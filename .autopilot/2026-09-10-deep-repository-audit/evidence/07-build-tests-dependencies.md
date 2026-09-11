# 07 — Сборка, зависимости, тесты и CI

## Контекст и неизменность checkout

- Проверен commit `e87267d7c6840ce7d4ec153d7d183731bf5f32e4`, ветка
  `audit/deep-repository-20260910`, 2026-09-10. Запрошенный `executor.md` отсутствует как в
  корне, так и в audit-run; работа выполнена по `interfaces.md`, тикету 07 и разрешённым
  разделам `spec.md`.
- До команд `git status --short --branch` показывал только ранее существовавшие изменения
  `.autopilot/README.md`, `.autopilot/dashboard.html`, `.autopilot/state.js` и два untracked
  audit-run. После команд набор тот же, кроме настоящего evidence внутри уже untracked run.
- SHA-256 до и после совпали: `package.json` `87c5880a…ca217`, `package-lock.json`
  `049ecaaa…e0b7`, `pyproject.toml` `097bb924…640a`, `uv.lock` `8620b3a5…ff7f`.
  `git diff --name-only -- technozrelost-backend technozrelost-frontend .github` и staged
  аналог после проверки пусты: продукт, CI, manifests и lockfiles не изменены.
- Версии локальной среды: Node `v22.23.1`, uv `0.12.1`; точный Python CI воспроизведён как
  CPython `3.11.15`. Созданы только ignored `node_modules`, `.next`, `.venv`, `dist`.

## Run evidence

| Команда | Результат | Доказательство / ограничение |
|---|---|---|
| `npm ci` | PASS | 529 packages; lock не изменён; npm сразу сообщил 6 vulnerabilities. |
| `uv sync --extra dev --locked` | PASS | 79 packages resolved, dev tools установлены; lock не изменён. |
| `npm test` | PASS | 182 passed, 0 failed/skipped/todo, 1.44 s; есть ожидаемые module-type и missing-message diagnostics. |
| `npm run lint` | PASS | ESLint exit 0, без diagnostics. |
| `npm run build` | FAIL | Без env: `API_URL_INTERNAL не задан`, guard в `next.config.ts`; это не CI parity, потому что CI задаёт env. |
| `API_URL_INTERNAL=http://backend:8000 npm run build` | PASS | Точный CI env (`.github/workflows/ci.yml:84-86`): Next 16.3.0 compile, TypeScript и 49 static pages успешны; warning о deprecated `middleware` convention. |
| `uv run ruff check app tests infra/alerter scripts/udgu_ingest` | PASS | `All checks passed!`; совпадает с CI `ci.yml:66-67`. |
| `uv run mypy app` на исходном Python 3.14 env | FAIL | До проверки parity парсер упал в `numpy/__init__.pyi` на syntax 3.12+; проект допускает `>=3.11`, но CI фиксирует 3.11. |
| `uv sync --python 3.11 --extra dev --locked`; `uv run mypy app` | FAIL | Точный CI Python: 2 product errors, `app/api/v1/realtime.py:109 [no-untyped-call]` и `app/main.py:307 [arg-type]`; 61 files checked. |
| `uv build` | PASS | Построены `dist/technozrelost_backend-0.1.0.tar.gz` и universal wheel. Это штатный package contract без Docker daemon. |
| `uv run pytest -q infra/alerter/test_alerter.py` | PASS | 30 passed in 0.85 s; этот файл вне destructive `tests/conftest.py`. |
| `uv run pytest --collect-only -q infra/alerter/test_alerter.py tests` | PASS | 520 tests collected; только импорт/collection, без запуска DB fixtures. |
| `uv run pytest -q infra/alerter/test_alerter.py tests` | BLOCKED | `tests/conftest.py:23,58-62,73-106` фиксирует общую БД `technozrelost_test`, мигрирует её и после каждого теста делает `TRUNCATE public... RESTART IDENTITY CASCADE`; нет per-run DB/schema guard. |
| migration clean upgrade/downgrade/API ASGI suite | BLOCKED | Тот же shared destructive fixture. Единственный явный data migration cycle меняет общую схему до `0030` (`tests/test_migration_remediation.py:13-35,68-115`). Disposable harness без Docker отсутствует. |
| `uv pip check` | PASS | 76 packages checked, conflicts отсутствуют. |
| `uv run --extra dev --with pip-audit==2.9.0 pip-audit -l` | PASS | Network audit выполнился: known vulnerabilities не найдены. |
| `npm audit --audit-level=high` | FAIL | Network audit выполнился: 6 vulnerabilities = 3 moderate, 2 high, 1 critical. |
| Docker image build/runtime checks | BLOCKED | По условию Docker daemon/контейнеры не трогались. Dockerfiles прочитаны статически; backend package и frontend production build проверены. CI Docker runtime parity остаётся внешним ограничением. |

## CI parity

- CI содержит locked installs, оба audits, exact ruff/mypy/pytest, backend Docker build/client
  smoke/readiness и frontend lint/test/build (`.github/workflows/ci.yml:47-79,87-107`). Локально
  воспроизведены все безопасные non-Docker/non-shared-DB шаги.
- На текущем snapshot CI должен быть красным минимум на backend Mypy (`ci.yml:68-69`) и
  frontend dependency audit (`ci.yml:100-101`). Frontend build зелёный только с уже заданным
  CI env. Docker build, client libs, readiness и 490 DB-bound tests не подтверждены локально.
- `tests/test_ci_gates.py:22-64` лишь ищет токены в сыром YAML: он не парсит workflow, не
  доказывает исполнимость команд/jobs и сам попадает под destructive global conftest.

## Кандидаты находок

### BTD07-01: locked frontend содержит unauthenticated RCE advisory

