# Release Candidate — planning index

Дата планирования: 10.08.2026. Целевая дата release candidate: 14.08.2026.

## Порядок выполнения

1. `repo-hygiene` — определить каноническое дерево, проверить секреты, безопасно очистить и доказать clean clone.
2. `release-audit` — подтвердить фактическую baseline-функциональность и RBAC/IDOR.
3. Параллельный frontier после baseline:
   - `identity-organizations`;
   - `ai-rag`;
   - `internal-frontend/01`;
   - `security-infrastructure/01`, затем CI/audit.
4. После организаций и baseline:
   - `requests-matching`;
   - `operations-modules`;
   - остальные internal frontend slices.
5. Инфраструктура, backup/restore, capacity и staging Kali выполняются после зелёной интеграции.

## Артефакты локального трекера

- Мастер: `.scratch/week-release-rc/spec.md`
- Очистка: `.scratch/repo-hygiene/`
- Аудит: `.scratch/release-audit/`
- Аккаунты и организации: `.scratch/identity-organizations/`
- Запросы и матчинг: `.scratch/requests-matching/`
- Операционные модули: `.scratch/operations-modules/`
- Внутренний frontend: `.scratch/internal-frontend/`
- AI/RAG: `.scratch/ai-rag/`
- Security/infra: `.scratch/security-infrastructure/`

## Правила передачи модели-разработчику

- Один тикет — один свежий контекст — один worktree — один атомарный commit.
- В prompt передаются только ticket, релевантные разделы spec и канонические пути; секреты запрещены.
- Изменения вне scope тикета отклоняются.
- Security-sensitive ticket сверяется с `THREAT_MODEL.md` и проходит усиленный review.
- Push выполняет оркестратор только после тестов и review; merge/deploy остаются ручными gates.

## Классификация продукта

- Ready: ядро УГТ, аккаунты/организации, карточки, запросы, базовый matcher, сопровождение, базовая экспертиза, РИД, проверяемый грантовый каталог, служебная аналитика, кабинеты, публичный консультант, release stack.
- Beta: AI ranking, AI contradiction/risk hints, предварительные грантовые подсказки.
- В разработке: новости/мероприятия, прогнозирование, эффективность мероприятий, официальная экспертиза, доращивание, внешние интеграции, финансовый контроль.
- Исключено: образование/кадры, социальная сеть, платежи, генерация документов.
