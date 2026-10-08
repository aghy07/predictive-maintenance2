# Deployment guide — Vercel and Supabase

This guide describes the repository's deployment layout, server/database requirements, migration procedure, and verification evidence. Do not put credentials in this file, source control, or frontend build variables.

## Production URLs

The following URLs were supplied for this project:

- Frontend: <https://predictive-maintenance2-sy6k.vercel.app>
- Backend: <https://predictive-maintenance2-pgwe.vercel.app>
- Swagger / OpenAPI UI: <https://predictive-maintenance2-pgwe.vercel.app/docs>

These are project deployment links. Their presence is not evidence that every health, readiness, authorization, database, or end-to-end check below has passed. Record only observed live results in the verification table.

## Deployment layout

Use two Vercel projects from the same repository:

| Project | Root directory | Runtime / framework | Build / output |
|---|---|---|---|
| Frontend | `frontend` | Static Vite SPA | `npm run build` → `dist` |
| Backend | `backend` | Python Function running FastAPI ASGI | `index.py` exports `app` |

The frontend sends HTTPS requests to the backend. The API persists application records in Supabase PostgreSQL and loads its Random Forest model bundle from `backend/ml/`. The production API uses SQLAlchemy `NullPool`; psycopg prepared statements are disabled for transaction-pooler requests.

## Supabase database connection

Configure production backend `DATABASE_URL` using the Supabase Shared Pooler **Transaction** connection details shown in Supabase Connect:

- Port `6543`.
- Supabase pooler hostname and username copied from the project connection details.
- PostgreSQL scheme `postgresql://` or `postgresql+psycopg://`; production settings normalize the standard scheme to psycopg.
- Keep the entire URL in protected backend environment configuration. Do not commit it or set it in frontend variables.

Production validation rejects SQLite and requires the Supabase pooler hostname on port `6543`; a direct `db.<project-ref>.supabase.co` URL or a different pooler port is not accepted by runtime settings.

Alembic migrations must use a separate Direct connection where available or a Supabase Session Pooler connection (commonly port `5432`). **Do not run migrations through the Transaction Pooler on port `6543`.** Confirm the connection mode and exact host/port in Supabase Connect; do not guess them from examples.

## Apply and verify the database migration

The current migration chain has a single head revision: `0001_initial_schema`. On an empty database it creates `users`, `machines`, `predictions`, their indexes and foreign key, and `alembic_version`. It does not seed production machines. Application startup does not create tables.

From PowerShell, set a migration URL only in the local process. Do not paste it into source control or chat. Run this from the backend directory after dependencies are installed:

```powershell
Set-Location "E:\Python\Project RPL\predictive-maintenance\backend"
$env:APP_ENV = "development"
$env:SECRET_KEY = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
$env:DATABASE_URL = Read-Host "Enter the Supabase Direct or Session Pooler migration URL"
if ($env:DATABASE_URL.StartsWith("postgresql://", [StringComparison]::OrdinalIgnoreCase)) {
    $env:DATABASE_URL = "postgresql+psycopg://" + $env:DATABASE_URL.Substring("postgresql://".Length)
}
try {
    python -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        throw "Alembic migration failed with exit code $LASTEXITCODE"
    }
}
finally {
    Remove-Item Env:DATABASE_URL, Env:APP_ENV, Env:SECRET_KEY -ErrorAction SilentlyContinue
}
```

The temporary settings above exist only to allow Alembic to load application metadata without applying the API runtime's production-only Transaction Pooler restriction. Use a proper local Python environment with backend dependencies installed. The URL is read into the process and removed afterward; PowerShell's ordinary `Read-Host` is not masked, so take care that the terminal is private and clear its history according to local policy. Alternatively, configure the URL through an approved secrets manager or secure shell environment. Never store the URL in `.env` files that are tracked or share it in chat.

Before applying a migration to a non-empty database, inspect the schema and back up required data. The revision rejects a partial legacy schema. A complete pre-existing legacy schema is adopted through compatibility alterations intended to preserve rows, but still requires review before execution. Do not use a downgrade as a production rollback; the downgrade to `base` drops the application tables.

