# Внеплановые ремонты прогона (все в ветке, все запушены)

| # | Что | SHA |
|---|---|---|
| R-1 | tls_issue.sh: ERE без обратных ссылок (валидация PUBLIC_HOST) + tests/test_tls_issue.py | fb0dfed |
| R-2 | MinIO: `minio/minio` удалён с Docker Hub → `quay.io/minio/minio`, тот же тег+дайджест | c481ddb |
| R-3 | Harness: pacing provisioning ~8/с + ретраи (зона auth 10r/s) | d01b9d7 |
| R-4 | Harness: синтетика `@load.local` → `@example.com` (EmailStr режет .local) | f71419c |
| R-5 | Пул БД: 1 сессия на auth-запрос (было 2) + пул 20+35; найден по QueuePool timeout на проде | 2584668 |
| R-6 | Тест формы каталога: 66 → 60 открытых (секретные скрыты тикетом 06) | b18db2b |
| R-7 | Авария 301-петли: `default_server` основным блокам + гейт маршрутизации в deploy/rollback | 14ca7d4 |
| R-8 | deploy.sh: reload nginx при изменении redirect.conf (иначе редирект только на диске) | d1b3c35 |

Уроки: гейт ловит только то, что проверяет (петля, reload); single-IP hammer ≠ живые пользователи;
валидаторы email режут тестовые зоны; Docker Hub — не вечный дом для образов.
