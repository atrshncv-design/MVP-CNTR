# Отчёт тикета 03 — Безопасность фронтенда, секреты и история репозитория

## Реестр находок

Формат: `{id, область, файл:строка, severity, описание, действие}`

| id | область | файл:строка | severity | описание | действие |
|---|---|---|---|---|---|
| F03-01 | фронт | `technozrelost-frontend/next.config.ts` | высоко | Отсутствовали security-заголовки: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS | **исправлено**: добавлены `headers()` для всех маршрутов; CSP с `frame-ancestors 'none'`, `'unsafe-eval'` только в dev, connect-src учитывает `NEXT_PUBLIC_API_URL`. Тест `tests/security-headers.test.mjs` (3 кейса) |
| F03-02 | фронт+бэк | `technozrelost-frontend/src/components/landing/news-detail.tsx:77` | высоко | `post.content` рендерится через `dangerouslySetInnerHTML`, но backend НЕ санитизирует HTML новостей (`technozrelost-backend/app/schemas.py:441` — content сохраняется как есть; санитайзеров bleach/nh3/Cleaner в backend нет) → stored XSS на публичной `/news/[id]` от имени cntr_admin/cntr_manager | **рекомендация**: серверная санитизация allow-list'ом (nh3/bleach) — зона тикета 04; клиентский фикс требует новой npm-зависимости (dompurify) — по правилам прогона не ставил молча. Добавленный CSP (F03-01) снижает дампинг |
| F03-03 | фронт | `technozrelost-frontend/src/components/dashboard/news-editor.tsx:504` | низко | Предпросмотр новости рендерит сырой HTML без санитизации; маршрут admin-only → фактически self-XSS | **рекомендация**: санитизировать предпросмотр или показывать исходник как текст |
| F03-04 | фронт | `technozrelost-frontend/src/lib/roles.ts:29` | средне | `ROUTE_ALLOWED_ROLES` не покрывает `/dashboard/nioktr*`: middleware пропускает туда любую залогиненную роль (role-check только на бэкенде). Аналогично `/dashboard/profile` (осознанно?) | **рекомендация**: дополнить матрицу ролей или задокументировать решение «авторизация только на API» |
| F03-05 | фронт | `technozrelost-frontend/.gitignore:34` | низко | Паттерн `.env*` игнорировал и `.env.example` — шаблон переменных нельзя было закоммитить; у фронта шаблона вообще не было | **исправлено**: negation `!.env.example`; создан `technozrelost-frontend/.env.example` (AUTH_SECRET, AUTH_URL, NEXT_PUBLIC_API_URL, API_URL_INTERNAL — пустые значения, только имена) |
| F03-06 | фронт | `technozrelost-frontend/src/**` (33 файла) + `next.config.ts:31` | низко | Fallback `http://127.0.0.1:8000` для `NEXT_PUBLIC_API_URL`: прод-сборка без явной переменной заставит браузер клиента стучаться на его localhost (и mixed content при HTTPS); destination rewrites захардкожен | **рекомендация**: fail-fast при сборке/старте в production без переменной; вынести destination rewrites в env |
| F03-07 | фронт | `technozrelost-frontend/src/auth.config.ts:28,111` | низко | `trustHost: true` (оправдано за reverse-proxy, но в проде лучше явный `AUTH_URL`); session отдаёт `accessToken` клиенту — стандартный паттерн для прямых вызовов API из браузера, токен краткоживущий (55 мин, refresh в зашифрованной cookie) | **рекомендация**: зафиксировать AUTH_URL в проде (внесено в `.env.example`) |

## NextAuth / маршруты — что проверено и чисто

- Секрет сессии берётся из `AUTH_SECRET` (v5), в коде не захардкожен; стратегия JWT, access 55 мин, refresh за 5 мин до истечения, ошибка обновления помечается `RefreshAccessTokenError`.
- Middleware защищает весь `/dashboard/*` (редирект на `/login` + role-matrix), auth-маршруты `/login`, `/register` перенаправляют залогиненных; matcher исключает только статику.
- Клиентский бандл: единственная `NEXT_PUBLIC_*` — `NEXT_PUBLIC_API_URL` (адрес, не секрет); `API_URL_INTERNAL` читается только на сервере.
- `eval` / `new Function` не найдены; `dangerouslySetInnerHTML` — только 2 места выше.

## Скан git-истории (все ветки, 233 коммита, ~3.8k объектов)

Паттерны: `sk-`/`sk-proj-`, `ghp_`/`github_pat_`, `AKIA`, `xox[baprs]-`, `eyJ*` (JWT), `postgres(ql)://user:pass@`, `-----BEGIN … PRIVATE KEY`, `AIzaSy`.

**Результат: утечек не найдено. Отзыв ключей не требуется, история не переписывалась.**

Уточнения:
- `eyJ`-совпадения — только integrity-хэши в `package-lock.json` (base64, не JWT).
- В историю когда-либо попадали только `*.env.example` / `*.env.production.example`; реальные значения проверены программно (значения нигде не печатались): все секретные поля — плейсхолдеры (например `JWT_SECRET` = «your-secret-here…», `LLM_API_KEY` пуст).
- Трекенных реальных `.env`/`.pem`/`.key` нет ни в одном коммите.

## CI-воркфлоу — вердикт

На базе аудита (ветка `autopilot/deploy-readiness-code`) `.github/` **отсутствует** — CI нет вовсе.

В истории найден годный workflow `repo-hygiene.yml` (коммит e5932bb, ветка `codex/repo-hygiene-complete-v2`): secret-scan с маскированием вывода (`<masked>`, содержимое не печатается), контроль .gitignore-матрицы, поиск трекенных секретоподобных файлов. Замечания: действия пинованы тегом (`actions/checkout@v4`), а не SHA; нет блока `permissions:` (рекомендую `contents: read`).

**Рекомендация:** портировать `repo-hygiene.yml` на базу аудита при merge + добавить `permissions: contents: read` (+ опционально SHA-пин). Не портировал сам: состав CI — решение владельца репозитория.

## Верификация

- `npm run lint` ✓ (0 ошибок)
- `npm test` ✓ 23 passed (было 20; +3 security-headers)
- `npm run build` ✓ (запуск при остановленном dev-сервере)
- `git check-ignore`: `.env` игнорируется, `.env.example` трекабелен

## Критерии приёмки

- [x] Реестр находок: каждая с файл:строкой, severity, действием (7 находок)
- [x] Безопасные фиксы применены и проверены (lint + test + build зелёные)
- [x] Отчёт по скану истории: чисто, отзыв ключей не нужен, история не переписана
- [x] Вердикт по CI-воркфлоу (см. выше)
- [x] `.env*`: значения не вынесены ни в один отчёт (анализ программный), файлы не коммитятся, история не переписана
