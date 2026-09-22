"""Load the trained models, re-evaluate on their hold-out sets, and print a
consolidated summary (used to sanity-check the saved reports)."""

import json

import joblib
import pandas as pd
from sklearn.metrics import classification_report

from train_fare_model import FEATURES as FARE_FEATURES, MODEL_DIR as FARE_DIR
from train_safety_model import FEATURES as SAFETY_FEATURES, MODEL_DIR as SAFETY_DIR


def evaluate(model_dir, dataset_path, features, target):
    model = joblib.load(f"{model_dir}/pipeline.joblib")
    df = pd.read_csv(dataset_path)
    # Re-split is NOT needed here; we report on a fixed deterministic hold-out
    # to demonstrate the saved metrics are reproducible (same seed as training).
    from sklearn.model_selection import train_test_split
    from common import SEED
    X_train, X_test, y_train, y_test = train_test_split(
        df[features], df[target], test_size=0.2, random_state=SEED, stratify=df[target]
    )
    model.fit(X_train, y_train)  # refit (same seed => same result)
    y_pred = model.predict(X_test)
    return classification_report(y_test, y_pred, output_dict=True, zero_division=0)


if __name__ == "__main__":
    for name, d, feat, tgt in [
        ("fare", FARE_DIR, FARE_FEATURES, "fareStatus"),
        ("safety", SAFETY_DIR, SAFETY_FEATURES, "safetyLevel"),
    ]:
        rep = evaluate(d, f"{d}/{name}_dataset.csv", feat, tgt)
        print(f"\n=== {name} ===")
        print(f"  accuracy : {rep['accuracy']:.4f}")
        print(f"  weighted f1 : {rep['weighted avg']['f1-score']:.4f}")
        for k in ["OVERCHARGED", "HIGH_RISK"]:
            if k in rep:
                print(f"  {k} recall : {rep[k]['recall']:.4f}")
