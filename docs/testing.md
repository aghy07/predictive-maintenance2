# Testing and verification

This page distinguishes automated local tests, local browser checks, and checks that require the deployed services. A local or mocked pass is not evidence of live Supabase/Vercel behavior.

## Automated backend tests

Run the full Python suite from the repository root:

```powershell
python -m pytest -q
```

The last recorded full suite result during the operator-provisioning work was **84 passed**, with one dependency deprecation warning. The documentation-only update did not rerun Python tests.

The suite covers:

- Login, token validation, active accounts, and administrator/operator authorization.
- Admin-only operator provisioning and denied access for anonymous/operator requests.
- Request validation, including invalid/non-finite sensor input and missing or archived machines.
- Risk-band boundaries, recommendations, and training-range warnings.
- Model artifact loading, caching, integrity checks, and one inference per prediction.
- Prediction persistence, machine archival, and latest-per-machine dashboard aggregation.
- SQLite foreign keys, fresh/legacy Alembic behavior, schema checks, and PostgreSQL DDL compilation.
- Synthetic dataset, training metadata, and matching model artifact hashes.

The PostgreSQL DDL compilation and SQLite tests are not live PostgreSQL integration tests.

## Frontend build and type checking

From `frontend/`, set the build-time API URL to a non-secret HTTPS URL and run:

```powershell
$env:VITE_API_URL = "https://your-backend.example"
$env:APP_ENV = "production"
npm ci
npm run build
```

`npm run build` runs the environment check, TypeScript `tsc -b`, and Vite production build. The latest recorded build passed; Vite reported a non-fatal minified JavaScript chunk-size advisory above 500 kB. No separate lint script is currently defined in `frontend/package.json`.

## Browser and responsive checks

During the frontend presentation phase, a browser session exercised login with a mocked response, dashboard rendering, machine creation, prediction submission/result, history, mobile navigation, and logout. API responses were mocked; this did not verify live authentication, API data, or persistence.

The core pages were checked using browser viewports targeting 320, 375, 390, 768, 1024, and 1280 CSS pixels. The browser harness did not always report exactly the requested width, so interpret this as a local responsive inspection rather than a physical-device compatibility certification. No unintended document-width overflow or JavaScript console errors were observed during those mocked checks. React Router printed non-fatal future-flag warnings.

There is no committed automated browser E2E suite.

## Live integration and production checks

The following require the actual Supabase/Vercel services and must be recorded from a live run before being reported as passed:

| Check | Evidence required | Status in last recorded verification |
|---|---|---|
| Supabase schema | Confirm Alembic head and application tables in the target database | Not independently verified here |
| PostgreSQL integration | Connect and perform API CRUD against the deployed PostgreSQL database | Not run as part of the local automated suite |
| Production readiness | `/ready` reports both database and model as available | Not recorded |
| Production authentication/authorization | Verify login, anonymous denial, operator denial, and admin access against the deployed API | Not recorded as a complete production test |
| Production prediction/history | Create a result and confirm it remains in history after reload | Not independently verified |
| Production CORS/network | Confirm browser uses the configured HTTPS backend and allowed frontend origin | Not recorded |
| Production responsive/browser smoke | Exercise deployed views and navigation in target browsers/devices | Not recorded as a production test |
| Load and operational acceptance | Measure load behavior and validate procedures with real equipment/technicians | Not performed |

Production URLs provided for project documentation:

- Frontend: <https://predictive-maintenance2-sy6k.vercel.app>
- Backend: <https://predictive-maintenance2-pgwe.vercel.app>
- API docs: <https://predictive-maintenance2-pgwe.vercel.app/docs>

Their inclusion above identifies the target locations; it does not turn local or mocked checks into production acceptance evidence. See [deployment.md](./deployment.md) for service configuration and the deployment verification log.

## Interpretation

The dataset and labels are synthetic classroom assets. Passing code tests, TypeScript, or browser checks does not establish real-world predictive accuracy, safety, or fitness for sole-source maintenance decisions. See [ml-pipeline.md](./ml-pipeline.md) for the dataset design and evaluation limitations.
