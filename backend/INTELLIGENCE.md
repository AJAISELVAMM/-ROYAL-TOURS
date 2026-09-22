# TourGuard AI — Intelligence Layer

This document describes the **intelligence layer** added on top of the existing
TourGuard AI backend. It integrates six intelligence components (route
optimization, fair-fare detection, place recommendation, safety scoring, nearest
emergency service, and AI packing) with the existing Express/Prisma/Socket.IO
architecture **without redesigning the UI or removing working functionality**.

> **Honest labelling.** A* and Haversine are deterministic algorithms (NOT
> trained ML models). Weighted recommendation and the weighted safety score are
> deterministic weighted-scoring algorithms (NOT automatically ML). The
> **Random Forest** fare and safety classifiers ARE trained ML models. Packing
> is a **context-aware rules engine**. These labels are used consistently in
> the UI and API responses (`method` fields).

---

## A. Files created

### Intelligence layer (`backend/src/intelligence/`)
| File | Purpose |
| --- | --- |
| `config.js` | Central thresholds/weights (fare, recommendation, safety, routing, ML URL) — env-overridable |
| `geo/haversine.js` | Haversine distance + bearing + coordinate validation |
| `geo/nearestService.js` | Nearest emergency service (DB `EmergencyService`) via Haversine |
| `route/astRouter.js` | A* path-finding (`f(n)=g(n)+h(n)`) over a node/edge graph |
| `fare/fareEngine.js` | Transparent rule-based fare baseline + verdict |
| `fare/farePredictionService.js` | Hybrid: Random Forest (via ML service) + rule fallback |
| `recommendation/recommendationEngine.js` | Weighted place recommendation + travel-type personalisation |
| `safety/safetyScoreEngine.js` | Weighted safety risk score (0–100) + level bands + risk factors |
| `safety/safetyPredictionService.js` | Hybrid: Random Forest + weighted-score fallback |
| `packing/packingEngine.js` | Context-aware day-wise packing rules (ESSENTIAL/RECOMMENDED/OPTIONAL) |
| `trip/itineraryOptimizer.js` | Distribute + nearest-neighbour-order selected places, time/cost estimates |
| `ml/client.js` | HTTP client for the optional ML inference service |

### Backend API
- `src/controllers/intelligenceController.js`
- `src/routes/intelligenceRoutes.js`

### ML (Python) — training + inference
- `ml/training/common.py` — shared config/seed/helpers
- `ml/training/prepare_fare_data.py`, `train_fare_model.py`
- `ml/training/prepare_safety_data.py`, `train_safety_model.py`
- `ml/training/evaluate_models.py`
- `ml/models/fare_model_v1/` — `fare_dataset.csv`, `pipeline.joblib`, `metadata.json`, `fare_model_report.json`
- `ml/models/safety_model_v1/` — `safety_dataset.csv`, `pipeline.joblib`, `metadata.json`, `safety_model_report.json`
- `ml_service/app.py`, `ml_service/requirements.txt`

### Tests
- `tests/intelligence.test.js` (33 tests — engines + API)

## B. Files modified
- `src/app.js` — mounted `/api/intelligence`
- `src/config/env.js` — added `mlServiceUrl`
- `src/middleware/rateLimitMiddleware.js` — added `intelligenceLimiter`
- `src/services/tripService.js` — itinerary/packing now delegate to the engines
- `src/services/adminService.js` — `getServiceStatus()` reports ML status
- `prisma/schema.prisma` — added `EmergencyService`, `IntelligenceModel`, `PredictionLog`, `IntelligenceFeedback`, `PackingItem.priority`, `EmergencyServiceType`/`FeedbackType`/`PredictionModel` enums
- `prisma/seed.js` — seeded geocoded emergency services + cleanup for new tables
- `prisma/registerModels.js` — NEW script that registers trained models into the DB
- `.env` / `.env.example` — `ML_SERVICE_URL` + tuning vars
- **Frontend**: `src/services/fareService.js`, `src/services/safetyService.js`, `src/services/adminService.js`, `src/services/transportService.js` (new), `src/pages/tourist/{FairFareView,TransportView,SafetyMapView}.jsx`, `src/pages/admin/AdminAI.jsx`, `src/styles.css`

