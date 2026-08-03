# Задача: аудит фронтенда на соответствие бэкенду, зависимости и адаптацию к тёмной теме

**Ветка:** `codex/recovery-frontend` → коммит + push в `origin`.
**Запрещено:** менять контракты API бэкенда, трогать `src/app/api/auth/**`, `src/auth.config.ts` (кроме .env).

---

## Контекст

Фронтенд (Next.js 16 + React 19 + Tailwind v4) после дизайн-системы 3.0 (коммит `11a7a1c`) получил двойную тему (светлая/тёмная по переключателю). Бэкенд на `codex/recovery-backend` @ `8e13f84` (80/80 тестов, миграция `0010` переименовала роль `ugt_expert` → `regulating_organization`). Текущая ветка фронта: `codex/recovery-frontend` @ `11a7a1c`.

Аудит выявил **6 дефектов совместимости и 3 проблемы зависимостей**. Ниже — каждый с точным файлом, строкой и ожидаемым результатом.

---

## ДЕФЕКТ 1 (КРИТИЧНЫЙ): slate-токены не адаптируются к тёмной теме

**Симптом:** 236 классов `text-slate-*` / `bg-slate-*` / `border-slate-*` в `src/app/dashboard/**` и `src/components/**` в тёмной теме остаются тёмно-серыми (`#475569` для `slate-600`) на тёмном фоне — **текст нечитаем**.

**Причина:** в `src/app/globals.css` токены `--tz-p-slate-50` … `--tz-p-slate-900` определены в `:root` (светлая тема) и смаплены на Tailwind `--color-slate-*` в `@theme inline`. Но в блоке `[data-theme="dark"]` **нет переопределения** `--tz-p-slate-*` под тёмный фон — значения наследуются из светлой темы.

**Файлы:**
- `src/app/globals.css` — строки ~83–92 (определение `--tz-p-slate-*` в `:root`) и ~242–246 (маппинг на `--color-slate-*`)
- Блок `[data-theme="dark"]` — нужно добавить инверсию: `--tz-p-slate-50: #0f172a; --tz-p-slate-100: #1e293b; --tz-p-slate-200: #334155; --tz-p-slate-300: #475569; --tz-p-slate-400: #64748b; --tz-p-slate-500: #94a3b8; --tz-p-slate-600: #cbd5e1; --tz-p-slate-700: #e2e8f0; --tz-p-slate-800: #f1f5f9; --tz-p-slate-900: #f8fafc;`

**Критерий приёмки:** в тёмной теме `text-slate-600` рендерится светлым (`#cbd5e1`), а не тёмным (`#475569`). Проверить во всех 9 ЛК.

---

## ДЕФЕКТ 2 (ВЫСОКИЙ): investor и serial_manufacturer дёргают устаревший `/technologies`

**Симптом:** страницы ЛК инвестора и серийного производителя вызывают `GET /api/v1/technologies`, который отдаёт модель `Technology` (старая отдельная таблица) вместо реестра проектов с УГТ 7+.

**Реальное состояние бэкенда:** `GET /api/v1/technologies` существует (`technologies.py:13`) и отдаёт `TechnologyOut` из таблицы `technologies`. Но по решению интервью №14 «реестр технологий = тот же реестр проектов с фильтром УГТ 7+». Страница `/dashboard/technologies` уже переведена на `GET /api/v1/projects/registry` (коммит `9586d79`), а investor и serial_manufacturer — **нет**.

**Файлы:**
- `src/app/dashboard/investor/page.tsx:68` — `fetch('/api/v1/technologies')` → заменить на `fetch('/api/v1/projects/registry?ugt_min=7')`
- `src/app/dashboard/serial_manufacturer/page.tsx:65` — `fetch('/api/v1/technologies?${params}')` → заменить на `fetch('/api/v1/projects/registry?ugt_min=7&${params}')`
- Привести схемы ответа к `RegistryProjectOut` (поля: `id`, `name`, `organization`, `current_level`, `category`, `status`, `budget`, `created_at`), а не `TechnologyOut`.

**Критерий приёмки:** investor и serial_manufacturer показывают реальные опубликованные проекты УГТ 7+ из `projects/registry`, а не пустую/старую таблицу `technologies`.

---

## ДЕФЕКТ 3 (СРЕДНИЙ): маршрут роли «Регулирующая организация» ведёт в папку `ugt_expert`

**Симптом:** роль переименована (`regulating_organization`), но `ROLE_DASHBOARD` и `ROUTE_ALLOWED_ROLES` в `roles.ts` ссылаются на `/dashboard/ugt_expert` — папка не переименована, slug маршрута не соответствует роли.

**Файлы:**
- `src/lib/roles.ts:21` — `regulating_organization: "/dashboard/ugt_expert"` → переименовать маршрут в `/dashboard/regulating_organization`
- `src/lib/roles.ts:57` — `"/dashboard/ugt_expert": ["regulating_organization"]` → обновить ключ
- `src/app/dashboard/ugt_expert/` → переименовать папку в `src/app/dashboard/regulating_organization/`
- `src/app/dashboard/layout.tsx` — проверить навигацию ЛК (если ссылается на `ugt_expert`)
- `src/lib/roles.ts:29` (`ROUTE_ALLOWED_ROLES`) — обновить все упоминания `ugt_expert`

**Критерий приёмки:** регулирующая организация после входа попадает на `/dashboard/regulating_organization`, маршрут работает, в URL нет `ugt_expert`.

---

## ДЕФЕКТ 4 (НИЗКИЙ): `api-client.ts` — мёртвый код и неиспользуемая зависимость

