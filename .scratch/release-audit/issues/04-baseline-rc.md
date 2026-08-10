# 04 — Зелёная baseline release candidate

**What to build:** Повторяемую базовую сборку существующего MVP с gap report, smoke/E2E и нулём необъяснённых мёртвых функций.

**Blocked by:** 02 — Сквозное ядро УГТ; 03 — Базовая матрица девяти ролей и IDOR.

**Status:** ready-for-agent

- [ ] Backend tests/lint и frontend lint/typecheck/build зелёные.
- [ ] Smoke всех девяти ролей выполнен на чистой базе.
- [ ] Gap report закрыт либо содержит явный утверждённый статус каждого остатка.
- [ ] Commit пригоден как общая база всех feature-пакетов.
