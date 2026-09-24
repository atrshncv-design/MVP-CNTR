import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("root layout self-hosts the licensed variable font assets", async () => {
  const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /from "next\/font\/local"/);
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(layout, /--font-manrope/);
  assert.match(layout, /--font-jetbrains-mono/);
  assert.match(layout, /weight: "400 800"/);
  assert.match(layout, /weight: "400 700"/);

  for (const [font, sha256] of [
    ["Manrope[wght].ttf", "3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6"],
    ["JetBrainsMono[wght].ttf", "48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda"],
  ]) {
    const bytes = await readFile(new URL(`../src/app/fonts/${font}`, import.meta.url));
    assert.deepEqual(bytes.subarray(0, 4), Buffer.from([0, 1, 0, 0]));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256);
  }
  for (const license of ["Manrope-OFL.txt", "JetBrainsMono-OFL.txt"]) {
    const text = await readFile(new URL(`../src/app/fonts/${license}`, import.meta.url), "utf8");
    assert.match(text, /SIL OPEN FONT LICENSE Version 1\.1/);
  }
});
