# White-box testing

## Recorded execution status
The last recorded full backend suite run during the operator-provisioning work completed with **84 passed** and one dependency deprecation warning. This documentation update did not rerun the suite. The coverage inventory below describes tested behaviors; it is not a claim that production integration tests passed.

## Testing objective
White-box testing validates internal logic, decision branches, and failure paths to ensure the app behaves correctly under both normal and exceptional conditions.

## Covered backend behaviors
- health-only endpoint availability
- readiness requires an active database connection and verified model artifacts
- production configuration rejects SQLite, missing bootstrap-admin credentials, and non-HTTPS frontend origins
- admin-only operator provisioning; unauthenticated and operator requests are rejected
- login success and failure conditions
- prediction request validation
- refusal of negative and non-finite sensor values
- warnings for values outside observed training ranges (without treating the ranges as physical limits)
- risk-band boundary behavior
- cached model artifact loading and explicit artifact failure
- one inference per request and persisted prediction history
- unknown/missing machine rejection
- archived-machine exclusion and refusal of new predictions for archived records
- production startup does not seed the development sample machine
- latest-per-machine dashboard counts and machines without predictions
- fresh and legacy SQLite migration, schema drift check, foreign-key enforcement, and PostgreSQL DDL compilation
- synthetic dataset generation contract, pipeline candidate comparison, metadata, evaluation metrics, and artifact checksum

## Example test cases
| Test | Condition | Expected result |
|---|---|---|
| healthcheck | GET /health | HTTP 200 and ok status |
| readiness | GET /ready with database and model available | HTTP 200 and both dependencies reported ready |
| operator provisioning | admin POST /auth/register with a valid user payload | operator created without returning an operator token |
| registration authorization | no token or operator token on POST /auth/register | HTTP 401 or 403 |
| login | valid credentials | authenticated response |
| prediction | valid sensor input and existing machine | one stored result with probability, risk, and warnings |
| prediction boundary | probability at 0.39, 0.40, 0.41, 0.59, 0.60, 0.61, 0.79, 0.80, 0.81 | correct metadata-backed risk band |
| dashboard | multiple predictions for one machine | latest status counted once; categories do not overlap |
| invalid auth | wrong password | HTTP 401 |

## Cyclomatic complexity example
For the function `classify_risk` in the prediction service:

```python
if probability >= risk_thresholds["failure"]:
    return "FAILURE", "high"
if probability >= risk_thresholds["high_risk"]:
    return "HIGH_RISK", "high"
if probability >= risk_thresholds["warning"]:
    return "WARNING", "medium"
return "NORMAL", "low"
```

This function contains 3 decision points, therefore its cyclomatic complexity is 4 according to the standard formula:

`Complexity = E - N + 2P`

With 3 decision points and 1 connected component, the function is still relatively straightforward and easy to test.

## Independent paths
1. probability >= 0.8
2. 0.6 <= probability < 0.8
3. 0.4 <= probability < 0.6
4. probability < 0.4

These paths cover all meaningful model outcomes for the risk classification function.

Production configuration validation is covered separately; the `classify_risk` function remains at cyclomatic complexity 4 (three decision points plus one).
