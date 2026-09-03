from __future__ import annotations

import importlib


CHANNEL_SLUGS = (
    "pen",
    "grasp",
    "posture",
    "gesture",
    "eye",
    "tactile",
    "emg",
    "ecg",
    "speech",
    "face",
)


def load_channel_api_routers():
    routers = []
    for slug in CHANNEL_SLUGS:
        try:
            routers.append(importlib.import_module(f"developer_modules.interaction_channels.{slug}.backend.api"))
        except ImportError:
            continue
    return routers
