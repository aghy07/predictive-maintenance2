# Black-box testing

## Goal and scope
These manual scenarios validate externally observable behavior through the UI/API contract. They are not a claim that browser-driven end-to-end automation has been implemented or run.

## Acceptance scenarios
| Scenario | Action | Expected result |
|---|---|---|
| Login success | Sign in with a configured active account | Dashboard opens and authenticated requests succeed |
| Login rejection | Submit an incorrect password | Session is not granted; a clear authentication error appears |
| Dashboard empty state | Open dashboard with no prediction history | Empty state appears; no fabricated risk totals |
| Machine selection | Open machine list or prediction selector | Active machines appear; archived machines are absent |
| Valid prediction | Submit valid sensor values for an active machine | Probability, risk label, recommendation, and applicable range warnings appear |
| Prediction persistence | Open history after making a prediction | The result appears with its machine and timestamp |
| Invalid values | Submit negative, non-finite, missing, or rejected values through the API | Validation error is returned and no prediction is stored |
| Missing machine | Request a prediction for an unknown machine | Request is rejected and no prediction is stored |
| Archived machine | Archive a machine and attempt a new prediction | It is unavailable for selection; new prediction is rejected; previous history remains |
| Dashboard aggregation | Create multiple predictions for one machine | Dashboard counts its latest status once; history retains all records |
| API unavailable | Load a view while its API request fails | Retryable error state appears, not a success-shaped empty state |
| Logout | Sign out from an authenticated session | Protected views/API requests require authentication again |

## Input partitions and boundaries
| Input partition | Example | Expected outcome |
|---|---|---|
| Valid finite sensor value | temperature 80 | Accepted when all request fields and machine are valid |
| Missing sensor field | Omit temperature | Validation error |
| Negative sensor value | temperature -5 | Rejected |
| Physically/schema-invalid value | load 120 | Rejected by request validation |
| Wrong value type | temperature `"abc"` | Validation error |
| Out-of-training-range but valid value | A finite value above the recorded training range | Accepted with extrapolation warning; not treated as a physical limit |

## Deployment smoke check
Apply `alembic upgrade head`, configure the database and a unique bootstrap administrator, start the API and frontend, then exercise login, machine listing, one prediction, and prediction history. The Docker backend entrypoint runs the migration before Uvicorn.

Actual production scenario results must be recorded from a live deployment; no such deployment has been verified in the current environment. Passing these scenarios does not establish production readiness. The model and dataset are synthetic; live PostgreSQL integration, real-equipment validation, load testing, and operational safety acceptance remain outstanding.