## C. Algorithms implemented
| Algorithm | Type | Where |
| --- | --- | --- |
| A* (`f(n)=g(n)+h(n)`, Haversine heuristic) | deterministic search | `route/astRouter.js` |
| Haversine distance + bearing | deterministic geo | `geo/haversine.js` |
| Nearest-emergency (sort by Haversine) | deterministic geo | `geo/nearestService.js` |
| Fare baseline (`base + dist·perKm + dur·perMin`)·surge | rule-based | `fare/fareEngine.js` |
| Weighted recommendation (rating/safety/distance/budget/type/opening) | weighted scoring | `recommendation/recommendationEngine.js` |
| Weighted safety score (incident/emergency/proximity/lighting/crowd/transport/time) | weighted scoring | `safety/safetyScoreEngine.js` |
| Context-aware packing (activity + weather rules, dedupe, priority) | rules | `packing/packingEngine.js` |
| Itinerary distribution + nearest-neighbour ordering | deterministic | `trip/itineraryOptimizer.js` |
| Random Forest classifier (fareStatus) | **trained ML** | `ml/models/fare_model_v1` |
| Random Forest classifier (safetyLevel) | **trained ML** | `ml/models/safety_model_v1` |

## D. ML models trained
| Model | Algorithm | Target | Classes |
| --- | --- | --- | --- |
| `fare_model_v1` | RandomForestClassifier | `fareStatus` | FAIR / SLIGHTLY_HIGH / OVERCHARGED |
| `safety_model_v1` | RandomForestClassifier | `safetyLevel` | SAFE / MODERATE / HIGH_RISK |

Both use a `ColumnTransformer` (one-hot categoricals + passthrough numerics) →
`RandomForestClassifier`, `class_weight="balanced"`, 5-fold stratified CV,
grid search, fixed seed `42`.

## E. Dataset sources
- **Fare**: `ml/models/fare_model_v1/fare_dataset.csv` — 12,000 **synthetic** rows,
  each carrying `datasetSource="synthetic"`. The label is derived from the
  transparent baseline + thresholds, with a small noise component so the model
  has a genuine generalisation task. `tripId` is an opaque identifier, **never a
  feature**; no post-trip info (no leakage).
- **Safety**: `ml/models/safety_model_v1/safety_dataset.csv` — 12,000
  **synthetic** rows, scenario-driven (safe/moderate/dangerous) for realistic,
  correlated features. No future information in the inputs.

> The pipeline is designed so **real historical data can replace these CSVs**
> without code changes (`datasetSource` flips to `"real"`).

## F. Model evaluation metrics
**fare_model_v1** (hold-out 20%, stratified):
- Accuracy **0.7817**, weighted F1 **0.7539**
- **OVERCHARGED recall 0.6994**
- Confusion matrix (rows = true): `FAIR [1413, 5, 47]`, `SLIGHTLY_HIGH [98, 349, 62]`, `OVERCHARGED [266, 50, 110]`

**safety_model_v1** (hold-out 20%, stratified):
- Accuracy **0.8771**, weighted F1 **0.8776**
- **HIGH_RISK recall 0.9543** (the critical metric)
- Per-class: SAFE P/R/F1 0.925/0.882/0.903 · MODERATE 0.776/0.808/0.792 · HIGH_RISK 0.913/0.954/0.933

Full reports: `ml/models/*/  *_model_report.json` (accuracy, precision, recall,
F1, confusion matrix, feature importance, hyperparameters, timestamps).

## G. API endpoints
All under `/api/intelligence` (require a valid JWT unless noted):

