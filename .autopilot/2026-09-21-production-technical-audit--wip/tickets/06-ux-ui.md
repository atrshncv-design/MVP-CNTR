# 06 — UX/UI production

**Требования:** R03, R16–R18, R25, R26, R30, R31
**Blocked by:** 02
**Зона:** `docs/audit/2026-09-21-production/06-ux/`
**Волна:** 6
**Status:** ready

## Что должно заработать

Браузерный проход public production на 1920/768/375 с screenshots и accessibility/interaction-проверками. Авторизованные screens без accounts помечаются `UNKNOWN`, а не подменяются static-выводом.

## Критерии приёмки

- [ ] Каждый доступный public route и key state пройден на трёх viewports.
- [ ] Каждый visual finding имеет screenshot, viewport, URL, role, steps, expected behavior.
- [ ] Keyboard/focus/labels/contrast/overflow/clipping/z-index/actions/language/feedback проверены.
- [ ] Screenshots не содержат секретов; случайные чувствительные кадры не сохраняются.
