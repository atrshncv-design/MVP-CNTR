# 06 — CI-конвейер GitHub Actions

**Требования:** R04, R17i
**Blocked by:** 01 (mypy доводится до зелёного поверх финального кода бэкенда)
**Зона:** `.github/workflows/` + точечные правки типов по всему `technozrelost-backend/app/` (только аннотации)
**Волна:** 2
**Status:** code/local complete; remote CI pending

## Что должно заработать

Каждый push и каждый pull request прогоняет оба приложения через полный набор проверок:
бэкенд — тесты на настоящей БД с pgvector, линтер, строгий типизатор; фронтенд — линтер,
тесты и production-сборку. Красный конвейер виден до того, как дефект увидит владелец.
«mypy strict объявлен» становится доказанным фактом.

## Из брифа, дословно

> «CI-пайплайн (P-12)»

## Разделы спецификации

История 7; Решения §CI; таблица соответствия (P-12).

## Критерии приёмки

- [x] Workflow описывает backend/frontend jobs и проверки; локально backend `334 passed` (single process), frontend `39 passed`, lint/build, ruff/mypy и audits green
- [x] Дополнительные секреты CI не требуются по конфигурации
- [ ] Реальный remote GitHub Actions run на ветке и на main: не проверялся
- [ ] Внешняя приёмка: HEAD `7f6ad43`; поздние repair-изменения остаются dirty/uncommitted
