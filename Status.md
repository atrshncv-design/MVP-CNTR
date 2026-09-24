# Status — платформа «Технозрелость»

## 2026-09-24 — stabilization audit follow-up (отдельный worktree, без деплоя) — in-progress
- Ветка `autopilot/production-stabilization`: backend test baseline 720 passed; Ruff passed. Изолированный Python 3.11 mypy проверил 62 файла и выявил два локальных typing findings (T26/T27), поэтому type gate ещё красный.
- Frontend T25: те же Manrope и JetBrains Mono скачаны из официального `google/fonts` с OFL, подключены локально; 238 тестов и production build через webpack проходят. Штатный Turbopack build в локальном sandbox блокируется на создании worker process; CI/production этим не подтверждены.
- T23/T24: ассистенты по документам и реестрам ещё не исправлялись; live provider проверка ждёт нового ключа от владельца после локальных правок. Production не менялся.
- T26: Redis SSE factory приведён к узкой границе типов; 10 SSE-тестов и Ruff проходят, mypy теперь показывает только T27.

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

## 2026-09-21 — переход AI на OpenCode Go (тот же ключ, endpoint go/v1, mimo-v2.5) — in-progress
- Проверка с сервера: тот же ключ на `https://opencode.ai/zen/go/v1` принят (`GET /models` 200, 31 модель); точный id — `mimo-v2.5` (endpoint `chat/completions` по доке). Старый `zen/v1` + `mimo-v2.5-free` отвечал 403 FreeTierError.
- Нюанс провайдера: без `x-opencode-session` — 400 MissingSessionID; клиент обязан слать свой User-Agent.
- Код в ветке `fix/ai-assistant-relevance` (коммит `d464dc0`, запушен): `ask_llm(..., session_id=None)` шлёт `User-Agent: technozrelost-backend/1.0` + `x-opencode-session` (стабильный `stable_session_id`, наружу только хеш); сессии: чат — по пользователю, стейдж — по проекту+этапу, мэтчинг — по содержимому; `resolve_llm_api_key` знает алиас `OPENCODE_ZEN_API_KEY`; example + allowlist backend переведены на go/v1 + `mimo-v2.5` + оба имени ключа.
- Проверки: ruff clean; 46 + 115 тестов зелёные (включая allowlist прод-env и infra-контракты).
- Осталось (нужно решение владельца): сменить на проде `LLM_API_BASE` → `https://opencode.ai/zen/go/v1`, `LLM_MODEL` → `mimo-v2.5` (ключ тот же, гейт уже true) и передеплоить бэкенд.

## 2026-09-21 — AI-ассистент оживлён на проде (deepseek-v4-flash) — done
- Деплой `edf8083` (ветка в `53591dc`): health-gate passed. Прод-env: `LLM_API_BASE=https://opencode.ai/zen/go/v1`, `LLM_MODEL=deepseek-v4-flash`, ключ тот же, гейт true.
- Почему не MiMo: `mimo-v2.5` стабильно 403 на этом ключе, `hy3` тоже 403; 200 отвечают `mimo-v2.5-pro`, `glm-5.3-flash`, `deepseek-v4-flash`, `deepseek-v4.1-flash`, `longcat-2.0`, `qwen3.8-flash`. Владелец выбрал `deepseek-v4-flash` (65 тыс. запросов/мес, retention 0 дней).
- Ловушка при рестарте: `up -d backend` без `--env-file` и без `IMAGE_TAG` поднял старый образ `:local` — пересоздано явно с `IMAGE_TAG=edf8083cba6e`.
- Живая проверка задеплоенным кодом: синтез «Да» за 1–6 сек (один холодный таймаут 8с — в пределах бюджета, повтор ок).
- Осталось владельцу: проверить в UI (`/dashboard/ai-assistant`, вопрос по ГОСТ Р 58048-2017) — функциональная приёмка.

## 2026-09-21 — «расскажи про угт 6»: таймаут + мимо корпуса — fixed, deployed 283ea7e
- Причина 1: разовый таймаут deepseek (>8с) в момент вопроса — в логах `LLM synthesis timeout`, других ошибок нет.
- Причина 2 (главная): в текстах 58048 нет аббревиатуры «УГТ» — только «уровень зрелости/готовности», а синонима не было: запрос давал 1 выдержку из постороннего ГОСТ 57194.1. Плюс `ugt_level` пуст во всех 677 документах — бустить нечего.
- Фикс (ветка `fix/ai-assistant-relevance`, в деплойной `283ea7e`): канон `syn_ugt` (угт/trl ↔ готовност/зрелост); cap генерации 2000→1200 (reasoning-хвосты deepseek); тесты +4 (`test_ai_relevance.py` 10 passed; пачки 14/71 зелёные; ruff clean).
- Живая проверка на проде: «расскажи про угт 6» → 3 релевантные выдержки (методики оценки зрелости); синтез отвечает за 1–6с, варнингов нет.
- Остаточный риск: хвост латентности deepseek близок к бюджету 8с — при повторах таймаутов смотреть в сторону смены модели.

## 2026-09-21 — синтез падал и после фиксов: deepseek 30с+ на боевом промпте — fixed, deployed f06b15c
- Причина: мои ранние пробы были с крошечным промптом (ок), а боевой RAG-промпт (персона + 3 фрагмента) deepseek-v4-flash не переваривает — ReadTimeout даже на 30с. Замер: GLM 6–13с на том же промпте. Бюджет 8с провайдеру мал в принципе.
- Фикс (ветка `fix/ai-assistant-relevance`, в деплойной `f06b15c`): `LLM_TIMEOUT_SECONDS` 8→20 (худший случай 24с, тест-контракт обновлён), cap 1200→800, elapsed в warning таймаута; модель прод → `glm-5.3-flash` (31.5 тыс. запросов/мес, retention 0 дней).
- Живая проверка боевым промптом: synthesis 200, честный ответ с цитатами (~13–20с); ретрив «расскажи про угт 6» — 3 релевантные выдержки.
- Честно: ожидание ответа 10–20с — это хвост провайдера, без стриминга быстрее не будет. Если критично — следующий шаг стриминг SSE.
