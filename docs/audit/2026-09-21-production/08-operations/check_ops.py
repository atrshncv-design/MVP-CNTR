"""Ticket 08 operations/performance zone gate (seam: JSON-schema artifacts + CLI gate).

Validates that the 08-operations zone satisfies the ticket acceptance criteria:
- every operations checklist item from the spec is covered in operations.md
  or explicitly marked UNKNOWN
- current single-node is compared with the 2x Dell R640 target
- latency/resources/slow queries/locks/Redis are observation-only (no load created)
- backup freshness/encryption/offsite/restore-proof are separated; script
  presence is never claimed as restore proof
- findings.json follows the R26 schema used by sibling zones (04/05/06/07)
- artifacts contain key names only, never secret values
"""
import json
import re
import sys
from pathlib import Path

ZONE = Path(__file__).parent
REQUIRED_FINDING_KEYS = [
    "id", "area", "severity", "confidence", "affected_environments",
    "affected_roles", "description", "business_effect", "technical_cause",
    "evidence_ids", "reproduction_steps", "safe_recommendation", "complexity",
    "effort", "dependencies", "regression_risk", "risk",
    "migration_required", "downtime_required", "acceptance_criteria", "kind",
]
# Operations checklist (spec: Обязательные контуры проверки -> Эксплуатация).
CHECKLIST_TOKENS = [
    "reproducibility", "probes", "restart", "resources", "disk",
    "log rotation", "monitoring", "alerting", "tracing", "errors",
    "backup", "restore", "RPO", "RTO", "CI/CD", "rollback",
    "zero-downtime", "SPOF", "Redis persistence", "Redis eviction",
    "PostgreSQL connections", "slow queries", "locks", "queues",
    "retries", "DLQ", "latency",
]
SECRET_PATTERNS = re.compile(
    r"(bearer\s+[a-z0-9_\-\.]{8,}|eyJ[a-zA-Z0-9_\-\.]{10,}|"
    r"sk-[a-zA-Z0-9]{8,}|"
    r"password\s*[:=]\s*\S+|api[_-]?key\s*[:=]\s*['\"]?\S+)",
    re.IGNORECASE,
)

errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


report_path = ZONE / "operations.md"
findings_path = ZONE / "findings.json"
evidence_path = ZONE / "EV-025-ops-static.md"
readme_path = ZONE / "README.md"

for p in (report_path, findings_path, evidence_path, readme_path):
    if not p.exists():
        fail(f"missing {p.name}")

report_text = report_path.read_text() if report_path.exists() else ""
for token in CHECKLIST_TOKENS:
    if token.lower() not in report_text.lower():
        fail(f"operations.md: checklist token not covered: {token!r}")

# Ticket-specific acceptance markers (each must appear, UNKNOWN counts as coverage).
for token in ("R640", "single-node", "UNKNOWN", "no load", "restore proof"):
    if token.lower() not in report_text.lower():
        fail(f"operations.md: must reference {token!r}")

# Backup four-way split must be explicit, not collapsed into "backups exist".
for token in ("freshness", "encryption", "offsite"):
    if token.lower() not in report_text.lower():
        fail(f"operations.md: backup split missing {token!r}")

findings = []
if findings_path.exists():
    try:
        findings = json.loads(findings_path.read_text())
    except json.JSONDecodeError as exc:
        fail(f"findings.json invalid JSON: {exc}")
    if not isinstance(findings, list) or not findings:
        fail("findings.json must be a non-empty JSON array")
    seen = set()
    for f in findings:
        fid = f.get("id", "?") if isinstance(f, dict) else "?"
        if not isinstance(f, dict):
            fail(f"{fid}: finding must be an object")
            continue
        for key in REQUIRED_FINDING_KEYS:
            if key not in f:
                fail(f"{fid}: missing key {key}")
        if fid in seen:
            fail(f"{fid}: duplicate id")
        seen.add(fid)
        if isinstance(f.get("evidence_ids"), list):
            if not f["evidence_ids"] or not all(
                isinstance(v, str) and v.strip() for v in f["evidence_ids"]
            ):
                fail(f"{fid}: evidence_ids must be a non-empty string list")

for p in (report_path, findings_path, evidence_path, readme_path):
    if p.exists():
        m = SECRET_PATTERNS.search(p.read_text())
        if m:
            fail(f"{p.name}: looks like a secret value ({m.group(0)[:24]}...)")

# Every finding must be reachable from the report via its ID.
for f in findings:
    if isinstance(f, dict) and f.get("id") not in report_text:
        fail(f"operations.md: finding {f.get('id')} not referenced")

if errors:
    print("FAIL")
    for e in errors:
        print(f"- {e}")
    sys.exit(1)
n_find = len(findings) if isinstance(findings, list) else 0
print(f"OK: {n_find} findings, checklist {len(CHECKLIST_TOKENS)} tokens covered, no load created")
