/**
 * P3: публичные реестры открыты (таск 09, G04/G06/G49/G59).
 * Шов release-p3: анонимное чтение проверенных данных (без Authorization,
 * limit + keyset after_id), витрина на живых данных с честным пустым
 * состоянием, приватные поля недоступны. Gated-заглушка getPublicRegistry
 * таска 02 намеренно НЕ тронута — её держит tests/p2-gating.test.mjs
 * (заглушка matchOrganizations открыта таском 04 — реальный POST /match).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// G04/G49: первая страница реестра читается анонимно с лимитом и курсором.
test("release-p3: SSR-читалка реестра поддерживает limit + after_id без токена", () => {
  const src = read("src/app/(landing)/public-registry.ts");
  assert.match(src, /fetchPublicRegistryPage\(\s*\w/);
  assert.match(src, /after_id/);
  assert.match(src, /buildPublicRegistryQuery/);
  assert.match(src, /\/api\/v1\/projects\/registry/);
});

// G04: чтение реестра анонимно — ни одного Authorization в P3-пути чтения.
test("release-p3: публичный реестр читается без Authorization", () => {
  for (const p of [
    "src/app/(landing)/public-registry.ts",
    "src/app/(landing)/projects/page.tsx",
    "src/app/(landing)/page.tsx",
    "src/components/landing/projects-showcase.tsx",
  ]) {
    const src = read(p);
    assert.doesNotMatch(src, /Bearer/);
    assert.doesNotMatch(src, /Authorization['"]?\s*:/);
    assert.doesNotMatch(src, /accessToken|access_token/);
  }
  const server = read("src/app/(landing)/public-registry.ts");
  assert.match(server, /serverApiBase/);
  assert.match(server, /cache: "no-store"/);
  const client = read("src/components/landing/projects-showcase.tsx");
  assert.match(client, /CLIENT_API_BASE as API_URL/);
  assert.match(client, /fetch\(`\$\{API_URL\}\/api\/v1\/projects\/registry/);
});

// G06/G49: витрина на живых данных + честное пустое состояние (без демо-выдумки).
test("release-p3: витрина показывает живые данные и честное пустое", () => {
  const projects = read("src/app/(landing)/projects/page.tsx");
  assert.match(projects, /fetchPublicRegistryPage/);
  assert.match(projects, /ProjectsShowcase/);
  assert.doesNotMatch(projects, /p2GatedMessage|P2_GATED/);
  const home = read("src/app/(landing)/page.tsx");
  assert.match(home, /fetchPublicRegistryPage/);
  assert.match(home, /href="\/projects"/);
  assert.match(home, /showcaseEmptyTitle/);
  assert.match(home, /showcaseEmptyHint/);
  const showcase = read("src/components/landing/projects-showcase.tsx");
  assert.match(showcase, /emptyRegistryTitle/);
  assert.match(showcase, /emptyRegistryHint/);
  assert.match(showcase, /loadError/);
  assert.match(showcase, /mergeRegistryPage/);
  assert.match(showcase, /toShowcaseCard/);
  assert.doesNotMatch(showcase, /getShowcaseProjects/);
});

// G04: приватные поля и действия недоступны анонимно (только поля реестра).
test("release-p3: публичная витрина не отдаёт приватные поля", async () => {
  for (const p of [
    "src/app/(landing)/public-registry.ts",
    "src/app/(landing)/page.tsx",
    "src/app/(landing)/projects/page.tsx",
    "src/components/landing/projects-showcase.tsx",
    "src/lib/landing-registry.ts",
  ]) {
    const src = read(p);
    assert.doesNotMatch(src, /passport|inn\b|snils/i);
    assert.doesNotMatch(src, /join_token/);
    assert.doesNotMatch(src, /created_by/);
  }
  // Карточка строится только из полей реестра — значение взято из спеки
  // формы бэкенда, а не посчитано кодом под тестом.
  const { toShowcaseCard } = await import("../src/lib/landing-registry.ts");
  assert.deepEqual(
    toShowcaseCard({
      id: 7,
      name: "Стенд",
      category: null,
      tags: ["Медицина"],
      current_level: 5,
      preliminary_level: null,
      target_level: 7,
      budget: null,
      organization: "Завод",
      is_public: true,
      show_preliminary: false,
      published_at: "2026-09-01T00:00:00",
      created_at: "2026-08-01T00:00:00",
    }),
    {
      id: 7,
      name: "Стенд",
      category: "Медицина",
      description: null,
      current_level: 5,
      status: null,
      budget: null,
      org: "Завод",
    },
  );
});

// G06/G49: discoverability — посетитель без прямого URL попадает в реестры:
// постоянный пункт навигации в /projects и ссылка в пустое состояние витрины
// главной (при любом состоянии реестра: данные / ошибка / пусто).
test("release-p3: навигация ведёт в /projects при любом состоянии реестра", () => {
  const nav = read("src/components/landing/landing-nav.tsx");
  assert.match(nav, /href: "\/projects"/);
  const home = read("src/app/(landing)/page.tsx");
  const emptyAt = home.indexOf("showcaseEmptyTitle");
  assert.notEqual(emptyAt, -1, "пустое состояние витрины обязано существовать");
  assert.match(
    home.slice(emptyAt, emptyAt + 800),
    /href="\/projects"/,
    "пустое состояние витрины ведёт в /projects, а не только в регистрацию",
  );
});
