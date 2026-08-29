# SOPS+age — управление секретами (22-,23-)

> **Правило:** plaintext секреты никогда не коммитятся. В репозитории только `secrets.enc.env` (SOPS+age), ключ в 1Password/pass.

## Что шифруется
- `JWT_SECRET` (≥32 символов, `openssl rand -hex 32`, deploy.sh:63)
- `REPL_PASSWORD` / `POSTGRES_PASSWORD`
- `MINIO_SECRET_KEY`, `GRAFANA_ADMIN_PASSWORD`
- `LLM_API_KEY` (если включён gateway)

## Файлы
- `technozrelost-backend/.sops.yaml` — правила creation_rules (path_regex + age recipient)
- `technozrelost-backend/secrets.enc.env` — шифрованный env (коммитится), суффикс `_enc`
- `.env` / `.env.production` — расшифрованные, `0600`, в `.gitignore`

## Команды
```bash
# Генерация ключа (один раз, solo-CTO)
age-keygen -o age.key
# Публичный получатель: age1...
pass insert sops/age-key < age.key   # или 1Password

# Шифрование (после заполнения plaintext .env)
sops --encrypt --age age1... --in-place secrets.enc.env

# Деплой (расшифровка в окружение, без записи plaintext)
sops exec-env secrets.enc.env './infra/deploy.sh'
# или
sops --decrypt secrets.enc.env > infra/.env.production && chmod 0600 infra/.env.production

# Проверка (30-интервью: пароли не в argv/ps)
# REPL_PASSWORD подаётся через \getenv/passfile, не --password "value"
```

## Процесс (мгновенные доки, 22-)
Feature → spec → tickets → code → сразу `docs/adr` + `git commit` (DoD). Секреты — только SOPS, CI проверяет `security_check.py` (секреты не в git, debt).

## Почему SOPS, а не Vault
Solo-CTO, 1 файл, 1 ключ, без сервера HashiCorp Vault (см. ADR 0013). Для B2G 152-ФЗ — шифрование at-rest, бэкап незашифрован не допускается. ENV 0600 допустим в пилоте 16 ГБ, на прод 5К — только SOPS.

## Отложено до B2G (M4 TICKET-07 / SPEC-04 I-03) — placeholder ключ

> **Статус:** pilot (`16 ГБ, Docker Desktop`) — `0600 .env`/`0600 infra/.env.production` допустим (как сейчас, `security_check` PASS). B2G (`152-ФЗ, 4vCPU/12ГБ/500ГБ`) — `age1ql3z7…placeholder` в `technozrelost-backend/.sops.yaml:7` заменить реальным `age-keygen` recipient из 1Password, затем `sops --encrypt --age age1… --in-place secrets.enc.env` — без ротации placeholder в git. Перешифровка откладывается до выделения прод-хоста, чтобы не ломать `deploy.sh` `openssl rand -hex 32` fallback.

## Ссылки
- ADR 0013, интервью 23-пароли-vault-vs-env, 29-рекомендация-доки-и-пароли, spec.md R25
- `technozrelost-backend/app/core/config.py` production guard, `infra/deploy.sh:63` generation
- M4 TICKET-07 / SPEC-04 I-03: placeholder `age1ql3z7…` — доку, не code; `technozrelost-backend/.sops.yaml:7`
