# TICKET-13: Удалить x-nonce (L-01)

- **Спека:** SPEC-06
- **Проблемы:** L-01 (мёртвый `x-nonce`)
- **Приоритет:** P2
- **Критичность:** Low
- **Сложность:** S
- **Зависимости:** TICKET-12
- **Можно параллельно с:** TICKET-14

## Проблема
`middleware.ts:53` `requestHeaders.set("x-nonce")` и `response.headers.set("x-nonce")` — ни один `src/app` не читает, Next 16 nonce из CSP.

## Требуемый результат
`grep -r "x-nonce" technozrelost-frontend/src` ==0, `CSP` остаётся.

## Объём работ
- `technozrelost-frontend/src/middleware.ts:52` удалить `requestHeaders.set("x-nonce")` и `requestHeaders.set("Content-Security-Policy", csp)` (оставить только `response.headers.set("Content-Security-Policy", csp)`). Альтернатива: удалить обе `x-nonce` строки, оставить `Content-Security-Policy` в `response` via `withCsp`.

## Не входит
CSP логика (TICKET-12).

## Компоненты
- Файл: `src/middleware.ts`

## План
1. `grep -n "x-nonce" src/middleware.ts`.
2. Удалить 2 строки.
3. `npm run build` + `npm test`.

## Пограничные случаи
- `requestHeaders` больше не нужен? Оставить `NextResponse.next({request: {headers: requestHeaders}})` если `requestHeaders` пустой — можно убрать `requestHeaders` вовсе.

## Тесты
- `npm test` `security-headers.test.mjs` PASS.
- `grep x-nonce` 0.

## Критерии приёмки
- [ ] `grep x-nonce` 0.
- [ ] `npm run build` pass.

## Команды проверки
- `grep -r "x-nonce" technozrelost-frontend --include="*.ts" --include="*.tsx"`
- `npm test 2>&1 | grep -E "pass|fail"`

## Риски
- Если future Server Component читает `x-nonce`, сломается — но сейчас 0.
