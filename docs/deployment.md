# Deployment guide — Vercel and Supabase

## Target layout
Use the same GitHub repository for two separate Vercel projects:

| Project | Root Directory | Runtime | Build/output |
|---|---|---|---|
| Frontend | `frontend` | Vercel static Vite | `npm run build` → `dist` |
| Backend | `backend` | Vercel Python Function / FastAPI ASGI | `index.py` exports `app` |

Both projects connect to a Supabase PostgreSQL database. The API is serverless; it uses SQLAlchemy `NullPool` and disables psycopg prepared statements for Vercel's transaction pooler. PostgreSQL migrations are a separate deployment step.

## Supabase setup and connection modes
Create the project in the Supabase dashboard, then use **Connect** to copy connection details. Choose the connection method based on runtime networking:

- Vercel serverless requests: Supabase Shared Pooler, **Transaction** mode, port `6543`. Use the exact host, port, username, and database shown by Supabase Connect; do not use the direct `db.<project-ref>.supabase.co` endpoint. The transaction pooler is designed for serverless short-lived connections. The backend's psycopg engine sets `prepare_threshold=None` and SQLAlchemy `NullPool` for Vercel.
- Alembic migrations: use Direct connection when reachable, or Session Pooler where direct IPv6/network access is unavailable. Do not run migrations through the Transaction Pooler.

The Vercel production `DATABASE_URL` should be the Transaction Pooler connection string copied from Supabase Connect, using the provider-issued host, port `6543`, username, database, and SSL options. Either `postgresql://` or `postgresql+psycopg://` is accepted; the backend normalizes the standard form to `postgresql+psycopg://` in production and rejects non-pooler endpoints or ports. Percent-encode reserved characters in passwords. Keep the URL only in protected provider/local environment configuration. Do not put it in a client environment variable or commit it.

Apply migrations separately, before deploying/activating the backend. For this one-time CLI run, use the Supabase **Session Pooler** URL (port `5432`) or Direct connection if the network supports it. Use the driver prefix `postgresql+psycopg://`; do not use the Transaction Pooler on port `6543` for migrations.

```powershell
Set-Location "E:\Python\Project RPL\predictive-maintenance\backend"
$secureUrl = Read-Host "Paste the Supabase Session Pooler/Direct migration URL (input is masked)" -AsSecureString
$urlPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
try {
    # Alembic imports app settings; development mode avoids the API-only port 6543 restriction.
    $env:APP_ENV = "development"
    $env:SECRET_KEY = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
    $migrationUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($urlPointer)
    if ($migrationUrl.StartsWith("postgresql://", [StringComparison]::OrdinalIgnoreCase)) {
        $migrationUrl = "postgresql+psycopg://" + $migrationUrl.Substring("postgresql://".Length)
    }
    $env:DATABASE_URL = $migrationUrl
    python -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        throw "Alembic migration failed with exit code $LASTEXITCODE"
    }
}
finally {
    Remove-Item Env:DATABASE_URL, Env:APP_ENV, Env:SECRET_KEY -ErrorAction SilentlyContinue
    $migrationUrl = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($urlPointer)
    $secureUrl.Dispose()
}
```

The temporary `APP_ENV` and generated `SECRET_KEY` above exist only in that PowerShell process so Alembic can import the application metadata; they do not change Vercel's production settings or any application credentials. The migration URL is typed into a masked prompt and removed from the process environment after the command.

The chain currently contains the single head revision `0001_initial_schema` (root revision). On an empty database, it creates `users`, `machines`, and `predictions`, with their indexes and foreign key, and records the revision in `alembic_version`. The revision checks existing tables first; a partial legacy schema is rejected before changes. If all three legacy application tables already exist, it performs compatibility updates and alters/recreates tables while preserving rows, so inspect an existing non-empty database before applying. Do not downgrade production.

After `upgrade head` succeeds, run this read-only verification in the Supabase SQL Editor:

```sql
SELECT version_num FROM alembic_version;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'machines', 'predictions', 'alembic_version')
ORDER BY table_name;
```

Expected revision: `0001_initial_schema`; expected tables: all four listed above. Never point destructive or downgrade tests at production.

