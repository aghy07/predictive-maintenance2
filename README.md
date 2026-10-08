# PredictiveMaintenance

## 1. Project Overview

**PredictiveMaintenance: Aplikasi Web Pendeteksi Dini Kerusakan Mesin Pabrik Berdasarkan Sensor Suhu dan Getaran** is a web-based prototype for early machine-failure risk detection and maintenance decision support. It accepts operational sensor readings, evaluates them with a machine-learning model, and presents a prediction label, risk level, probability, and suggested action.

The system is intended to help users review machine conditions. It is an **early risk detection and decision-support prototype**, not a replacement for qualified technicians, inspections, or safety procedures.

## 2. Background

Unexpected equipment failure can interrupt production and increase maintenance costs. Reviewing operational readings such as temperature, vibration, pressure, load, and power can help identify patterns that warrant earlier inspection. This project demonstrates how a web application can bring machine records, model assessments, and prediction history together for monitoring.

The project is relevant to **SDG 9 (Industry, Innovation and Infrastructure)** as an educational example of applying software and data analysis to industrial monitoring. It does not claim to measure or deliver real-world SDG impact.

## 3. Objectives

- Demonstrate early risk assessment from machine sensor and operating data.
- Provide a dashboard for reviewing registered equipment and the latest prediction categories.
- Store prediction results for later review.
- Separate administrator and operator capabilities.
- Demonstrate an ML-backed decision-support workflow through a web application.

## 4. Main Features

- **Authentication:** login with an email and password; protected views and API routes use a bearer token.
- **Role-based authorization:** administrator-only machine changes and operator provisioning.
- **Dashboard:** machine and prediction counts, latest risk distribution, current machine registry readings, recent predictions, and navigation to key tasks.
- **Machine management:** administrators can register, update, and archive machines through the API; the frontend provides machine registration and a machine list.
- **Machine selection:** choose an active machine before submitting a prediction.
- **Prediction:** submit temperature, vibration, pressure, load, and power readings for model inference.
- **Risk assessment:** display the model label, estimated probability, risk level, recommendation, model version, and any training-range warnings.
- **Prediction history:** review persisted results in newest-first order.
- **Database persistence:** users, machines, and predictions are stored through SQLAlchemy; migrations are managed by Alembic.
- **Operator provisioning:** an authenticated administrator can create operator accounts through the protected API endpoint. Public self-registration is disabled.
- **Responsive navigation:** desktop sidebar and mobile navigation drawer support the main authenticated pages.

## 5. User Roles

### Administrator

- Log in and access the authenticated application.
- Register, update, and archive machine records through the administrator-protected API. The current frontend provides the add-machine form and machine list; edit and archive controls are not provided in the UI.
- Create operator accounts through `POST /auth/register`.
- Review machines, predictions, and history.

### Operator

- Log in and review the dashboard, machine list, prediction form, and prediction history.
- Submit predictions for active machines.
- Cannot provision users or create, update, or archive machines.

Both roles use authenticated API routes for machine and prediction data. Account provisioning always creates an `operator`; there is no public registration page or unauthenticated registration flow.

## 6. System Architecture

```text
User / Browser
      |
      v
Vercel static frontend (React + Vite)
      | HTTPS requests + JWT bearer token
      v
Vercel Python Function (FastAPI)
      |                 \
      v                  v
Supabase PostgreSQL   ML inference service
                      Random Forest + metadata
```

The frontend handles navigation, forms, and result presentation. FastAPI authenticates requests, validates input, coordinates data access and inference, and exposes health/readiness endpoints. The inference service loads a paired model and metadata bundle. PostgreSQL stores application records. The production target uses separate Vercel frontend and backend projects with Supabase PostgreSQL; Vercel database requests use the Supabase Shared Transaction Pooler. Local development and automated tests can use SQLite.

## 7. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, TypeScript, Vite 6 | SPA screens, navigation, and client interaction |
| Frontend styling | Tailwind CSS 3 | Responsive utility-based styling |
| Charts and icons | Recharts, lucide-react | Dashboard chart and interface icons |
| Backend | Python, FastAPI, Pydantic 2 | REST API, request validation, and ASGI application |
| ORM and migrations | SQLAlchemy 2, Alembic | Database access and schema versioning |
| Database | PostgreSQL on Supabase; SQLite for local development/tests | Persistent user, machine, and prediction data |
| PostgreSQL driver | psycopg 3 | PostgreSQL connectivity |
| ML | pandas, NumPy, scikit-learn, joblib | Data preparation, model training, inference, and artifact persistence |
| Authentication | JWT (PyJWT) and PBKDF2-HMAC-SHA256 password hashing | Bearer-token sessions and password verification |
| Deployment | Vercel and Supabase | Frontend hosting, FastAPI function, and managed PostgreSQL |

