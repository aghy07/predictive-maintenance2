# Project scope and functional requirements

This document describes the implemented project scope for evaluation and maintenance. It distinguishes available API operations from controls exposed by the current frontend.

## Project objective

PredictiveMaintenance is an educational web prototype for early risk assessment of machine failure using synthetic operational sensor data. It provides a dashboard, machine records, ML-assisted prediction, risk communication, and prediction history. It is a decision-support tool, not a replacement for inspections, technicians, or safety systems.

## User roles and access

| Capability | Administrator | Operator |
|---|---:|---:|
| Sign in and use authenticated dashboard | Yes | Yes |
| View active machines | Yes | Yes |
| Submit predictions for active machines | Yes | Yes |
| View prediction history | Yes | Yes |
| Register, update, or archive machines through the API | Yes | No |
| Provision operator accounts through the API | Yes | No |
| Public/self-registration | Not available | Not available |

The current frontend provides machine registration and a machine list. Although the API has administrator-only update and archive operations, the frontend does not currently expose edit/archive controls.

## Functional requirements

### Authentication and authorization

- Users can sign in with an email and password.
- Successful login returns a JWT for authenticated API requests.
- Protected API operations reject missing or invalid credentials.
- Inactive accounts cannot use authenticated functionality.
- Machine mutations and operator provisioning require the administrator role.
- `POST /auth/register` is an administrator-only operator-provisioning endpoint; it is not public registration.

### Dashboard and machine records

- Authenticated users can view dashboard totals and latest-per-machine risk summaries.
- Authenticated users can list active machines.
- Administrators can create, update, and archive machine records through the API.
- Archiving preserves the machine row and its prediction history; archived machines are not available for new predictions.
- Development may seed a sample machine; production startup does not seed sample records.

### Prediction and history

- A prediction request identifies an existing active machine and includes temperature, vibration, pressure, load, and power values.
- The API validates identifiers and finite, non-negative numeric inputs before inference.
- The response includes a model label, probability, risk level, recommendation, model version, and applicable out-of-training-range warnings.
- The same inference result is persisted as a prediction record.
- Authenticated users can review saved predictions in history.
- Dashboard risk totals are based on the latest prediction per machine rather than counting each historical row as a current machine status.

### Readiness and schema management

- `/health` reports process liveness.
- `/ready` checks database connectivity and model artifact availability.
- Alembic manages database schema revisions; application startup does not create tables.
- Production runtime requires PostgreSQL through the configured Supabase transaction pooler. SQLite is intended for local development/tests.

## Non-functional expectations

- **Security:** keep server secrets and database credentials in protected environment configuration; never place them in frontend build variables or documentation.
- **Usability:** provide clear loading, empty, validation, and API-error states and responsive navigation.
- **Maintainability:** keep frontend, backend/API, ML artifacts/pipeline, and documentation separated.
- **Reliability:** reject invalid prediction requests explicitly and preserve prediction history when machines are archived.
- **Performance:** keep dashboard and prediction workflows suitable for interactive use; no production latency target or load-test result is claimed here.

## Acceptance flow

1. An active user signs in.
2. The authenticated dashboard and machine list load.
3. An active machine can be selected for a prediction.
4. A valid request returns a risk assessment and creates a history record.
5. Invalid values, unknown machines, and archived machines are rejected without creating a prediction.
6. An operator cannot perform administrator-only operations; an administrator can perform those operations through the API.
7. A saved prediction remains visible in history after a page refresh when the same database is in use.

Automated test and production verification evidence is tracked separately in [testing.md](./testing.md), [white-box-testing.md](./white-box-testing.md), [black-box-testing.md](./black-box-testing.md), and [deployment.md](./deployment.md).

## Scope and limitations

- The checked-in dataset and target labels are synthetic, not measurements from operating industrial machinery.
- The project demonstrates an ML workflow, not validated field performance or calibrated real-world failure probabilities.
- Real-equipment validation, load testing, production acceptance, and safety certification are outside the demonstrated scope.
- The current frontend does not expose all administrator machine-management operations available in the API.