**Симптом:** `src/lib/api-client.ts` экспортирует `getProjects()` и `ApiError`, но **ни одна страница их не использует** — все делают `fetch` напрямую с дублированием `API_URL`, `Authorization` и обработки ошибок. Это 15+ файлов с копипастой.

**Файл:** `src/lib/api-client.ts` (весь файл — 50 строк)

**Решение (на усмотрение):** либо (a) удалить `api-client.ts` как мёртвый код, либо (b) рефакторить — вынести в него все `fetch`-вызовы с единой обработкой `ApiError` и `Authorization`. Для MVP достаточно (a); (b) — если есть время.

**Критерий приёмки:** нет мёртвого кода; либо `api-client.ts` используется везде, либо удалён.

---

## ДЕФЕКТ 5 (НИЗКИЙ): `.env.local` — плейсхолдер NEXTAUTH_SECRET

**Симптом:** `NEXTAUTH_SECRET=change_me_super_secret_32_chars_min_for_hs256_signing` — это плейсхолдер из README, **небезопасен** для любого окружения кроме локальной разработки.

**Файл:** `.env.local`

**Решение:** для локальной разработки — сгенерировать реальный секрет (`openssl rand -base64 32`) и вписать. Для прода — через переменные окружения сервера (не коммитить). `.env.local` в `.gitignore`? Проверить.

**Критерий приёмки:** `NEXTAUTH_SECRET` — реальный 32+ char random, не плейсхолдер.

---

## ДЕФЕКТ 6 (НИЗКИЙ): несогласованные fallback для `API_URL`

**Симптом:** большинство файлов используют fallback `http://127.0.0.1:8000`, но `src/auth.config.ts:4` и `src/app/register/page.tsx:8` — `http://localhost:8000`. На локальной машине это одно и то же, но при деплое или в Docker может разойтись.

**Файлы:**
- `src/auth.config.ts:4` — `?? "http://localhost:8000"` → `?? "http://127.0.0.1:8000"`
- `src/app/register/page.tsx:8` — то же

**Критерий приёмки:** все 17 файлов используют один fallback `http://127.0.0.1:8000`.

---

## ПРОВЕРКА ЗАВИСИМОСТЕЙ

### Установленные версии (проверено, консистентны):
```
next: 16.2.10          (package.json: exact pin ✓)
react: 19.2.4          (package.json: exact pin ✓)
react-dom: 19.2.4      (package.json: exact pin ✓)
tailwindcss: 4.3.3     (^4 ✓)
next-auth: ^5.0.0-beta.32  (v5 beta ✓)
@auth/core: ^0.41.3    (✓)
framer-motion: ^12.42.2 (✓)
lucide-react: ^1.25.0  (✓)
recharts: ^3.10.0      (✓)
typescript: ^5         (5.9.3 installed ✓)
eslint: ^9             (9.39.5 installed ✓)
```

### `npm ls` — без ошибок (no missing/invalid/peer/unmet).

### Шрифты (next/font/google):
- `src/app/layout.tsx` — Manrope (`--font-inter`, sans+display) + JetBrains Mono (`--font-jetbrains_mono`)
- **Внимание:** CSS-переменная называется `--font-inter`, но шрифт — Manrope. Это работает (переменная — просто идентификатор), но может запутать. Переименовать в `--font-sans` / `--font-mono` — опционально.

### `AUTH_TRUST_HOST=true` — присутствует в `.env.local` ✓ (без него NextAuth v5 в edge падает с `UntrustedHost`).

---

## Полный список проверок (выполнить после фиксов)

```bash
# 1. Зависимости
npm install              # убедиться, что lock-файл консистентен
npm ls                   # 0 errors

# 2. Линт и типы
npm run lint             # 0 errors
npx tsc --noEmit         # 0 errors

# 3. Production build
#    ВАЖНО: сначала остановить dev-сервер (npm run build при живом dev ломает NextAuth!)
rm -rf .next
npm run build            # 23+ маршрута, 0 ошибок

# 4. Dev-сервер + ручная проверка
npm run dev
# - Открыть / в светлой и тёмной теме — текст читаемый в обеих
# - Зайти в каждый из 9 ЛК в тёмной теме — text-slate-* читаемый
# - ЛК инвестора — показывает проекты УГТ 7+ из registry
# - ЛК регулирующей организации — маршрут /dashboard/regulating_organization
```

---

## Критерии приёмки (итог)

1. **Тёмная тема читаема во всех 9 ЛК** — `text-slate-*` инвертируется (Дефект 1).
2. **Investor и serial_manufacturer** показывают реальные проекты УГТ 7+ из `/projects/registry` (Дефект 2).
3. **Маршрут регулирующей организации** — `/dashboard/regulating_organization`, без `ugt_expert` в URL (Дефект 3).
4. **Мёртвый код** `api-client.ts` удалён или используется (Дефект 4).
5. **`NEXTAUTH_SECRET`** — реальный, не плейсхолдер (Дефект 5).
6. **`API_URL` fallback** — единый `http://127.0.0.1:8000` во всех 17 файлах (Дефект 6).
7. `npm install` + `npm ls` — 0 ошибок зависимостей.
8. `lint` + `tsc` + `build` — зелёные.
9. Коммиты в `codex/recovery-frontend`, push в `origin`.

---

## Открытые вопросы (не блокируют)

- **Публичный реестр на лендинге:** `GET /projects/registry` без авторизации отдаёт 401. Нужен ли публичный read-only эндпоинт — задача на бэкенд (отдельной формулировкой), не молчать.
- **Модель `Technology`:** бэкенд отдаёт `TechnologyOut` из отдельной таблицы `technologies`, но по решению №14 «технология = проект УГТ 7+». Уточнить у бэкенд-разработчика, должна ли таблица `technologies` быть удалена или используется где-то ещё.
