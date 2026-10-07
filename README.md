# PredictiveMaintenance

Prototype web application for machine-maintenance decision support and early risk detection from temperature, vibration, pressure, load, and power sensor values. The ML dataset and labels are synthetic; predictions are not safety guarantees and do not replace technician judgment.

## Features
- JWT login and role-based authorization (admin/operator)
- Machine management and machine selection
- Sensor-based prediction with probability, risk category, recommendation, and range warnings
- Prediction history and dashboard aggregations
- Alembic schema migrations and verified ML artifact metadata

## Architecture
```text
Vercel project 1 (React/Vite frontend)
                  │ HTTPS + JWT
Vercel project 2 (FastAPI Python Function)
                  │ PostgreSQL psycopg through Supabase connection pooler
Supabase PostgreSQL

FastAPI Function ── bundled Random Forest model + metadata
```

The repository has separate Vercel configurations: `frontend/` for the static SPA and `backend/` for FastAPI. The backend entrypoint is `backend/index.py`; application routes and business logic stay in `backend/app/`. The Vercel deployment includes matching artifacts under `backend/ml/`, with a test ensuring they match the training artifacts under `ml/`.

## ML
The current v2.0 Random Forest and its metadata are stored in `ml/`. The 1,800-row training dataset is synthetic and intended for demonstration. See [docs/ml-pipeline.md](docs/ml-pipeline.md) for the leakage checks, model comparison, threshold policy, holdout results, and limitations. The model is a decision-support prototype, not validated against real industrial equipment.

## Database
Local development and automated tests may use SQLite. Production mode requires a `postgresql+psycopg://` URL, configured using `DATABASE_URL`; use a Supabase connection string copied from its dashboard and do not store it in source control or frontend configuration.

For Vercel serverless requests, the backend uses SQLAlchemy `NullPool`; for the psycopg transaction pooler it disables prepared statements. Run Alembic separately before enabling the API. Do not run a migration inside an API invocation.

## Local development and tests
Backend:
```powershell
cd backend
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
# Set unique local secrets in backend/.env; migrate, then run:
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:
```powershell
cd frontend
npm ci
$env:VITE_API_URL = "http://localhost:8000"
npm run dev
```

Run the complete Python suite from the repository root:
```powershell
python -m pytest -q
```

## Cloud deployment
The deployment target is two Vercel projects plus Supabase PostgreSQL:

1. Import the GitHub repository into Supabase-independent Vercel project **Backend**, set **Root Directory** to `backend`, framework/runtime to Python if prompted, and configure backend environment variables described in [docs/deployment.md](docs/deployment.md).
2. Create the Supabase database. Use **Shared Pooler → Transaction** for Vercel requests where appropriate; copy the actual host, port, and username from Supabase Connect. Run migrations separately using an appropriate direct/session connection before serving traffic.
3. Verify the deployed backend `/health` and `/ready` endpoints. Do not proceed if readiness fails.
4. Import the same GitHub repository into Vercel project **Frontend**, set **Root Directory** to `frontend`, framework to Vite, build command `npm run build`, output `dist`, and set `VITE_API_URL` to the actual backend HTTPS URL.
5. Set backend `FRONTEND_URL` to the actual frontend HTTPS origin and verify login, protected routes, prediction, and persisted history.

Environment variable **names**: backend `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `MODEL_PATH`, `METADATA_PATH`, `FRONTEND_URL`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME`; frontend `VITE_API_URL`. Never add values for secrets to this README, source, or the frontend project.

### Current public URLs
- Frontend: **not deployed**
- Backend: **not deployed**
- Supabase: **not connected**

See [docs/deployment.md](docs/deployment.md) for exact setup and acceptance instructions. Deployment is not complete until actual provider URLs are tested.

## Limitations
- Synthetic dataset; no evidence of real-machine generalization.
- No live Supabase migration, Vercel backend or frontend deployment, public URL, or production browser/mobile test has been verified yet.
- The reported CV/holdout scores are not operating guarantees; false negatives remain possible.
