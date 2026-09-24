# 25 — Воспроизводимая сборка frontend без Google Fonts на build-time

**Требование:** D02, служит R20/R21 и CODE-06. **После:** T03. **Зона:** frontend typography/build, минимум файлов.

## RED

`API_URL_INTERNAL=http://backend:8000 npm run build` → exit 1: `next/font` не может скачать Manrope и JetBrains Mono с `fonts.googleapis.com` в изолированном окружении (`evidence/T03-verification.md`). `npm test` при этом 237 passed. Отсутствие `API_URL_INTERNAL` — ожидаемый guard, его не убирать.

## Исполнителю

Проверь существующие локальные assets и варианты сборки без сетевого запроса. Сохрани текущую типографику и поддержку latin/cyrillic, если доступен законно распространяемый локальный asset; иначе верни `NEEDS_DECISION` с точным visual trade-off. Не добавляй новый пакет ради шрифтов, не меняй CSP или production guard без необходимости. Сначала зафиксируй failing build, затем минимальный fix, focused checks и повтор полной сборки с CI-значением `API_URL_INTERNAL`. Не читай `.env`/секреты, не трогай production, `.autopilot/**`, не коммить.

Приёмка: `npm test` и `API_URL_INTERNAL=http://backend:8000 npm run build` exit 0 без Google Fonts fetch, сохранены визуальные переменные `--font-manrope`/`--font-jetbrains-mono` либо явно согласован эквивалент. Оркестратор независимо повторяет тесты/сборку и ревьюит UX-impact.
