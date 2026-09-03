from __future__ import annotations

from urllib.parse import parse_qs

from server import legacy_core as core
from developer_modules.core_architecture.backend import legacy_data_service as service


def handle_get(handler, parsed) -> bool:
    if parsed.path == "/api/demo-feature-pdf":
        relative_path = parse_qs(parsed.query).get("path", [""])[0]
        core.response(handler, 200, service.demo_pdf(relative_path), "application/pdf")
        return True
    if parsed.path == "/api/channels":
        core.response(handler, 200, service.channel_dashboard())
        return True
    if parsed.path == "/api/version":
        core.response(handler, 200, service.version())
        return True
    if parsed.path == "/api/labels":
        core.response(handler, 200, service.labels())
        return True
    if parsed.path == "/api/channel-items":
        label = parse_qs(parsed.query).get("label", [""])[0]
        core.response(handler, 200, service.channel_items(label))
        return True
    if parsed.path == "/api/external-feature-methods":
        core.response(handler, 200, service.external_feature_methods())
        return True
    if parsed.path == "/api/datasets":
        core.response(handler, 200, service.datasets())
        return True
    if parsed.path == "/api/summary":
        dataset_id = parse_qs(parsed.query).get("dataset_id", [""])[0]
        core.response(handler, 200, service.summary(dataset_id))
        return True
    return False


def handle_post(handler, parsed, body) -> bool:
    if parsed.path == "/api/features":
        core.response(handler, 200, service.extract_features(body))
        return True
    if parsed.path == "/api/run-external-feature":
        core.response(handler, 200, service.run_external_feature(body))
        return True
    if parsed.path == "/api/recommend":
        core.response(handler, 200, service.recommend_methods(body))
        return True
    return False
