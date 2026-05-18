from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.db import execute, fetch_all, fetch_one, get_conn
from app.detection import LEVEL_RANK, confidence, evaluate_sensor
from psycopg.types.json import Json


def row_to_feature(row: dict, geometry_key: str = "geometry") -> dict[str, Any]:
    result = dict(row)
    result[geometry_key] = row.get(geometry_key)
    return result


def latest_config() -> dict:
    return fetch_one("SELECT * FROM threshold_configs ORDER BY updated_at DESC LIMIT 1") or {}


def get_sensors() -> list[dict]:
    return fetch_all(
        """
        SELECT id, code, name, is_primary, status, last_seen,
               ST_AsGeoJSON(location::geometry)::json AS geometry
        FROM sensors ORDER BY code
        """
    )


def get_latest_samples(sensor_id: str, limit: int = 300) -> list[dict]:
    return fetch_all(
        """
        SELECT sensor_id, measured_at, water_level_cm, quality
        FROM sensor_readings
        WHERE sensor_id = %s
        ORDER BY measured_at DESC
        LIMIT %s
        """,
        (sensor_id, limit),
    )


def detection_status() -> dict:
    config = latest_config()
    results = [evaluate_sensor(sensor, get_latest_samples(str(sensor["id"])), config).__dict__ for sensor in get_sensors()]
    active_results = [item for item in results if item["quality"] != "offline"]
    highest = max(active_results or results, key=lambda item: LEVEL_RANK[item["level"]], default=None)
    if highest is None:
        return {"level": "NORMAL", "confidence": 0, "sensors": [], "confirmedSensors": 0}
    level = highest["level"]
    confirming = [item for item in active_results if LEVEL_RANK[item["level"]] >= max(1, LEVEL_RANK[level] - 1)]
    max_delta = max((abs(item["delta_3m"]) for item in active_results), default=0)
    max_rate = max((abs(item["rate_cm_per_minute"]) for item in active_results), default=0)
    max_z = max((abs(item["z_score"]) for item in active_results), default=0)
    score = confidence(level, len(confirming), max_delta, max_rate, max_z)
    return {
        "level": level,
        "confidence": score,
        "sensors": results,
        "confirmedSensors": len(confirming),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "locationName": "Panjang, Lampung",
    }


def ensure_alert_and_siren(status: dict) -> dict:
    if status["level"] not in ("WASPADA", "SIAGA", "AWAS"):
        return status
    active = fetch_one("SELECT * FROM alerts WHERE status='active' ORDER BY created_at DESC LIMIT 1")
    if not active or LEVEL_RANK[status["level"]] > LEVEL_RANK[active["level"]]:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO alerts (level, title, message, confidence, location_name)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        status["level"],
                        f"Alert {status['level']} - Anomali Muka Air Laut",
                        "Kondisi muka air laut abnormal terdeteksi. Ikuti prosedur evakuasi.",
                        status["confidence"],
                        status["locationName"],
                    ),
                )
                alert_id = cur.fetchone()["id"]
                for item in status["sensors"]:
                    if LEVEL_RANK[item["level"]] >= 1:
                        cur.execute(
                            """
                            INSERT INTO alert_sensor_evidence (alert_id, sensor_id, delta_3m, rate_cm_per_minute, z_score)
                            VALUES (%s, %s, %s, %s, %s)
                            """,
                            (alert_id, item["sensor_id"], item["delta_3m"], item["rate_cm_per_minute"], item["z_score"]),
                        )
                cur.execute(
                    """
                    INSERT INTO audit_logs (actor, action, entity, new_value, reason)
                    VALUES ('system', 'CREATE_ALERT', 'alerts', %s, 'automatic anomaly detection')
                    """,
                    (Json({"alert_id": str(alert_id), "level": status["level"], "confidence": status["confidence"]}),),
                )
            conn.commit()
    if status["level"] == "AWAS" and status["confidence"] >= int(latest_config()["min_confidence_auto_siren"]):
        activate_all_sirens("system", "automatic AWAS alert")
    return status


