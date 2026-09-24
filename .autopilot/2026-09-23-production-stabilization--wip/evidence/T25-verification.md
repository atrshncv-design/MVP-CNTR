# T25 — проверка автономной сборки шрифтов

Дата: 2026-09-24 (+04:00). Исполнитель Codex `gpt-6-luna`/high; продуктовых правок нет.

- RED повторён: `npm test` → 237 passed; `API_URL_INTERNAL=http://backend:8000 npm run build` → exit 1 на fetch Manrope и JetBrains Mono из Google Fonts.
- `src/app/layout.tsx` импортирует оба шрифта через `next/font/google`; `src/app/globals.css` использует их переменные для текста и mono. Локальных Manrope/JetBrains font assets в frontend или пользовательском font/cache не обнаружено; bundled Geist отличается визуально.
- Официальные источники font assets доступны юридически под OFL, но загрузка в этой среде упёрлась в DNS (`raw.githubusercontent.com` не разрешается). Без доступных файлов точный visual-preserving self-hosted fix не реализован.
- Диспозиция: **NEEDS_DECISION**. Владельцу отправлен выбор через всплывающее окно: сохранить текущие шрифты с файлами/доступом либо разрешить визуальную замену. До ответа T25 не DONE, CODE-06 не GREEN. Production и секреты не затрагивались.

## Продолжение по решению владельца

Владелец запретил менять шрифты и поручил искать способ их скачать. Оркестратор проверил официальные прямые URL Manrope и JetBrains Mono в `google/fonts` через разрешённый сетевой запрос: оба вернули HTTP 200, размеры 164700 и 187208 байт. Исполнитель повторно запущен для получения точных файлов и OFL, локального подключения и регрессии. Предыдущий NEEDS_DECISION остаётся историческим, итог ещё не объявлен.

## Итог реализации

- `src/app/layout.tsx` переключён с `next/font/google` на `next/font/local` для **тех же** семейств Manrope и JetBrains Mono, с сохранением CSS-переменных и прежних используемых весов. Добавлены оригинальные variable TTF и OFL 1.1 из официального `google/fonts`; замены на Geist/system нет.
- Независимый повтор загрузки официальных файлов во временный каталог и SHA-256 сверка с рабочим деревом: Manrope `3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6`, JetBrains Mono `48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda`. Тест закрепляет оба хэша.
- TDD: тест `local-fonts.test.mjs` был RED до перехода на локальные файлы, GREEN после. Независимый оркестраторский `npm test` → exit 0, 238 passed. `API_URL_INTERNAL=http://backend:8000 npm run build -- --webpack` → exit 0, TypeScript passed, 53 страницы сгенерированы. Независимый повтор штатного `npm run build` с тем же `API_URL_INTERNAL` → exit 1 на Turbopack `creating new process / binding to a port / Operation not permitted`; ошибки Google Fonts fetch больше нет. Это ограничение данной локальной среды, а не доказательство зелёного штатного build/CI.
- Независимое ревью после уточнения решения владельца: PASS, блокирующих замечаний нет. Production, ключи и package/lock не затронуты.

Диспозиция: D02/T25 исправлены и подтверждены локальным webpack production build; CODE-06 остаётся **условным** до штатного Turbopack build/CI в среде, где разрешён его worker process.

Код и тест T25 зафиксированы и отправлены в `origin/autopilot/production-stabilization`: `6799a9a`.
