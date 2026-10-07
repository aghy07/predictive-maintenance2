import json
import hashlib
import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.prediction import Prediction
from app.schemas.prediction import PredictionInput

logger = logging.getLogger(__name__)

FEATURE_COLUMNS = (
    "temperature_c",
    "vibration_mm_s",
    "pressure_bar",
    "load_percent",
    "power_kw",
)
RISK_LABELS = ("NORMAL", "WARNING", "HIGH_RISK", "FAILURE")


class ModelUnavailableError(RuntimeError):
    """Raised when the configured model artifacts cannot serve predictions."""


@dataclass(frozen=True)
class ModelBundle:
    model: Any
    metadata: dict[str, Any]


def _resolve_artifact_path(path_value: str) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    project_root = Path(__file__).resolve().parents[3]
    working_directory_path = path.resolve()
    project_root_path = (project_root / path).resolve()
    if working_directory_path.exists():
        return working_directory_path
    if project_root_path.exists():
        return project_root_path
    return working_directory_path


@lru_cache(maxsize=1)
def load_model_and_metadata() -> ModelBundle:
    settings = get_settings()
    model_path = _resolve_artifact_path(settings.model_path)
    metadata_path = _resolve_artifact_path(settings.metadata_path)

    try:
        with metadata_path.open("r", encoding="utf-8") as handle:
            metadata = json.load(handle)
        if not isinstance(metadata, dict):
            raise ValueError("Model metadata must be a JSON object")

        feature_columns = metadata["feature_columns"]
        if (
            tuple(feature_columns) != FEATURE_COLUMNS
            or tuple(metadata["features"]) != FEATURE_COLUMNS
            or tuple(metadata["feature_order"]) != FEATURE_COLUMNS
        ):
            raise ValueError("Model feature order does not match the prediction API")

        thresholds = metadata["risk_thresholds"]
        alert_threshold = float(metadata["threshold"])
        warning = float(thresholds["warning"])
        high_risk = float(thresholds["high_risk"])
        failure = float(thresholds["failure"])
        if not 0 <= warning < high_risk < failure <= 1:
            raise ValueError("Risk thresholds must be ordered between 0 and 1")
        if not 0 <= alert_threshold <= 1 or alert_threshold != warning:
            raise ValueError("Alert threshold must match the warning risk boundary")

        feature_ranges = metadata["feature_ranges"]
        for column in FEATURE_COLUMNS:
            feature_range = feature_ranges.get(column)
            if not isinstance(feature_range, dict):
                raise ValueError("Model feature ranges are missing or invalid")
            minimum = float(feature_range["min"])
            maximum = float(feature_range["max"])
            if not np.isfinite(minimum) or not np.isfinite(maximum) or minimum > maximum:
                raise ValueError("Model feature ranges are missing or invalid")

        artifact_hash = hashlib.sha256(model_path.read_bytes()).hexdigest()
        if artifact_hash != metadata["artifact_sha256"]:
            raise ValueError("Model artifact hash does not match metadata")

        model = joblib.load(model_path)
        classes = getattr(model, "classes_", None)
        if classes is None or 1 not in classes:
            raise ValueError("Model does not expose a failure class")
    except Exception as exc:
        logger.exception("Unable to load prediction model artifacts")
        raise ModelUnavailableError("Prediction model is unavailable") from exc

    return ModelBundle(model=model, metadata=metadata)


def classify_risk(
    probability: float,
    risk_thresholds: dict[str, float],
    alert_threshold: float | None = None,
) -> tuple[str, str]:
    normal_boundary = (
        alert_threshold if alert_threshold is not None else risk_thresholds["warning"]
    )
    if probability < normal_boundary:
        return "NORMAL", "low"
    if probability >= risk_thresholds["failure"]:
        return "FAILURE", "high"
    if probability >= risk_thresholds["high_risk"]:
        return "HIGH_RISK", "high"
    return "WARNING", "medium"


def recommendation_for(label: str) -> str:
    mapping = {
        "NORMAL": "Machine remains within the expected operating range. Continue routine monitoring.",
        "WARNING": "Temperature or vibration is elevated. Schedule a brief inspection before the next shift.",
        "HIGH_RISK": "Maintenance should inspect the machine soon; check bearings, thermal load, and alignment.",
        "FAILURE": "Severe risk detected. Stop the machine and perform a maintenance inspection immediately.",
    }
    return mapping[label]


def _input_row(payload: PredictionInput) -> dict[str, float]:
    return {
        "temperature_c": payload.temperature_c,
        "vibration_mm_s": payload.vibration_mm_s,
        "pressure_bar": payload.pressure_bar,
        "load_percent": payload.load_percent,
        "power_kw": payload.power_kw,
    }


def _input_warnings(
    row: dict[str, float], feature_ranges: dict[str, dict[str, float]]
) -> list[str]:
    outside_features = [
        feature
        for feature, value in row.items()
        if value < feature_ranges[feature]["min"] or value > feature_ranges[feature]["max"]
    ]
    if not outside_features:
        return []
    return [
        "Input berada di luar rentang data pelatihan untuk: "
        + ", ".join(outside_features)
        + ". Probabilitas prediksi dapat kurang andal."
    ]


def build_prediction_record(
    payload: PredictionInput, model_bundle: ModelBundle | None = None
) -> dict[str, Any]:
    bundle = model_bundle or load_model_and_metadata()
    row = _input_row(payload)
    feature_columns = bundle.metadata["feature_columns"]
    df = pd.DataFrame([row], columns=feature_columns)
    probabilities = bundle.model.predict_proba(df)[0]
    classes = list(bundle.model.classes_)
    probability = float(probabilities[classes.index(1)])
    if not np.isfinite(probability) or not 0 <= probability <= 1:
        raise ModelUnavailableError("Prediction model returned an invalid probability")

    prediction_label, risk_level = classify_risk(
        probability,
        bundle.metadata["risk_thresholds"],
        float(bundle.metadata["threshold"]),
    )
    return {
        "machine_id": payload.machine_id,
        "input_data": row,
        "prediction": prediction_label,
        "probability": round(probability, 4),
        "risk_level": risk_level,
        "recommended_action": recommendation_for(prediction_label),
        "model_version": bundle.metadata.get("model_version", "unknown"),
        "warnings": _input_warnings(row, bundle.metadata["feature_ranges"]),
    }


def save_prediction(db: Session, result: dict[str, Any]) -> Prediction:
    prediction = Prediction(
        machine_id=result["machine_id"],
        input_data=result["input_data"],
        prediction=result["prediction"],
        probability=result["probability"],
        risk_level=result["risk_level"],
        recommended_action=result["recommended_action"],
        model_version=result["model_version"],
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction
