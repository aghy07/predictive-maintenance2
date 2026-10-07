import atexit
import json
import os
import sys
import tempfile
import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from fastapi.testclient import TestClient
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

_TEST_DB_DIR = tempfile.TemporaryDirectory(prefix="predictive-maintenance-tests-")
os.environ["SECRET_KEY"] = "test-only-secret-key-not-for-production"
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TEST_DB_DIR.name) / 'predictive-test.db'}"
os.environ["APP_ENV"] = "development"
os.environ["FRONTEND_URL"] = "http://localhost:5173"
os.environ["BOOTSTRAP_ADMIN_EMAIL"] = "test-admin@example.com"
os.environ["BOOTSTRAP_ADMIN_PASSWORD"] = "Test-Only-Admin-Password-123"

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_DIR = _PROJECT_ROOT / "backend"
_ALEMBIC_CONFIG = Config(str(_BACKEND_DIR / "alembic.ini"))
command.upgrade(_ALEMBIC_CONFIG, "head")

from app.main import app
from app.core.config import Settings
from app.core.db import SessionLocal, engine
from app.core.security import hash_password
from app.models.machine import Machine
from app.models.prediction import Prediction
from app.models.user import User


def _cleanup_test_database() -> None:
    client.__exit__(None, None, None)
    engine.dispose()
    _TEST_DB_DIR.cleanup()


atexit.register(_cleanup_test_database)

client = TestClient(app)
client.__enter__()


def auth_headers(email: str, password: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_healthcheck():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_readiness_reports_database_and_model_status():
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "database": "ok",
        "model": "ok",
    }


def test_readiness_returns_service_unavailable_when_database_fails(monkeypatch):
    from sqlalchemy.exc import OperationalError

    def unavailable_session():
        raise OperationalError("SELECT 1", {}, RuntimeError("database unavailable"))

    monkeypatch.setattr("app.main.SessionLocal", unavailable_session)

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json()["detail"] == "Database is unavailable"


def test_cors_allows_only_configured_frontend():
    allowed = client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    blocked = client.options(
        "/auth/login",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in blocked.headers


def test_production_configuration_rejects_sqlite():
    with pytest.raises(ValidationError, match="Production requires PostgreSQL"):
        Settings(
            app_env="production",
            database_url="sqlite:///./predictive.db",
            secret_key="production-test-secret-that-is-not-real",
            bootstrap_admin_email="admin@example.com",
            bootstrap_admin_password="production-test-password",
        )


def test_production_configuration_rejects_non_https_frontend():
    with pytest.raises(ValidationError, match="FRONTEND_URL must use HTTPS"):
        Settings(
            app_env="production",
            database_url="postgresql+psycopg://user:password@db:5432/test",
            secret_key="production-test-secret-that-is-not-real",
            frontend_url="http://localhost:5173",
            bootstrap_admin_email="admin@example.com",
            bootstrap_admin_password="production-test-password",
        )


def test_production_configuration_requires_bootstrap_admin():
    with pytest.raises(ValidationError, match="requires BOOTSTRAP_ADMIN_EMAIL"):
        Settings(
            app_env="production",
            database_url="postgresql+psycopg://user:password@db:5432/test",
            secret_key="production-test-secret-that-is-not-real",
            frontend_url="https://frontend.example.com",
            bootstrap_admin_email=None,
            bootstrap_admin_password=None,
        )


def test_register_and_login():
    email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": "Test User", "email": email, "password": "SecretPassword123"}
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 200
    token = response.json()["token"]
    assert token

    login_response = client.post("/auth/login", json={"email": payload["email"], "password": payload["password"]})
    assert login_response.status_code == 200
    assert login_response.json()["token"]


def test_prediction_with_valid_input():
    payload = {
        "machine_id": 1,
        "temperature_c": 82.0,
        "vibration_mm_s": 5.5,
        "pressure_bar": 112.0,
        "load_percent": 70.0,
        "power_kw": 60.0,
    }
    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    response = client.post("/predictions", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert "probability" in data
    assert "risk_level" in data
    assert 0 <= data["probability"] <= 1


@pytest.mark.parametrize(
    ("feature", "value"),
    [
        ("temperature_c", 95.0),
        ("vibration_mm_s", 10.0),
        ("pressure_bar", 150.0),
        ("load_percent", 95.0),
        ("power_kw", 95.0),
    ],
)
def test_prediction_flags_abnormal_sensor_readings(feature, value):
    payload = {
        "machine_id": 1,
        "temperature_c": 70.0,
        "vibration_mm_s": 4.0,
        "pressure_bar": 100.0,
        "load_percent": 55.0,
        "power_kw": 50.0,
    }
    payload[feature] = value

    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    response = client.post("/predictions", json=payload, headers=headers)

    assert response.status_code == 200
    data = response.json()
    minimum_expected_probability = 0.2 if feature == "power_kw" else 0.4
    assert minimum_expected_probability <= data["probability"] <= 1
    if feature != "power_kw":
        assert data["prediction"] in {"WARNING", "HIGH_RISK", "FAILURE"}


def test_login_rejects_invalid_credentials():
    response = client.post("/auth/login", json={"email": "admin@predictive.com", "password": "wrong-password"})
    assert response.status_code == 401


def test_legacy_demo_admin_is_not_active():
    with SessionLocal() as db:
        legacy_admin = db.query(User).filter(User.email == "admin@predictive.com").first()

    assert legacy_admin is None or not legacy_admin.is_active


def test_prediction_rejects_invalid_values():
    payload = {
        "machine_id": 1,
        "temperature_c": -10,
        "vibration_mm_s": 5.5,
        "pressure_bar": 112.0,
        "load_percent": 70.0,
        "power_kw": 60.0,
    }
    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    response = client.post("/predictions", json=payload, headers=headers)
    assert response.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {
            "machine_id": 1,
            "temperature_c": 70,
            "vibration_mm_s": 4,
            "pressure_bar": 100,
            "load_percent": 50,
        },
        {
            "machine_id": 1,
            "temperature_c": "too hot",
            "vibration_mm_s": 4,
            "pressure_bar": 100,
            "load_percent": 50,
            "power_kw": 50,
        },
    ],
)
def test_prediction_rejects_missing_fields_and_invalid_sensor_types(payload):
    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")

    assert client.post("/predictions", json=payload, headers=headers).status_code == 422


def test_sensor_validation_accepts_zero_boundary():
    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    payload = {
        "machine_id": 1,
        "temperature_c": 0,
        "vibration_mm_s": 0,
        "pressure_bar": 0,
        "load_percent": 0,
        "power_kw": 0,
    }

    response = client.post("/predictions", json=payload, headers=headers)

    assert response.status_code == 200
    assert response.json()["probability"] >= 0


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("GET", "/machines", None),
        ("POST", "/machines", {"machine_code": "M-X", "machine_name": "Press X", "location": "Plant X"}),
        ("PUT", "/machines/1", {"machine_code": "M-X", "machine_name": "Press X", "location": "Plant X"}),
        ("DELETE", "/machines/1", None),
        ("GET", "/predictions", None),
        ("GET", "/predictions/1", None),
        ("GET", "/predictions/dashboard", None),
        ("GET", "/predictions/metadata", None),
        ("POST", "/predictions", {"temperature_c": 70, "vibration_mm_s": 4, "pressure_bar": 100, "load_percent": 50, "power_kw": 50}),
    ],
)
def test_protected_endpoints_reject_requests_without_token(method, path, payload):
    response = client.request(method, path, json=payload)

    assert response.status_code == 401


def test_operator_can_read_and_predict_but_cannot_manage_machines():
    email = f"operator-{uuid.uuid4().hex[:8]}@example.com"
    registration = client.post(
        "/auth/register",
        json={"name": "Test Operator", "email": email, "password": "OperatorPassword123"},
    )
    assert registration.status_code == 200
    headers = {"Authorization": f"Bearer {registration.json()['token']}"}

    assert client.get("/machines", headers=headers).status_code == 200
    assert client.get("/predictions", headers=headers).status_code == 200
    assert client.post(
        "/machines",
        json={"machine_code": "OP-100", "machine_name": "Operator Machine", "location": "Plant B"},
        headers=headers,
    ).status_code == 403


def test_admin_can_manage_machines():
    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    response = client.post(
        "/machines",
        json={
            "machine_code": f"ADMIN-{uuid.uuid4().hex[:8]}",
            "machine_name": "Admin Test Machine",
            "location": "Test Plant",
        },
        headers=headers,
    )

    assert response.status_code == 200


