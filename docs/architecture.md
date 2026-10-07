# Architecture

The system follows the pattern: `Frontend -> REST API -> Backend -> ML Model -> Database`.

## 1. System architecture diagram
```text
+---------------------+
| User / Operator     |
| Browser / Frontend  |
+----------+----------+
           |
           v
+---------------------+
| React + Vite        |
| TypeScript Frontend  |
| Dashboard / Forms    |
+----------+----------+
           |
           v
+---------------------+
| FastAPI Backend     |
| Validation + Auth    |
| Business Logic      |
+----------+----------+
           |
           v
+---------------------+
| ML Inference Layer   |
| Saved joblib model  |
| Feature preprocessing|
+----------+----------+
           |
           v
+---------------------+
| SQLite / Postgres   |
| users / machines    |
| predictions          |
+---------------------+
```

## 2. Data flow
1. User logs in to the frontend.
2. User enters sensor values on the prediction page.
3. Frontend sends a POST request to the `/predictions` route.
4. Backend validates payload values and checks machine existence.
5. Backend verifies the selected machine and uses the model bundle loaded at API startup.
6. One inference computes probability, metadata-backed risk class, and any training-range warnings.
7. That exact result is saved to the database as prediction history and returned to the client.
8. The dashboard aggregates the latest saved prediction per machine; machines without predictions remain a separate category.
9. Alembic migrations are applied before the API accepts traffic; startup does not create tables.
10. `GET /health` reports process liveness; `GET /ready` verifies both a database query and the cached model bundle.

## 3. API flow
```text
POST /auth/login
  -> validate credentials
  -> issue JWT token

POST /predictions
  -> validate sensor input
  -> verify selected machine
  -> use cached model and metadata
  -> generate probability once
  -> classify risk
  -> store the same prediction result
  -> return result to client

GET /predictions/dashboard
  -> count all history records
  -> select each machine's latest prediction
  -> report exclusive status groups and machines without a prediction

Database deployment
  -> alembic upgrade head
  -> start FastAPI after the database schema is current
  -> readiness succeeds only when database and model are usable

Production runtime:
  Vercel static frontend -> Vercel Python Function (FastAPI ASGI)
  -> Supabase PostgreSQL via psycopg pooler -> bundled Random Forest artifacts
```

## 4. ERD
```text
users
- id (PK)
- name
- email
- password_hash
- role
- created_at

machines
- id (PK)
- machine_code (UNIQUE)
- machine_name
- location
- temperature_c
- vibration_mm_s
- status
- created_at
- archived_at (nullable)

predictions
- id (PK)
- machine_id (FK -> machines.id, NOT NULL)
- input_data (JSON)
- prediction
- probability
- risk_level
- recommended_action
- model_version
- created_at
```

One machine may have many predictions. Users are not currently linked to machines or predictions. A machine is archived, not physically deleted, so its predictions remain available as history.

## 5. Component responsibilities
- Frontend: user interactions, dashboard, validation feedback, visual analytics
- Backend: API contracts, auth, DB logic, request validation, ML inference orchestration
- ML Layer: model loading and prediction generation from feature vector
- Database: persistence of users, machines, and prediction history

## 6. Design decisions
- SQLite is used for local development and fast iteration.
- PostgreSQL uses the configured SQLAlchemy `DATABASE_URL` and psycopg 3; no dialect is hardcoded into database services.
- Alembic owns production schema creation and evolution; the initial revision can adopt the prior unversioned schema without discarding rows.
- Vercel serverless instances use SQLAlchemy `NullPool`; psycopg prepared statements are disabled for transaction-pooler requests. Migrations run as a separate deployment step.
- ML artifacts are bundled under `backend/ml/` for Vercel's backend project root and are checked against the canonical training files in `ml/`.
- Machines are archived rather than physically deleted so historical predictions retain their machine relation.
- Development can seed a sample machine; production mode does not generate sample machine records.
- The backend loads and validates the model bundle once per process and performs inference once per prediction request.
- Risk bands and observed training feature ranges are stored in model metadata and served to the prediction UI.
- Authentication uses token-based local validation, plus hashed storage for password values.
