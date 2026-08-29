# PLAN — Ремедиация аудита 2026-08-29 (M2 P2 + P0 внешние)

## 0. Блокирующие вопросы — нет, неблокирующие — с предположениями

**Вывод после перечитки кода/`BACKLOG.md`/`.autopilot/2026-08-29-m2-p2-hardening/spec.md`: блокирующих вопросов 0** — все продуктовые развилки закрываются разумными предположениями с ADR, без остановки.

### Неблокирующие вопросы и принятые предположения (каждый влияет на тикеты, требует подтверждения владельца на ревью)

| ID | Вопрос | Почему возник | Влияет | Варианты | Рекомендуемый | Последствия |
|---|---|---|---|---|---|---|
| Q-01 | Легаси `file_ref` без “/” — считать ли `ref-1` валидным? | `projects.py:671` bypass `"/" in file_ref` оставлен “чтобы не ломать тесты”. Аудит H-01 считает это дырой. | SPEC-01 TICKET-01 | A) Строго: любой непустой `file_ref` → `storage.get` 404 иначе. B) Allowlist из 3 значений `ref-1, ref-2, manual`. C) Оставить как есть. | **A строгий, с миграцией**: старые `verification_documents.file_ref` без слэша помечаем `legacy=true` и разрешаем только их (один UPDATE). Новые без слэша → 422. | B компромисс, но сохраняет дыру для новых `evil`. C — аудит FAIL. Решение фиксируем в ADR. |
| Q-02 | Чтение анкеты: отдавать ли чужие `percentage`? | `projects.py:508` отдаёт все `QuestionnaireResult` всем участникам после per-user изоляции N-16. | SPEC-03 TICKET-07 | A) Только свои (`user_id==current`). B) Свои + `avg` по команде. C) Все как сейчас. | **A для обычных ролей, B для `cntr_admin/manager` (средний по проекту)** — приватность + управленческий обзор. | C — leak, продуктовый риск. |
| Q-03 | `pymupdf` AGPL — менять до B2G? | `pyproject.toml:14` pin, но замена на `pypdf` оценена лишь в комменте. | SPEC-04 TICKET-05 | A) Заменить сейчас (`pypdf` BSD). B) Оставить с ADR “только offline seed”. | **B для P2 (пилот), A в Q1 2027** — риск низкий: `pymupdf` только в `seed_gost.py` offline, не в рантайме. | A — труд L, задержит P0. B — принять риск с докой `ИМПОРТОЗАМЕЩЕНИЕ.md`. |
| Q-04 | Digest pinning обязательно до релиза? | `docker-compose.prod.yml:101` tag без `@sha256` — воспроизводимость неполная. | SPEC-04 TICKET-08 | A) Tag+digest сейчас. B) Только tag. | **A** — `docker pull && inspect RepoDigests` — 30 мин, закрывает supply-chain. | B — мутабельный прод. |
| Q-05 | `style-src 'unsafe-inline'` — принять? | `next.config.ts:31` нужен Tailwind, иначе стили ломаются. | SPEC-06 TICKET-12 | A) Оставить с ADR. B) Nonce для стилей. | **A для пилота, B backlog P3** — XSS-вектор только через `dangerouslySetInnerHTML` новостей, уже `nh3` санитизирован. | B — переработка Next 16 nonce для CSS, риск регресса. |

Предположения зафиксированы в спеках как **“Принято: …”** — владелец меняет одной строкой в `PLAN.md` и спеках.

---

## 1. Краткое резюме плана

- **Цель:** закрыть 20 находок аудита (3 High, 7 Medium, 6 Low, 4 Info) + операционные P0-доказательства, не ломая 347/39 gates.
- **Объём:** 8 спек, 17 тикетов, 2 ADR. Каждый тикет — одна сессия агента, `ruff/mypy/pytest` green, миграция обратима, `uv.lock` запинен.
- **Волны:** P0 (неделя 1) → P1 (неделя 2) → P2/тесты (неделя 3) → внешний smoke (неделя 4, нужен прод-хост).
- **Критерий готовности:** сек. 9 чек-лист (все P0/P1 closed, `security_check --base-url` ALL PASS, `loadtest 1K` 99% p95, PITR rehearsal).

---

## 2. Карта «проблема → спецификация → тикет»