def test_machine_crud_duplicate_archive_and_prediction_relationship():
    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    code = f"CRUD-{uuid.uuid4().hex[:8]}"
    create_payload = {
        "machine_code": code,
        "machine_name": "CRUD Machine",
        "location": "Test Plant",
        "temperature_c": 71,
        "vibration_mm_s": 3.5,
        "status": "healthy",
    }
    created_response = client.post("/machines", json=create_payload, headers=headers)
    assert created_response.status_code == 200
    machine_id = created_response.json()["id"]
    assert any(item["id"] == machine_id for item in client.get("/machines", headers=headers).json())
    assert client.post("/machines", json=create_payload, headers=headers).status_code == 400

    update_payload = {**create_payload, "machine_name": "Updated CRUD Machine"}
    updated = client.put(f"/machines/{machine_id}", json=update_payload, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["machine_name"] == "Updated CRUD Machine"

    prediction_response = client.post(
        "/predictions",
        headers=headers,
        json={
            "machine_id": machine_id,
            "temperature_c": 80,
            "vibration_mm_s": 5,
            "pressure_bar": 110,
            "load_percent": 65,
            "power_kw": 60,
        },
    )
    assert prediction_response.status_code == 200
    prediction_id = prediction_response.json()["id"]

    archived = client.delete(f"/machines/{machine_id}", headers=headers)
    assert archived.status_code == 200
    assert archived.json()["message"] == "Machine archived"
    assert all(item["id"] != machine_id for item in client.get("/machines", headers=headers).json())
    assert client.post(
        "/predictions",
        headers=headers,
        json={
            "machine_id": machine_id,
            "temperature_c": 80,
            "vibration_mm_s": 5,
            "pressure_bar": 110,
            "load_percent": 65,
            "power_kw": 60,
        },
    ).status_code == 404

    with SessionLocal() as db:
        machine = db.query(Machine).filter(Machine.id == machine_id).one()
        prediction = db.query(Prediction).filter(Prediction.id == prediction_id).one()
        assert machine.archived_at is not None
        assert prediction.machine_id == machine.id
        assert prediction.machine.machine_name == "Updated CRUD Machine"


def test_prediction_foreign_key_rejects_missing_machine():
    with SessionLocal() as db:
        db.add(
            Prediction(
                machine_id=987654321,
                input_data={},
                prediction="NORMAL",
                probability=0.1,
                risk_level="low",
                recommended_action="Monitor",
                model_version="test",
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_alembic_migration_upgrade_downgrade_and_upgrade_again(monkeypatch):
    temporary_directory = tempfile.TemporaryDirectory(prefix="predictive-maintenance-migrations-")
    database_url = f"sqlite:///{Path(temporary_directory.name) / 'migration-test.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    migration_config = Config(str(_BACKEND_DIR / "alembic.ini"))

    command.upgrade(migration_config, "head")
    migration_engine = create_engine(database_url)
    try:
        assert {"users", "machines", "predictions", "alembic_version"}.issubset(
            set(inspect(migration_engine).get_table_names())
        )
        command.downgrade(migration_config, "base")
        assert set(inspect(migration_engine).get_table_names()) == {"alembic_version"}
        command.upgrade(migration_config, "head")
        assert {"users", "machines", "predictions"}.issubset(
            set(inspect(migration_engine).get_table_names())
        )
    finally:
        migration_engine.dispose()
        temporary_directory.cleanup()


def test_alembic_adopts_legacy_schema_without_losing_records(monkeypatch):
    temporary_directory = tempfile.TemporaryDirectory(prefix="predictive-maintenance-legacy-")
    database_path = Path(temporary_directory.name) / "legacy.db"
    database_url = f"sqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    import sqlite3

    connection = sqlite3.connect(database_path)
    try:
        connection.executescript(
            """
            CREATE TABLE machines (
                id INTEGER NOT NULL PRIMARY KEY,
                machine_code VARCHAR(50) NOT NULL,
                machine_name VARCHAR(150) NOT NULL,
                location VARCHAR(120) NOT NULL,
                temperature_c FLOAT,
                vibration_mm_s FLOAT,
                status VARCHAR(30),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE UNIQUE INDEX ix_machines_machine_code ON machines(machine_code);
            CREATE INDEX ix_machines_id ON machines(id);
            CREATE TABLE users (
                id INTEGER NOT NULL PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                email VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50),
                is_active BOOLEAN,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE UNIQUE INDEX ix_users_email ON users(email);
            CREATE INDEX ix_users_id ON users(id);
            CREATE TABLE predictions (
                id INTEGER NOT NULL PRIMARY KEY,
                machine_id INTEGER NOT NULL REFERENCES machines(id),
                input_data JSON NOT NULL,
                prediction VARCHAR(50) NOT NULL,
                probability FLOAT NOT NULL,
                risk_level VARCHAR(50) NOT NULL,
                recommended_action VARCHAR(255) NOT NULL,
                model_version VARCHAR(50),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX ix_predictions_id ON predictions(id);
            INSERT INTO machines
                (id, machine_code, machine_name, location, temperature_c, vibration_mm_s, status)
                VALUES (1, 'LEGACY-1', 'Legacy machine', 'Old plant', NULL, NULL, NULL);
            INSERT INTO users
                (id, name, email, password_hash, role, is_active)
                VALUES (1, 'Legacy user', 'legacy@example.com', 'test-hash', NULL, NULL);
            INSERT INTO predictions
                (id, machine_id, input_data, prediction, probability, risk_level, recommended_action, model_version)
                VALUES (1, 1, '{}', 'NORMAL', 0.1, 'low', 'Monitor', NULL);
            """
        )
    finally:
        connection.close()

    migration_config = Config(str(_BACKEND_DIR / "alembic.ini"))
    command.upgrade(migration_config, "head")
    legacy_engine = create_engine(database_url)
    try:
        inspector = inspect(legacy_engine)
        assert "archived_at" in {column["name"] for column in inspector.get_columns("machines")}
        assert {
            "ix_machines_archived_at",
            "ix_machines_machine_code",
        }.issubset({index["name"] for index in inspector.get_indexes("machines")})
        assert "ix_predictions_machine_id_id" in {
            index["name"] for index in inspector.get_indexes("predictions")
        }
        with legacy_engine.connect() as connection:
            assert connection.execute(
                text("SELECT status, temperature_c FROM machines WHERE id = 1")
            ).one() == ("healthy", 0.0)
            assert connection.execute(
                text("SELECT role, is_active FROM users WHERE id = 1")
            ).one() == ("operator", 1)
            assert connection.execute(
                text("SELECT model_version FROM predictions WHERE id = 1")
            ).scalar_one() == "v1.0"
        command.check(migration_config)
    finally:
        legacy_engine.dispose()
        temporary_directory.cleanup()


def test_alembic_schema_matches_orm_metadata():
    command.check(_ALEMBIC_CONFIG)


def test_model_schema_compiles_for_postgresql():
    from sqlalchemy import create_mock_engine

    from app.core.db import Base

    statements = []
    mock_engine = create_mock_engine(
        "postgresql+psycopg://user:password@localhost/predictive",
        lambda statement, *args, **kwargs: statements.append(
            str(statement.compile(dialect=mock_engine.dialect))
        ),
    )
    Base.metadata.create_all(mock_engine)
    compiled_sql = "\n".join(statements)

    assert "JSON" in compiled_sql
    assert "TIMESTAMP WITH TIME ZONE" in compiled_sql
    assert "FOREIGN KEY(machine_id) REFERENCES machines (id)" in compiled_sql
    assert "ON DELETE CASCADE" not in compiled_sql


def test_admin_can_read_prediction_dashboard():
    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    response = client.get("/predictions/dashboard", headers=headers)

    assert response.status_code == 200
    assert {
        "total_machines",
        "total_predictions",
        "normal_machines",
        "at_risk_machines",
        "failure_machines",
        "machines_without_predictions",
    }.issubset(response.json())


@pytest.mark.parametrize(
    ("probability", "expected"),
    [
        (0.39, "NORMAL"),
        (0.40, "WARNING"),
        (0.41, "WARNING"),
        (0.59, "WARNING"),
        (0.60, "HIGH_RISK"),
        (0.61, "HIGH_RISK"),
        (0.79, "HIGH_RISK"),
        (0.80, "FAILURE"),
        (0.81, "FAILURE"),
    ],
)
def test_risk_threshold_boundaries(probability, expected):
    from app.services.prediction_service import classify_risk, load_model_and_metadata

    thresholds = load_model_and_metadata().metadata["risk_thresholds"]
    label, _ = classify_risk(probability, thresholds)

    assert label == expected


def test_model_and_metadata_are_cached():
    from app.services.prediction_service import load_model_and_metadata

    first = load_model_and_metadata()
    second = load_model_and_metadata()

    assert first is second


def test_configured_relative_model_paths_resolve_from_backend_working_directory(monkeypatch):
    from app.services.prediction_service import _resolve_artifact_path

    project_root = Path(__file__).resolve().parents[1]
    monkeypatch.chdir(project_root / "backend")

    assert _resolve_artifact_path("../ml/model.joblib") == project_root / "ml" / "model.joblib"


def test_prediction_runs_inference_once_and_is_persisted(monkeypatch):
    from app.api.routes import predictions as prediction_routes

    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    before = client.get("/predictions", headers=headers)
    assert before.status_code == 200
    original_build = prediction_routes.build_prediction_record
    calls = 0

    def count_build(payload):
        nonlocal calls
        calls += 1
        return original_build(payload)

    monkeypatch.setattr(prediction_routes, "build_prediction_record", count_build)
    response = client.post(
        "/predictions",
        headers=headers,
        json={
            "machine_id": 1,
            "temperature_c": 82,
            "vibration_mm_s": 5.5,
            "pressure_bar": 112,
            "load_percent": 70,
            "power_kw": 60,
        },
    )

    assert response.status_code == 200
    assert calls == 1
    saved_id = response.json()["id"]
    history = client.get("/predictions", headers=headers)
    assert history.status_code == 200
    persisted = next(item for item in history.json() if item["id"] == saved_id)
    assert persisted["prediction"] == response.json()["prediction"]
    assert persisted["probability"] == response.json()["probability"]


def test_prediction_requires_existing_machine():
    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    payload = {
        "machine_id": 987654321,
        "temperature_c": 70,
        "vibration_mm_s": 4,
        "pressure_bar": 100,
        "load_percent": 50,
        "power_kw": 50,
    }

    assert client.post("/predictions", json=payload, headers=headers).status_code == 404
    payload.pop("machine_id")
    assert client.post("/predictions", json=payload, headers=headers).status_code == 422


@pytest.mark.parametrize(
    ("feature", "value"),
    [
        ("temperature_c", 100),
        ("vibration_mm_s", 10),
        ("pressure_bar", 170),
        ("load_percent", 105),
        ("power_kw", 120),
    ],
)
def test_prediction_warns_but_accepts_values_outside_training_ranges(feature, value):
    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    payload = {
        "machine_id": 1,
        "temperature_c": 70,
        "vibration_mm_s": 4,
        "pressure_bar": 100,
        "load_percent": 50,
        "power_kw": 50,
    }
    payload[feature] = value

    response = client.post("/predictions", json=payload, headers=headers)

    assert response.status_code == 200
    warnings = response.json()["warnings"]
    assert len(warnings) == 1
    assert feature in warnings[0]


def test_prediction_metadata_is_available_and_artifact_errors_are_explicit(monkeypatch):
    from app.services import prediction_service

    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    response = client.get("/predictions/metadata", headers=headers)
    assert response.status_code == 200
    assert response.json()["threshold"] == 0.4
    assert response.json()["risk_thresholds"] == {
        "warning": 0.4,
        "high_risk": 0.6,
        "failure": 0.8,
    }
    assert response.json()["feature_ranges"]["temperature_c"]["min"] < 50

    monkeypatch.setattr(
        prediction_service,
        "_resolve_artifact_path",
        lambda _: Path(_TEST_DB_DIR.name) / "missing-model-artifact",
    )
    prediction_service.load_model_and_metadata.cache_clear()
    unavailable = client.get("/predictions/metadata", headers=headers)
    assert unavailable.status_code == 503
    assert unavailable.json()["detail"] == "Prediction model is unavailable"
    prediction_service.load_model_and_metadata.cache_clear()


@pytest.mark.parametrize("corruption", ["feature_order", "artifact_hash"])
def test_model_loader_rejects_corrupt_metadata_or_artifact(monkeypatch, tmp_path, corruption):
    from app.services import prediction_service

    model_path = Path(prediction_service._resolve_artifact_path("ml/model.joblib"))
    metadata_path = Path(prediction_service._resolve_artifact_path("ml/model_metadata.json"))
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if corruption == "feature_order":
        metadata["feature_order"] = list(reversed(metadata["feature_order"]))
        configured_metadata_path = tmp_path / "invalid-metadata.json"
        configured_metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
        configured_model_path = model_path
    else:
        configured_model_path = tmp_path / "corrupt-model.joblib"
        configured_model_path.write_bytes(model_path.read_bytes() + b"corruption")
        configured_metadata_path = metadata_path

    monkeypatch.setattr(
        prediction_service,
        "_resolve_artifact_path",
        lambda value: configured_model_path
        if value.endswith("model.joblib")
        else configured_metadata_path,
    )
    prediction_service.load_model_and_metadata.cache_clear()
    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    try:
        response = client.get("/predictions/metadata", headers=headers)
        assert response.status_code == 503
    finally:
        prediction_service.load_model_and_metadata.cache_clear()


def test_dashboard_uses_latest_prediction_per_machine_and_counts_unpredicted():
    headers = auth_headers("test-admin@example.com", "Test-Only-Admin-Password-123")
    baseline_response = client.get("/predictions/dashboard", headers=headers)
    assert baseline_response.status_code == 200
    baseline = baseline_response.json()
    new_machines = []
    for suffix in ("normal-latest", "risk-latest", "no-prediction"):
        response = client.post(
            "/machines",
            headers=headers,
            json={
                "machine_code": f"PHASE2-{suffix}-{uuid.uuid4().hex[:6]}",
                "machine_name": f"Phase 2 {suffix}",
                "location": "Test Plant",
            },
        )
        assert response.status_code == 200
        new_machines.append(response.json())

    with SessionLocal() as db:
        machine_normal, machine_risk, _ = new_machines
        db.add_all(
            [
                Prediction(
                    machine_id=machine_normal["id"],
                    input_data={},
                    prediction="NORMAL",
                    probability=0.2,
                    risk_level="low",
                    recommended_action="Monitor",
                    model_version="test",
                ),
                Prediction(
                    machine_id=machine_normal["id"],
                    input_data={},
                    prediction="FAILURE",
                    probability=0.9,
                    risk_level="high",
                    recommended_action="Inspect",
                    model_version="test",
                ),
                Prediction(
                    machine_id=machine_risk["id"],
                    input_data={},
                    prediction="WARNING",
                    probability=0.5,
                    risk_level="medium",
                    recommended_action="Inspect",
                    model_version="test",
                ),
            ]
        )
        db.commit()

    response = client.get("/predictions/dashboard", headers=headers)
    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["total_machines"] == baseline["total_machines"] + 3
    assert dashboard["total_predictions"] == baseline["total_predictions"] + 3
    assert dashboard["normal_machines"] == baseline["normal_machines"]
    assert dashboard["at_risk_machines"] == baseline["at_risk_machines"] + 1
    assert dashboard["failure_machines"] == baseline["failure_machines"] + 1
    assert dashboard["machines_without_predictions"] == baseline["machines_without_predictions"] + 1
    assert (
        dashboard["normal_machines"]
        + dashboard["at_risk_machines"]
        + dashboard["failure_machines"]
        + dashboard["machines_without_predictions"]
        == dashboard["total_machines"]
    )


def test_end_to_end_login_machine_prediction_history_dashboard():
    registration = client.post(
        "/auth/register",
        json={
            "name": "Integration Operator",
            "email": f"integration-{uuid.uuid4().hex[:8]}@example.com",
            "password": "IntegrationPassword123",
        },
    )
    assert registration.status_code == 200
    headers = {"Authorization": "Bearer " + registration.json()["token"]}

    machines_response = client.get("/machines", headers=headers)
    assert machines_response.status_code == 200
    machine_id = machines_response.json()[0]["id"]
    dashboard_before = client.get("/predictions/dashboard", headers=headers).json()

    prediction_response = client.post(
        "/predictions",
        headers=headers,
        json={
            "machine_id": machine_id,
            "temperature_c": 73,
            "vibration_mm_s": 4.1,
            "pressure_bar": 102,
            "load_percent": 58,
            "power_kw": 52,
        },
    )
    assert prediction_response.status_code == 200
    prediction = prediction_response.json()

    history_response = client.get("/predictions", headers=headers)
    assert history_response.status_code == 200
    assert any(item["id"] == prediction["id"] for item in history_response.json())

    dashboard_response = client.get("/predictions/dashboard", headers=headers)
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["total_predictions"] == dashboard_before["total_predictions"] + 1


def test_invalid_token_is_rejected():
    response = client.get("/machines", headers={"Authorization": "Bearer invalid-token"})

    assert response.status_code == 401


def test_inactive_user_token_is_rejected():
    email = f"inactive-{uuid.uuid4().hex[:8]}@example.com"
    with SessionLocal() as db:
        user = User(
            name="Inactive User",
            email=email,
            password_hash=hash_password("InactivePassword123"),
            role="operator",
            is_active=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        user_id = user.id

    from app.core.security import create_access_token

    token = create_access_token(str(user_id))
    response = client.get("/machines", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
