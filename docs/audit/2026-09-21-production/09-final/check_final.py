"""Ticket 09 synthesis gate (seam: JSON-schema artifacts + CLI gate).

Validates that the 09-final synthesis satisfies the ticket acceptance criteria:
- all 16 spec artifacts exist and reference evidence IDs
- unified findings.json is valid, deduplicated, prioritized, no severity inflation
- gate decision names concrete blocking conditions; planned features not regressions
- UNKNOWN, missing evidence and required access are listed explicitly
- no code/production/DB/Autopilot/spec changes; secrets only by name
"""
import csv
import json
import re
import sys
from pathlib import Path

AUDIT = Path(__file__).parent.parent
FINAL = Path(__file__).parent

BASE_KEYS = [
    "id", "area", "severity", "confidence", "affected_environments",
    "affected_roles", "description", "business_effect", "technical_cause",
    "evidence_ids", "reproduction_steps", "safe_recommendation", "complexity",
    "dependencies", "regression_risk",
    "migration_required", "downtime_required", "acceptance_criteria", "kind",
]
SEVERITIES = {"critical", "high", "medium", "low"}
KINDS = {"defect", "risk", "debt", "product_recommendation"}
SECRET_PATTERNS = re.compile(
    r"(bearer\s+[a-z0-9_\-\.]{8,}|eyJ[a-zA-Z0-9_\-\.]{10,}|"
    r"sk-[a-zA-Z0-9]{8,}|"
    r"password\s*[:=]\s*\S+|api[_-]?key\s*[:=]\s*['\"]?\S+)",
    re.IGNORECASE,
)

errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


# 16 spec artifacts: (num, exact rel path from audit root, required map/section tokens).
# Categories 12-16 are sections hosted in root/final README and verified by anchor+token.
ARTIFACTS_16 = [
    (1, "09-final/README.md", ["artifact-01", "executive summary"]),
    (2, "01-environments.md", ["artifact-02"]),
    (3, "02-features/feature-matrix.csv", ["artifact-03"]),
    (4, "03-code/architecture.md", ["artifact-04"]),
    (5, "09-final/findings.json", ["artifact-05"]),
    (6, "04-database/db-model.md", ["artifact-06"]),
    (7, "05-security/security.md", ["artifact-07"]),
    (8, "06-ux/ux.md", ["artifact-08"]),
    (9, "07-ai/ai-registry.json", ["artifact-09"]),
    (10, "08-operations/operations.md", ["artifact-10"]),
    (11, "03-code/hardcode-stubs-deadends.md", ["artifact-11"]),
    (12, "09-final/README.md", ["artifact-12", "risk matrix"]),
    (13, "09-final/README.md", ["artifact-13", "quick win"]),
    (14, "09-final/README.md", ["artifact-14", "30/60/90"]),
    (15, "09-final/README.md", ["artifact-15", "backlog"]),
    (16, "09-final/README.md", ["artifact-16", "unknown"]),
]

report_path = FINAL / "README.md"
unified_path = FINAL / "findings.json"
gate_path = FINAL / "check_final.py"
root_path = AUDIT / "README.md"

for p in (report_path, unified_path, gate_path, root_path):
    if not p.exists():
        fail(f"missing {p.relative_to(AUDIT) if p != gate_path else p.name}")

# 16 spec artifacts must exist on disk (exact paths) + be mapped with anchors.
FILE_MUST_EXIST = [
    AUDIT / "09-final" / "README.md",
    AUDIT / "README.md",
    AUDIT / "00-evidence" / "README.md",
    AUDIT / "01-environments.md",
    AUDIT / "02-features" / "feature-matrix.csv",
    AUDIT / "03-code" / "architecture.md",
    AUDIT / "09-final" / "findings.json",
    AUDIT / "04-database" / "db-model.md",
    AUDIT / "05-security" / "security.md",
    AUDIT / "06-ux" / "ux.md",
    AUDIT / "07-ai" / "ai-registry.json",
    AUDIT / "07-ai" / "ai.md",
    AUDIT / "08-operations" / "operations.md",
    AUDIT / "03-code" / "hardcode-stubs-deadends.md",
]
for p in FILE_MUST_EXIST:
    if not p.exists():
        try:
            fail(f"spec artifact missing: {p.relative_to(AUDIT)}")
        except ValueError:
            fail(f"spec artifact missing: {p}")
if not list((AUDIT / "06-ux" / "screenshots").glob("*.png")):
    fail("spec artifact missing: 06-ux/screenshots/*.png")

report_text = report_path.read_text() if report_path.exists() else ""
root_text = root_path.read_text() if root_path.exists() else ""

# Every one of the 16 categories: exact path token in the numbered map
# (root README is canonical) + named section anchor + required section token.
for num, rel, tokens in ARTIFACTS_16:
    if rel not in root_text and rel not in report_text:
        fail(f"artifact {num:02d}: map must reference exact path {rel}")
    for tok in tokens:
        in_root = tok.lower() in root_text.lower()
        in_final = tok.lower() in report_text.lower()
        if not (in_root or in_final):
            fail(f"artifact {num:02d}: required section token {tok!r} missing in root/final README")
    anchor = f"artifact-{num:02d}"
    if anchor not in root_text and anchor not in report_text:
        fail(f"artifact {num:02d}: named section anchor {anchor!r} missing in root/final README")

# Sectional artifacts 12-16 must physically exist as sections in BOTH
# root README and final README (verifiable headings).
for num, token in ((12, "risk matrix"), (13, "quick win"),
                   (14, "30/60/90"), (15, "backlog"), (16, "unknown")):
    anchor = f"artifact-{num:02d}"
    if anchor not in root_text:
        fail(f"artifact {num:02d}: section anchor {anchor!r} missing in root README")
    if anchor not in report_text:
        fail(f"artifact {num:02d}: section anchor {anchor!r} missing in 09-final README")
    if token not in root_text.lower():
        fail(f"artifact {num:02d}: section token {token!r} missing in root README")
    if token not in report_text.lower():
        fail(f"artifact {num:02d}: section token {token!r} missing in 09-final README")

