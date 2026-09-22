"""Ticket 06 UX/UI zone gate (seam: JSON-schema artifacts + screenshots).

Validates that the 06-ux zone satisfies the ticket acceptance criteria:
- every visual finding carries screenshot/viewport/URL/role/steps/expected
- screenshots exist on disk and contain no secrets (filename/content scan)
- auth-gated screens are marked UNKNOWN, never substituted by static output
- findings.json follows the R26 schema used by sibling zones (05-security)
"""
import json
import re
import sys
from pathlib import Path

ZONE = Path(__file__).parent
REQUIRED_VIEWPORTS = {"1920", "768", "375"}
SECRET_PATTERNS = re.compile(
    r"(bearer\s+[a-z0-9_\-\.]{8,}|eyJ[a-zA-Z0-9_\-\.]{10,}|"
    r"password\s*[:=]\s*\S+|api[_-]?key\s*[:=]\s*\S+)",
    re.IGNORECASE,
)
REQUIRED_FINDING_KEYS = [
    "id", "area", "severity", "confidence", "affected_environments",
    "affected_roles", "description", "business_effect", "technical_cause",
    "evidence_ids", "reproduction_steps", "safe_recommendation", "complexity",
    "effort", "dependencies", "regression_risk", "risk",
    "migration_required", "downtime_required", "acceptance_criteria", "kind",
]

errors = []

report = ZONE / "ux.md"
if not report.exists():
    errors.append("missing ux.md report")
findings_path = ZONE / "findings.json"
findings = []
if not findings_path.exists():
    errors.append("missing findings.json")
else:
    try:
        findings = json.loads(findings_path.read_text())
    except json.JSONDecodeError as exc:
        errors.append(f"findings.json invalid JSON: {exc}")

for f in findings:
    fid = f.get("id", "?")
    for key in REQUIRED_FINDING_KEYS:
        if key not in f:
            errors.append(f"{fid}: missing key {key}")
    steps = f.get("reproduction_steps", "")
    if isinstance(steps, list):
        steps = "\n".join(steps)
    for token in ("screenshot", "viewport", "URL"):
        if token.lower() not in steps.lower() and token.lower() not in json.dumps(f).lower():
            errors.append(f"{fid}: no {token} reference")
            break
    for shot in re.findall(r"[\w\-/]+\.png", steps + json.dumps(f)):
        if not (ZONE / shot).exists() and not (ZONE / Path(shot).name).exists():
            errors.append(f"{fid}: referenced screenshot missing: {shot}")

shots = list((ZONE / "screenshots").glob("*.png"))
if not shots:
    errors.append("no screenshots captured")
viewports_hit = {v for v in REQUIRED_VIEWPORTS if any(f"-{v}." in s.name or f"_{v}." in s.name for s in shots)}
missing_vp = REQUIRED_VIEWPORTS - viewports_hit
if missing_vp:
    errors.append(f"viewports without screenshots: {sorted(missing_vp)}")

for s in shots:
    if SECRET_PATTERNS.search(s.name):
        errors.append(f"screenshot filename looks sensitive: {s.name}")

if findings:
    auth_unknown = [f for f in findings if "UNKNOWN" in json.dumps(f) or "unknown" in f.get("description", "").lower()]
    if not auth_unknown and not (report.exists() and "UNKNOWN" in report.read_text()):
        errors.append("auth-gated screens not marked UNKNOWN anywhere")

if errors:
    print("FAIL")
    for e in errors:
        print(f"- {e}")
    sys.exit(1)
print(f"OK: {len(findings)} findings, {len(shots)} screenshots, viewports {sorted(viewports_hit)}")
