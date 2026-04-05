from fastapi import FastAPI
from pydantic import BaseModel
import os
import joblib

# import your ML logic
from exp import predict_disease, ENV_MAPPINGS, MODELS_DIR, train_and_save_models

app = FastAPI()

# -------------------------------
# Model Files
# -------------------------------
model_files = [
    'xgb_model.pkl', 'clinical_model.pkl', 'env_model.pkl',
    'disease_encoder.pkl', 'symptom_features.pkl', 'clinical_features.pkl',
    'env_features.pkl', 'clinical_scaler.pkl', 'symptom_data.pkl'
]

models = None

# -------------------------------
# Startup: Load / Train Models
# -------------------------------
@app.on_event("startup")
def load_models():
    global models

    # Check if models exist
    if not all(os.path.exists(os.path.join(MODELS_DIR, f)) for f in model_files):
        print("⚠️ Models not found. Training now...")
        success = train_and_save_models()
        if not success:
            raise Exception("Model training failed")

    # Load models
    models = tuple(
        joblib.load(os.path.join(MODELS_DIR, f)) for f in model_files
    )

    print("✅ Models loaded successfully")


# -------------------------------
# Helper: Safe Mapping
# -------------------------------
def safe_map(mapping, key, default=None):
    return mapping.get(key, mapping.get(default))


# -------------------------------
# Request Schema
# -------------------------------
class PredictionRequest(BaseModel):
    symptoms: str

    # clinical (with defaults)
    age: int = 30
    weight: int = 60
    bp: int = 120
    sugar: int = 100
    cholesterol: int = 180
    wbc: int = 6
    bmi: float = 22.0
    sleep: int = 7

    # environmental (with defaults)
    temperature: str = "medium"
    humidity: str = "medium"
    air_quality: str = "normal"
    water_quality: str = "good"
    region_type: str = "urban"
    weather: str = "sunny"
    time_delay: str = "moderate"


# -------------------------------
# Prediction Endpoint
# -------------------------------
@app.post("/predict")
async def predict(data: PredictionRequest):

    if models is None:
        return {"success": False, "error": "Models not loaded"}

    try:
        # Clinical data
        clinical = {
            'Age': data.age,
            'Weight': data.weight,
            'BP': data.bp,
            'Sugar': data.sugar,
            'Cholesterol': data.cholesterol,
            'WBC': data.wbc,
            'BMI': data.bmi,
            'Sleep': data.sleep
        }

        # Environmental data (safe mapping)
        environmental = {
            'temperature': safe_map(ENV_MAPPINGS['temperature'], data.temperature),
            'humidity': safe_map(ENV_MAPPINGS['humidity'], data.humidity),
            'air_quality': safe_map(ENV_MAPPINGS['air_quality'], data.air_quality),
            'water_quality': safe_map(ENV_MAPPINGS['water_quality'], data.water_quality),
            'region_type': safe_map(ENV_MAPPINGS['region_type'], data.region_type),
            'weather': safe_map(ENV_MAPPINGS['weather'], data.weather),
            'time_delay': ENV_MAPPINGS['time_delay'].get(
                data.time_delay,
                ENV_MAPPINGS['time_delay'][None]
            )[0]
        }

        # Run prediction
        predictions, matched, unmatched = predict_disease(
            data.symptoms,
            clinical,
            environmental,
            models
        )

        return {
            "success": True,
            "data": {
                "predictions": predictions,
                "matched_symptoms": matched,
                "unmatched_symptoms": unmatched
            }
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# -------------------------------
# Health Check
# -------------------------------
@app.get("/")
def root():
    return {"message": "API is running 🚀"}