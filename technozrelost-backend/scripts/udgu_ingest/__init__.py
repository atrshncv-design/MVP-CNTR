"""Пакет пайплайна выгрузки УдГУ (normalize+validate+report)."""

from scripts.udgu_ingest.models import (
    Department,
    Equipment,
    Patent,
    Person,
    Priority,
    Service,
    UdguImport,
)

__all__ = [
    "Department",
    "Equipment",
    "Patent",
    "Person",
    "Priority",
    "Service",
    "UdguImport",
]
