# 02 — Карантин и безопасная выдача файлов

**What to build:** Сквозную загрузку PDF/DOCX/XLSX/PNG/JPEG до 25 МБ через проверку типа, карантин, антивирус, private storage и короткоживущий доступ.

**Blocked by:** 01 — SECURITY.md и THREAT_MODEL.md; release-audit/03 — Базовая матрица ролей.

**Status:** ready-for-agent

- [ ] Extension, MIME и signature проверяются независимо; архивы, executables и macro-enabled файлы запрещены.
- [ ] До clean verdict файл нельзя скачать, обработать или передать AI.
- [ ] Signed access повторно проверяет authorization и истекает.
- [ ] Malicious fixtures, IDOR, rescan и versioning покрыты тестами.
