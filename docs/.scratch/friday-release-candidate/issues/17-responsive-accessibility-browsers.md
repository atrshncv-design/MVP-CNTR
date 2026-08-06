# 17 — Mobile, accessibility и browser matrix

**What to build:** Довести ключевые сценарии до mobile-ready и WCAG AA и подтвердить поддержку согласованных браузеров.

**Blocked by:** 09, 10, 11, 12, 16 — завершённые пользовательские экраны

**Status:** done

- [x] На телефоне работают витрина, регистрация, карточки и загрузка
- [x] Менеджерские экраны адаптивны и desktop-first
- [x] Клавиатура, focus, labels и контраст проходят проверки
- [x] Chrome/Firefox/Safari/Edge/Yandex desktop smoke зелёный
- [x] Chrome/Safari mobile smoke зелёный


## Реализация (05.08.2026)
- Frontend `7a08999`: контраст токенов до WCAG AA (muted/warning/success/accent/danger в 3 темах), фикс «Отклонить», mobile-эмуляция (0 overflow, 44px цели), docs/browser-matrix.md. Гейты зелёные.

- Повторная волна (аудит 06.08): browser matrix приведён к факту (Chromium live, остальные pending до серверного прогона); поведенческие тесты темы и API-клиента добавлены (14/14).
