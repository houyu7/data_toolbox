from __future__ import annotations

from server import legacy_core as core


def target_columns(channels: list[str]) -> dict:
    enriched = core.discover_target_columns_for_channels([ch for ch in channels if ch])
    return {"targets": [item["name"] for item in enriched], "target_details": enriched}


def exploration_history() -> dict:
    return {"history": core.load_multichannel_history()}


def clear_exploration_history() -> dict:
    core.save_multichannel_history([])
    return {"history": []}


def analyze_features(payload: dict) -> dict:
    return core.multichannel_feature_analysis(payload.get("channels", []), payload.get("target_column", ""), payload.get("goal", ""))


def explore_fusion_features(payload: dict) -> dict:
    result = core.multichannel_explore(payload.get("channels", []), payload.get("target_column", ""), payload.get("goal", ""))
    result["history_record"] = core.append_multichannel_history(result)
    return result


def generate_demo_data() -> dict:
    return core.generate_demo_multichannel_data()
