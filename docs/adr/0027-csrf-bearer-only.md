# ADR 0027: Мутации только с Bearer — cookie-POST без CSRF-токена не вводится

**Tier:** T2 — security / CSRF, reversal = cookie-аутентификация к API без SameSite/CSRF-токена
**Date:** 2026-09-08
**Status:** accepted

## Title
Мутации API — только с `Authorization: Bearer`; cookie-POST к бэкенду не вводится без CSRF-токена

## Context
Бэкенд принимает пользователя только из заголовка `Authorization: Bearer <access>` (`technozrelost-backend/app/core/deps.py:14` `HTTPBearer`, `get_current_user`/`get_current_user_optional`; cookie не читаются — `grep Set-Cookie backend/app` пуст). Фронт шлёт токен явно в момент отправки из единого слоя (`technozrelost-frontend/src/lib/api-client.ts:52` `Authorization: Bearer`, `src/features/offline/queue.ts:11` — очередь хранит действия без `Authorization`, токен инжектится при отправке, таск 10). Ни один `fetch` к API не ставит `credentials: include`, Bearer не кладётся в `document.cookie`/`localStorage` (проверено поиском 2026-09-08).

Сессионная cookie NextAuth (`src/auth.config.ts`, JWT-стратегия) — граница фронтенд-shell: браузер↔Next, никогда не отправляется в FastAPI как credential мутаций. Поэтому CSRF через чужой сайт невозможен: браузер не прикрепляет `Authorization` к cross-site запросам автоматически, а cookie бэкенда не устанавливают сессию.

## Decision
- Мутации (`POST/PATCH/PUT/DELETE /api/v1/*`) — только с валидным `Authorization: Bearer`; аноним/поддельный заголовок = anon-лимит или `401/403` (таск 05: классификация по валидированному user, не по наличию заголовка).
- Cookie-POST к FastAPI (сессионная cookie как credential мутаций) не вводится. Если когда-нибудь понадобится (SSO, httpOnly-сессия) — только пакетом: `SameSite=Lax/Strict` + CSRF-токен (double-submit или synchronizer) на все не-GET + `Origin/Referer`-проверка; без этого пакета cookie-auth — запрет.
- CORS (`app/main.py`, `CORSMiddleware`) не расширять до `allow_credentials` с `allow_origins=["*"]`; текущий `allow_credentials=True` — только под явный `cors_origin_list` из настроек.

## Consequences
**Положительные:** класс CSRF закрыт архитектурой, а не дисциплиной: нечего красть через cookie, токен в `Authorization` чужой origin не подставит. Приёмка таска 15 (документ фиксирует правило) — этот ADR.

**Отрицательные / цена:** XSS с кражей access-токена из памяти остаётся критичным — компенсируется CSP-nonce (`script-src` без `unsafe-inline`, middleware per-request nonce) + коротким TTL access (60 мин) + ротацией refresh (таск 06). Cookie-auth как удобство (httpOnly от XSS) сознательно не берём без CSRF-пакета.

**Что отвергли и почему:**
- *Cookie-сессия к API сейчас* — отвергнуто: требует CSRF-токены на всех мутациях, `SameSite`/CORS-аудит и тесты origin; выигрыш (httpOnly от XSS) не покрывает объём при рабочем Bearer + CSP.
- *CSRF-токены поверх Bearer* — отвергнуто: Bearer не прикрепляется браузером автоматически, токен в URL запрещён (SSE-ticket, таск 04) — защищать нечего.

## References
- `technozrelost-backend/app/core/deps.py:14,20` Bearer-граница, `app/main.py:288` CORS
- `technozrelost-frontend/src/lib/api-client.ts:52` Bearer в момент отправки, `src/features/offline/queue.ts:11` очередь без секретов
- `technozrelost-frontend/src/auth.config.ts` NextAuth cookie — только shell, не credential API
- Таск 15 (R06i, история 19): гонка инвайтов + CSP-nonce + этот документ
