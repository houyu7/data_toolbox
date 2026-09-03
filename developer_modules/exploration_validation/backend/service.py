from __future__ import annotations

from server import legacy_core as core


def train_multichannel_model(payload: dict) -> dict:
    return core.multichannel_train(
        payload.get("channels", []),
        payload.get("target_column", ""),
        payload.get("model", "linear_svm"),
        payload.get("test_ratio", 0.25),
    )


def train_dataset_model(payload: dict) -> dict:
    result = core.train_model(payload["dataset_id"], payload["target"], payload.get("model", "linear_svm"))
    return result.__dict__
