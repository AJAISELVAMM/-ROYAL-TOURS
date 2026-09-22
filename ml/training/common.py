"""Shared utilities for the TourGuard AI model training pipeline.

Every synthetic row is labelled datasetSource="synthetic" so it is NEVER
presented as real tourist data. Models are trained OFFLINE; only inference
happens at runtime. A fixed random seed makes the whole pipeline reproducible.
"""

import json
import os
from datetime import datetime, timezone

import numpy as np

SEED = 42
np.random.seed(SEED)

# ---------------------------------------------------------------------------
# Fare configuration (mirrors backend/src/intelligence/config.js defaults)
# ---------------------------------------------------------------------------
VEHICLE_FARES = {
    "AUTO": {"baseFare": 30, "perKmRate": 12, "perMinuteRate": 0, "minimum": 40},
    "TAXI": {"baseFare": 50, "perKmRate": 18, "perMinuteRate": 0, "minimum": 80},
    "BUS": {"baseFare": 10, "perKmRate": 2, "perMinuteRate": 0, "minimum": 10},
    "BIKE_TAXI": {"baseFare": 20, "perKmRate": 8, "perMinuteRate": 0, "minimum": 25},
}

FAIR_MAX_RATIO = 1.10
HIGH_MIN_RATIO = 1.30

TIME_OF_DAY = ["MORNING", "DAY", "EVENING", "NIGHT"]
DAY_OF_WEEK = ["WEEKDAY", "SATURDAY", "SUNDAY"]
TRAFFIC_LEVEL = ["LOW", "NORMAL", "HIGH"]
WEATHER = ["CLEAR", "RAIN", "HOT", "COLD"]

CROWD = ["LOW", "NORMAL", "HIGH", "DESERTED"]
TRANSPORT = ["LOW", "MODERATE", "HIGH"]

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2, default=str)


def load_json(path):
    with open(path) as f:
        return json.load(f)
