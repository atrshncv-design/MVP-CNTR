# Security, инфраструктура и эксплуатация

**Status:** ready-for-agent

## Problem Statement

Платформа будет обрабатывать персональные и коммерчески чувствительные данные, но пока не имеет доказанной модели угроз, полного security pipeline, согласованного сервера и проверенного восстановления.

## Solution

Ввести defence-in-depth: `THREAT_MODEL.md`, единые security-инварианты, безопасные файлы/секреты, audit, автоматические release gates, Docker Compose deployment, backup/restore, observability, capacity report и внешний Kali-пентест staging.

## User Stories

1. Как пользователь, я хочу, чтобы чужой ID никогда не давал доступ к моему объекту или файлу.
2. Как владелец, я хочу обнаруживать секреты и уязвимые/выдуманные зависимости до merge.
3. Как владелец, я хочу безопасно загружать документы через карантин и антивирус.
4. Как расследующий, я хочу append-only audit без секретов и содержимого документов.
5. Как оператор, я хочу развернуть и откатить release по инструкции.
6. Как оператор, я хочу восстановить БД и файлы из отдельной зашифрованной копии.
7. Как оператор, я хочу получить alert и отдельно выключить AI, регистрацию, upload или внешний доступ.
8. Как руководитель, я хочу сравнить три измеренных профиля серверной мощности.

## Implementation Decisions

- `THREAT_MODEL.md` обновляется каждым security-sensitive ticket; `SECURITY.md` определяет policy.
- Данные пилота: без гостайны/ВПК, секретов, избыточных ПДн; закрытые коммерческие данные не передаются AI.
- Upload: PDF/DOCX/XLSX/PNG/JPEG, 25 MB, signature/MIME validation, quarantine, antivirus, private storage, signed short-lived access, versions.
- Audit хранится 12 месяцев, append-only для приложения; полный просмотр — отдельное служебное permission.
- CI: secret history/patch scan, SAST, SCA, package/version verification, image scan, SBOM, RBAC/IDOR, migration test, DAST, headers/cookies/CORS/rate limits. Critical/high блокируют release.
- Docker Compose: Nginx, frontend, backend, Primary/Replica, internal network, TLS, firewall, volumes, health/readiness и rollback.
- Backup: daily 30d, weekly 3m, separate encrypted storage, monthly restore test, RPO 24h, RTO 4h.
- Kali: только staging, synthetic data, written scope/window, rate limits, no destructive DoS, logs, stop switch and retest.
- Три capacity profiles подтверждаются load test; ориентиры — 4vCPU/8GB, 8vCPU/16GB и split scalable contour.
- AI-разработчик не имеет GitHub credentials; оркестратор публикует только после review.

## Testing Decisions

- Security tools не заменяются AI review; Codex Security — дополнительный независимый слой.
- Restore выполняется на чистом окружении; DAST и Kali — только после staging.
- Проверяются malicious uploads, signed URL expiry, log redaction, backup integrity, rollback и kill switches.

## Out of Scope

- Сам фактический production deploy без сервера и ручного разрешения.
- Kubernetes.
- Destructive load/DoS tests.
- Обработка гостайны и данных ВПК.

## Further Notes

Организационные блокеры: сервер/доступы, SMTP, юридические тексты, второй ответственный эксплуатации. До их закрытия возможен release candidate, но не внешний запуск.
