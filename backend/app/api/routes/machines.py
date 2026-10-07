from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.core.db import get_db
from app.schemas.machine import MachineCreate
from app.services.machine_service import create_machine, delete_machine, get_machines, update_machine

router = APIRouter(prefix="/machines", tags=["machines"])


@router.get("")
def list_machines(
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    return [
        {
            "id": machine.id,
            "machine_code": machine.machine_code,
            "machine_name": machine.machine_name,
            "location": machine.location,
            "temperature_c": machine.temperature_c,
            "vibration_mm_s": machine.vibration_mm_s,
            "status": machine.status,
            "created_at": machine.created_at.isoformat() if machine.created_at else None,
        }
        for machine in get_machines(db)
    ]


@router.post("")
def add_machine(
    machine: MachineCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_roles("admin")),
):
    try:
        created = create_machine(db, machine)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "id": created.id,
        "machine_code": created.machine_code,
        "machine_name": created.machine_name,
        "location": created.location,
        "temperature_c": created.temperature_c,
        "vibration_mm_s": created.vibration_mm_s,
        "status": created.status,
    }


@router.put("/{machine_id}")
def edit_machine(
    machine_id: int,
    machine: MachineCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_roles("admin")),
):
    try:
        updated = update_machine(db, machine_id, machine)
    except ValueError as exc:
        status_code = 400 if "code already exists" in str(exc) else 404
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return {
        "id": updated.id,
        "machine_code": updated.machine_code,
        "machine_name": updated.machine_name,
        "location": updated.location,
        "temperature_c": updated.temperature_c,
        "vibration_mm_s": updated.vibration_mm_s,
        "status": updated.status,
    }


@router.delete("/{machine_id}")
def remove_machine(
    machine_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_roles("admin")),
):
    try:
        delete_machine(db, machine_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"message": "Machine archived"}
