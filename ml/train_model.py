import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import (
    StratifiedKFold,
    cross_val_predict,
    cross_validate,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "data" / "machine_sensor_history.csv"
MODEL_PATH = ROOT / "model.joblib"
METADATA_PATH = ROOT / "model_metadata.json"
FEATURE_COLUMNS = [
    "temperature_c",
    "vibration_mm_s",
    "pressure_bar",
    "load_percent",
    "power_kw",
]
TARGET_COLUMN = "failure"
DATASET_VERSION = "synthetic-v1"
TEST_SIZE = 0.2
RANDOM_STATE = 42
CV_SPLITS = 5
DEFAULT_THRESHOLD = 0.5
THRESHOLD_CANDIDATES = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]
MIN_CV_PRECISION = 0.75
RISK_THRESHOLDS = {"warning": 0.4, "high_risk": 0.6, "failure": 0.8}
SCORING = {
    "accuracy": "accuracy",
    "precision": "precision",
    "recall_failure": "recall",
    "f1_failure": "f1",
    "roc_auc": "roc_auc",
    "pr_auc": "average_precision",
}


def build_model_candidates() -> dict[str, Pipeline]:
    return {
        "logistic_regression": Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    LogisticRegression(
                        max_iter=2000,
                        class_weight="balanced",
                        random_state=RANDOM_STATE,
                        solver="liblinear",
                    ),
                ),
            ]
        ),
        "random_forest": Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    RandomForestClassifier(
                        n_estimators=300,
                        class_weight="balanced",
                        random_state=RANDOM_STATE,
                        n_jobs=1,
                    ),
                ),
            ]
        ),
        "gradient_boosting": Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    GradientBoostingClassifier(
                        random_state=RANDOM_STATE,
                        n_estimators=180,
                        learning_rate=0.05,
                        max_depth=3,
                    ),
                ),
            ]
        ),
    }


def read_dataset(path: Path = DATASET_PATH) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(f"Dataset not found at {path}")
    dataset = pd.read_csv(path)
    required_columns = FEATURE_COLUMNS + [TARGET_COLUMN]
    missing_columns = sorted(set(required_columns) - set(dataset.columns))
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {', '.join(missing_columns)}")
    if dataset.empty:
        raise ValueError("Dataset must contain at least one row")
    if dataset[TARGET_COLUMN].isna().any() or not set(dataset[TARGET_COLUMN].unique()) <= {0, 1}:
        raise ValueError("Failure target must contain only non-null binary values 0 and 1")
    if dataset[TARGET_COLUMN].nunique() != 2:
        raise ValueError("Dataset must contain both normal and failure target classes")
    for feature in FEATURE_COLUMNS:
        if not pd.api.types.is_numeric_dtype(dataset[feature]):
            raise ValueError(f"Feature {feature} must be numeric")
        if np.isinf(dataset[feature].dropna()).any():
            raise ValueError(f"Feature {feature} contains infinite values")
    return dataset


def _binary_metrics(
    actual: pd.Series | np.ndarray,
    probabilities: np.ndarray,
    threshold: float,
) -> dict[str, Any]:
    predicted = (probabilities >= threshold).astype(int)
    matrix = confusion_matrix(actual, predicted, labels=[0, 1])
    true_negative, false_positive, false_negative, true_positive = (
        int(matrix[0, 0]),
        int(matrix[0, 1]),
        int(matrix[1, 0]),
        int(matrix[1, 1]),
    )
    return {
        "threshold": float(threshold),
        "accuracy": float(accuracy_score(actual, predicted)),
        "precision_failure": float(precision_score(actual, predicted, zero_division=0)),
        "recall_failure": float(recall_score(actual, predicted, zero_division=0)),
        "f1_failure": float(f1_score(actual, predicted, zero_division=0)),
        "roc_auc": float(roc_auc_score(actual, probabilities)),
        "pr_auc": float(average_precision_score(actual, probabilities)),
        "confusion_matrix": {
            "TN": true_negative,
            "FP": false_positive,
            "FN": false_negative,
            "TP": true_positive,
        },
    }


def _threshold_analysis(
    actual: pd.Series,
    out_of_fold_probabilities: np.ndarray,
    holdout_actual: pd.Series,
    holdout_probabilities: np.ndarray,
) -> tuple[float, list[dict[str, Any]], list[dict[str, Any]]]:
    cv_results = [
        _binary_metrics(actual, out_of_fold_probabilities, threshold)
        for threshold in THRESHOLD_CANDIDATES
    ]
    eligible = [
        result for result in cv_results
        if result["precision_failure"] >= MIN_CV_PRECISION
    ]
    if not eligible:
        raise ValueError(
            "No alert threshold met the minimum cross-validated failure precision"
        )
    selected = max(
        eligible,
        key=lambda result: (
            result["recall_failure"],
            result["precision_failure"],
            result["threshold"],
        ),
    )
    holdout_results = [
        _binary_metrics(holdout_actual, holdout_probabilities, result["threshold"])
        for result in cv_results
    ]
    return selected["threshold"], cv_results, holdout_results


