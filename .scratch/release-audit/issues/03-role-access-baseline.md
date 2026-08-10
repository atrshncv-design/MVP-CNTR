# 03 — Базовая матрица девяти ролей и IDOR

**What to build:** Единые backend-инварианты доступа для девяти ролей, проектов, приглашений, файлов, заявок и служебных очередей.

**Blocked by:** 01 — Матрица фактических функций MVP.

**Status:** ready-for-review

- [x] Создатель и принятый участник получают только предусмотренный проектный доступ — **Status: PASS**: OWN-проверки `require_project_access`/`can_access_project` (projects.py:138-179), тесты test_project_scope/test_rbac_projects (role-access-matrix.md §2).
- [ ] Перебор ID чужого проекта, файла, запроса и очереди возвращает безопасный отказ — **Status: PASS (по коду)**; живой прогон негативных проверок — **Status: BLOCKED**: статически 31/33 endpoint с object-id закрыты (0 открытых, 2 частично: SSE access_token — R3, генерация — не готова); живые IDOR-негативные проверки невозможны без БД (docker DOWN; команда владельцу: `docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica`, затем в клоне `env -u PYTHONPATH uv run pytest`) — role-access-matrix.md §3–4.
- [x] Служебная роль не назначается самостоятельно — **Status: PASS**: регистрация запрещает `cntr_admin`/`cntr_manager` (auth.py:42-46 → 403), тест `test_cntr_staff_role_cannot_be_self_registered` (role-access-matrix.md §1).
- [ ] Все отказы покрыты API-тестами и значимые попытки попадают в audit — **Status: PARTIAL**: негативные тесты 401/403/404/409 существуют, но 5 пробелов покрытия (G3: mark_read чужого уведомления, rescan чужого файла, невалидный INV-токен, /rag/templates 403, chat 429); отдельный открытый риск — отсутствие audit для auth-событий и экспорта/скачиваний (R5) — role-access-matrix.md §5, evidence-matrix.md §Разрывы.

## Comments
- 10.08.2026 (исполнитель тикета 03): статический аудит завершён, артефакт `role-access-matrix.md` в `.scratch/release-audit/`. Итог: матрица 9 ролей × разделы по коду BE; IDOR-аудит 33 endpoint с object-id → 31 закрыт, 0 открыт, 2 частично (SSE access_token в query — R3 тикета 01; генерация документов — не готова, тикет 01); негативные тесты перечислены (test_rbac_projects, test_publication_privacy, test_file_storage, test_comments_pdf_retention, test_new_core, test_invites, test_join_mechanic, test_auth_smoke, test_profile_admin и др.); collect-only в клоне — 191 тест собран; живой прогон негативных тестов — BLOCKED (docker DOWN; команда владельцу: docker compose -f infra/docker-compose.yml up -d pg-primary pg-replica → в клоне env -u PYTHONPATH uv run pytest). Acceptance: 2×PASS, 1×PARTIAL, 1×BLOCKED. Готово к ревью.
