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

## 2026-09-21 — диагностика AI-ассистента на проде + фикс релевантности — in-progress
- Диагноз прод (213.139.209.165, образ `b30187a`): синтез LLM мёртв — провайдер `opencode.ai/zen` отвечает 403 `FreeTierError: free tier can only be used from within OpenCode` на серверные вызовы; каждый ответ падает в ветку «Не удалось подготовить синтезированный ответ». Корпус цел: 677 документов, ГОСТ Р 58048-2017 на месте.
- Второй дефект (код): поиск без порога отдавал первые попавшиеся выдержки при скоре ~0 («Ты работаешь?» → мусор из ГОСТ 15.309/15.301).
- Фикс в worktree `.worktrees/fix-ai-assistant`, ветка `fix/ai-assistant-relevance` (коммит `2357006`, запушен): порог `_is_relevant` (без общей лексики нужен combined>=0.15), местоимения я/ты/он/она/оно в стоп-слова, warning-лог отказов LLM без секретов, `tests/test_ai_relevance.py` (6 passed; соседние AI/RAG-сьюты 64 passed; ruff clean).
- ВНИМАНИЕ: значение `LLM_API_KEY` прод-среды попало в вывод диагностики — рекомендована ротация ключа. Деплой фикса и решение по серверному LLM-ключу — за владельцем.
- Дополнительно: весь корпус прод — `contour=tuno`, вызовы `/chat/kaba` (AiDocConsultant) всегда пустые; ГОСТы семантически относятся к `kaba` — нужен реимпорт с корректным контуром (решение владельца).
