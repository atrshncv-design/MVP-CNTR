# Манифест требований

Источник: `2026-08-28-brief.md`. Строку из этого списка может снять **только пользователь**.

| ID | Из брифа (дословно) | Статус | Основание | Где |
|----|---------------------|--------|-----------|-----|
| R01 | «Сначала сделай новые спеки и тикеты» — M1 спеки+тикеты для 5К | open | — | — |
| R02 | «проверить, нет ли дублирования или сломанной логики между старыми и новыми тикетами — это критически важно» | open | — | — |
| R03 | «M1 должен закрыть все 24 P1 BACKLOG.md» → N-05 LLM-гейтвей | done | тикет 01 DONE, 7 тестов, ask_llm флаг | 01 |
| R04 | P1 → N-07 throttle без очистки | done | BACKLOG N-07 | — |
| R05 | P1 → N-08 register без троттлинга | done | BACKLOG N-08 | — |
| R06 | P1 → Q-01 sync bcrypt в users.py | done | BACKLOG Q-01 | — |
| R07 | P1 → P-02 sync MinIO в news.py | done | BACKLOG P-02 | — |
| R08 | P1 → P-03 шедулер ×2 реплики | done | BACKLOG P-03, 13- | — |
| R09 | P1 → P-04 throttle in-memory 2 реплики | done | BACKLOG P-04 | — |
| R10 | P1 → N-03 SSE держит DB-сессию | done | BACKLOG N-03 | — |
| R11 | P1 → FE-03 RefreshAccessTokenError | done | BACKLOG FE-03 | — |
| R12 | P1 → FE-04 npm audit high | done | BACKLOG FE-04 | — |
| R13 | P1 → P-05 индексы НИОКТР (trgm/GIN) | done | BACKLOG P-05, 25- | — |
| R14 | P1 → P-06 count на каждую организацию | done | BACKLOG P-06 | — |
| R15 | P1 → P-07 карточка без limit | done | BACKLOG P-07, 27- | — |
| R16 | P1 → P-08 реестры без пагинации | done | BACKLOG P-08 | — |
| R17 | P1 → INF-08 лимиты контейнеров | open | BACKLOG INF-08 | — |
| R18 | P1 → INF-09 ротация логов | open | BACKLOG INF-09 | — |
| R19 | P1 → INF-12 nginx hardening (resolver, rate limit, gzip, cache) | open | BACKLOG INF-12 | — |
| R20 | P1 → INF-13 SPOF один хост + DR-runbook | open | BACKLOG INF-13 | — |
| R21 | P1 → N-18 rate limit публичных реестров | open | BACKLOG N-18 | — |
| R22 | интервью: Туно tuno vs Каба kaba 0028 contour, админка max 19-, пагинация 20 27-, хотфиксы 28- | open | интервью 14/V2 | — |
| R23 | интервью: мэтчинг LLM кросс-отрасль 5 полей 25- топ-5 через центр 14- | open | интервью Q34 | — |
| R24 | интервью: доки мгновенные 22- + SOPS 23- | open | интервью Q24 | — |
