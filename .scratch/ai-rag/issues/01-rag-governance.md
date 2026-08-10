# 01 — Редакционный workflow базы знаний

**What to build:** Управляемую curated RAG-базу со статусами draft/published/retired, источником, версией, проверкой и ответственным.

**Blocked by:** release-audit/04 — Зелёная baseline release candidate.

**Status:** ready-for-agent

- [ ] Только служебная permission публикует или отзывает материал.
- [ ] Пользовательские проекты, файлы и чаты не индексируются автоматически.
- [ ] Retired материал исчезает из retrieval без потери audit history.
- [ ] Prompt-injection review является обязательной частью публикации.
