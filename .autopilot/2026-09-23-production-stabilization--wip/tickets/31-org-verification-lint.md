# 31 — React effect в подсказке верификации организации

**Требование:** D08. **После:** T28. **Зона:** `technozrelost-frontend/src/components/project-create/org-verification-hint.tsx` и узкие тесты.

RED: полный `npm run lint` exit 1 на `:39` — `react-hooks/set-state-in-effect`: синхронный `setPhase('pending')` внутри effect при отсутствии token. Дефект найден при приёмке T28, но файл там не менялся (`evidence/T28-verification.md`). Warning `_params` в `api-client.ts:677` не блокирует lint и не входит в T31.

Trace все состояния `status`/`token`/`phase` и сценарии входа/выхода, прежде чем менять effect. Убери синхронный setState в effect минимально, не теряя скрытие подсказки без сессии, loading/error/ready и cancellation semantics. Сначала RED проверка, затем focused test, полный `npm run lint`, `npm test`, build. Не отключай rule, не меняй auth flow, `.autopilot`, production или секреты; не коммить.