def train_and_evaluate() -> tuple[Pipeline, dict[str, Any]]:
    dataset = read_dataset()
    features = dataset[FEATURE_COLUMNS]
    target = dataset[TARGET_COLUMN]
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=target,
    )
    cross_validation = StratifiedKFold(
        n_splits=CV_SPLITS,
        shuffle=True,
        random_state=RANDOM_STATE,
    )
    candidates = build_model_candidates()
    comparison: dict[str, Any] = {}
    fitted_candidates: dict[str, Pipeline] = {}

    for name, candidate in candidates.items():
        cv_scores = cross_validate(
            candidate,
            x_train,
            y_train,
            cv=cross_validation,
            scoring=SCORING,
            n_jobs=1,
            return_train_score=False,
        )
        cv_summary = {
            metric: {
                "mean": float(np.mean(cv_scores[f"test_{metric}"])),
                "std": float(np.std(cv_scores[f"test_{metric}"], ddof=0)),
            }
            for metric in SCORING
        }
        candidate.fit(x_train, y_train)
        probabilities = candidate.predict_proba(x_test)[:, list(candidate.classes_).index(1)]
        comparison[name] = {
            "cross_validation": cv_summary,
            "holdout_at_default_threshold": _binary_metrics(
                y_test, probabilities, DEFAULT_THRESHOLD
            ),
        }
        fitted_candidates[name] = candidate

    selected_name = max(
        candidates,
        key=lambda name: (
            comparison[name]["cross_validation"]["recall_failure"]["mean"],
            comparison[name]["cross_validation"]["f1_failure"]["mean"],
            comparison[name]["cross_validation"]["pr_auc"]["mean"],
        ),
    )
    selected_model = fitted_candidates[selected_name]
    out_of_fold_probabilities = cross_val_predict(
        build_model_candidates()[selected_name],
        x_train,
        y_train,
        cv=cross_validation,
        method="predict_proba",
        n_jobs=1,
    )[:, 1]
    holdout_probabilities = selected_model.predict_proba(x_test)[
        :, list(selected_model.classes_).index(1)
    ]
    selected_threshold, cv_thresholds, holdout_thresholds = _threshold_analysis(
        y_train,
        out_of_fold_probabilities,
        y_test,
        holdout_probabilities,
    )
    alert_threshold_metrics = _binary_metrics(y_test, holdout_probabilities, selected_threshold)
    comparison[selected_name]["holdout_at_selected_threshold"] = alert_threshold_metrics

    metadata = {
        "model_name": selected_name,
        "model_version": "v2.0",
        "features": FEATURE_COLUMNS,
        "feature_order": FEATURE_COLUMNS,
        "feature_columns": FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
        "threshold": selected_threshold,
        "threshold_selection": {
            "method": "highest cross-validated failure recall subject to minimum precision",
            "minimum_cv_precision": MIN_CV_PRECISION,
            "selected_threshold": selected_threshold,
            "candidate_thresholds": THRESHOLD_CANDIDATES,
            "cross_validation": cv_thresholds,
            "holdout": holdout_thresholds,
        },
        "risk_thresholds": RISK_THRESHOLDS,
        "feature_ranges": {
            feature: {
                "min": float(x_train[feature].min()),
                "max": float(x_train[feature].max()),
            }
            for feature in FEATURE_COLUMNS
        },
        "training_date": datetime.now(timezone.utc).isoformat(),
        "dataset": DATASET_PATH.relative_to(ROOT.parent).as_posix(),
        "dataset_version": DATASET_VERSION,
        "dataset_rows": int(len(dataset)),
        "dataset_failure_count": int(target.sum()),
        "dataset_failure_rate": float(target.mean()),
        "training_rows": int(len(x_train)),
        "holdout_rows": int(len(x_test)),
        "cross_validation": {
            "strategy": "StratifiedKFold",
            "folds": CV_SPLITS,
            "shuffle": True,
            "random_state": RANDOM_STATE,
        },
        "model_comparison": comparison,
        "evaluation": {
            "selected_model": selected_name,
            "default_threshold": _binary_metrics(
                y_test, holdout_probabilities, DEFAULT_THRESHOLD
            ),
            "selected_threshold": alert_threshold_metrics,
        },
        "threshold_policy": (
            "An alert is a non-normal prediction. The selected threshold prioritizes "
            "failure recall while requiring cross-validated failure precision >= "
            f"{MIN_CV_PRECISION:.2f}; risk bands remain separately defined."
        ),
    }
    return selected_model, metadata


def main() -> None:
    model, metadata = train_and_evaluate()
    joblib.dump(model, MODEL_PATH)
    model_hash = hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest()
    metadata["artifact_sha256"] = model_hash
    metadata["dataset_sha256"] = hashlib.sha256(DATASET_PATH.read_bytes()).hexdigest()
    METADATA_PATH.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    matrix = metadata["evaluation"]["selected_threshold"]["confusion_matrix"]
    print(f"Selected model: {metadata['model_name']} {metadata['model_version']}")
    print(f"Selected alert threshold: {metadata['threshold']:.2f}")
    print(
        "Holdout confusion matrix (TN/FP/FN/TP): "
        f"{matrix['TN']}/{matrix['FP']}/{matrix['FN']}/{matrix['TP']}"
    )
    print(f"Model SHA-256: {model_hash}")
    print(f"Model saved to {MODEL_PATH}")
    print(f"Metadata saved to {METADATA_PATH}")


if __name__ == "__main__":
    main()
