"""Сканер хардкода платформы для аудита 2026-09-04 (только чтение, детерминирован)."""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
FE = ROOT / "technozrelost-frontend" / "src"
BE = ROOT / "technozrelost-backend" / "app"
MSG_RU = ROOT / "technozrelost-frontend" / "messages" / "ru.json"
MSG_EN = ROOT / "technozrelost-frontend" / "messages" / "en.json"

CYR = re.compile(r"[А-Яа-яЁё]")
JSX_TXT = re.compile(r">([^<>{}]*[А-Яа-яЁё][^<>{}]*)<")
STR_LIT = re.compile(r"""('[^'\n]*[А-Яа-яЁё][^'\n]*'|"[^"\n]*[А-Яа-яЁё][^"\n]*"|`[^`\n]*[А-Яа-яЁё][^`\n]*`)""")
ATTR = re.compile(r"(placeholder|title|aria-label|aria-description|label)\s*=\s*(\{[\"'][^\"'}]*[А-Яа-яЁё][^\"'}]*[\"']\}|[\"'][^\"']*[А-Яа-яЁё][^\"']*[\"'])")
URL_RX = re.compile(r"(https?://[^\s\"'<>]+|wss?://[^\s\"'<>]+|localhost|127\.0\.0\.1|0\.0\.0\.0|:\d{4,5}\b)")
HEX_RX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
PX_RX = re.compile(r"[:\s(]\d+(?:\.\d+)?px\b")
INTL_RX = re.compile(r"useTranslations|getTranslations|getMessages|useLocale")
SECRET_RX = re.compile(
    r"(BEGIN [A-Z ]*PRIVATE KEY|sk-(live|test)-|ghp_[A-Za-z0-9]+|gho_[A-Za-z0-9]+|"
    r"AKIA[0-9A-Z]{16}|xox[bpa]-[A-Za-z0-9-]+|AIza[0-9A-Za-z_-]{10,}|"
    r"(password|passwd|secret|api[_-]?key)\s*[:=]\s*['\"][^'\"]{3,}['\"])"
)
USER_FACING_RX = re.compile(r"(detail\s*=|message\s*[=:]|description\s*[=:]|raise |HTTPException|error\s*[=:])")


def line_no(text, pos):
    return text.count("\n", 0, pos) + 1


def scan_frontend():
    findings = []
    files = sorted(FE.rglob("*.tsx")) + sorted(FE.rglob("*.ts"))
    for path in files:
        rel = str(path.relative_to(ROOT))
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        uses_intl = bool(INTL_RX.search(text))
        is_test = "test" in rel.lower() or rel.endswith(".test.ts") or rel.endswith(".test.tsx")
        for m in JSX_TXT.finditer(text):
            frag = re.sub(r"\s+", " ", m.group(0)).strip()[:160]
            findings.append({
                "file": rel, "line": line_no(text, m.start()),
                "category": "ui-string", "kind": "jsx-text",
                "uses_intl": uses_intl, "test_noise": is_test, "fragment": frag,
            })
        for m in STR_LIT.finditer(text):
            s = m.group(0)
            # пропускаем импорты/пути без пробелов-предложений? нет — фиксируем всё, классификация позже
            frag = s.strip()[:160]
            findings.append({
                "file": rel, "line": line_no(text, m.start()),
                "category": "ui-string", "kind": "string-literal",
                "uses_intl": uses_intl, "test_noise": is_test, "fragment": frag,
            })
        for m in ATTR.finditer(text):
            frag = re.sub(r"\s+", " ", m.group(0)).strip()[:160]
            findings.append({
                "file": rel, "line": line_no(text, m.start()),
                "category": "ui-string", "kind": "attr",
                "uses_intl": uses_intl, "test_noise": is_test, "fragment": frag,
            })
        for m in URL_RX.finditer(text):
            frag = m.group(0)[:120]
            findings.append({
                "file": rel, "line": line_no(text, m.start()),
                "category": "config-url", "kind": "url",
                "uses_intl": uses_intl, "test_noise": is_test, "fragment": frag,
            })
        for m in HEX_RX.finditer(text):
            findings.append({
                "file": rel, "line": line_no(text, m.start()),
                "category": "style-const", "kind": "hex-color",
                "uses_intl": uses_intl, "test_noise": is_test, "fragment": m.group(0),
            })
        for m in SECRET_RX.finditer(text):
            frag = m.group(0)[:80]
            findings.append({
                "file": rel, "line": line_no(text, m.start()),
                "category": "secret-candidate", "kind": "secret-pattern",
                "uses_intl": uses_intl, "test_noise": is_test, "fragment": frag,
            })
    findings.sort(key=lambda f: (f["file"], f["line"], f["fragment"]))
    return findings


def scan_backend():
    findings = []
    files = sorted(BE.rglob("*.py"))
    for path in files:
        rel = str(path.relative_to(ROOT))
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for m in STR_LIT.finditer(text):
            s = m.group(0)
            line_start = text.rfind("\n", 0, m.start()) + 1
            line_end = text.find("\n", m.end())
            line = text[line_start:line_end if line_end != -1 else len(text)]
            user_facing = bool(USER_FACING_RX.search(line))
            findings.append({
                "file": rel, "line": line_no(text, m.start()),
                "category": "server-user-text" if user_facing else "server-internal-text",
                "kind": "string-literal",
                "uses_intl": False, "test_noise": False,
                "fragment": s.strip()[:160],
            })
        for m in URL_RX.finditer(text):
            findings.append({
                "file": rel, "line": line_no(text, m.start()),
                "category": "config-url", "kind": "url",
                "uses_intl": False, "test_noise": False, "fragment": m.group(0)[:120],
            })
        for m in SECRET_RX.finditer(text):
            findings.append({
                "file": rel, "line": line_no(text, m.start()),
                "category": "secret-candidate", "kind": "secret-pattern",
                "uses_intl": False, "test_noise": False, "fragment": m.group(0)[:80],
            })
    findings.sort(key=lambda f: (f["file"], f["line"], f["fragment"]))
    return findings


def flatten(d, prefix=""):
    out = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else str(k)
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def check_parity():
    ru = json.loads(MSG_RU.read_text(encoding="utf-8"))
    en = json.loads(MSG_EN.read_text(encoding="utf-8"))
    fru, fen = flatten(ru), flatten(en)
    return {
        "ru_keys": len(fru), "en_keys": len(fen),
        "missing_in_en": sorted(set(fru) - set(fen)),
        "missing_in_ru": sorted(set(fen) - set(fru)),
    }


def main(out_dir):
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    fe = scan_frontend()
    be = scan_backend()
    parity = check_parity()
    (out / "findings.json").write_text(
        json.dumps({"frontend": fe, "backend": be, "parity": parity},
                   ensure_ascii=False, indent=1, sort_keys=False),
        encoding="utf-8",
    )
    summary = {
        "frontend_findings": len(fe),
        "backend_findings": len(be),
        "frontend_files_hit": len({f["file"] for f in fe}),
        "backend_files_hit": len({f["file"] for f in be}),
        "parity": {
            "ru_keys": parity["ru_keys"], "en_keys": parity["en_keys"],
            "missing_in_en": len(parity["missing_in_en"]),
            "missing_in_ru": len(parity["missing_in_ru"]),
        },
    }
    (out / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".autopilot/2026-09-04-hardcode-audit/evidence")