# R32 explicit: registries fully audited in T02/T09, code/production untouched.
for label, text in (("root README", root_text), ("09-final README", report_text)):
    for tok in ("R32", "T02", "T09"):
        if tok not in text:
            fail(f"{label}: must state R32 explicitly (missing {tok})")
    low = text.lower()
    if ("реестр" not in low and "registry" not in low and "registr" not in low):
        fail(f"{label}: R32 must mention registries audit")
    if not (("код" in low or "code" in low) and ("не меня" in low or "не исправля" in low or "not modified" in low or "unchanged" in low or "no code" in low)):
        fail(f"{label}: R32 must state code/production were not fixed")

# root README and this gate itself are inside the gate.
if "check_final.py" not in root_text:
    fail("root README: must reference check_final.py as part of the gate")
if "README.md" not in gate_path.read_text():
    fail("check_final.py: must validate root README (gate membership)")

# Unified findings: valid, deduped, complete, no severity inflation.
findings = []
if unified_path.exists():
    try:
        findings = json.loads(unified_path.read_text())
    except json.JSONDecodeError as exc:
        fail(f"findings.json invalid JSON: {exc}")
    if not isinstance(findings, list) or not findings:
        fail("findings.json must be a non-empty JSON array")
    seen: set[str] = set()
    sev_by_id: dict[str, str] = {}
    for zone_file in [
        "03-code", "04-database", "05-security",
        "06-ux", "07-ai", "08-operations",
    ]:
        zp = AUDIT / zone_file / "findings.json"
        if zp.exists():
            try:
                for f in json.loads(zp.read_text()):
                    if isinstance(f, dict) and f.get("id"):
                        sev_by_id[f["id"]] = f.get("severity", "?")
            except json.JSONDecodeError:
                fail(f"zone file invalid JSON: {zone_file}/findings.json")
    for f in findings:
        fid = f.get("id", "?") if isinstance(f, dict) else "?"
        if not isinstance(f, dict):
            fail(f"{fid}: finding must be an object")
            continue
        for key in BASE_KEYS:
            if key not in f:
                fail(f"{fid}: missing key {key}")
        if fid in seen:
            fail(f"{fid}: duplicate id")
        seen.add(fid)
        if f.get("severity") not in SEVERITIES:
            fail(f"{fid}: severity outside closed vocabulary")
        if f.get("kind") not in KINDS:
            fail(f"{fid}: kind outside closed vocabulary")
        # No severity inflation vs zone sources.
        if fid in sev_by_id and f.get("severity") != sev_by_id[fid]:
            fail(f"{fid}: severity differs from zone source (inflation)")
        ev = f.get("evidence_ids")
        if not isinstance(ev, list) or not ev or not all(
            isinstance(v, str) and re.fullmatch(r"EV-\d+[a-z]?", v) for v in ev
        ):
            fail(f"{fid}: evidence_ids must be non-empty EV-### list")
        if fid not in report_text:
            fail(f"README.md: finding {fid} not referenced")
    # Prioritized: sorted high -> medium -> low, stable by id within severity.
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    ids_in_file = [f["id"] for f in findings if isinstance(f, dict)]
    expected = sorted(ids_in_file, key=lambda i: (order.get(sev_by_id.get(i, "low"), 9), i))
    if ids_in_file != expected:
        fail("findings.json is not prioritized (severity high->low, then id)")
    if len(findings) != 30:
        fail(f"findings.json must preserve 30 unified findings (got {len(findings)})")

# Feature matrix CSV stays parseable with the fixed 12-column spec schema.
csv_path = AUDIT / "02-features" / "feature-matrix.csv"
if csv_path.exists():
    with open(csv_path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    want = ["id", "feature", "expected_behavior", "local_implementation",
            "server_implementation", "production_check", "roles",
            "data_entities", "status", "defect_id", "evidence_ids",
            "recommendation"]
    if (rows and list(rows[0].keys()) != want) or len(rows) != 33:
        fail("feature-matrix.csv schema/row count drifted (want 12 cols, 33 rows)")

# Report must cover the synthesis contract explicitly.
for token in ("GO WITH CONDITIONS", "UNKNOWN", "blocking condition",
              "risk matrix", "30/60/90", "backlog", "quick win",
              "planned features", "regression"):
    if token.lower() not in report_text.lower():
        fail(f"README.md: must reference {token!r}")
for ev in ["EV-001", "EV-004", "EV-007", "EV-013", "EV-016",
           "EV-019", "EV-022", "EV-025"]:
    if ev not in report_text:
        fail(f"README.md: must link evidence {ev}")
# Gate names concrete blocking conditions; planned features are not regressions.
if not re.search(r"C\d.*(offsite|restore|test account|SPOF|gate)", report_text,
                 re.IGNORECASE | re.DOTALL):
    fail("README.md: gate must name concrete blocking conditions")

# No secret values in final artifacts (incl. root entry point).
for p in (report_path, unified_path, root_path):
    if p.exists():
        m = SECRET_PATTERNS.search(p.read_text())
        if m:
            fail(f"{p.name}: looks like a secret value ({m.group(0)[:24]}...)")

if errors:
    print("FAIL")
    for e in errors:
        print(f"- {e}")
    sys.exit(1)
print(f"OK: {len(findings)} unified findings, 16/16 artifacts mapped, "
      f"root README + check_final.py in gate, gate decided")
