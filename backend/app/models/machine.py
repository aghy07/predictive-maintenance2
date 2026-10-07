from sqlalchemy import Column, DateTime, Float, Index, Integer, String, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.db import Base


class Machine(Base):
    __tablename__ = "machines"
    __table_args__ = (
        Index("ix_machines_machine_code", "machine_code", unique=True),
        Index("ix_machines_archived_at", "archived_at"),
    )

    id = Column(Integer, primary_key=True)
    machine_code = Column(String(50), nullable=False)
    machine_name = Column(String(150), nullable=False)
    location = Column(String(120), nullable=False)
    temperature_c = Column(Float, nullable=False, default=0.0, server_default=text("0"))
    vibration_mm_s = Column(Float, nullable=False, default=0.0, server_default=text("0"))
    status = Column(String(30), nullable=False, default="healthy", server_default=text("'healthy'"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    archived_at = Column(DateTime(timezone=True), nullable=True)

    predictions = relationship(
        "Prediction",
        back_populates="machine",
        passive_deletes="all",
    )
