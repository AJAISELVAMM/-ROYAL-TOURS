"""Train the Random Forest safety classifier (offline).

Target: safetyLevel in {SAFE, MODERATE, HIGH_RISK}. Same reproducible pipeline
as fare (one-hot + RF + grid search + 5-fold stratified CV). Monitors HIGH_RISK
recall specifically. Saves model + report under ml/models/safety_model_v1/.
"""

import json
import os

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix, f1_score,
    precision_score, recall_score,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from common import SEED, save_json, now_iso

MODEL_DIR = "ml/models/safety_model_v1"
MODEL_KEY = "safety_model_v1"

CATEGORICAL = ["timeOfDay", "dayOfWeek", "crowdDensity", "transportAvailability"]
NUMERICAL = [
    "latitude", "longitude", "policeDistanceKm", "hospitalDistanceKm",
    "fireStationDistanceKm", "emergencyResponseDistanceKm", "incidentCount",
    "crimeReports", "touristReports", "lightingScore",
]
FEATURES = CATEGORICAL + NUMERICAL


def main():
    df = pd.read_csv(f"{MODEL_DIR}/safety_dataset.csv")
    X = df[FEATURES]
    y = df["safetyLevel"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=SEED, stratify=y
    )

    preprocessor = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
        ("num", "passthrough", NUMERICAL),
    ])

    pipeline = Pipeline([
        ("prep", preprocessor),
        ("clf", RandomForestClassifier(random_state=SEED, class_weight="balanced", n_jobs=-1)),
    ])

    param_grid = {
        "clf__n_estimators": [200, 300],
        "clf__max_depth": [None, 12, 20],
        "clf__min_samples_leaf": [1, 2],
    }
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    grid = GridSearchCV(pipeline, param_grid, cv=cv, scoring="f1_weighted", n_jobs=-1)
    grid.fit(X_train, y_train)

    model = grid.best_estimator_
    y_pred = model.predict(X_test)

    classes = sorted(y.unique())
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_test, y_pred, labels=classes).tolist()

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision_weighted": round(precision_score(y_test, y_pred, average="weighted", zero_division=0), 4),
        "recall_weighted": round(recall_score(y_test, y_pred, average="weighted", zero_division=0), 4),
        "f1_weighted": round(f1_score(y_test, y_pred, average="weighted", zero_division=0), 4),
        "high_risk_recall": round(report.get("HIGH_RISK", {}).get("recall", 0.0), 4),
        "per_class": {c: {
            "precision": round(report[c]["precision"], 4),
            "recall": round(report[c]["recall"], 4),
            "f1": round(report[c]["f1-score"], 4),
        } for c in classes},
        "confusion_matrix": cm,
    }

    rf = model.named_steps["clf"]
    cat_names = list(model.named_steps["prep"].named_transformers_["cat"].get_feature_names_out(CATEGORICAL))
    all_names = cat_names + NUMERICAL
    importance = sorted(
        zip(all_names, rf.feature_importances_.tolist()), key=lambda x: -x[1]
    )[:10]

    report_json = {
        "modelKey": MODEL_KEY,
        "algorithm": "RandomForestClassifier",
        "trainingTimestamp": now_iso(),
        "datasetSource": "synthetic",
        "datasetVersion": "v1",
        "datasetSize": int(len(df)),
        "trainSize": int(len(X_train)),
        "testSize": int(len(X_test)),
        "features": FEATURES,
        "hyperparameters": grid.best_params_,
        "cv": {"folds": 5, "bestF1Weighted": round(grid.best_score_, 4)},
        "metrics": metrics,
        "featureImportance": importance,
    }

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, f"{MODEL_DIR}/pipeline.joblib")
    save_json(f"{MODEL_DIR}/safety_model_report.json", report_json)
    save_json(f"{MODEL_DIR}/metadata.json", {
        "modelKey": MODEL_KEY,
        "version": "1.0.0",
        "trainingDate": report_json["trainingTimestamp"],
        "datasetVersion": report_json["datasetVersion"],
        "datasetSource": report_json["datasetSource"],
        "features": FEATURES,
        "classes": classes,
    })

    print(json.dumps({
        "best_params": grid.best_params_,
        "cv_f1_weighted": round(grid.best_score_, 4),
        "test_accuracy": metrics["accuracy"],
        "high_risk_recall": metrics["high_risk_recall"],
        "confusion_matrix": cm,
    }, indent=2))


if __name__ == "__main__":
    main()