- **Category:** supply chain; **proposed severity:** Critical; **confidence:** Confirmed.
- **Files:** `technozrelost-frontend/package.json:12-21`,
  `technozrelost-frontend/package-lock.json:6846-6874`.
- **Evidence:** lock реально устанавливает Next `16.3.0`; `npm audit --audit-level=high`
  относит диапазон `16.0.0–16.3.2` к critical GHSA-p293-qw3h-jr36 и
  GHSA-2xp9-vwfh-vxw4 (unauthenticated RCE, включая Image Optimization/AVIF). Тот же audit
  подтверждает high `browserslist@4.28.6`, high `sharp@0.35.3`, moderate
  `baseline-browser-mapping@2.10.44` и `uuid@8.3.2`; цепочки подтверждены `npm ls`.
- **Safe reproduction:** `npm ci && npm audit --audit-level=high`; без `npm audit fix`.
- **Impact:** удалённый неаутентифицированный актор может атаковать уязвимый Next image path
  при выполнении условий advisory; Windows-specific часть GHSA не переносится на Linux image,
  но AVIF advisory остаётся применимым к установленному server package. High transitive
  defects дают DoS/crash/memory and image parsing exposure.
- **Remediation/tests:** обновить Next и transitives до advisory-fixed releases, пересобрать
  lock, повторить audit/build/tests и добавить image-optimizer malicious-AVIF regression.

### BTD07-02: обязательный backend Mypy gate не проходит на CI Python

- **Category:** build/CI; **proposed severity:** High; **confidence:** Confirmed.
- **Files:** `technozrelost-backend/app/api/v1/realtime.py:102-113`,
  `technozrelost-backend/app/main.py:305-307`, `.github/workflows/ci.yml:53-69`.
- **Evidence/reproduction:** после `uv sync --python 3.11 --extra dev --locked` команда
  `uv run mypy app` возвращает exit 1: untyped Redis `from_url` call на строке 109 и
  несовместимую сигнатуру validation exception handler на строке 307.
- **Impact:** штатный required CI не может завершиться успешно, независимо от зелёных runtime
  tests/build; типовые регрессии не отфильтрованы до исправления baseline.
- **Remediation/tests:** типизировать Redis factory и адаптировать/annotate handler к Starlette
  exception protocol; зафиксировать regression запуском exact CI Mypy на Python 3.11 и 3.12.

### BTD07-03: локальный pytest harness разрушает разделяемую test DB

- **Category:** test isolation/data safety; **proposed severity:** High; **confidence:** Confirmed.
- **Files:** `technozrelost-backend/tests/conftest.py:11-14,23-45,58-62,73-106`,
  `technozrelost-backend/tests/test_migration_remediation.py:13-35,68-115`.
- **Evidence:** имя БД константно, host/user/password наследуются из окружения, schema всегда
  `public`; session fixture выполняет migrations, function fixture TRUNCATE 34+ tables с
  `RESTART IDENTITY CASCADE`. Migration test глобально downgrade/upgrade той же БД.
- **Impact:** параллельный разработчик/агент теряет test data, получает races/deadlocks или
  видит ложные результаты; ошибочно направленная test-named remote DB также будет изменена.
- **Remediation/tests:** уникальная disposable DB/schema на run/worker, denylist remote hosts,
  ownership marker и guaranteed teardown; проверить два параллельных suite без пересечений.

### BTD07-04: большинство frontend «behavior/WCAG» проверок являются source-grep contracts

- **Category:** test quality; **proposed severity:** Medium; **confidence:** Confirmed.
- **Files:** `technozrelost-frontend/package.json:5-10`, `tests/wcag.test.mjs:1-10,12-24,125-143,179-183`,
  `tests/matching.test.mjs:41-72,91-102,124-131`, `tests/routes-matrix.test.mjs:73-92`.
- **Evidence:** test script — только `node --test`; как минимум 21 из 27 test files читают
  production source через `readFileSync`. WCAG suite называет regex-поиск «статическим
  эквивалентом axe» и заявляет `axe 0`, но DOM/axe не запускает. Matching PII «snapshot» не
  вызывает sanitizer, а лишь проверяет наличие идентификаторов/слов. Playwright не является
  direct installed dependency (`npm ls @playwright/test --depth=0` пуст); skips frontend нет.
- **Impact:** 182/182 создают завышенный сигнал: сломанные event flows, render/hydration,
  keyboard/focus, computed contrast, auth redirects и фактическая утечка payload могут пройти.
- **Remediation/tests:** добавить component/browser tests с реальным render, axe и keyboard;
  E2E login/refresh/RBAC, form errors/double-submit, registry pagination/races, offline replay и
  frontend↔API contract. Оставить source checks только для узких конфигурационных инвариантов.

## Покрытие и пропуски

- Backend collection: 520 unit/integration/API/security/file/AI/concurrency/migration/infra
  tests; выполнены лишь 30 isolated alerter unit tests. Две явные skip-ветки скрывают disposable
  PostgreSQL Docker contract при unavailable daemon/image (`test_infra_contracts.py:1048-1060`).
- Frontend: 182 node tests, 0 skips; есть несколько настоящих module/fetch-mock unit tests, но
  нет browser E2E/component render. Критически отсутствуют реальные browser auth/session/RBAC,
  accessibility/keyboard, hydration/mobile и end-to-end frontend/backend failure scenarios.
- Миграции: обнаружен executable downgrade/data test только для `0031→0030→head`; безопасный
  clean-DB `base→head`, полный `head→base→head`, concurrent startup и data-safety всех ревизий
  в этом run не подтверждены. Coverage-процент не заявляется: coverage tool/gate отсутствует.
