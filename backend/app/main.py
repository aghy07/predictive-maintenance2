from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes.auth import router as auth_router
from app.api.routes.machines import router as machines_router
from app.api.routes.predictions import router as predictions_router
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models.machine import Machine  # noqa: F401
from app.models.prediction import Prediction  # noqa: F401
from app.models.user import User  # noqa: F401
from app.services.prediction_service import (
    ModelUnavailableError,
    load_model_and_metadata,
)

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_model_and_metadata()
    with SessionLocal() as session:
        legacy_admin = session.query(User).filter(User.email == "admin@predictive.com").first()
        if legacy_admin and legacy_admin.email != (settings.bootstrap_admin_email or "").lower():
            legacy_admin.is_active = False

        if settings.bootstrap_admin_email and settings.bootstrap_admin_password:
            admin = session.query(User).filter(User.email == settings.bootstrap_admin_email.lower()).first()
            if admin is None:
                admin = User(
                    name=settings.bootstrap_admin_name,
                    email=settings.bootstrap_admin_email.lower(),
                    password_hash=hash_password(settings.bootstrap_admin_password.get_secret_value()),
                    role="admin",
                    is_active=True,
                )
                session.add(admin)
            else:
                admin.name = settings.bootstrap_admin_name
                admin.password_hash = hash_password(settings.bootstrap_admin_password.get_secret_value())
                admin.role = "admin"
                admin.is_active = True
        if (
            settings.app_env.lower() != "production"
            and session.query(Machine).filter(Machine.archived_at.is_(None)).count() == 0
        ):
            session.add(Machine(machine_code="M-1001", machine_name="Press #1", location="Plant A", temperature_c=74.0, vibration_mm_s=4.1, status="healthy"))
        session.commit()
    yield

app = FastAPI(title="Predictive Maintenance API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(machines_router)
app.include_router(predictions_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def readiness():
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
        load_model_and_metadata()
    except SQLAlchemyError as exc:
        logger.warning("Readiness check failed because the database is unavailable")
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail="Prediction model is unavailable") from exc
    return {"status": "ready", "database": "ok", "model": "ok"}