def activate_all_sirens(actor: str, reason: str) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, active FROM sirens")
            sirens = cur.fetchall()
            for siren in sirens:
                if not siren["active"]:
                    cur.execute("UPDATE sirens SET active=true, last_event_at=now() WHERE id=%s", (siren["id"],))
                    cur.execute(
                        "INSERT INTO siren_events (siren_id, action, reason, success) VALUES (%s, 'ON', %s, true)",
                        (siren["id"], reason),
                    )
            cur.execute(
                "INSERT INTO audit_logs (actor, action, entity, new_value, reason) VALUES (%s, 'SIREN_ON', 'sirens', %s, %s)",
                (actor, Json({"active": True}), reason),
            )
        conn.commit()


def deactivate_all_sirens(actor: str, reason: str, pin: str) -> bool:
    user = fetch_one("SELECT * FROM users WHERE username=%s AND role IN ('supervisor','admin')", (actor,))
    if not user or user["pin_hash"] != pin:
        return False
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM sirens WHERE active=true")
            sirens = cur.fetchall()
            for siren in sirens:
                cur.execute("UPDATE sirens SET active=false, last_event_at=now() WHERE id=%s", (siren["id"],))
                cur.execute("INSERT INTO siren_events (siren_id, action, reason, success) VALUES (%s, 'OFF', %s, true)", (siren["id"], reason))
            cur.execute(
                "INSERT INTO audit_logs (actor, action, entity, old_value, new_value, reason) VALUES (%s, 'SIREN_OFF_2STEP', 'sirens', %s, %s, %s)",
                (actor, Json({"active": True}), Json({"active": False}), reason),
            )
        conn.commit()
    return True


def insert_simulated_readings(offset_cm: float, quality: str = "good") -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM sensors WHERE status <> 'offline'")
            sensors = cur.fetchall()
            for index, sensor in enumerate(sensors):
                value = 95 + offset_cm + index * 4
                cur.execute(
                    """
                    INSERT INTO sensor_readings (sensor_id, water_level_cm, quality, source)
                    VALUES (%s, %s, %s, 'simulation')
                    """,
                    (sensor["id"], value, quality),
                )
                cur.execute("UPDATE sensors SET last_seen=now(), status='online' WHERE id=%s", (sensor["id"],))
        conn.commit()


def map_layers() -> dict:
    return {
        "center": [-5.468, 105.322],
        "zoom": 13,
        "sensors": get_sensors(),
        "sirens": fetch_all("SELECT id, code, name, status, active, radius_m, ST_AsGeoJSON(location::geometry)::json AS geometry FROM sirens ORDER BY code"),
        "facilities": fetch_all("SELECT id, type, name, status, capacity, ST_AsGeoJSON(location::geometry)::json AS geometry FROM facilities ORDER BY type, name"),
        "heavyEquipment": fetch_all("SELECT id, type, name, status, ST_AsGeoJSON(location::geometry)::json AS geometry FROM heavy_equipment ORDER BY name"),
        "routes": fetch_all("SELECT id, name, status, density, ST_AsGeoJSON(path::geometry)::json AS geometry FROM evacuation_routes ORDER BY name"),
        "safeZones": fetch_all("SELECT id, name, capacity, occupancy, ST_AsGeoJSON(area::geometry)::json AS geometry FROM safe_zones ORDER BY name"),
        "inundationZones": fetch_all("SELECT id, name, risk, ST_AsGeoJSON(area::geometry)::json AS geometry FROM inundation_zones ORDER BY name"),
    }


def active_alerts() -> list[dict]:
    return fetch_all("SELECT * FROM alerts WHERE status='active' ORDER BY created_at DESC")


def recent_audit() -> list[dict]:
    return fetch_all("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100")


def siren_status() -> list[dict]:
    return fetch_all("SELECT id, code, name, status, active, radius_m, last_event_at FROM sirens ORDER BY code")


def history() -> dict:
    return {
        "alerts": fetch_all("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50"),
        "sirenEvents": fetch_all("SELECT e.*, s.code FROM siren_events e JOIN sirens s ON s.id=e.siren_id ORDER BY e.created_at DESC LIMIT 50"),
        "sensorReadings": fetch_all(
            """
            SELECT r.measured_at, r.water_level_cm, r.quality, s.code
            FROM sensor_readings r JOIN sensors s ON s.id=r.sensor_id
            ORDER BY r.measured_at DESC LIMIT 100
            """
        ),
    }