After migration, run these read-only checks in the Supabase SQL Editor:

```sql
SELECT version_num FROM alembic_version;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'machines', 'predictions', 'alembic_version')
ORDER BY table_name;
```

Expected migration revision: `0001_initial_schema`. Expected application tables: `users`, `machines`, `predictions`, plus the Alembic version table. Record actual query output before marking migration verification complete.

## Vercel backend project

1. Create or open the backend Vercel project and set its root directory to `backend`.
2. Use the Python runtime. `backend/index.py` exports the FastAPI app; application routes remain under `backend/app/`.
3. Install production dependencies from `backend/requirements.txt`. `backend/requirements-dev.txt` is for development/test tools.
4. Configure the following backend environment variable **names** in protected settings:
   - `APP_ENV=production`
   - `DATABASE_URL` — Supabase Shared Transaction Pooler URL on port `6543`
   - `SECRET_KEY` — a unique random value meeting the configured minimum length
   - `ALGORITHM`
   - `ACCESS_TOKEN_EXPIRE_MINUTES`
   - `MODEL_PATH`
   - `METADATA_PATH`
   - `FRONTEND_URL` — exact frontend HTTPS origin
   - `BOOTSTRAP_ADMIN_EMAIL`
   - `BOOTSTRAP_ADMIN_PASSWORD`
   - `BOOTSTRAP_ADMIN_NAME`
5. Deploy only after the target schema has been migrated. API startup does not run Alembic.
6. Confirm `/health` and `/ready`. `/ready` requires both a database query and a valid model bundle.
7. Operator accounts can be provisioned through `POST /auth/register` from an authenticated administrator session. This endpoint always creates the `operator` role. There is no public self-registration.

The API bootstraps or refreshes the configured administrator account during startup when both bootstrap administrator settings are present. It disables the legacy `admin@predictive.com` account unless that address is the configured bootstrap administrator. Do not include any actual bootstrap credentials in deployment notes.

## Vercel frontend project

1. Create a separate Vercel project from the same repository with root directory `frontend`.
2. Use the Vite preset, build command `npm run build`, and output directory `dist`; `frontend/vercel.json` supplies the SPA route fallback.
3. Configure only `VITE_API_URL` for the frontend, set to the backend HTTPS origin. Never set database URLs, JWT signing secrets, or bootstrap credentials in the frontend project.
4. Set backend `FRONTEND_URL` to the exact deployed frontend origin so CORS can allow that origin.
5. Redeploy after changing build-time environment values; Vite compiles `VITE_API_URL` into the static frontend output.

## Production verification checklist

| Check | Expected evidence | Recorded status |
|---|---|---|
| Migration | Alembic head is `0001_initial_schema`; all expected tables are present | Not independently verified in this documentation update |
| Backend `/health` | HTTP 200 liveness response | Not recorded here |
| Backend `/ready` | HTTP 200 with database and model reported ready | Not recorded here |
| Protected API without token | HTTP 401 | Not recorded against production |
| Operator attempts admin operation | HTTP 403 | Not recorded against production |
| Administrator admin operation | Expected authorized response | Not recorded against production |
| Frontend login and navigation | Browser uses deployed API and authenticated views load | Not recorded as a complete live flow |
| Prediction and history | A created prediction is persisted and appears after reload | Not independently verified against Supabase |
| Logout and protected route | Session is cleared and unauthenticated route redirects to login | Local/mock behavior exercised; production behavior not recorded here |
| CORS and network | HTTPS request to the intended API succeeds only from configured frontend origin | Not recorded here |
| Mobile layout | Core deployed pages and navigation usable on target devices | Local/mock responsive inspection only; no physical-device production check |

Update this table only with observations from the live provider and database. A local build or mocked API browser run must not be reported as a production pass.

## Optional local Docker deployment

The repository includes Docker-related files as an optional local/container path. Vercel is the documented production target; a Docker build is not required for it. Record a Docker build/runtime result only after actually running it.