## 8. Machine Learning

The checked-in dataset, `ml/data/machine_sensor_history.csv`, contains **1,800 synthetic rows** generated by `ml/generate_data.py` with seed 42. Its binary failure labels are generated from a synthetic rule involving five operational features. The dataset is not collected from actual factory machines.

The training pipeline in `ml/train_model.py`:

1. Uses `temperature_c`, `vibration_mm_s`, `pressure_bar`, `load_percent`, and `power_kw` as model features and `failure` as the target.
2. Splits data into stratified training and holdout partitions (80%/20%).
3. Compares Logistic Regression, Random Forest, and Gradient Boosting using five-fold stratified cross-validation on the training partition. Median imputation and any scaling are kept inside each model pipeline.
4. Selects the Random Forest under the documented training-CV selection policy and evaluates it on the held-out synthetic partition.
5. Stores the fitted pipeline in `ml/model.joblib` and the matching model version, feature order, observed training ranges, thresholds, evaluation metadata, and artifact hash in `ml/model_metadata.json`.

The current artifact is version `v2.0`. Its application risk bands are metadata-backed:

| Prediction label | Model probability band |
|---|---:|
| `NORMAL` | below 0.40 |
| `WARNING` | 0.40 to below 0.60 |
| `HIGH_RISK` | 0.60 to below 0.80 |
| `FAILURE` | 0.80 and above |

The API also reports a risk level (`low`, `medium`, or `high`) and a recommendation associated with the prediction label. Inputs outside observed training ranges are accepted when otherwise valid but receive an extrapolation warning. Those observed ranges are not physical safety limits. See [docs/ml-pipeline.md](docs/ml-pipeline.md) for the evaluation method, recorded metrics, threshold trade-offs, and artifact details.

**Limitations:** the data and labels are synthetic; there is no demonstrated validation on real equipment, across machines, or over future time periods. Probabilities and risk bands are model outputs, not guaranteed or necessarily calibrated real-world failure probabilities. False negatives are possible. The model is not a safety system and must not be the sole basis for maintenance or shutdown decisions.

## 9. Prediction Workflow

```text
User logs in
    ↓
Selects an active machine
    ↓
Enters sensor / operating values
    ↓
Backend validates the request and machine
    ↓
Cached model performs inference
    ↓
Backend assigns the metadata-backed label and risk level
    ↓
Recommendation and any training-range warning are prepared
    ↓
Result is saved as a prediction record
    ↓
Frontend displays the result
    ↓
Saved result is available in prediction history
```

The API validates a positive machine ID and finite, non-negative values for all five numeric inputs. A machine must exist and be active. Model inference is performed once for the request; the response and stored prediction use that same result.

## 10. Database

The application defines three business tables and Alembic's migration-version table:

- **`users`** — name, unique email, password hash, role, active flag, and creation time.
- **`machines`** — unique machine code, name, location, registry temperature/vibration readings, status, creation time, and nullable archive time.
- **`predictions`** — required foreign key to a machine, submitted input JSON, prediction label, probability, risk level, recommendation, model version, and creation time.
- **`alembic_version`** — tracks the database revision applied by Alembic.

One machine can have many predictions. User records do not have a foreign-key relationship to machines or predictions; the schema does not record per-user prediction ownership. Archiving a machine preserves the machine row and its prediction history. See [docs/erd.md](docs/erd.md) for columns, constraints, and migration notes.

The migration chain currently has the initial revision `0001_initial_schema`. Apply migrations with Alembic before serving a newly configured database. Application startup does not create the schema automatically.

## 11. Security

- Protected routes require a JWT bearer token; the backend validates the token and confirms the associated account is active.
- Role checks restrict user provisioning and machine mutations to administrators. Operators cannot perform those actions.
- Passwords are stored as PBKDF2-HMAC-SHA256 hashes with per-password random salts; plaintext passwords are not stored by the application.
- Production secrets and database connection details are supplied through server-side environment variables. Do not place them in source control, the frontend environment, or documentation.
- CORS allows the configured frontend origin. Production configuration requires HTTPS for that origin.
- Production database validation requires a PostgreSQL psycopg URL using a Supabase pooler hostname on port `6543`; SQLite and direct/non-transaction pooler endpoints are rejected for production runtime.
- `/health` is a liveness check; `/ready` also checks database connectivity and model-artifact availability.

These controls do not replace provider-level access management, secret rotation, backups, or review of production logs and configuration.

## 12. API Overview

