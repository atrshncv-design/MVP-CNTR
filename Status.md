# Status — платформа «Технозрелость»

## 2026-09-21 — временно скрыты AI-функции из UX/UI серверной версии — done
- Флаги: `AI_UI_ENABLED=false`, `P2_MATCHING_ENABLED=false` (`technozrelost-frontend/src/lib/release.ts`).
- Скрыто: пункт «AI-ассистент» + страница (заглушка), «Подбор партнёра» + страница (заглушка), `AiDocConsultant` в карточке проекта.
- Код/API/словари AI не удалены; возврат — `true` в флагах. Запись прогона: `.autopilot/2026-09-21-remove-ai-ux--wip/`.
- Проверки: `npm test` 237 passed, `npm run build` success, eslint changed files clean.

## 2026-09-21 — деплой d811da2 на прод (213.139.209.165) — done
- Сервер подтянут с `8651cce` на `d811da2` (fast-forward, дерево чистое), `./infra/deploy.sh` — «Выкладка d811da2 прошла health-gate», все 12 сервисов healthy.
- Проверка эфира: образ `technozrelost-frontend:d811da2`, в сборке есть `ai-assistant-hidden` + `sectionHiddenTitle`; `/api/v1/health` 200, `/api/v1/ready` ready (primary ok).
- Доступ: SSH-ключ в рабочей директории не найден (там только парольный `.md`) — зашёл по агентному ключу без пароля.

## 2026-09-21 — AI-функции возвращены в UX (решение владельца) — done
- Флаги `AI_UI_ENABLED=true`, `P2_MATCHING_ENABLED=true`, тесты обновлены (`npm test` 237 passed).
- Деплой `b30187a` на прод: health-gate passed, образ `technozrelost-frontend:b30187a`, `/api/v1/health` 200.
