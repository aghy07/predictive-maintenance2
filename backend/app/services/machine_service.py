from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.machine import Machine
from app.schemas.machine import MachineCreate


def get_machines(db: Session):
    return (
        db.query(Machine)
        .filter(Machine.archived_at.is_(None))
        .order_by(Machine.id.desc())
        .all()
    )


def create_machine(db: Session, payload: MachineCreate):
    existing = db.query(Machine).filter(Machine.machine_code == payload.machine_code).first()
    if existing:
        raise ValueError("Machine code already exists")
    machine = Machine(**payload.model_dump())
    db.add(machine)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("Machine code already exists") from exc
    db.refresh(machine)
    return machine


def update_machine(db: Session, machine_id: int, payload: MachineCreate):
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    if not machine:
        raise ValueError("Machine not found")
    for key, value in payload.model_dump().items():
        setattr(machine, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("Machine code already exists") from exc
    db.refresh(machine)
    return machine


def delete_machine(db: Session, machine_id: int):
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    if not machine:
        raise ValueError("Machine not found")
    if machine.archived_at is not None:
        raise ValueError("Machine is already archived")
    machine.archived_at = func.now()
    db.commit()
    db.refresh(machine)
    return machine
