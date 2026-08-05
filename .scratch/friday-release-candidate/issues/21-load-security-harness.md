# 21 — Нагрузочный и security harness

**What to build:** Подготовить воспроизводимый профиль 1 000 пользователей и автоматические security gates для будущего сервера.

**Blocked by:** 18, 20 — масштабируемый наблюдаемый контур

**Status:** done

- [x] Профиль: 70% чтение, 20% ЛК/опросник, 8% файлы, 2% manager
- [x] AI тестируется отдельно
- [x] Отчёт считает success rate, p50/p95/p99 и throughput
- [x] Цели: >=99% успеха, p95 read <=500ms, write <=1s
- [x] Есть secrets/dependency/RBAC/IDOR/file-security проверки
- [x] Локально подтверждена корректность сценария, серверный запуск документирован


## Реализация (05.08.2026)
- Backend `2f3763f`: scripts/loadtest.py (профиль 70/20/8/2, отчёт success/p50/p95/p99/throughput, цели PASS/FAIL, --prepare-users/--seed-manager), scripts/security_check.py (secrets/RBAC/IDOR/file, все PASS; известные ecdsa advisory без фикса задокументированы), infra/README-LOADTEST.md; cryptography обновлена до 50.x (закрыты 2 CVE). **190/190 pytest, ruff чист** (6 новых тестов).

- Повторная волна (аудит 06.08): security gate переведён на актуальный контракт (реестры 200) → **ALL CHECKS PASS**; deps без фикса — WARN.
