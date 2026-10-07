from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.db import Base


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (Index("ix_predictions_machine_id_id", "machine_id", "id"),)

    id = Column(Integer, primary_key=True)
    machine_id = Column(Integer, ForeignKey("machines.id"), nullable=False)
    input_data = Column(JSON, nullable=False)
    prediction = Column(String(50), nullable=False)
    probability = Column(Float, nullable=False)
    risk_level = Column(String(50), nullable=False)
    recommended_action = Column(String(255), nullable=False)
    model_version = Column(String(50), nullable=False, default="v1.0", server_default=text("'v1.0'"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    machine = relationship("Machine", back_populates="predictions")
