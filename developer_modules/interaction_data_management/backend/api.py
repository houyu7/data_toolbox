from __future__ import annotations

from urllib.parse import urlparse

from server import legacy_core as core
from developer_modules.interaction_data_management.backend import service


def handle_get(handler, parsed) -> bool:
    if parsed.path == "/api/nsd-collection-overview":
        core.response(handler, 200, service.collection_overview())
        return True
    if parsed.path == "/api/cases":
        core.response(handler, 200, service.case_database())
        return True
    if parsed.path == "/api/nsd-cases":
        core.response(handler, 200, service.nsd_case_database())
        return True
    return False


def handle_post(handler, parsed, body) -> bool:
    if parsed.path == "/api/register-patient":
        core.response(handler, 200, service.register_patient(body))
        return True
    if parsed.path == "/api/add-patient-test":
        core.response(handler, 200, service.add_patient_test(body))
        return True
    if parsed.path == "/api/launch-nsd-data-system":
        core.response(handler, 200, service.launch_collection_system())
        return True
    return False