| ID аудита | Проблема из аудита (кратко) | Крит. | Решение | Спека | Тикеты | Приор | Завис. |
|---|---|---|---|---|---|---|---|
| H-01 | N-15 `file_ref` bypass без “/” `projects.py:671` | High | Валидировать любой непустой ref через `storage` + allowlist легаси | SPEC-01 | TICKET-01 | P0 | — |
| H-02a | Sync Redis в async auth/nioktr блокирует loop | High | `redis.asyncio` или `to_thread` | SPEC-02 | TICKET-03,04 | P0 | — |
| H-02b | CRLF инъекция `X-Request-ID` + `Content-Disposition` | High | Валидация `^[A-Za-z0-9-_]{8,64}$`, `re.sub(r'[\r\n\"]', "_")` | SPEC-01 | TICKET-02 | P0 | — |
| H-03 | Dirty `uv.lock` не запушен | High | `uv lock && commit && push` + `.gitignore` | SPEC-04 | TICKET-05 | P0 | — |
| M-01 | 0031 `USING ::date` падает на мусоре | Med | `CASE WHEN ~ '^\d{4}-\d{2}-\d{2}'` + pre-UPDATE | SPEC-03 | TICKET-06 | P1 | TICKET-05 |
| M-02 | Чтение анкеты leak чужих % | Med | Фильтр по `user_id` + avg для staff | SPEC-03 | TICKET-07 | P1 | TICKET-06 |
| M-03 | ETag без `Vary`/`private` | Med | `Vary`, `Cache-Control: private` для auth, инвалидация | SPEC-05 | TICKET-11 | P1 | — |
| M-04 | Tag без digest | Med | `image: tag@sha256:digest` | SPEC-04 | TICKET-08 | P1 | TICKET-05 |
| M-05 | Nginx не форвардит `X-Request-ID` | Med | `proxy_set_header X-Request-ID` + `log_format` | SPEC-05 | TICKET-09 | P1 | TICKET-03 |
| M-06 | `storage.get` sync в async | Med | `await to_thread(storage.get)` | SPEC-01 | TICKET-10 | P0 | TICKET-01 |
| M-07 | `style-src unsafe-inline` | Med | ADR принять риск, backlog nonce | SPEC-06 | TICKET-12 | P2 | — |
| L-01 | `x-nonce` мёртвый | Low | Удалить, оставить только CSP | SPEC-06 | TICKET-13 | P2 | TICKET-12 |
| L-02 | `detect_mime` minor | Low | Документировать, тест на zip-бомбу | SPEC-01 | (в TICKET-16) | P3 | — |
| L-03 | Дублирование CVD константы | Low | Вынести в `settings` | SPEC-05 | TICKET-14 | P2 | — |
| L-04 | Orphan cleanup best-effort | Low | Документировать, не менять | SPEC-01 | (принято) | P3 | — |
| L-05 | `ИМПОРТОЗАМЕЩЕНИЕ.md` не обновлён про pymupdf | Low | Обновить доку | SPEC-04 | (в TICKET-05) | P2 | — |
| L-06 | `technologies` без кэша | Low | ETAG для `/technologies` | SPEC-05 | (в TICKET-11) | P2 | — |
| I-01 | Scheduler в процессе | Info | Вынести в sidecar `clock` | SPEC-07 | TICKET-15 | P3 | — |
| I-02 | LRU 5k evict | Info | Оставить, задокументировать лимит | SPEC-07 | (принято) | P3 | — |
| I-03 | Versioning best-effort | Info | Init job + метрика | SPEC-05 | (принято) | P3 | — |
| I-04 | PROC-01/02 deferred | Info | Отложено, не в P2 | — | (отложено) | P3 | — |
| EXT-01 | P0 внешние pending (daily backup, WAL, offsite crypt, Telegram, PITR) | High | Операционные smoke + `reports/` | SPEC-08 | TICKET-17 | P1 | Все P0 |

Объединения: H-02a+b — один домен “блокировка loop + инъекция” но разные файлы → разные тикеты; H-01+M-06 — один домен файлов → одна спека, два тикета (валидация + async).

---

## 3. Этапы и порядок (граф зависимостей в сек. 7)

См. сек. 8 ниже — волны с параллелизмом.

## 4. Проверка полноты — сек. 9
