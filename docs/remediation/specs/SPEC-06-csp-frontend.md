# SPEC-06: CSP и фронтенд-безопасность (M-07, L-01)

## Контекст
M-07: `next.config.ts:31` `style-src 'self' 'unsafe-inline'` оставлен для Tailwind v4 — без него стили ломаются, но CSP не блокирует инлайн-стили. L-01: `middleware.ts:53` `requestHeaders.set("x-nonce", nonce)` + `response.headers.set("x-nonce")` — мёртвый код: ни один Server Component не читает `headers().get("x-nonce")`, Next 16 автоматически ставит nonce из `Content-Security-Policy` header. Затронуты `technozrelost-frontend/next.config.ts`, `src/middleware.ts`, `docs/adr/`.

## Цель
CSP без `unsafe-inline` в `script-src` (уже done FE-05) сохранить; `style-src unsafe-inline` явно принять с ADR; `x-nonce` удалить.

## Не входит
Nonce для стилей (backlog P3), замена `pymupdf`, `technologies` кэш (SPEC-05).

## Функциональные требования
- `FR-01` `Content-Security-Policy` для HTML: `default-src 'self'; script-src 'self' 'nonce-<base64>' 'strict-dynamic' ['unsafe-eval' в dev]; style-src 'self' 'unsafe-inline'; ... form-action 'self'; upgrade-insecure-requests` — как сейчас `middleware.ts:16` + `next.config.ts:22`. `script-src` без `unsafe-inline`.
- `FR-02` `x-nonce` header не отправляется в ответе и не прокидывается в `requestHeaders` (удалён). `CSP` остаётся единственный носитель nonce.
- `FR-03` `docs/adr/0014-csp-style-unsafe-inline.md` — решение: принимаем `unsafe-inline` для стилей, т.к. XSS-вектор только `dangerouslySetInnerHTML` новостей (санитизирован `nh3`), Tailwind требует inline; nonce для стилей — P3.

## Нефункциональные
- Безопасность: `script-src` без `unsafe-inline` — `security-headers.test.mjs` `script-src` без `unsafe-inline` PASS.
- Совместимость: `npm run build` не ломает стили.

## Техническое решение
- `middleware.ts:52` удалить `requestHeaders.set("x-nonce", nonce)` и `requestHeaders.set("Content-Security-Policy", csp)` — оставить только `response.headers.set("Content-Security-Policy", csp)` через `withCsp`. Или оставить `requestHeaders` для `next/headers` если нужно — но проверить, что ни один `src/app/**/page.tsx` не читает `x-nonce`. Grep `x-nonce` → 0 после удаления.
- `next.config.ts:31` оставить `style-src 'self' 'unsafe-inline'` с комментом `// ADR-0014: Tailwind requires unsafe-inline for styles, see docs/adr`.
- Создать `docs/adr/0014-csp-style-unsafe-inline.md` — контекст, решение, последствия.

## Сценарии
- **Given** `GET /news` , **When** ответ, **Then** `Content-Security-Policy` содержит `script-src 'self' 'nonce-...'` без `unsafe-inline`, `x-nonce` отсутствует.
- **Given** `npm test`, **When** `security-headers.test.mjs`, **Then** `script-src` без `unsafe-inline` PASS.

## Безопасность
- `script-src` без `unsafe-inline` + `strict-dynamic` — даже с `nonce` инъекция не проходит.
- `style-src unsafe-inline` — принято, т.к. стили не исполняют JS (кроме `expression()` в старых IE, неактуально).

## Тестирование
- `npm test` `security-headers.test.mjs` — `headers(): CSP запрещает ... кроме self` без `unsafe-inline` в `script-src`.
- `grep -r "x-nonce" technozrelost-frontend/src` → 0.

## Критерии приёмки
- [ ] `x-nonce` удалён (grep 0).
- [ ] ADR 0014 создан.
- [ ] `npm run build` pass, стили на `/news` не сломаны (визуально или `playwright` smoke).

## DoD
FR, ADR, `npm lint/test/build` green, нет `x-nonce`.
