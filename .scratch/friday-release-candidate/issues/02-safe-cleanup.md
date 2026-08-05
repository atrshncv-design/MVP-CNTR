# 02 — Безопасная очистка репозитория

**What to build:** Удалить только доказуемо мёртвый код, дубли, временные файлы, кэши и старые сборки, сохранив рабочее поведение.

**Blocked by:** 01 — Аудит фактического состояния и release baseline

**Status:** done

- [x] Для каждого удаления есть доказательство недостижимости или воспроизводимости
- [x] Старые модели, API, миграции и MVP0 не удалены без отдельного доказательства
- [x] Все baseline-проверки остаются зелёными
- [x] Размер и состав очистки отражены в Status.md

Удалено (frontend `codex/recovery-frontend`): мёртвый `src/app/dashboard/_role-dashboard.tsx` (0 импортов в репо), стартовые ассеты Next.js `public/{next,vercel,globe,file,window}.svg` (0 ссылок; favicon.ico сохранён); фикс stale-теста `tests/ui-shell.test.mjs` №5 — проверка честности по поведению (нет литеральных числовых value), 5/5 зелёные. Удалено (docs `codex/friday-release-candidate`): `КОД MVP "0"/{download,tool-results,upload}` (128 файлов: tool-артефакты, скриншоты, zip+extracted-дубль) и `.zscripts/dev.pid` (PID-файл). Backend: чисто (0 мусора, все .py используются). Гейты: frontend test 5/5, lint, tsc, build — зелёные; pytest 97/97 (не затронут).
