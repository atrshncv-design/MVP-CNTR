# 15 — Отчётность LLM-агент

Источник Q18

Grafana добавлена предыдущим агентом `compose.prod.yml:339` `prometheus.yml:11` для метрик `readiness/slot/disk`, доступ внутрь `expose 3000` `INF-07` (SSH-туннель, `GRAFANA_ADMIN_PASSWORD` обязателен `deploy.sh:86`). Не ты добавлял — агент для наблюдаемости 99.9%.

Отчётность LLM-агент: собирает `projects by UGT`, `sectors`, `match requests`, `achievements stats admin.py:61` → LLM генерирует пояснения/прогнозы/красивые PDF (как document_generator). Данные обезличены, только агрегаты.
