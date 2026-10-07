# Testing summary

## White-box testing
The suite covers authentication and authorization, prediction validation, model artifact caching and integrity failures, risk-band boundaries, machine archive behavior, one-inference persistence, training-range metadata, dashboard aggregation, SQLite foreign-key enforcement, fresh and legacy Alembic upgrades, downgrade behavior on scratch databases, schema drift, PostgreSQL DDL compilation, and ML data/training metadata. Run the full suite from the project root using a compatible Python environment:

```powershell
python -m pytest -q
```

PostgreSQL DDL is compiled in tests, but no live PostgreSQL service is available in the current verification environment. Do not interpret this as completed PostgreSQL integration validation.

The full Python test suite passes: **73 passed** (with existing dependency deprecation warnings). The focused tests cover the Vercel entrypoint, serverless engine options, production DB URL validation, and matching model-artifact hashes. The frontend TypeScript/Vite production build passes with an explicit HTTPS test API base URL; Vite reports a **640.63 kB** minified JavaScript chunk, above its 500 kB advisory threshold. This is non-fatal. The Docker frontend image uses a multi-stage production build and Nginx static serving, but the image itself has not been built because Docker is unavailable.

## Black-box testing
See [black-box-testing.md](./black-box-testing.md) for manual end-to-end scenarios. The end-user workflow is login, dashboard access, machine review, sensor submission, prediction/risk/recommendation inspection, and history review. These are manual product scenarios, not proof that a browser-driven end-to-end automation suite exists.

The UI reports loading, retryable error, and empty states for dashboard, machine selection/list, and prediction history. Run the frontend production build from `frontend`:

```powershell
cd frontend
$env:VITE_API_URL = "https://api.example.com"
$env:APP_ENV = "production"
npm run build
```

No Supabase project or Vercel deployment is connected in the current environment. Live PostgreSQL migration/CRUD, Vercel Function packaging/runtime, cloud deployment, E2E browser testing, mobile-device testing, and deployment-level persistence are still outstanding. Docker is optional for the selected Vercel deployment path.

The checked-in model and dataset are synthetic classroom assets; passing these tests and the build does not establish real-world predictive accuracy or operational safety. No live deployment, load, or real-equipment acceptance test has been performed.
