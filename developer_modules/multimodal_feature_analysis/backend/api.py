from __future__ import annotations

from urllib.parse import parse_qs

from server import legacy_core as core
from developer_modules.multimodal_feature_analysis.backend import service


def handle_get(handler, parsed) -> bool:
    if parsed.path == "/api/multichannel-targets":
        query = parse_qs(parsed.query)
        channels = query.get("channels", [""])[0].split(",") if query.get("channels") else []
        core.response(handler, 200, service.target_columns(channels))
        return True
    if parsed.path == "/api/multichannel-history":
        core.response(handler, 200, service.exploration_history())
        return True
    return False


def handle_post(handler, parsed, body) -> bool:
    if parsed.path == "/api/multichannel-feature-analysis":
        core.response(handler, 200, service.analyze_features(body))
        return True
    if parsed.path == "/api/multichannel-explore":
        core.response(handler, 200, service.explore_fusion_features(body))
        return True
    if parsed.path == "/api/clear-multichannel-history":
        core.response(handler, 200, service.clear_exploration_history())
        return True
    if parsed.path == "/api/generate-demo-multichannel-data":
        core.response(handler, 200, service.generate_demo_data())
        return True
    return False
