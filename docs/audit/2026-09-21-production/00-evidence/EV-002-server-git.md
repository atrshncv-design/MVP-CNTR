# EV-002 — сервер: deployment checkout

- Дата: UTC 2026-09-21T13:27Z (время сервера, UTC)
- Target: `root@213.139.209.165`, SSH (уже настроенный; файлы доступов не читались)
- Команды (read-only): `cd ~/MVP-CNTR && git branch --show-current; git rev-parse HEAD;
  git status --short --branch | head -20; git log --oneline -5; git remote -v`
- Exit: 0

## Санитизированный вывод

- Фактический deployment path: `~/MVP-CNTR` (каталог `/opt/technozrelost`
  из spec на сервере отсутствует — см. расхождение ниже)
- Branch: `autopilot/m0-security-hardening`
- HEAD SHA: `f06b15cb76ef27d00f8e4f708f1b3b3690aad993`
- Status: `## autopilot/m0-security-hardening...remotes/origin/autopilot/m0-security-hardening`,
  без modified/untracked строк (чистое дерево на глубину проверки 20 строк)
- Последние коммиты: `f06b15c merge(ai): бюджет LLM 20s + glm`;
  `613fbbb fix(ai): бюджет LLM 20s + cap 800 + glm-5.3-flash`;
  `7404d6c status: UGT-6 timeout+recall fixed, deployed 283ea7e`
- Remote: `origin https://github.com/atrshncv-design/MVP-CNTR.git` (fetch/push)

## Расхождения (факты, не выводы)

1. Deployment path `~/MVP-CNTR` ≠ `/opt/technozrelost` из spec Решения 2.
   Ссылка для findings-реестра (ticket 07): `server-path-differs-from-spec`.
2. Server SHA `f06b15c` ≠ local SHA `f364388` (ожидаемо: разные ветки/задачи;
   продуктовый код между `3a4dfe3` и `f364388` не менялся — см. EV-001).
3. Server branch `autopilot/m0-security-hardening` — имя исторической ветки,
   не признак незавершённого hardening; оценка — в code/security-контурах.

## Связь со spec

- R01 (server SHA/dirty-state): закрыт этим файлом — static/deployed факт.
- Ссылки: `01-environments.md` (Сервер).