All paths below are relative to the backend base URL. “Authenticated” means an `Authorization: Bearer <JWT>` header is required. Machine mutations and operator provisioning additionally require the `admin` role.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Process liveness check |
| `GET` | `/ready` | No | Database and ML-artifact readiness check |
| `POST` | `/auth/login` | No | Verify credentials and return a JWT plus user summary |
| `POST` | `/auth/register` | Admin | Create an operator account; does not return an operator token |
| `GET` | `/machines` | User | List active machines |
| `POST` | `/machines` | Admin | Create a machine |
| `PUT` | `/machines/{machine_id}` | Admin | Update a machine |
| `DELETE` | `/machines/{machine_id}` | Admin | Archive a machine without deleting prediction history |
| `GET` | `/predictions` | User | List prediction history, newest first |
| `GET` | `/predictions/dashboard` | User | Return machine/prediction counts and latest per-machine risk totals |
| `GET` | `/predictions/metadata` | User | Return model version, threshold, risk thresholds, and feature ranges |
| `GET` | `/predictions/{prediction_id}` | User | Fetch a prediction by ID |
| `POST` | `/predictions` | User | Validate readings, run inference, save, and return a prediction |

FastAPI interactive API documentation is available at `/docs` on the backend deployment. Authentication and request/response schemas are enforced by the implementation; this table is a high-level index, not a replacement for the generated schema.

## 13. Production Deployment

The project production URLs supplied for this application are:

- **Frontend:** <https://predictive-maintenance2-sy6k.vercel.app>
- **Backend:** <https://predictive-maintenance2-pgwe.vercel.app>
- **Swagger / OpenAPI UI:** <https://predictive-maintenance2-pgwe.vercel.app/docs>

These are documentation links, not a claim that every endpoint, database migration, or production acceptance check has been verified. Record live smoke-test results separately in [docs/deployment.md](docs/deployment.md). The frontend build-time `VITE_API_URL` must point to the backend HTTPS origin; backend secrets and `DATABASE_URL` belong only in protected backend environment settings.

## 14. Testing

| Test category | What is covered / observed | Status |
|---|---|---|
| Unit / backend | Authentication, role checks, validation, risk boundaries, model integrity, persistence, machine archive behavior, dashboard aggregation, schema and ML pipeline | The last recorded full backend suite was **84 passed**; it was not rerun during the documentation-only phase |
| Authentication | Login success/failure and active-user/token behavior are covered in backend tests | Covered by the backend test suite |
| Authorization | Anonymous/operator denial and administrator-only operator provisioning and machine mutations are covered | Covered by the backend test suite |
| Integration | SQLite-backed API/database and migration scenarios; PostgreSQL DDL compilation | Automated local coverage exists; live PostgreSQL integration is not verified |
| Browser E2E | Browser interaction through login, dashboard, machine creation, prediction result, history, mobile navigation, and logout was exercised with mocked API responses | Manual browser check with mocks; not a committed automated E2E suite |
| Responsive | Browser checks at target widths 320, 375, 390, 768, 1024, and 1280 px across core pages | Local/mock browser checks only; not a physical-device test |
| Production smoke | Public production health/readiness, auth, role enforcement, and end-to-end prediction | Not verified as a complete production smoke suite |
| Persistence | Local test database verifies stored predictions and history behavior | Supabase production persistence not independently verified |
| Frontend build/typecheck | `npm run build` runs TypeScript `tsc -b` followed by Vite production build | Passed during the preceding frontend phase; Vite emitted a non-fatal bundle-size warning above 500 kB |

Run the backend suite from the repository root:

```powershell
python -m pytest -q
```

Run the frontend production build with a non-secret HTTPS API URL:

```powershell
Set-Location frontend
$env:VITE_API_URL = "https://your-backend.example"
$env:APP_ENV = "production"
npm ci
npm run build
```

See [docs/testing.md](docs/testing.md), [docs/white-box-testing.md](docs/white-box-testing.md), and [docs/black-box-testing.md](docs/black-box-testing.md). Local/mock testing must not be described as production integration or persistence testing.

## 15. Limitations

- The training dataset and generated labels are synthetic; there is no validation against real industrial equipment or failure records.
- The model does not establish temporal or cross-machine generalization.
- Prediction outputs are decision support only; the model can produce false positives and false negatives and must not replace qualified maintenance judgment or safety procedures.
- Reported evaluation metrics describe the checked-in synthetic-data experiment, not expected production performance.
- Production availability and persistence depend on the configured Vercel and Supabase services and a successfully applied database migration.
- The API schema has no per-user machine ownership or prediction attribution.
- The current frontend does not expose machine edit/archive controls even though administrator-protected API endpoints exist.

## 16. User Guide

### Login

Open the frontend URL and sign in using an account provisioned by the administrator. Public self-registration is not available. An invalid email/password combination displays a login error.

### Dashboard

Review machine and prediction counts, latest risk distribution, registered machine readings, recent prediction records, and shortcuts to machine management, prediction, and history. Dashboard information comes from the API; the displayed refresh time is when the browser completed its most recent fetch.

