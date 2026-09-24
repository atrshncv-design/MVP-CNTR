# T03 — независимая проверка frontend environment

Дата: 2026-09-24 (+04:00). Worktree `autopilot/production-stabilization`.

| Команда | Итог |
|---|---|
| `npm ci` | Исполнитель: exit 0, установлено 529 packages; lock-файл не изменён |
| `npm test` | Исполнитель: exit 0, 237 passed / 0 failed. Независимый повтор оркестратора: exit 0, 237 passed / 0 failed |
| `npm run build` без env | Исполнитель: exit 1, `API_URL_INTERNAL не задан` — ожидаемый production-guard `next.config.ts` |
| `API_URL_INTERNAL=http://backend:8000 npm run build` | Исполнитель и независимый повтор оркестратора: exit 1, Next не смог получить Manrope и JetBrains Mono из Google Fonts (network/fetch failure) |

Node v22.23.1, npm 10.9.8. `API_URL_INTERNAL=http://backend:8000` — CI-значение из `.github/workflows/ci.yml:85` и локальная строка конфигурации, не production endpoint. Никаких запросов к backend или production при сборке не выполнялось. Продуктовый код, tests, package/lock и production не менялись. `npm test` выдаёт неблокирующие `MODULE_TYPELESS_PACKAGE_JSON` warnings; Next предупреждает об устаревшем `middleware` convention.

Disposition: **T03 BLOCKED / CODE-06 не DONE**. Отсутствующие зависимости устранены, но локальный production build требует доступа к Google Fonts. Это отдельный D02/T25; не объявлять билд зелёным по одному только `npm test`. Перед исправлением проверить возможность сохранить ту же типографику без сетевого build-запроса; не ослаблять production guard.
