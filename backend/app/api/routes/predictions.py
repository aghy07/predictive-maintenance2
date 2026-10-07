from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import get_current_user
from app.core.db import get_db
from app.models.machine import Machine
from app.models.prediction import Prediction
from app.schemas.prediction import (
    DashboardOut,
    PredictionInput,
    PredictionMetadataOut,
    PredictionOut,
)
from app.services.prediction_service import (
    ModelUnavailableError,
    build_prediction_record,
    load_model_and_metadata,
    save_prediction,
)

router = APIRouter(
    prefix="/predictions",
    tags=["predictions"],
    dependencies=[Depends(get_current_user)],
)


@router.get("")
def list_predictions(db: Session = Depends(get_db)):
    predictions = (
        db.query(Prediction)
        .options(joinedload(Prediction.machine))
        .order_by(Prediction.id.desc())
        .all()
    )
    return [
        {
            "id": item.id,
            "machine": item.machine.machine_name,
            "prediction": item.prediction,
            "probability": item.probability,
            "risk_level": item.risk_level,
            "recommended_action": item.recommended_action,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in predictions
    ]


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)) -> DashboardOut:
    total_machines = db.query(Machine).filter(Machine.archived_at.is_(None)).count()
    total_predictions = db.query(Prediction).count()
    latest_prediction_ids = (
        db.query(Prediction.machine_id, func.max(Prediction.id).label("prediction_id"))
        .join(Machine, Machine.id == Prediction.machine_id)
        .filter(Machine.archived_at.is_(None))
        .group_by(Prediction.machine_id)
        .subquery()
    )
    latest_predictions = (
        db.query(Prediction.prediction)
        .join(latest_prediction_ids, Prediction.id == latest_prediction_ids.c.prediction_id)
        .all()
    )
    latest_labels = [item.prediction for item in latest_predictions]
    normal_machines = latest_labels.count("NORMAL")
    at_risk_machines = sum(
        label in {"WARNING", "HIGH_RISK"} for label in latest_labels
    )
    failure_machines = latest_labels.count("FAILURE")
    return DashboardOut(
        total_machines=total_machines,
        total_predictions=total_predictions,
        normal_machines=normal_machines,
        at_risk_machines=at_risk_machines,
        failure_machines=failure_machines,
        machines_without_predictions=total_machines - len(latest_labels),
    )


@router.get("/metadata", response_model=PredictionMetadataOut)
def prediction_metadata() -> PredictionMetadataOut:
    try:
        metadata = load_model_and_metadata().metadata
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=503, detail="Prediction model is unavailable"
        ) from exc
    return PredictionMetadataOut(
        model_version=metadata["model_version"],
        threshold=metadata["threshold"],
        risk_thresholds=metadata["risk_thresholds"],
        feature_ranges=metadata["feature_ranges"],
    )


@router.get("/{prediction_id}")
def get_prediction(prediction_id: int, db: Session = Depends(get_db)):
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return {
        "id": prediction.id,
        "machine_id": prediction.machine_id,
        "prediction": prediction.prediction,
        "probability": prediction.probability,
        "risk_level": prediction.risk_level,
        "recommended_action": prediction.recommended_action,
        "model_version": prediction.model_version,
        "input_data": prediction.input_data,
        "created_at": prediction.created_at.isoformat() if prediction.created_at else None,
    }


@router.post("")
def create_prediction(
    payload: PredictionInput, db: Session = Depends(get_db)
) -> PredictionOut:
    machine = (
        db.query(Machine)
        .filter(Machine.id == payload.machine_id, Machine.archived_at.is_(None))
        .first()
    )
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    try:
        result = build_prediction_record(payload)
        saved = save_prediction(db, result)
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=503, detail="Prediction model is unavailable"
        ) from exc
    return PredictionOut(
        id=saved.id,
        machine_id=saved.machine_id,
        prediction=saved.prediction,
        probability=saved.probability,
        risk_level=saved.risk_level,
        recommended_action=saved.recommended_action,
        model_version=saved.model_version,
        input_data=saved.input_data,
        created_at=saved.created_at.isoformat() if saved.created_at else None,
        warnings=result["warnings"],
    )
