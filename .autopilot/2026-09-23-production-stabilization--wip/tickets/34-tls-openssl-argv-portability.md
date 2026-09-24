# 34 — D11: переносимый OpenSSL SAN-check в TLS deploy gate

**Требование:** D11, C4 baseline. **После:** T33. **Зона:** `technozrelost-backend/infra/tls_deploy_gate.py` и узкие TLS-тесты при необходимости.

RED: CI Linux positive-case тесты получают `SAN сертификата не содержит PUBLIC_HOST`; `openssl_text` передаёт строку `"-ext subjectAltName"` одним argv. В синтетическом Linux OpenSSL 3.0.20 эта форма возвращает пустой stdout с exit 0, раздельные argv показывают SAN. Начать с точного воспроизведения и test, затем минимально передавать `-ext`/`subjectAltName` раздельными argv. Не ослаблять fail-closed: отсутствие сертификата, чужой SAN, self-signed и недостаточная годность должны продолжать отвергаться. Не читать production cert/key и не запускать deploy.

Приёмка: шесть positive-case TLS тестов GREEN на Linux и локально; все negative TLS tests GREEN; Ruff/mypy/full CI после T32–T34. Исполнитель не меняет `.autopilot/**`, не коммитит/push'ит и не трогает production.
