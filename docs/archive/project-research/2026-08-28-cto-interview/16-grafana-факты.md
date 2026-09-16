# 16 — Grafana: нужна ли? Факты

Источник Q19

**Что делает:** `infra/docker-compose.prod.yml:339-358` Grafana + `prometheus.yml:11` scrape `backend:8000/metrics` (readiness, lag, disk) + `alerter.py:32` Telegram.

**Факты за:** без Grafana — `readiness 503`, `lag slot 12G`, `disk 90%` видит только Telegram; с Grafana — график 7 дней, удобно показать главе «стабильность».

**Факты против:** `infra` уже имеет `alerter` (достаточно для 99.9%), Grafana — доп 300МБ RAM, `expose 3000` внутрь (не наружу), `GRAFANA_ADMIN_PASSWORD` обязателен `deploy.sh:86`, иначе деплой падает.

**Решение CTO для solo:** оставить Grafana внутри (1 день — фронт отчётности как ты сказал), но не наружу. Альтернатива — только Telegram + `prometheus` без UI — дешевле, но главе не показать. Ты сказал «фронт 1д для отчётности» — берём Grafana как фронт отчётности.

**Итог:** нужна, но внутрь, 1 день на дашборд «проекты/УГТ/реестры».
