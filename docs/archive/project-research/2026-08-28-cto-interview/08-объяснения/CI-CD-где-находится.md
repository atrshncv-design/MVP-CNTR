# CI/CD — где находится

## Где сейчас
- GitHub `https://github.com/atrshncv-design/MVP-CNTR.git` `origin` `AGENTS.md`
- CI: `GitHub Actions` `.github/workflows/ci.yml` — раннер `ubuntu-latest` облако GitHub (бесплатно 2000м/мес), поднимает `pgvector:0.8.0-pg16` service `5432`, `uv` + `npm`, гоняет `pytest/ruff/mypy`.
- CD: `infra/deploy.sh` лежит в репо, запускается на твоём прод-хосте (не в облаке) в техокно 02:00, делает `docker compose build` + `health-gate`.

## Альтернативы
- Self-hosted runner на твоём 8/32 хосте — быстрее, но тратит твой CPU.
- Для B2G: оставить GitHub cloud CI + CD на хосте заказчика (закрытый контур, без наружу). Секреты `LLM_API_KEY` только на хосте, не в GitHub.

Итого: CI в облаке GitHub, CD на хосте ЦНТР — как сейчас задумано.
