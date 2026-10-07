from pydantic import BaseModel, Field


class MachineCreate(BaseModel):
    machine_code: str = Field(..., min_length=2, max_length=50)
    machine_name: str = Field(..., min_length=2, max_length=150)
    location: str = Field(..., min_length=2, max_length=120)
    temperature_c: float = Field(default=0.0, ge=0.0)
    vibration_mm_s: float = Field(default=0.0, ge=0.0)
    status: str = Field(default="healthy")


class MachineUpdate(MachineCreate):
    pass


class MachineOut(MachineCreate):
    id: int
    model_config = {"from_attributes": True}
