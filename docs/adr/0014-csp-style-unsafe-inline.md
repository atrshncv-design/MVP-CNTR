# ADR 0014: CSP style-src unsafe-inline — принимаем для Tailwind, nonce для стилей P3 (M-07)

**Tier:** T2 — security / CSP, reversal = инъекция стилей без исполнения JS, замена на nonce требует рефактора Tailwind P3
**Date:** 2026-08-29
**Status:** accepted

## Title
Принимаем `style-src 'self' 'unsafe-inline'` для Tailwind v4; nonce для стилей — backlog P3

## Context
`technozrelost-frontend/next.config.ts:31` формирует `Content-Security-Policy` со `style-src 'self' 'unsafe-inline'`. Без `unsafe-inline` Tailwind v4 ломается: фреймворк инжектит инлайн-стили через `<style>` и `style=""` атрибуты при сборке и рантайме, удаление директивы даёт FOUC/сломанную вёрстку на всех маршрутах. При этом `script-src` уже защищён nonce `'nonce-<base64>'` + `'strict-dynamic'` (FE-05), без `unsafe-inline`. Аудитор (M-07) отмечает, что CSP не блокирует инлайн-стили — нужен явный ADR о принятии риска.

Единственный пользовательский XSS-вектор в приложении — `dangerouslySetInnerHTML` для контента новостей/достижений, который санитизируется `nh3` на обеих точках записи (`app/services/html_sanitizer.py`, санитизация при создании и обновлении). Остальные страницы рендерят React-экранированный JSX.

## Decision
- Оставляем `style-src 'self' 'unsafe-inline'` в `next.config.ts:31` и `middleware.ts:16` (production и dev fallback CSP). Комментируем строку `// ADR-0014: Tailwind requires unsafe-inline for styles, see docs/adr/0014-csp-style-unsafe-inline.md`.
- `script-src` остаётся без `unsafe-inline` — `script-src 'self' 'nonce-...' 'strict-dynamic'` (+ `'unsafe-eval'` только в dev для react-refresh). Это главный барьер против XSS.
- HTML новостей остаётся под `nh3`-санитизацией (разрешённые теги/атрибуты, вырезаются `<script>`, `on*`, `javascript:`).
- Nonce/hashes для стилей (`style-src 'nonce-...'` или `'hash-...'`) выносим в backlog P3 — требует кастомной интеграции Next.js/Tailwind (нет стабильного API для nonce в инлайн-стилях) и не даёт соразмерного выигрыша при отсутствии JS-исполнения в CSS.

## Consequences
**Положительные:** стили Tailwind работают без FOUC; CSP сохраняет защиту от скриптового XSS (`script-src` без `unsafe-inline` + `strict-dynamic`); решение задокументировано для аудита 152-ФЗ/B2G — M-07 закрыт.

**Отрицательные / цена:** инлайн-стили не блокируются CSP — злоумышленник с возможностью инжекта HTML может вставить `style=""`/` <style>` и исказить вёрстку (defacement, exfiltration через CSS-селекторы в старых техниках). Риск ограничен: CSS-инъекция не исполняет JS (кроме `expression()` в IE, неактуально), а HTML-инжект уже закрыт `nh3`; P3-рефактор на nonce для стилей потребует изменений в сборке Tailwind и Next.js runtime.

**Что отвергли и почему:**
- *Удалить `unsafe-inline` из `style-src` без замены* — отвергнуто: ломает Tailwind v4 на всех страницах, визуальная регрессия блокирует релиз.
- *Nonce/hashes для стилей сейчас* — отвергнуто: P3 — нет стабильного Next.js API для прокидки nonce в `<style>` Tailwind, объём рефактора несоразмерен риску (CSS не исполняет JS); вернёмся при появлении framework-поддержки.
- *Один CSP без разделения script/style* (`default-src` с `unsafe-inline`) — отвергнуто: ослабляет `script-src`, противоречит FE-05.

## References
- `technozrelost-frontend/next.config.ts:31` `style-src 'self' 'unsafe-inline'` + коммент `// ADR-0014`
- `technozrelost-frontend/src/middleware.ts:16` CSP сборка, `html_sanitizer.py` nh3-санитизация `dangerouslySetInnerHTML`
- SPEC-06 (M-07, L-01) — CSP фронтенд, `docs/remediation/tickets/TICKET-12-csp-style-adr.md`
- `technozrelost-frontend/tests/security-headers.test.mjs` — ожидает `style-src` с `unsafe-inline`, `script-src` без `unsafe-inline`
- Tailwind CSS 4 docs — inline style injection, Next.js CSP nonce docs
