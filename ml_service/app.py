"""
TourGuard AI — ML inference & Multilingual Translation service (FastAPI).

Serves:
  · fare_model_v1   (fareStatus: FAIR / SLIGHTLY_HIGH / OVERCHARGED)
  · safety_model_v1 (safetyLevel: SAFE / MODERATE / HIGH_RISK)
  · multilingual translation (13 Indian languages + English)

Run:
    uvicorn app:app --host 0.0.0.0 --port 8000
"""

import os
import json
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Optional, List

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODELS_ROOT = Path(os.environ.get("MODELS_ROOT", str(Path(__file__).resolve().parent.parent / "ml" / "models")))

app = FastAPI(title="TourGuard AI ML Service", version="1.0.0")

# --- feature schemas (must match training) ----------------------------------

FARE_FEATURES = [
    "vehicleType", "timeOfDay", "dayOfWeek", "trafficLevel", "weatherCondition",
    "distanceKm", "durationMinutes", "baseFare", "perKmRate", "perMinuteRate",
    "surgeMultiplier", "quotedFare",
]
SAFETY_FEATURES = [
    "timeOfDay", "dayOfWeek", "crowdDensity", "transportAvailability",
    "latitude", "longitude", "policeDistanceKm", "hospitalDistanceKm",
    "fireStationDistanceKm", "emergencyResponseDistanceKm", "incidentCount",
    "crimeReports", "touristReports", "lightingScore",
]

SUPPORTED_LANGUAGES = {
    "en": "English",
    "ta": "Tamil",
    "hi": "Hindi",
    "ml": "Malayalam",
    "kn": "Kannada",
    "te": "Telugu",
    "bn": "Bengali",
    "mr": "Marathi",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ur": "Urdu",
    "or": "Odia",
    "as": "Assamese"
}


class FareInput(BaseModel):
    vehicleType: str = "AUTO"
    distanceKm: float = 0.0
    durationMinutes: float = 0.0
    timeOfDay: str = "DAY"
    dayOfWeek: str = "WEEKDAY"
    trafficLevel: str = "NORMAL"
    weatherCondition: str = "CLEAR"
    baseFare: Optional[float] = None
    perKmRate: Optional[float] = None
    perMinuteRate: Optional[float] = None
    surgeMultiplier: float = 1.0
    quotedFare: Optional[float] = None


class SafetyInput(BaseModel):
    latitude: float
    longitude: float
    timeOfDay: str = "DAY"
    dayOfWeek: str = "WEEKDAY"
    policeDistanceKm: Optional[float] = None
    hospitalDistanceKm: Optional[float] = None
    fireStationDistanceKm: Optional[float] = None
    emergencyResponseDistanceKm: Optional[float] = None
    incidentCount: float = 0.0
    crimeReports: float = 0.0
    touristReports: float = 0.0
    lightingScore: Optional[float] = None
    crowdDensity: str = "NORMAL"
    transportAvailability: str = "MODERATE"


class TranslateInput(BaseModel):
    text: str
    sourceLanguage: str = "en"
    targetLanguage: str = "ta"


def _load(model_key: str, features: List[str]):
    model_dir = MODELS_ROOT / model_key
    pipeline_path = model_dir / "pipeline.joblib"
    meta_path = model_dir / "metadata.json"
    if not pipeline_path.exists():
        return None, None, None
    pipeline = joblib.load(pipeline_path)
    meta = None
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    return pipeline, meta, features


FARE_PIPELINE, FARE_META, _ = _load("fare_model_v1", FARE_FEATURES)
SAFETY_PIPELINE, SAFETY_META, _ = _load("safety_model_v1", SAFETY_FEATURES)


def _row(features, values):
    return pd.DataFrame([values], columns=features)


def _predict(pipeline, features, values):
    df = _row(features, values)
    proba = pipeline.predict_proba(df)[0]
    classes = list(getattr(pipeline, "classes_", []))
    idx = int(proba.argmax())
    return str(classes[idx]), float(proba[idx])


@app.get("/health")
def health():
    return {
        "ok": True,
        "models": {
            "fare": FARE_PIPELINE is not None,
            "safety": SAFETY_PIPELINE is not None,
            "translation": True
        },
    }


@app.post("/predict/fare")
def predict_fare(inp: FareInput):
    if FARE_PIPELINE is None:
        raise HTTPException(status_code=503, detail="fare_model_v1 not loaded")
    values = [inp.vehicleType, inp.timeOfDay, inp.dayOfWeek, inp.trafficLevel, inp.weatherCondition,
              inp.distanceKm, inp.durationMinutes, inp.baseFare, inp.perKmRate, inp.perMinuteRate,
              inp.surgeMultiplier, inp.quotedFare]
    prediction, confidence = _predict(FARE_PIPELINE, FARE_FEATURES, values)
    return {
        "prediction": prediction,
        "confidence": confidence,
        "modelVersion": (FARE_META or {}).get("modelKey", "fare_model_v1"),
        "datasetSource": (FARE_META or {}).get("datasetSource", "synthetic"),
    }


@app.post("/predict/safety")
def predict_safety(inp: SafetyInput):
    if SAFETY_PIPELINE is None:
        raise HTTPException(status_code=503, detail="safety_model_v1 not loaded")
    values = [inp.timeOfDay, inp.dayOfWeek, inp.crowdDensity, inp.transportAvailability,
              inp.latitude, inp.longitude, inp.policeDistanceKm, inp.hospitalDistanceKm,
              inp.fireStationDistanceKm, inp.emergencyResponseDistanceKm, inp.incidentCount,
              inp.crimeReports, inp.touristReports, inp.lightingScore]
    prediction, confidence = _predict(SAFETY_PIPELINE, SAFETY_FEATURES, values)
    return {
        "prediction": prediction,
        "confidence": confidence,
        "modelVersion": (SAFETY_META or {}).get("modelKey", "safety_model_v1"),
        "datasetSource": (SAFETY_META or {}).get("datasetSource", "synthetic"),
    }


@app.get("/translate/languages")
def get_languages():
    return [{"code": k, "label": v} for k, v in SUPPORTED_LANGUAGES.items()]


@app.post("/translate")
def translate_text(inp: TranslateInput):
    text = (inp.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    
    src = inp.sourceLanguage.lower()
    tgt = inp.targetLanguage.lower()

    if tgt not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported target language: {tgt}")

    if src == tgt:
        return {
            "sourceLanguage": src,
            "targetLanguage": tgt,
            "original": text,
            "translated": text,
            "provider": "identity"
        }

    langpair = f"{src}|{tgt}"
    params = urllib.parse.urlencode({"q": text, "langpair": langpair})
    url = f"https://api.mymemory.translated.net/get?{params}"

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "TourGuard-AI/1.0 (Tourist Safety & Translation Assistant)"}
        )
        with urllib.request.urlopen(req, timeout=6) as response:
            res_body = response.read().decode("utf-8")
            data = json.loads(res_body)
            translated = (data.get("responseData") or {}).get("translatedText")
            if translated:
                return {
                    "sourceLanguage": src,
                    "targetLanguage": tgt,
                    "original": text,
                    "translated": translated,
                    "provider": "multilingual_engine"
                }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Translation engine unavailable: {str(e)}")

    raise HTTPException(status_code=503, detail="Translation result was empty.")
