import hashlib
import json
from pathlib import Path

import pandas as pd
import pytest

from ml.train_model import (
    DATASET_PATH,
    FEATURE_COLUMNS,
    MODEL_PATH,
    METADATA_PATH,
    TARGET_COLUMN,
    build_model_candidates,
    read_dataset,
)


def test_dataset_is_synthetic_versioned_and_schema_valid():
    dataset = read_dataset()

    assert len(dataset) == 1800
    assert list(dataset.columns) == FEATURE_COLUMNS + [TARGET_COLUMN]
    assert set(dataset[TARGET_COLUMN].unique()) == {0, 1}


def test_candidate_models_use_pipeline_preprocessing():
    candidates = build_model_candidates()

    assert set(candidates) == {
        "logistic_regression",
        "random_forest",
        "gradient_boosting",
    }
    for model in candidates.values():
        assert model.steps[0][0] == "imputer"
    assert [name for name, _ in candidates["logistic_regression"].steps] == [
        "imputer",
        "scaler",
        "classifier",
    ]


def test_saved_model_metadata_metrics_and_hashes_are_consistent():
    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))

    assert metadata["model_name"] == "random_forest"
    assert metadata["features"] == FEATURE_COLUMNS
    assert metadata["feature_order"] == FEATURE_COLUMNS
    assert metadata["feature_columns"] == FEATURE_COLUMNS
    assert metadata["target_column"] == TARGET_COLUMN
    assert metadata["dataset_rows"] == 1800
    assert metadata["threshold"] == metadata["risk_thresholds"]["warning"]
    assert metadata["risk_thresholds"] == {
        "warning": 0.4,
        "high_risk": 0.6,
        "failure": 0.8,
    }
    assert metadata["artifact_sha256"] == hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest()
    assert metadata["dataset_sha256"] == hashlib.sha256(DATASET_PATH.read_bytes()).hexdigest()

    comparison = metadata["model_comparison"]
    assert set(comparison) == {
        "logistic_regression",
        "random_forest",
        "gradient_boosting",
    }
    selected = max(
        comparison,
        key=lambda name: (
            comparison[name]["cross_validation"]["recall_failure"]["mean"],
            comparison[name]["cross_validation"]["f1_failure"]["mean"],
            comparison[name]["cross_validation"]["pr_auc"]["mean"],
        ),
    )
    assert selected == metadata["model_name"]

    threshold_analysis = metadata["threshold_selection"]
    assert threshold_analysis["selected_threshold"] == metadata["threshold"]
    eligible = [
        item
        for item in threshold_analysis["cross_validation"]
        if item["precision_failure"] >= threshold_analysis["minimum_cv_precision"]
    ]
    assert threshold_analysis["selected_threshold"] == max(
        eligible,
        key=lambda item: (
            item["recall_failure"],
            item["precision_failure"],
            item["threshold"],
        ),
    )["threshold"]

    holdout_matrix = metadata["evaluation"]["selected_threshold"]["confusion_matrix"]
    assert sum(holdout_matrix.values()) == metadata["holdout_rows"]
    assert all(
        metric in metadata["evaluation"]["selected_threshold"]
        for metric in (
            "accuracy",
            "precision_failure",
            "recall_failure",
            "f1_failure",
            "roc_auc",
            "pr_auc",
        )
    )


def test_dataset_loader_rejects_missing_features(tmp_path: Path):
    dataset_path = tmp_path / "invalid.csv"
    pd.DataFrame({"temperature_c": [20], "failure": [0]}).to_csv(dataset_path, index=False)

    with pytest.raises(ValueError, match="missing required columns"):
        read_dataset(dataset_path)


def test_dataset_loader_rejects_non_binary_target(tmp_path: Path):
    dataset_path = tmp_path / "invalid-target.csv"
    dataset = pd.DataFrame(
        {
            **{feature: [1.0, 2.0] for feature in FEATURE_COLUMNS},
            TARGET_COLUMN: [0, 2],
        }
    )
    dataset.to_csv(dataset_path, index=False)

    with pytest.raises(ValueError, match="binary values"):
        read_dataset(dataset_path)
