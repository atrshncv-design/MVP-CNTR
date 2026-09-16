# Тикет 02 — Throttle/bcrypt/SSE/Scheduler (N-07,N-08,Q-01,P-02,P-03,P-04,N-03)

**Требования:** R04,R05,R06,R07,R08,R09,R10
**Зависит от:** —
**Зона:** `app/services/auth_throttle.py`, `app/api/v1/auth.py`, `app/api/v1/users.py:68`, `app/services/file_storage.py`, `app/api/v1/news.py:487`, `app/main.py:56`, `app/api/v1/realtime.py:46`

## Задача
Закрыть `N-07` LRU/TTL `auth_throttle.py:21`, `N-08` троттлинг `register` как `login`, `Q-01` `to_thread` `users.py:68`, `P-02` `to_thread` MinIO `news.py:487`, `P-03` `pg_try_advisory_lock` `main.py:56` или `scheduler:1`, `P-04` `Redis INCR` `auth_throttle.py:37` `compose:112`, `N-03` SSE snapshot+pubsub `realtime.py:46`.

## Приёмка
- [ ] `Redis fixed window` `10/60s` две реплики не удваивают
- [ ] `pytest` `test_auth_throttle` + `test_sse_no_session` зелёные

## Связи
`spec Истории 2-8` `13-`
