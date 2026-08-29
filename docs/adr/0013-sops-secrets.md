# ADR 0013: SOPS+age для секретов — шифрованный secrets.enc.env вместо plaintext ENV (R25)

**Tier:** T2 — security / 152-ФЗ, reversal = утечка JWT/REPL_PASSWORD в git/argv
**Date:** 2026-08-28
**Status:** accepted

## Title
Шифрование секретов через SOPS+age (secrets.enc.env) с ключом в 1Password/pass

## Context
ENV `technozrelost-backend/.env` + `infra/.env.production` лежат plaintext 0600, попадают в бэкапы незашифрованными, `REPL_PASSWORD` рискует попасть в `ps aux` (Plan.md:128). Для B2G 152-ФЗ нужен шифрованный at-rest и отсутствие секретов в git.

## Decision
- Секреты хранятся только в `secrets.enc.env` (SOPS `age` шифрование, 1 файл, 1 ключ, без сервера Vault — рекомендация solo, 23-).
- Исходник `config/.sops.yaml` объявляет `creation_rules` для `secrets.enc.env` с age-получателем; ключ age хранится в `pass`/`1Password`, не в репозитории.
- Деплой: `sops exec-env secrets.enc.env 'deploy.sh'` или `sops --decrypt secrets.enc.env > .env.production` с правами 0600; `deploy.sh:63` генерирует `JWT_SECRET`/`GRAFANA_PASSWORD` через `openssl rand -hex 32`, не `change_me`; `REPL_PASSWORD` подаётся через `\getenv`/`passfile 0600`, не argv.
- Plain `.env*` в .gitignore, `secrets.enc.env` коммитится; CI проверяет, что plaintext секреты не в git (security_check.py).

## Consequences
**Положительные:** секреты шифрованы at-rest, не утекают в git/bekap/argv; 1 файл solo-удобен без Vault-сервера; совместимо с `Docker secrets /run/secrets`.

**Отрицательные:** зависимость от `sops`+`age` в toolchain (установка в deploy-образ); ключ age нужно бэкапить вне репо (1Password).

**Что отвергли:** чистый Vault/1Password Connect — отвергнуто (сервер, сложность для solo-CTO); plaintext ENV 0600 на прод — отвергнуто (не 152-ФЗ, бэкап незашифрован).

## References
- интервью 23-пароли-vault-vs-env, 29-рекомендация-доки-и-пароли, spec.md R25, тикет 06
- `secrets.enc.env`, `.sops.yaml`, `technozrelost-backend/.env.example`, `infra/.env.production.example`
- `infra/deploy.sh:63` JWT generation, `app/core/config.py` production guard, `docs/CLAUDE.md` secrets policy
