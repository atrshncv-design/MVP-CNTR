# Тикет 03 — Frontend auth + audit (FE-03, FE-04)

**Требования:** R11,R12
**Зависит от:** —
**Зона:** `technozrelost-frontend/src/middleware.ts:27`, `src/lib/api-client.ts:36`, `package.json`, `.github/workflows/ci.yml`

## Задача
`FE-03` `RefreshAccessTokenError→/login` `middleware` + `api-client 401→signOut`, `FE-04` `overrides` `js-yaml nanoid` `npm audit` без high `ci.yml`.

## Приёмка
- [ ] `npm run lint && npm test && npm run build` зелёные, `npm audit` без high

## Связи
`spec Истории 9-10`
