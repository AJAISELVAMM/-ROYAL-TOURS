# TourGuard AI — Model Training

Offline training pipeline for the two Random Forest classifiers served by the
ML inference service (`../ml_service`). Models are trained **offline** and only
inference happens at runtime — they are never retrained per API request.

## Layout
```
ml/
  training/                 # scripts (reproducible, seed=42)
    common.py               # shared config + helpers
    prepare_fare_data.py    # -> models/fare_model_v1/fare_dataset.csv
    train_fare_model.py     # -> pipeline.joblib + *_report.json + metadata.json
    prepare_safety_data.py  # -> models/safety_model_v1/safety_dataset.csv
    train_safety_model.py
    evaluate_models.py      # re-run hold-out evaluation
  models/
    fare_model_v1/          # dataset + trained pipeline + report
    safety_model_v1/
```

## Run (from the repo root)
```bash
pip install -r ../ml_service/requirements.txt

PYTHONPATH=ml/training python3 ml/training/prepare_fare_data.py
PYTHONPATH=ml/training python3 ml/training/train_fare_model.py
PYTHONPATH=ml/training python3 ml/training/prepare_safety_data.py
PYTHONPATH=ml/training python3 ml/training/train_safety_model.py
PYTHONPATH=ml/training python3 ml/training/evaluate_models.py
```

Then register the models in the backend DB so the admin AI page shows them:
```bash
cd ../backend && npm run models:register
```

## Data honesty
- Every row carries `datasetSource="synthetic"`; the datasets are clearly
  labelled and never presented as real tourist data.
- `tripId` is an opaque identifier, never a predictive feature.
- No post-trip / future information is used as input (no target leakage).
- Replace the CSVs with real historical data to retrain without code changes.

## Model versioning
`fare_model_v1` / `safety_model_v1`. Never overwrite a production model
blindly — bump the version and register the new directory.
