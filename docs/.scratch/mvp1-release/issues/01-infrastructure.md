# 01 — Инфраструктура разработки

**What to build:** Восстановить рабочий контур разработки: git-репозитории (битые worktree-указатели заменяются на рабочую структуру, remote `origin` → MVP-CNTR.git сохраняется, push-контракт соблюдается), пересоздать backend-окружение (Python 3.11/3.12 через uv), поднять PostgreSQL (docker compose), применить миграции, засидить 9 ролей + permissions. Итог: backend и frontend запускаются локально, коммиты и пуши проходят.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `git status`/`git log` работают в frontend и backend, remote `origin` корректен
- [ ] Backend импортируется без ошибок (`python -c "import app.main"`), venv на Python 3.11/3.12
- [ ] `docker compose up -d` — БД на 5432/5433; `alembic upgrade head` без ошибок
- [ ] Seed: 9 ролей + permissions + дефолтные права; регистрация пользователя через API работает
- [ ] `npm run dev` (frontend) и `uvicorn` (backend) стартуют; главная страница открывается
