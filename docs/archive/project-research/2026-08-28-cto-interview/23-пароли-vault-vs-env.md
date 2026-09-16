# 23 — Пароли: ENV vs Vault

Источник Q24

**ENV** `technozrelost-backend/.env` + `infra/.env.production` — просто, но в git нельзя, бэкап незашифрован, `REPL_PASSWORD` в argv риск `Plan.md:128`.

**Лучше для B2G (152-ФЗ):** `Vault` (HashiCorp Vault / 1Password Connect / SOPS+age): секреты шифрованы `sops --age` в `secrets.enc.env`, ключ в `pass`, деплой `sops exec-env`. Или `Docker secrets` `/run/secrets`.

**Рекомендация solo:** ENV с `0600` + `SOPS` (1 файл, 1 ключ, без сервера Vault). `JWT_SECRET` `deploy.sh:63` `openssl rand -hex 32` + `GRAFANA_PASSWORD` `deploy.sh:86` генерировать, не `change_me`. Хранить в `1Password` + `SOPS`, не в голове.
