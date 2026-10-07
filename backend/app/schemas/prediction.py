from pydantic import BaseModel, Field


class PredictionInput(BaseModel):
    machine_id: int = Field(..., gt=0)
    temperature_c: float = Field(..., ge=0.0, allow_inf_nan=False)
    vibration_mm_s: float = Field(..., ge=0.0, allow_inf_nan=False)
    pressure_bar: float = Field(..., ge=0.0, allow_inf_nan=False)
    load_percent: float = Field(..., ge=0.0, allow_inf_nan=False)
    power_kw: float = Field(..., ge=0.0, allow_inf_nan=False)


class PredictionOut(BaseModel):
    id: int | None = None
    machine_id: int
    prediction: str
    probability: float
    risk_level: str
    recommended_action: str
    model_version: str
    input_data: dict
    created_at: str | None = None
    warnings: list[str] = Field(default_factory=list)


class DashboardOut(BaseModel):
    total_machines: int
    total_predictions: int
    normal_machines: int
    at_risk_machines: int
    failure_machines: int
    machines_without_predictions: int


class PredictionMetadataOut(BaseModel):
    model_version: str
    threshold: float
    risk_thresholds: dict[str, float]
    feature_ranges: dict[str, dict[str, float]]
