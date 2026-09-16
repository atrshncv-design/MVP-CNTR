# TICKET-12: CSP style ADR (M-07)

- **Спека:** SPEC-06
- **Проблемы:** M-07 (`style-src unsafe-inline`)
- **Приоритет:** P2
- **Критичность:** Medium
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-11,13

## Проблема
`next.config.ts:31` `style-src 'self' 'unsafe-inline'` — без него Tailwind ломается, но CSP не блокирует инлайн-стили. Нет ADR, аудитор отметит.

## Требуемый результат
ADR `0014-csp-style-unsafe-inline.md` “принимаем unsafe-inline для стилей, т.к. XSS только через `dangerouslySetInnerHTML` новостей, санитизирован `nh3`, nonce для стилей — P3”.

## Объём работ
- `docs/adr/0014-csp-style-unsafe-inline.md` — контекст (Tailwind), решение (keep unsafe-inline), последствия (style injection не исполняет JS), альтернативы (nonce for styles).
- `technozrelost-frontend/next.config.ts:31` добавить коммент `// ADR-0014: ...`.

## Не входит
Удаление `x-nonce` (TICKET-13).

## Компоненты
- Файлы: `docs/adr/0014*.md`, `next.config.ts`

## План
1. `read ИМПОРТОЗАМЕЩЕНИЕ.md` формат ADR.
2. Создать ADR по шаблону `0001-...md`.
3. Коммент в `next.config.ts`.

## Пограничные случаи
- `npm test` `security-headers.test.mjs` ожидает `style-src` с `unsafe-inline` — не менять тест.

## Тесты
- `npm test` PASS.
- `grep -c "ADR-0014" next.config.ts` ==1.

## Критерии приёмки
- [ ] ADR создан.
- [ ] Коммент в `next.config.ts`.
- [ ] `npm run build` pass.

## Команды проверки
- `npm test 2>&1 | tail -n 20`
- `ls docs/adr/0014*`

## Риски
- Нет.
