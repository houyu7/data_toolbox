from __future__ import annotations

from server import legacy_core as core
from developer_modules.exploration_validation.backend import service


def handle_post(handler, parsed, body) -> bool:
    if parsed.path == "/api/multichannel-train":
        core.response(handler, 200, service.train_multichannel_model(body))
        return True
    if parsed.path == "/api/train":
        core.response(handler, 200, service.train_dataset_model(body))
        return True
    return False
