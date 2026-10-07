# Phase 1 — Requirements analysis

## Problem statement
Manufacturing companies need a low-cost way to detect machine health deterioration before a failure causes downtime, quality loss, and safety risk. Decisions are often made from manual inspection or delayed alarm reports, which makes early intervention difficult.

## Proposed solution
PredictiveMaintenance provides a decision-support dashboard where operators can enter machine sensor values such as temperature, vibration, pressure, load, and power. The backend loads a trained machine-learning model and returns a risk probability together with a practical recommendation.

## Target users
- Operators
- Maintenance technicians
- Plant managers
- Admin users

## Core use cases
- Login and session management
- Dashboard overview
- Machine registration and review
- Sensor input and prediction execution
- Risk interpretation and maintenance recommendation
- Historical prediction review
- Machine and profile updates
- Logout and session closing

## Functional requirements
- The application must allow a user to sign in.
- The dashboard should summarize machine and prediction counts.
- Users can add, edit, and review machines.
- Users can submit sensor values for prediction.
- The API must return prediction label, probability, and recommendation.
- Predictions must be saved to history for auditing.
- Invalid input should be rejected with helpful validation errors.
- The frontend must respond clearly to error and loading states.

## Non-functional requirements
- Performance: prediction and dashboard queries should run fast.
- Security: passwords are hashed and API access is protected by token-based auth.
- Reliability: the app should handle missing data and validation errors cleanly.
- Maintainability: code is separated into frontend, backend, ML, and docs.
- Usability: the UI is modern, clean, and responsive.
- Scalability: the design is ready for PostgreSQL and cloud deployment.

## Acceptance criteria
- A user can log in successfully.
- The dashboard displays machine and prediction metrics.
- A valid prediction request returns a risk level and recommendation.
- Invalid values return a clean validation error.
- Prediction history is persisted and visible.
- The app builds and runs locally.
