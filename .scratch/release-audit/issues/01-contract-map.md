# 01 — Матрица фактических функций MVP

**What to build:** Проверенную матрицу UI → API → DB → RBAC → audit → tests для всех текущих функций без продуктовых изменений.

**Blocked by:** repo-hygiene/04 — Проверка чистого клона.

**Status:** done

- [x] Все маршруты и endpoints сопоставлены с ролями и источниками данных.
- [x] Моки, dead controls, fallback data и отсутствующие backend-проверки перечислены.
- [x] Каждому разрыву назначены severity и рекомендуемое действие: fix, hide или in-development.
- [x] Отдельно отмечены генерация документов и AI-доступ к данным.

Результат: `.scratch/release-audit/evidence-matrix.md` (10.08.2026).
