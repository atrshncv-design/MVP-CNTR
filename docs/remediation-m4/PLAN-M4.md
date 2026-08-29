# PLAN-M4 — План устранения аудита 2026-08-29 (M3 14 находок → 6 спек 14 тикетов)

## 0. Блокирующие вопросы — 0, неблокирующие — 6 с предположениями

**Вывод после перечитки аудита/`docs/remediation/PLAN.md`/`state.js` M3:** блокирующих 0 — все развилки закрываются предположениями с ADR, без остановки.

### Неблокирующие и принятые предположения (влияют на тикеты, требуют подтверждения на ревью)

| ID | Вопрос | Почему возник | Влияет | Варианты | Рекомендуемый | Последствия |
|---|---|---|---|---|---|---|
| Q-01 | `clamav` образ: `mkodockx` vs `clamav/clamav`? | `docker-compose.prod.yml:134` digest `b443…` placeholder, тег `1.4.3-r0-alpine` отсутствует (85 тегов, макс 1.1.2). Аудит H-01. | SPEC-01 TICKET-01 | A) `clamav/clamav:1.4.3@sha256:75fb5f…` официал amd64. B) `mkodockx:alpine@sha256:40c976…` 2022. C) Оставить. | **A официал** | A amd64 only, B стар, C FAIL |
| Q-02 | `GET /projects/{id}` staff — avg или все? | `projects.py:508` все строки без `user_id`, `PLAN Q-02` avg vs 90k JSON. Аудит M-03. | SPEC-05 TICKET-08 | A) Все с `user_id`. B) `AVG GROUP BY`. C) `?all=1` гибрид. | **C гибрид: без `all` avg+count, `?all=1` все** | Сохраняет тест и не ломает heavy |
| Q-03 | Nginx regex vs только backend? | `nginx.prod.conf:19` default echo, `main.py:188` fullmatch уже. | SPEC-03 TICKET-05 | A) Regex в `map`. B) Только backend. | **A** | B расхождение логов |
| Q-04 | `CVD_MAX_AGE_SECONDS` единый источник? | Дубль `file_storage.py:44` + `alerter.py:27`, env закомментирован. | SPEC-04 TICKET-06 | A) Env `CVD_MAX_AGE_SECONDS=604800`. B) Константа. | **A** | B drift |
| Q-05 | SOPS placeholder менять сейчас? | `.sops.yaml:7` `age1ql3z7…placeholder` | SPEC-04 TICKET-07 | A) `age-keygen` сейчас. B) Отложить до B2G. | **B pilot, A B2G** | A требует перешифровки |
| Q-06 | `technologies` ETag page vs full? | `technologies.py:44` md5 по всем без LIMIT. | SPEC-05 TICKET-09 | A) Per page `limit/offset`. B) Full. | **A per page** | B O(N) |

Предположения — «Принято: …» в спеках, меняются одной строкой в `PLAN-M4.md`.

---

## 1. Краткое резюме плана

- **Цель:** закрыть 14 остаточных находок (2H/5M/4L/3I) без потери 27 находок M3, сделать `361/39` воспроизводимым на прод-клоне.
- **Объём:** 6 спек, 14 тикетов, 2 миграции, 3 игнора/digest, `git push`. Каждый тикет — одна сессия, `ruff/mypy/pytest` green, миграции обратимы.
- **Волны:** P0 (неделя 1) → P1 (неделя 2) → P2 (неделя 3) → P3+EXT (неделя 4, нужен прод-хост).
- **Критерий готовности:** сек.9 чек-лист (P0/P1 closed, `git status` 0, `docker pull` детерминирован, `security_check --base-url` ALL PASS, `loadtest 1K` 99% p95, `rehearse_pitr.sh` PASS).

---

## 2. Карта «проблема → спецификация → тикет»

| ID аудита | Проблема из аудита (кратко) | Крит. | Решение | Спека | Тикеты | Приор | Завис. |
|---|---|---|---|---|---|---|---|
| H-01 | `clamav` digest placeholder `b443…` без образа | High | `clamav/clamav:1.4.3@sha256:75fb…` | SPEC-01 | TICKET-01 | P0 | — |
| M-05 | `git status` dirty 27M+12?? не запушен | Med | commit+push + `.gitignore` reports | SPEC-01 | TICKET-02,13 | P0/P2 | 01,03 |
| H-02 | 0031 `pg_temp.try_cast_date` падает в пуле | High | `DO $$ EXCEPTION` без `pg_temp` | SPEC-02 | TICKET-03 | P0 | — |
| L-03 | 0032 downgrade оставляет индексы | Low | `DROP INDEX IF EXISTS` | SPEC-02 | TICKET-04 | P2 | 03 |
| M-01 | nginx `map` без regex `X-Request-ID` | Med | `~^[A-Za-z0-9._-]{8,64}$` | SPEC-03 | TICKET-05 | P1 | — |
| M-02 | `CVD` дублирование `7*24*3600` | Med | env `CVD_MAX_AGE_SECONDS` единый | SPEC-04 | TICKET-06 | P1 | — |
| I-03 | `.sops.yaml` placeholder age | Info | доку отложено, 0600 pilot | SPEC-04 | TICKET-07 | P3 | — |
| M-03 | staff `GET /projects/{id}` heavy без avg | Med | `?all=1` все, иначе avg+count | SPEC-05 | TICKET-08 | P1 | — |
| I-02 | `technologies` ETag full-scan O(N) | Info | per page `limit/offset` | SPEC-05 | TICKET-09 | P2 | — |
| L-02 | `fallback` двойная `"` замена | Low | один `re.sub` | SPEC-05 | TICKET-10 | P2 | — |
| L-01 | дубли тестов `storage_*`/`throttle_*` | Low | rm дубль | SPEC-06 | TICKET-11 | P2 | — |
| I-01 | scheduler guard только коммент | Info | CI `grep --workers` | SPEC-06 | TICKET-12 | P3 | — |
| L-04 | `reports/` в корне не игнорит | Low | `.gitignore` `reports/*.json` | SPEC-01 | TICKET-13 | P2 | — |
| M-04 | EXT smoke stubs `null p95` `skip-live` | Med | прод-клон 6 шагов ADR-0016 | SPEC-06 | TICKET-14 | P1 | все P0/P1 |

Объединения: H-01+M-05+L-04 — один домен supply-chain, но разные файлы → 2 тикета; H-02+L-03 — один домен миграций; M-02+I-03 — один домен конфига.

---

## 3. Этапы и порядок (граф сек.7)

См. сек.8 ниже — волны с параллелизмом.

## 4. Проверка полноты — сек.9

