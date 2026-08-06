/**
 * Поведенческие тесты темы (тикет 16/17): реальная логика из src/lib/theme.ts
 * с минимальным DOM-стабом — проверяют переключение, сохранение и классы,
 * а не наличие строк в исходниках.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  THEME_ORDER,
  applyTheme,
  cycleTheme,
  getStoredTheme,
} from "../src/lib/theme.ts";

/** Минимальный стаб document.documentElement. */
function makeDom() {
  const classes = new Set();
  const attrs = new Map();
  return {
    documentElement: {
      classList: {
        toggle: (name, force) => {
          if (force) classes.add(name);
          else classes.delete(name);
        },
        contains: (name) => classes.has(name),
      },
      setAttribute: (name, value) => attrs.set(name, value),
      removeAttribute: (name) => attrs.delete(name),
      getAttribute: (name) => attrs.get(name) ?? null,
    },
    classes,
    attrs,
  };
}

function makeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
    dump: () => Object.fromEntries(store),
  };
}

test("getStoredTheme: без сохранённого значения — светлая, системная тёмная учитывается", () => {
  assert.equal(getStoredTheme(null), "light");
  assert.equal(getStoredTheme(makeStorage(), true), "dark");
  assert.equal(getStoredTheme(makeStorage(), false), "light");
});

test("getStoredTheme: валидные сохранённые темы возвращаются, невалидные игнорируются", () => {
  assert.equal(getStoredTheme(makeStorage({ "tz-theme": "udmurt" })), "udmurt");
  assert.equal(getStoredTheme(makeStorage({ "tz-theme": "dark" })), "dark");
  assert.equal(getStoredTheme(makeStorage({ "tz-theme": "neon" })), "light");
});

test("applyTheme: udmurt ставит data-theme и не включает .dark", () => {
  const dom = makeDom();
  const storage = makeStorage();
  applyTheme("udmurt", { documentElement: dom.documentElement, storage });
  assert.equal(dom.attrs.get("data-theme"), "udmurt");
  assert.equal(dom.classes.has("dark"), false);
  assert.equal(storage.dump()["tz-theme"], "udmurt");
});

test("applyTheme: dark включает класс .dark и снимает data-theme", () => {
  const dom = makeDom();
  const storage = makeStorage();
  applyTheme("dark", { documentElement: dom.documentElement, storage });
  assert.equal(dom.classes.has("dark"), true);
  assert.equal(dom.attrs.has("data-theme"), false);
  assert.equal(storage.dump()["tz-theme"], "dark");
});

test("applyTheme: светлая снимает и класс, и data-theme", () => {
  const dom = makeDom();
  applyTheme("udmurt", { documentElement: dom.documentElement });
  applyTheme("light", { documentElement: dom.documentElement });
  assert.equal(dom.classes.has("dark"), false);
  assert.equal(dom.attrs.has("data-theme"), false);
});

test("cycleTheme: светлая → тёмная → удмуртская → светлая", () => {
  assert.equal(cycleTheme("light"), "dark");
  assert.equal(cycleTheme("dark"), "udmurt");
  assert.equal(cycleTheme("udmurt"), "light");
  assert.deepEqual(THEME_ORDER, ["light", "dark", "udmurt"]);
});
