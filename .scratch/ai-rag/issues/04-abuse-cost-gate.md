# 04 — Abuse, rate-limit и cost gate AI

**What to build:** Серверные лимиты, дневной бюджет, метрики, cache и аварийное отключение, защищающие публичный AI от Denial of Wallet.

**Blocked by:** 03 — Тематические guardrails и off-topic блокировка.

**Status:** ready-for-agent

- [ ] Анонимная сессия ограничена 10/15 минут и 30/сутки; input не более 2000 символов.
- [ ] Лимиты устойчивы к простому client reset и не требуют хранения лишних ПДн.
- [ ] Общий budget cutoff и kill switch проверены без live расходов в CI.
- [ ] Логи редактированы; метрики отражают запросы, отказы, tokens и budget.
