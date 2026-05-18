from __future__ import annotations

import asyncio
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.db import execute, fetch_all, fetch_one
from app.services import (
    active_alerts,
    deactivate_all_sirens,
    detection_status,
    ensure_alert_and_siren,
    history,
    insert_simulated_readings,
    map_layers,
    recent_audit,
    siren_status,
)
from psycopg.types.json import Json

app = FastAPI(title="SIG-Pantau Tsunami API", version="1.0.0")

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def json_safe(value: Any) -> Any:
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    return value


class LoginRequest(BaseModel):
    username: str
    pin: str


class SimulationUpdate(BaseModel):
    scenario: str = "manual"
    waterOffsetCm: float = 0
    quality: str = "good"


class SirenOffRequest(BaseModel):
    actor: str
    pin: str
    reason: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    user = fetch_one("SELECT id, username, full_name, role, pin_hash FROM users WHERE username=%s", (payload.username,))
    if not user or user["pin_hash"] != payload.pin:
        raise HTTPException(status_code=401, detail="PIN atau username salah")
    return {"id": str(user["id"]), "username": user["username"], "fullName": user["full_name"], "role": user["role"]}


@app.get("/auth/me")
def me() -> dict[str, str]:
    return {"username": "operator", "role": "operator", "mode": "local-demo"}


@app.get("/map/config")
def get_map_config() -> dict:
    return map_layers()


@app.get("/map/layers/status")
def layer_status() -> dict:
    layers = map_layers()
    return {key: len(value) if isinstance(value, list) else value for key, value in layers.items()}


@app.get("/sensors")
def sensors() -> list[dict]:
    return map_layers()["sensors"]


@app.get("/sensors/readings")
def sensor_readings() -> list[dict]:
    return history()["sensorReadings"]


@app.get("/detection/status")
def detection() -> dict:
    return ensure_alert_and_siren(detection_status())


@app.get("/detection/rules")
def rules() -> dict:
    return fetch_one("SELECT * FROM threshold_configs ORDER BY updated_at DESC LIMIT 1") or {}


@app.post("/detection/recalculate")
def recalculate() -> dict:
    return ensure_alert_and_siren(detection_status())


@app.get("/alerts/active")
def alerts_active() -> list[dict]:
    return active_alerts()


@app.get("/alerts")
def alerts() -> list[dict]:
    return history()["alerts"]


@app.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, payload: SirenOffRequest) -> dict:
    ok = deactivate_all_sirens(payload.actor, payload.reason, payload.pin)
    if not ok:
        raise HTTPException(status_code=403, detail="Butuh PIN supervisor/admin")
    execute("UPDATE alerts SET status='resolved', resolved_at=now() WHERE id=%s", (alert_id,))
    execute(
        "INSERT INTO audit_logs (actor, action, entity, new_value, reason) VALUES (%s, 'RESOLVE_ALERT_2STEP', 'alerts', %s, %s)",
        (payload.actor, Json({"alert_id": alert_id}), payload.reason),
    )
    return {"ok": True}


@app.get("/sirens")
def sirens() -> list[dict]:
    return siren_status()


@app.post("/sirens/off")
def sirens_off(payload: SirenOffRequest) -> dict:
    ok = deactivate_all_sirens(payload.actor, payload.reason, payload.pin)
    if not ok:
        raise HTTPException(status_code=403, detail="Butuh PIN supervisor/admin")
    return {"ok": True}


@app.get("/evacuation/routes")
def evacuation_routes() -> list[dict]:
    return map_layers()["routes"]


@app.get("/evacuation/safe-zones")
def evacuation_safe_zones() -> list[dict]:
    return map_layers()["safeZones"]


@app.get("/evacuation/recommended")
def recommended_evacuation() -> dict:
    layers = map_layers()
    route = sorted(layers["routes"], key=lambda item: item["density"])[0]
    zone = sorted(layers["safeZones"], key=lambda item: item["occupancy"] / item["capacity"])[0]
    return {"route": route, "safeZone": zone}


@app.get("/facilities")
def facilities() -> list[dict]:
    return map_layers()["facilities"]


@app.get("/devices/status")
def devices_status() -> dict:
    layers = map_layers()
    return {"sensors": layers["sensors"], "sirens": layers["sirens"], "facilities": layers["facilities"]}


@app.post("/simulation/start")
def simulation_start(payload: SimulationUpdate) -> dict:
    execute("UPDATE simulation_sessions SET mode='simulation', scenario=%s, water_offset_cm=%s, active=true, updated_at=now()", (payload.scenario, payload.waterOffsetCm))
    insert_simulated_readings(payload.waterOffsetCm, payload.quality)
    return ensure_alert_and_siren(detection_status())


@app.post("/simulation/update")
def simulation_update(payload: SimulationUpdate) -> dict:
    execute("UPDATE simulation_sessions SET mode='simulation', scenario=%s, water_offset_cm=%s, active=true, updated_at=now()", (payload.scenario, payload.waterOffsetCm))
    insert_simulated_readings(payload.waterOffsetCm, payload.quality)
    return ensure_alert_and_siren(detection_status())


@app.post("/simulation/stop")
def simulation_stop() -> dict:
    execute("UPDATE simulation_sessions SET mode='live', scenario=NULL, water_offset_cm=0, active=false, updated_at=now()")
    return {"ok": True}


@app.get("/simulation/status")
def simulation_status() -> dict:
    return fetch_one("SELECT * FROM simulation_sessions ORDER BY updated_at DESC LIMIT 1") or {}


@app.get("/history")
def history_endpoint() -> dict:
    return history()


@app.get("/audit/logs")
def audit_logs() -> list[dict]:
    return recent_audit()


@app.get("/reports/daily")
def daily_report() -> dict:
    status = detection_status()
    return {"title": "Laporan Harian SIG-Pantau Tsunami", "status": status, "alerts": history()["alerts"][:10], "devices": devices_status()}


async def realtime_payload() -> dict:
    status = ensure_alert_and_siren(detection_status())
    return json_safe({
        "type": "snapshot",
        "detection": status,
        "alerts": active_alerts(),
        "sirens": siren_status(),
        "map": map_layers(),
        "simulation": fetch_one("SELECT * FROM simulation_sessions ORDER BY updated_at DESC LIMIT 1") or {},
    })


@app.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(await realtime_payload())
            await asyncio.sleep(10)
    except WebSocketDisconnect:
        return