### Machines

Review registered machines and their saved registry readings. An administrator can use **Add machine** to submit a machine code, name, location, temperature, vibration, and status. Machine updates and archiving are currently API-only administrator operations.

### Prediction

1. Select an active machine.
2. Enter temperature (°C), vibration (mm/s), pressure (bar), load (%), and power (kW).
3. Select **Run prediction**.
4. Review the returned prediction label, failure probability, risk level, recommendation, model version, timestamp, and any input-range warning.

**Probability** is the model's output for its synthetic training problem; it is not a calibrated guarantee of real failure likelihood. **Risk level** is a separate category (`low`, `medium`, or `high`) derived with metadata-backed thresholds. **Recommendation** is an action message associated with the predicted label and is advisory, not an instruction that supersedes site procedures.

### History

Open **History** to view saved predictions, machine name, label, probability, risk level, and time. On narrow screens, scroll horizontally within the table region.

### Logout

Use **Logout** in the sidebar or mobile navigation. The frontend clears its locally stored token and user summary and sends the browser to `/login`.

## 17. Demo Guide for Lecturer

### Recommended Demonstration Flow

1. Open the [production frontend](https://predictive-maintenance2-sy6k.vercel.app).
2. Log in using an account supplied securely by the project administrator.
3. Review dashboard KPIs, risk overview, machine status, and recent predictions.
4. Open **Machines** and review the registered machine list.
5. Open **Prediction** and select an active machine.
6. Enter valid sensor values for all five fields.
7. Run the prediction and inspect the probability.
8. Inspect the risk label and risk level.
9. Read the recommendation and any training-range warning.
10. Open **History** and confirm the resulting record appears.
11. Refresh the page or history list and confirm the record remains available, if the live database has been verified.
12. Log out and confirm the application returns to login.
13. Open a protected page without a session and confirm it redirects to login.
14. For an invalid-input demonstration, use the Swagger UI with an authorized token and submit a negative sensor value; the API should reject schema-invalid input.

Use a non-production test account and avoid creating unwanted records in a live database. Do not display account passwords, JWTs, or environment variable values during the demo. If a production check has not been run, describe it as a planned check rather than a successful result.

## 18. Troubleshooting

| Problem | Suggested check |
|---|---|
| Cannot log in | Confirm the account is active, use the provisioned email, and re-enter the password. An administrator can provision operator accounts through the protected endpoint. |
| API does not respond | Check the backend deployment and `/health`; inspect Vercel function logs. `/health` does not prove database/model readiness. |
| Prediction fails | Confirm the machine is active, all five sensor values are present and non-negative, and `/ready` reports the database and model as ready. Review the API error and backend logs. |
| Database error / `users` table missing | Apply the Alembic migration to the intended database using a supported migration connection, then check `/ready`. Vercel runtime requires the configured Supabase Transaction Pooler; migrations should use Direct or Session Pooler, not port 6543. |
| Protected page redirects to login | Sign in again. The frontend requires a locally stored token, while the backend independently validates the bearer token and active account. |
| Mobile navigation is unavailable | On a small viewport, use the hamburger button in the header; select a page or close with the close button, backdrop, or Escape key. |
| Backend works but browser API requests fail | Verify frontend `VITE_API_URL`, backend `FRONTEND_URL`, HTTPS origins, and browser network/CORS errors. Do not place backend secrets in frontend settings. |

## 19. Project Structure

```text
predictive-maintenance/
├── backend/
│   ├── app/
│   │   ├── api/routes/          # auth, machines, predictions
│   │   ├── core/                # settings, database, security
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   └── services/            # auth, machine, prediction logic
│   ├── alembic/                 # migration environment and revisions
│   ├── ml/                      # model artifacts bundled with backend
│   ├── index.py                 # Vercel ASGI entrypoint
│   ├── requirements.txt         # production Python dependencies
│   └── requirements-dev.txt     # development/test dependencies
├── docs/
│   ├── architecture.md
│   ├── black-box-testing.md
│   ├── deployment.md
│   ├── erd.md
│   ├── ml-pipeline.md
│   ├── requirements.md
│   ├── testing.md
│   └── white-box-testing.md
├── frontend/
│   ├── scripts/
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   └── pages/
│   ├── package.json
│   └── vercel.json
├── ml/
│   ├── data/
│   ├── generate_data.py
│   ├── train_model.py
│   ├── model.joblib
│   └── model_metadata.json
├── tests/
├── docker-compose.yml
└── README.md
```

The canonical training artifacts are under `ml/`; matching copies under `backend/ml/` are bundled for backend deployment. See the linked documentation for architecture, database, model, deployment, and test details.