| Method | Path | Description |
| --- | --- | --- |
| POST | `/fare/predict` | Hybrid fare prediction (RF + baseline) |
| POST | `/safety/predict` | Hybrid safety prediction (RF + weighted score + nearby services) |
| GET | `/recommendations?type=&location=&travelType=&budget=` | Weighted place ranking |
| GET | `/emergency/nearest?latitude=&longitude=&type=` | Haversine nearest services |
| POST | `/route` | A* (custom graph) or routing provider |
| POST | `/packing` | Context-aware day-wise packing |
| POST | `/trip/optimize` | Itinerary optimization |
| POST | `/feedback` | Record usefulness feedback |
| GET | `/models` | **Admin-only** model registry + ML health |

Existing endpoints are unchanged and still work (`/api/fare/check`,
`/api/safety/map`, `/api/emergency/nearest`, `/api/transport/routes`, …).

## H. Environment variables
| Var | Default | Purpose |
| --- | --- | --- |
| `ML_SERVICE_URL` | (empty) | ML inference service base URL; empty ⇒ fallback engines |
| `FARE_FAIR_MAX_RATIO` | 1.10 | FAIR upper ratio |
| `FARE_HIGH_MIN_RATIO` | 1.30 | OVERCHARGED lower ratio |
| `SAFETY_W_INCIDENT` … `SAFETY_W_TIME` | (see config) | Safety-score weights |
| `REC_WEIGHT_*` | (see config) | Recommendation weights |
| `EMERGENCY_SPEED_KMH` | 30 | ETA speed for nearest services |

## I–L. Commands
```bash
# Train the models (from the repo root, Python 3.10+ with scikit-learn)
pip install -r ml_service/requirements.txt
PYTHONPATH=ml/training python3 ml/training/prepare_fare_data.py
PYTHONPATH=ml/training python3 ml/training/train_fare_model.py
PYTHONPATH=ml/training python3 ml/training/prepare_safety_data.py
PYTHONPATH=ml/training python3 ml/training/train_safety_model.py

# Start the ML inference service
cd ml_service && uvicorn app:app --host 0.0.0.0 --port 8000

# Register trained models into the DB (admin AI page)
cd backend && npm run models:register

# Start the backend
cd backend && npm start

# Start the frontend
npm run dev
```

## M. Test results
```
Test Suites: 11 passed, 11 total
Tests:       94 passed, 94 total   (61 pre-existing + 33 new intelligence tests)
```
Run `cd backend && npm test`.

## N. Deployment instructions
1. Set all secrets via environment (`DATABASE_URL`, `JWT_SECRET`,
   `JWT_REFRESH_SECRET`, `FRONTEND_URL`, provider keys, `ML_SERVICE_URL`).
2. `npm install && npx prisma migrate deploy && npx prisma db seed`.
3. Deploy the ML service (`uvicorn app:app`) behind your infra and point
   `ML_SERVICE_URL` at it — or omit it to run fully on the deterministic engines.
4. `npm run models:register` once after training.
5. `npm start`. Graceful shutdown on SIGTERM/SIGINT is already implemented.

## O. Limitations & fallback behaviour
- **Deterministic engines are the ground truth and always available.** If the ML
  service is missing/unreachable/timeout, fare falls back to the rule baseline,
  safety to the weighted score, recommendation to weighted scoring, and packing
  to context rules — the app never crashes (verified by tests and by the
  `method`/`mlError` fields in responses).
- **Models are trained on labelled synthetic data** and are not claimed as
  production accuracy; `datasetSource="synthetic"` is surfaced in the model
  registry and reports.
- **A\*/Haversine are not "trained".** The UI and docs say "A* route
  optimization", "Haversine geographic distance", "weighted recommendation",
  "Random Forest fare/safety prediction", "context-aware AI packing".
- Real road routing still requires a configured routing provider
  (`ROUTING_PROVIDER` + key); without one, routes use the mock provider only in
  development (`MOCK_EXTERNAL_SERVICES=true`), never silently in production.
- Emergency-service data is seeded real Coimbatore facilities (`source="seed"`);
  swap in a live POI provider for production accuracy.
- Safety-map zones colour strictly by calculated safety level (never random).
