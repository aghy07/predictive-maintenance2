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

- Vercel serverless requests: Shared Pooler, **Transaction** mode, if supported by project/network. Use the exact host, port, username, and database shown by Supabase. The backend's psycopg engine sets `prepare_threshold=None` for this mode.
- Alembic migrations: use Direct connection when reachable, or Session Pooler where direct IPv6/network access is unavailable. Do not run migrations through the Transaction Pooler.

The Vercel production `DATABASE_URL` must use SQLAlchemy's `postgresql+psycopg://` scheme. Preserve the provider-issued pooler host/port/username and SSL options; percent-encode reserved characters in passwords. Keep the URL only in protected provider/local environment configuration. Do not put it in a client environment variable or commit it.

Apply migrations separately, before deploying/activating the backend:

```powershell
cd backend
$env:DATABASE_URL = Read-Host "Paste the Supabase migration URL (input is local only)"
alembic upgrade head
Remove-Item Env:DATABASE_URL
```

Use a Direct or Session Pooler connection string copied from Supabase for this step. Confirm in Supabase Table Editor that `users`, `machines`, `predictions`, and `alembic_version` exist. Never point destructive or downgrade tests at production.

## Vercel backend project
1. Import the GitHub repository into Vercel as a project named for the API.
2. Set **Root Directory** to `backend` (include files outside the root only if Vercel explicitly supports them; the model is bundled inside `backend/ml/`).
3. Select the Python framework/runtime if not auto-detected. `backend/index.py` exports the existing FastAPI object from `app.main`; no duplicate route implementation is introduced. `backend/requirements.txt` contains production dependencies; `backend/requirements-dev.txt` is for test tooling only.
4. Set protected environment variables:
   - `APP_ENV=production`
   - `DATABASE_URL` — Supabase transaction pooler URL with `postgresql+psycopg://` driver prefix
   - `SECRET_KEY` — unique random value of at least 32 characters
   - `ALGORITHM=HS256`
   - `ACCESS_TOKEN_EXPIRE_MINUTES=1440`
   - `MODEL_PATH=ml/model.joblib`
   - `METADATA_PATH=ml/model_metadata.json`
   - `FRONTEND_URL` — exact Vercel frontend HTTPS origin
   - `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME`
5. Deploy. No migration runs on API startup or request. Verify `/health` and `/ready` after migration and configuration.
6. Create a unique admin password in the provider dashboard. The legacy `admin@predictive.com` user is disabled unless explicitly configured as bootstrap admin.

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
