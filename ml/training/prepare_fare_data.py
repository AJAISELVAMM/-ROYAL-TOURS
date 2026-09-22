"""Generate the (synthetic) fair-fare training dataset.

The label `fareStatus` is derived from the transparent baseline:
    expected = (baseFare + distance*perKm + duration*perMin) * surge
and the quoted fare compared against FAIR/OVERCHARGE thresholds, with a small
amount of noise so the model has a real (not fabricated) generalisation task.

`tripId` is included ONLY as an opaque row identifier and is never a feature.
No post-trip information (e.g. actualFare) exists in the features -> no leakage.
"""

import pandas as pd
import numpy as np

from common import (
    SEED, VEHICLE_FARES, FAIR_MAX_RATIO, HIGH_MIN_RATIO,
    TIME_OF_DAY, DAY_OF_WEEK, TRAFFIC_LEVEL, WEATHER,
)

rng = np.random.default_rng(SEED)
N = 12000


def fare_status(expected, quoted):
    if quoted > expected * HIGH_MIN_RATIO:
        return "OVERCHARGED"
    if quoted > expected * FAIR_MAX_RATIO:
        return "SLIGHTLY_HIGH"
    return "FAIR"


def main():
    rows = []
    for i in range(N):
        vehicle = rng.choice(list(VEHICLE_FARES.keys()))
        cfg = VEHICLE_FARES[vehicle]

        distance = round(float(rng.uniform(1.0, 22.0)), 2)
        # Duration correlates with distance + traffic noise.
        traffic = rng.choice(TRAFFIC_LEVEL, p=[0.3, 0.5, 0.2])
        base_speed = rng.uniform(18, 32)
        duration = max(3, round(distance / base_speed * 60 + rng.normal(0, 4)))

        surge = float(rng.choice([1.0, 1.0, 1.0, 1.1, 1.2, 1.3, 1.5], p=[0.55, 0.1, 0.05, 0.1, 0.1, 0.05, 0.05]))

        expected = (cfg["baseFare"] + distance * cfg["perKmRate"] + duration * cfg["perMinuteRate"]) * surge
        expected = max(cfg["minimum"], expected)

        # Draw a quoted fare: mostly fair, sometimes inflated (overcharge),
        # with small noise so the boundary is not perfectly crisp.
        scenario = rng.choice(["fair", "fair", "slight", "slight", "over"], p=[0.5, 0.1, 0.15, 0.05, 0.2])
        if scenario == "fair":
            quoted = expected * float(rng.uniform(0.85, 1.08))
        elif scenario == "slight":
            quoted = expected * float(rng.uniform(1.08, 1.32))
        else:
            quoted = expected * float(rng.uniform(1.30, 2.2))
        quoted = round(max(0, quoted), 0)

        # ~3% label noise: driver-specific context can shift perception.
        if rng.random() < 0.03:
            quoted = expected * float(rng.uniform(0.9, 1.4))

        status = fare_status(expected, quoted)

        rows.append({
            "tripId": f"synthetic-{i:06d}",
            "city": rng.choice(["Chennai", "Coimbatore", "Madurai", "Bengaluru"]),
            "vehicleType": vehicle,
            "distanceKm": distance,
            "durationMinutes": duration,
            "timeOfDay": rng.choice(TIME_OF_DAY),
            "dayOfWeek": rng.choice(DAY_OF_WEEK),
            "trafficLevel": traffic,
            "weatherCondition": rng.choice(WEATHER),
            "baseFare": cfg["baseFare"],
            "perKmRate": cfg["perKmRate"],
            "perMinuteRate": cfg["perMinuteRate"],
            "surgeMultiplier": surge,
            "quotedFare": quoted,
            "expectedFare": round(expected, 2),
            "overchargePercentage": round((quoted - expected) / expected * 100, 2) if expected else 0.0,
            "fareStatus": status,
            "datasetSource": "synthetic",
        })

    df = pd.DataFrame(rows)
    out = "ml/models/fare_model_v1/fare_dataset.csv"
    df.to_csv(out, index=False)
    print(f"Wrote {len(df)} rows -> {out}")
    print(df["fareStatus"].value_counts().to_string())


if __name__ == "__main__":
    main()
