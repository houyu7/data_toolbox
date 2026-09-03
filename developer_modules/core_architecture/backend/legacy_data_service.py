from __future__ import annotations

from server import legacy_core as core


def demo_pdf(relative_path: str) -> bytes:
    return core.demo_pdf_bytes(relative_path)


def channel_dashboard() -> dict:
    return core.channel_dashboard()


def version() -> dict:
    return {"version": core.APP_VERSION, "root": str(core.ROOT), "server_file": str(core.ROOT / "toolbox_server.py")}


def labels() -> dict:
    return {"labels": core.ALL_LABELS, "fixed_labels": core.FIXED_LABELS}


def channel_items(label: str) -> dict:
    return core.channel_items(label)


def external_feature_methods() -> dict:
    return {"methods": core.external_feature_methods()}


def datasets() -> dict:
    payload = [core.summarize_dataset(core.dataset_id_for(p)) for p in core.iter_data_files()]
    return {"datasets": payload}


def summary(dataset_id: str) -> dict:
    return core.summarize_dataset(dataset_id)


def extract_features(payload: dict) -> dict:
    dataset_id = payload["dataset_id"]
    kind = core.infer_kind(core.dataset_path(dataset_id))
    if kind == "tabular":
        return core.csv_features(dataset_id, payload.get("methods", []))
    if kind == "image":
        return core.image_features(dataset_id)
    return {"features": {}, "message": "Video feature extraction is scaffolded for OpenCV/moviepy integration."}


def run_external_feature(payload: dict) -> dict:
    return core.run_external_feature(payload["method_id"], payload["path"])


def recommend_methods(payload: dict) -> dict:
    summary_payload = core.summarize_dataset(payload["dataset_id"])
    return core.recommend_methods(summary_payload, payload.get("goal", ""))
