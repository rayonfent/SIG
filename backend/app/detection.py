from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import median, pstdev


LEVEL_RANK = {"NORMAL": 0, "SUSPECT": 1, "WASPADA": 2, "SIAGA": 3, "AWAS": 4}


@dataclass
class DetectionResult:
    sensor_id: str
    sensor_code: str
    sensor_name: str
    level: str
    water_level_cm: float
    smoothed_cm: float
    baseline_cm: float
    delta_1m: float
    delta_3m: float
    delta_5m: float
    rate_cm_per_minute: float
    z_score: float
    quality: str
    last_seen: str


def moving_median(values: list[float], window: int = 5) -> float:
    if not values:
        return 0.0
    return float(median(values[:window]))


def nearest_delta(current: float, samples: list[dict], seconds: int) -> float:
    if not samples:
        return 0.0
    now = samples[0]["measured_at"]
    target = now.timestamp() - seconds
    closest = min(samples, key=lambda sample: abs(sample["measured_at"].timestamp() - target))
    return current - float(closest["water_level_cm"])


def classify(delta_3m: float, rate: float, z_score: float, config: dict) -> str:
    abs_delta = abs(delta_3m)
    abs_rate = abs(rate)
    abs_z = abs(z_score)
    if abs_delta >= float(config["awas_delta_3m"]) or abs_rate >= float(config["awas_rate"]) or abs_z >= float(config["awas_z"]):
        return "AWAS"
    if abs_delta >= float(config["siaga_delta_3m"]) or abs_rate >= float(config["siaga_rate"]) or abs_z >= float(config["siaga_z"]):
        return "SIAGA"
    if abs_delta >= float(config["waspada_delta_3m"]) or abs_rate >= float(config["waspada_rate"]) or abs_z >= float(config["waspada_z"]):
        return "WASPADA"
    if abs_delta >= float(config["suspect_delta_3m"]) or abs_z >= float(config["suspect_z"]):
        return "SUSPECT"
    return "NORMAL"


def confidence(level: str, confirmations: int, max_delta: float, max_rate: float, max_z: float) -> int:
    base = {"NORMAL": 10, "SUSPECT": 35, "WASPADA": 55, "SIAGA": 72, "AWAS": 82}[level]
    multi_sensor_bonus = 12 if confirmations >= 2 else 0
    intensity_bonus = min(16, int(abs(max_delta) / 10) + int(abs(max_rate) / 5) + int(abs(max_z) * 2))
    return max(0, min(100, base + multi_sensor_bonus + intensity_bonus))


def evaluate_sensor(sensor: dict, samples: list[dict], config: dict) -> DetectionResult:
    valid = [sample for sample in samples if sample["quality"] in ("good", "suspect")]
    if not valid:
        return DetectionResult(str(sensor["id"]), sensor["code"], sensor["name"], "NORMAL", 0, 0, 0, 0, 0, 0, 0, 0, "offline", datetime.now(timezone.utc).isoformat())

    levels = [float(sample["water_level_cm"]) for sample in valid]
    current = levels[0]
    smoothed = moving_median(levels, 5)
    baseline_values = levels[-270:] if len(levels) >= 5 else levels
    baseline = float(median(baseline_values))
    deviation = pstdev(baseline_values) if len(baseline_values) > 1 else 1.0
    deviation = max(deviation, 1.0)
    delta_1m = nearest_delta(smoothed, valid, 60)
    delta_3m = nearest_delta(smoothed, valid, 180)
    delta_5m = nearest_delta(smoothed, valid, 300)
    rate = delta_3m / 3
    z_score = (smoothed - baseline) / deviation
    level = classify(delta_3m, rate, z_score, config)

    last_seen = valid[0]["measured_at"]
    quality = valid[0]["quality"]
    if (datetime.now(timezone.utc) - last_seen).total_seconds() > 30:
        quality = "offline"

    return DetectionResult(
        str(sensor["id"]),
        sensor["code"],
        sensor["name"],
        level,
        round(current, 2),
        round(smoothed, 2),
        round(baseline, 2),
        round(delta_1m, 2),
        round(delta_3m, 2),
        round(delta_5m, 2),
        round(rate, 2),
        round(z_score, 2),
        quality,
        last_seen.isoformat(),
    )
