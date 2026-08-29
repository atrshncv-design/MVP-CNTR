# TICKET-13: Gitignore reports (L-04)

- **Спека:** SPEC-01
- **Проблемы:** L-04 (`.gitignore` корень не игнорит `reports/*.json`, `technozrelost-backend/.gitignore` игнорит только backend)
- **Приоритет:** P2
- **Критичность:** Low
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-11,12

## Проблема
Корень `reports/loadtest_report.json` untracked, `technozrelost-backend/reports/` игнор — контрадикция ADR-0016 «backend reports игнор, корень stub отслеживаемый» не отражена в игнорах — копятся untracked.

## Требуемый результат
`.gitignore` корень: `reports/*.json` игнор, `!reports/pitr-rehearsal-*.txt` исключение, `git check-ignore -v reports/loadtest_report.json` → root `.gitignore`, `pitr-*.txt` не игнор.

## Объём работ
- `read .gitignore` + `technozrelost-backend/.gitignore`.
- Добавить в корень `.gitignore` после `reports/` секции:

```
reports/*.json
!reports/pitr-rehearsal-*.txt
!reports/loadtest/PROC-01.json
```

(или `reports/loadtest/*.json` игнор кроме PROC-01 — выбрать один, задокументировать).

- `git check-ignore -v reports/loadtest_report.json` true, `reports/pitr-rehearsal-2026-08-29.txt` false.

## Не входит
`uv.lock` (TICKET-02), `digest` (TICKET-01).

## Компоненты
- Файлы: `.gitignore`, `technozrelost-backend/.gitignore`

## План
1. `read .gitignore`.
2. Edit root `.gitignore`.
3. `git check-ignore -v reports/loadtest_report.json` + `pitr-*.txt`.

## Пограничные случаи
- `reports/loadtest/PROC-01.json` stub должен оставаться tracked.

## Тесты
- `git check-ignore`.

## Критерии приёмки
- [ ] `git check-ignore -v reports/loadtest_report.json` → root `.gitignore`.
- [ ] `git check-ignore -v reports/pitr-rehearsal-*.txt` → не игнор.

## Команды проверки
- `git check-ignore -v reports/loadtest_report.json`
- `git check-ignore -v reports/pitr-rehearsal-2026-08-29.txt`
- `git status --porcelain | grep reports`

## Риски
- Нет.
