from __future__ import annotations

from server import legacy_core as core


def collection_overview() -> dict:
    return core.nsd_collection_overview()


def case_database() -> dict:
    return core.load_case_database()


def nsd_case_database() -> dict:
    return core.nsd_case_database()


def register_patient(payload: dict) -> dict:
    patient = core.register_patient(payload)
    return {"patient": patient, **core.load_case_database()}


def add_patient_test(payload: dict) -> dict:
    record = core.add_patient_test(payload)
    return {"record": record, **core.load_case_database()}


def launch_collection_system() -> dict:
    return core.launch_nsd_data_system()
