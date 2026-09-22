"""Ticket 07 AI/RAG zone gate (seam: JSON-schema artifacts + CLI gate).

Validates that the 07-ai zone satisfies the ticket acceptance criteria:
- ai-registry.json follows the exact spec schema (no extra/missing keys)
- every AI checklist item from spec is covered in ai.md or marked UNKNOWN
- live-request cap (<=200) is proven by an explicit counter file
- denylist and tenant boundaries are referenced without PII/secrets
- findings.json follows the R26 schema used by sibling zones (03/04/05/06)
- artifacts contain key names only, never secret values
"""
import json
import re
import sys
from pathlib import Path

ZONE = Path(__file__).parent
SPEC_KEYS = [
    "ai_id", "feature", "entry_point", "model_provider", "agent",
    "prompt_location_versioning", "tools", "input_context_sensitivity",
    "rag_sources_filters", "output_format_validation", "guardrails",
    "cost_controls", "observability", "fallback", "status", "tests",
    "evidence_ids",
]
STATUS_VOCAB = {
    "EXPECTED", "LOCAL_ONLY", "SERVER_ONLY", "DEPLOYED_WORKING",
    "DEPLOYED_BROKEN", "PARTIALLY_DEPLOYED", "DISABLED", "STUB", "UNKNOWN",
}
REQUIRED_FINDING_KEYS = [
    "id", "area", "severity", "confidence", "affected_environments",
    "affected_roles", "description", "business_effect", "technical_cause",
    "evidence_ids", "reproduction_steps", "safe_recommendation", "complexity",
    "effort", "dependencies", "regression_risk", "risk",
    "migration_required", "downtime_required", "acceptance_criteria", "kind",
]
# AI checklist spec (Обязательные контуры проверки -> AI/RAG), short tokens
# that must each appear in ai.md (covered) or in an UNKNOWN-marked row.
CHECKLIST_TOKENS = [
    "provider call", "key validity", "timeout", "retry", "circuit breaker",
    "fallback", "schema validation", "prompt injection", "tool permissions",
    "tenant isolation", "data policy", "logging", "hallucinations",
    "citations", "grounding", "retrieval", "chunking", "embeddings",
    "metadata", "staleness", "prompt version", "reproducibility",
    "eval set", "human-in-loop", "budget", "rate", "quota", "cap",
    "queue", "cache", "context limit", "outage",
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


registry_path = ZONE / "ai-registry.json"
report_path = ZONE / "ai.md"
findings_path = ZONE / "findings.json"
eval_path = ZONE / "eval-local.json"
readme_path = ZONE / "README.md"

for p in (registry_path, report_path, findings_path, eval_path, readme_path):
    if not p.exists():
        fail(f"missing {p.name}")

registry = []
if registry_path.exists():
    try:
        registry = json.loads(registry_path.read_text())
    except json.JSONDecodeError as exc:
        fail(f"ai-registry.json invalid JSON: {exc}")
    if not isinstance(registry, list) or not registry:
        fail("ai-registry.json must be a non-empty JSON array")
    seen = set()
    for i, entry in enumerate(registry):
        tag = entry.get("ai_id", f"index-{i}") if isinstance(entry, dict) else f"index-{i}"
        if not isinstance(entry, dict):
            fail(f"{tag}: entry must be an object")
            continue
        for key in SPEC_KEYS:
            if key not in entry:
                fail(f"{tag}: missing key {key}")
        for key in entry:
            if key not in SPEC_KEYS:
                fail(f"{tag}: extra key {key} (schema is exact)")
        if entry.get("status") not in STATUS_VOCAB:
            fail(f"{tag}: status {entry.get('status')!r} not in closed vocabulary")
        if entry.get("ai_id") in seen:
            fail(f"{tag}: duplicate ai_id")
        seen.add(entry.get("ai_id"))
        for list_key in ("evidence_ids", "tests"):
            val = entry.get(list_key)
            if not isinstance(val, list) or not val or not all(isinstance(v, str) and v.strip() for v in val):
                fail(f"{tag}: {list_key} must be a non-empty string list")

findings = []
if findings_path.exists():
    try:
        findings = json.loads(findings_path.read_text())
    except json.JSONDecodeError as exc:
        fail(f"findings.json invalid JSON: {exc}")
    for f in findings:
        fid = f.get("id", "?") if isinstance(f, dict) else "?"
        if not isinstance(f, dict):
            fail(f"{fid}: finding must be an object")
            continue
        for key in REQUIRED_FINDING_KEYS:
            if key not in f:
                fail(f"{fid}: missing key {key}")

report_text = report_path.read_text() if report_path.exists() else ""
for token in CHECKLIST_TOKENS:
    if token.lower() not in report_text.lower():
        fail(f"ai.md: checklist token not covered: {token!r}")

for token in ("denylist", "contour", "cap", "UNKNOWN"):
    if token.lower() not in report_text.lower():
        fail(f"ai.md: must reference {token!r}")

if eval_path.exists():
    try:
        eval_data = json.loads(eval_path.read_text())
    except json.JSONDecodeError as exc:
        fail(f"eval-local.json invalid JSON: {exc}")
        eval_data = {}
    if isinstance(eval_data, dict):
        live = eval_data.get("live_provider_requests")
        cap = eval_data.get("cap")
        if live != 0:
            fail(f"eval-local.json: live_provider_requests must be 0, got {live!r}")
        if cap != 200:
            fail(f"eval-local.json: cap must be 200, got {cap!r}")
        for case in eval_data.get("cases", []):
            for k in ("query", "kind", "lexical_score", "verdict"):
                if k not in case:
                    fail(f"eval-local.json case missing {k}")

for p in (registry_path, report_path, findings_path, eval_path, readme_path):
    if p.exists():
        text = p.read_text()
        m = SECRET_PATTERNS.search(text)
        if m:
            fail(f"{p.name}: looks like a secret value ({m.group(0)[:24]}...)")

if errors:
    print("FAIL")
    for e in errors:
        print(f"- {e}")
    sys.exit(1)
n_reg = len(registry) if isinstance(registry, list) else 0
n_find = len(findings) if isinstance(findings, list) else 0
print(f"OK: {n_reg} registry entries, {n_find} findings, checklist {len(CHECKLIST_TOKENS)} tokens, cap 0/200")
