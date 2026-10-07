# ERD and database schema

```text
+-------------------+        +----------------------+
| users             |        | machines             |
|-------------------|        |----------------------|
| id PK             |        | id PK                |
| name              |        | machine_code UNIQUE  |
| email UNIQUE      |        | machine_name         |
| password_hash     |        | location             |
| role              |        | temperature_c        |
| is_active         |        | vibration_mm_s       |
| created_at        |        | status               |
+-------------------+        | created_at           |
                             | archived_at NULL     |
                             +----------+-----------+
                                        | 1
                                        |
                                        | 0..N
                             +----------v-----------+
                             | predictions          |
                             |----------------------|
                             | id PK                |
                             | machine_id FK NOT NULL|
                             | input_data JSON      |
                             | prediction           |
                             | probability          |
                             | risk_level           |
                             | recommended_action   |
                             | model_version        |
                             | created_at           |
                             +----------------------+
```

## Relationships and lifecycle

- One machine has zero or more prediction records. `predictions.machine_id` references `machines.id` and is non-nullable.
- Prediction records are historical audit data and are not cascade-deleted with their machine.
- `DELETE /machines/{id}` archives the machine by setting `archived_at`; the machine and all its prediction history remain stored. Archived machines are omitted from selection and active dashboard totals.
- Users currently have no database relationship to machines or predictions. The application does not yet promise per-user ownership or prediction attribution, so `created_by` is intentionally not modeled.

## Constraints, nullability, and indexes

| Table | Column(s) | Constraint / index | Nullable |
|---|---|---|---|
| users | id | Primary key | No |
| users | email | Unique index `ix_users_email` | No |
| users | name, password_hash | — | No |
| users | role, is_active | Defaults to `operator`, `true` | No |
| users | created_at | Database timestamp default | No |
| machines | id | Primary key | No |
| machines | machine_code | Unique index `ix_machines_machine_code` | No |
| machines | machine_name, location | — | No |
| machines | temperature_c, vibration_mm_s, status | Defaults to `0`, `0`, `healthy` | No |
| machines | created_at | Database timestamp default | No |
| machines | archived_at | Index `ix_machines_archived_at` | Yes |
| predictions | id | Primary key | No |
| predictions | machine_id | FK to machines; composite index with id | No |
| predictions | input_data, prediction, probability, risk_level, recommended_action | — | No |
| predictions | model_version | Defaults to `v1.0` | No |
| predictions | created_at | Database timestamp default | No |

All timestamp columns use timezone-aware SQLAlchemy types. PostgreSQL persists timezone information; SQLite is used for development and does not preserve timezone offsets in the same way. SQLAlchemy's JSON type maps to PostgreSQL JSON and SQLite's JSON-compatible text storage.

## Schema source and migration

The declarative models are in `backend/app/models/`; Alembic revisions under `backend/alembic/versions/` create and evolve the schema. Application startup does not call `Base.metadata.create_all`. Run `alembic upgrade head` before serving traffic. The initial revision can adopt the application's prior unversioned SQLite schema while preserving existing records, then normal subsequent schema changes should use new revisions.

The migration's downgrade to `base` drops the application tables. Back up production data and do not use that downgrade as a routine rollback.