## Vercel backend project
1. Import the GitHub repository into Vercel as a project named for the API.
2. Set **Root Directory** to `backend` (include files outside the root only if Vercel explicitly supports them; the model is bundled inside `backend/ml/`).
3. Select the Python framework/runtime if not auto-detected. `backend/index.py` exports the existing FastAPI object from `app.main`; no duplicate route implementation is introduced. `backend/requirements.txt` contains production dependencies; `backend/requirements-dev.txt` is for test tooling only.
4. Set protected environment variables:
   - `APP_ENV=production`
   - `DATABASE_URL` — Supabase Shared Transaction Pooler URL (port `6543`), copied from Supabase Connect; either PostgreSQL URL scheme is accepted
   - `SECRET_KEY` — unique random value of at least 32 characters
   - `ALGORITHM=HS256`
   - `ACCESS_TOKEN_EXPIRE_MINUTES=1440`
   - `MODEL_PATH=ml/model.joblib`
   - `METADATA_PATH=ml/model_metadata.json`
   - `FRONTEND_URL` — exact Vercel frontend HTTPS origin
   - `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME`
5. Deploy. No migration runs on API startup or request. Verify `/health` and `/ready` after migration and configuration.
6. Create a unique admin password in the provider dashboard. The legacy `admin@predictive.com` user is disabled unless explicitly configured as bootstrap admin.
7. Create operator accounts by calling `POST /auth/register` with the admin Bearer token and each operator's name, valid email, and password. The endpoint is admin-only, always assigns the `operator` role, and does not return an operator token. Public/self-registration is not enabled. Keep operator passwords in an approved password manager or provide them to operators through a secure channel; never commit or document them.

The model and metadata files are each a few MB together and are bundled inside the backend project root. Training artifacts remain canonical in `ml/`; a backend test checks that their byte hashes match the copies in `backend/ml/`. After retraining, synchronize both backend copies and run the artifact integrity test before deploying. Vercel's current Python runtime documentation lists a 500 MB uncompressed standard function bundle limit; actual deployment build remains the final confirmation because dependencies contribute to bundle size.

## Vercel frontend project
1. Import the same GitHub repository as a second Vercel project.
2. Set **Root Directory** to `frontend`, framework preset to Vite, build command to `npm run build`, and output directory to `dist`. `frontend/vercel.json` sets the Vite build/output and SPA route fallback.
3. Set only `VITE_API_URL` in the frontend project, to the actual backend HTTPS base URL. Do not set `DATABASE_URL`, JWT secret, bootstrap password, or any database credential in frontend environment.
4. Deploy/redeploy after setting the environment variable. Vite compiles this URL into static assets at build time.
5. Set the backend `FRONTEND_URL` to the actual deployed frontend origin and redeploy the backend. CORS accepts only that configured origin.

## Production verification checklist
Record only actual observations; use the deployment dashboard/browser and do not infer pass results from a local build.

| Check | Expected | Actual |
|---|---|---|
| Backend `/health` | HTTP 200 liveness | Not tested — no deployed URL |
| Backend `/ready` | HTTP 200 with DB/model available | Not tested — no Supabase connection |
| No-token protected endpoints | HTTP 401/403 | Not tested against production |
| Invalid token | HTTP 401 | Not tested against production |
| Operator machine mutation | HTTP 403 | Not tested against production |
| Admin machine mutation | Success | Not tested against production |
| Login/dashboard/machine selection | Browser flow works against API | Not tested — no deployed URL |
| Prediction/history/refresh | Record persists in Supabase | Not tested — no Supabase connection |
| Logout/protected route | Token cleared and login required | Not tested against production |
| CORS and network | Browser requests HTTPS backend; only exact frontend origin allowed | Not tested against production |
| Mobile and browser console | Core pages usable; no important errors | Not tested — no deployed URL |
| Backend redeploy | Model and DB history remain available | Not tested against production |

## Optional local Docker deployment
`docker-compose.yml` and Dockerfiles remain as an optional local/container alternative only. They are not required by the Vercel deployment target. Docker was not available during this verification and its build/runtime is not claimed as tested.

## Current status
Repository: [aghy07/predictive-maintenance2](https://github.com/aghy07/predictive-maintenance2). The public repository currently has only the initial commit at the inspected `main` revision, so local changes in this workspace (including Vercel configuration) must be pushed before Vercel can build them. This workspace has no available `git` CLI or connected Vercel/Supabase account. No Supabase project/database, Vercel deployment, or public URL has been verified. Do not mark this project production-ready until the checklist above is completed on the actual public deployments.

### Phase 4 Vercel preparation
- Added a FastAPI Vercel entrypoint, bundled ML artifacts, serverless-specific `NullPool` configuration, and separate psycopg settings for transaction pooling.
- Migrations remain an explicit external step; no schema migration runs per invocation.
- Production requirements are separated from test-only dependencies.
- Live deployment, live PostgreSQL, CORS/auth, E2E, persistence, and mobile checks are pending.
