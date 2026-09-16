# CI/CD — максимально понятно (на твоём стеке)

## CI = Continuous Integration
Каждый git push -> GitHub Actions .github/workflows/ci.yml автоматически:
1. Поднимает PostgreSQL pgvector:0.8.0-pg16 (как pg-primary:5432)
2. uv sync --extra dev + npm ci
3. Гоняет pytest -q 334 + ruff check + mypy --strict + npm lint/test/build
4. Если красный — PR не мерджится

Зачем: ловит баг до прод. Без CI ты бы деплоил stages.py:203 дубль заявки и узнал на проде.

## CD = Continuous Delivery / Deployment
После зелёного CI -> infra/deploy.sh:
1. git SHA -> IMAGE_TAG compose.prod.yml
2. docker compose build
3. health-gate 300с health.py:12 curl /ready (Primary+Replica)
4. Если не healthy -> rollback TAG previous deploy.sh:60
5. Если healthy -> previous = SHA

Delivery — робот собрал, деплоит ты кнопкой (безопасно B2G). Deployment — робот сам деплоит при push main (быстро).

## Твоя схема сейчас
Ты пишешь код -> git push -> CI (pytest/ruff/mypy/npm) зелёный -> ИИ-агент deploy.sh в техокно 02:00 GMT+4 (нагрузка <1%) -> health-gate -> прод

Без CI/CD — деплоил бы руками docker compose up и узнал о P-01 пуле на проде 500 VU.

## Почему solo без CI/CD — риск
- Забыл uv sync --extra dev -> снес pytest
- FE-01 roles.ts:157 fail-open — CI routes-matrix.test.mjs ловит
- INF-06 deploy.sh без health-gate печатает Готово поверх упавшей миграции

CI/CD — твой второй инженер, как alerter.py для 99.9%.
