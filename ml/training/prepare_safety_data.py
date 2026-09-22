"""Generate the (synthetic) safety training dataset.

Target: safetyLevel in {SAFE, MODERATE, HIGH_RISK}, derived from an explainable
weighted-risk rule with noise. All inputs are pre-trip / at-location context
only — no future information, so there is no target leakage.

Every row carries datasetSource="synthetic".
"""

import numpy as np
import pandas as pd

from common import SEED, TIME_OF_DAY, DAY_OF_WEEK, CROWD, TRANSPORT

rng = np.random.default_rng(SEED)
N = 12000

# Chennai-ish bounding box for varied, plausible coordinates.
LAT_MIN, LAT_MAX = 12.8, 13.3
LON_MIN, LON_MAX = 80.0, 80.4


def safety_level(score):
    if score >= 75:
        return "SAFE"
    if score >= 50:
        return "MODERATE"
    return "HIGH_RISK"


def main():
    rows = []
    # Scenario-driven generation => correlated, realistic, balanced classes.
    for i in range(N):
        lat = round(float(rng.uniform(LAT_MIN, LAT_MAX)), 5)
        lon = round(float(rng.uniform(LON_MIN, LON_MAX)), 5)

        scenario = rng.choice(["safe", "moderate", "dangerous"], p=[0.30, 0.45, 0.25])

        if scenario == "safe":
            police = round(float(rng.uniform(0.1, 2.0)), 2)
            hospital = round(float(rng.uniform(0.1, 2.5)), 2)
            fire = round(float(rng.uniform(0.2, 3.0)), 2)
            emergency_response = round(float(rng.uniform(0.5, 4.0)), 2)
            incident_count = int(rng.exponential(0.4))
            crime_reports = int(rng.exponential(0.3))
            tourist_reports = int(rng.exponential(0.2))
            lighting = int(rng.integers(70, 100))
            crowd = rng.choice(["NORMAL", "HIGH", "NORMAL"], p=[0.6, 0.3, 0.1])
            transport = rng.choice(["HIGH", "MODERATE", "MODERATE"])
            time_of_day = rng.choice(["MORNING", "DAY", "DAY", "EVENING"])
        elif scenario == "dangerous":
            police = round(float(rng.uniform(4.0, 14.0)), 2)
            hospital = round(float(rng.uniform(4.0, 14.0)), 2)
            fire = round(float(rng.uniform(5.0, 16.0)), 2)
            emergency_response = round(float(rng.uniform(8.0, 24.0)), 2)
            incident_count = int(rng.exponential(6.0))
            crime_reports = int(rng.exponential(4.0))
            tourist_reports = int(rng.exponential(2.0))
            lighting = int(rng.integers(5, 40))
            crowd = rng.choice(["DESERTED", "LOW", "DESERTED"])
            transport = rng.choice(["LOW", "LOW", "MODERATE"])
            time_of_day = rng.choice(["NIGHT", "NIGHT", "EVENING", "DAY"])
        else:
            police = round(float(rng.uniform(1.5, 6.0)), 2)
            hospital = round(float(rng.uniform(1.5, 7.0)), 2)
            fire = round(float(rng.uniform(2.0, 8.0)), 2)
            emergency_response = round(float(rng.uniform(3.0, 12.0)), 2)
            incident_count = int(rng.exponential(2.0))
            crime_reports = int(rng.exponential(1.2))
            tourist_reports = int(rng.exponential(0.6))
            lighting = int(rng.integers(35, 80))
            crowd = rng.choice(["NORMAL", "NORMAL", "LOW", "HIGH"])
            transport = rng.choice(["MODERATE", "HIGH", "LOW"])
            time_of_day = rng.choice(TIME_OF_DAY)

        day_of_week = rng.choice(DAY_OF_WEEK)

        # Weighted risk score (mirrors backend safetyScoreEngine weights).
        def prox(km):
            return max(0, min(100, (1 - (km - 0.5) / (15 - 0.5)) * 100))

        police_score = prox(police)
        hospital_score = prox(hospital)
        fire_score = prox(fire)
        emergency_access = (police_score + hospital_score + fire_score) / 3
        incidents = max(0, min(100, 100 - (incident_count + crime_reports + tourist_reports) / 10 * 100))
        time_risk = {"MORNING": 85, "DAY": 85, "EVENING": 65, "NIGHT": 35}[time_of_day]
        crowd_score = {"LOW": 45, "DESERTED": 45, "NORMAL": 85, "HIGH": 70}[crowd]
        transport_score = {"LOW": 40, "MODERATE": 70, "HIGH": 90}[transport]

        score = (
            0.30 * incidents
            + 0.20 * emergency_access
            + 0.15 * police_score
            + 0.10 * hospital_score
            + 0.10 * lighting
            + 0.05 * crowd_score
            + 0.05 * transport_score
            + 0.05 * time_risk
        )
        # Noise so the boundary is learnable but not perfectly crisp.
        score += float(rng.normal(0, 4))
        score = max(0, min(100, score))

        rows.append({
            "latitude": lat,
            "longitude": lon,
            "timeOfDay": time_of_day,
            "dayOfWeek": day_of_week,
            "policeDistanceKm": police,
            "hospitalDistanceKm": hospital,
            "fireStationDistanceKm": fire,
            "emergencyResponseDistanceKm": emergency_response,
            "incidentCount": incident_count,
            "crimeReports": crime_reports,
            "touristReports": tourist_reports,
            "lightingScore": lighting,
            "crowdDensity": crowd,
            "transportAvailability": transport,
            "safetyLevel": safety_level(score),
            "datasetSource": "synthetic",
        })

    df = pd.DataFrame(rows)
    out = "ml/models/safety_model_v1/safety_dataset.csv"
    df.to_csv(out, index=False)
    print(f"Wrote {len(df)} rows -> {out}")
    print(df["safetyLevel"].value_counts().to_string())


if __name__ == "__main__":
    main()
