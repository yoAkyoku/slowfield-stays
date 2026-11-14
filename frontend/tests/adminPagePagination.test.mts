import assert from "node:assert/strict";
import test from "node:test";
import { collectAllPages } from "../app/admin/modules/adminPagePagination.ts";
import { readCode } from "./readCode.mts";

test("category and website-page totals read the complete article catalogue", () => {
  for (const file of ["app/admin/(dashboard)/cms/categories/page.tsx", "app/admin/(dashboard)/content-pages/page.tsx"]) {
    const source=readCode(file);
    assert.match(source, /getAdminPagesAll\(\)/);
    assert.doesNotMatch(source, /getAdminPages\(\)/);
  }
});

test("all article aggregate consumers traverse the complete catalogue", () => {
  for (const file of [
    "app/admin/(dashboard)/page.tsx",
    "app/admin/(dashboard)/publishing/page.tsx",
    "app/admin/(dashboard)/readiness/page.tsx",
    "app/admin/(dashboard)/cms/page.tsx",
    "app/admin/(dashboard)/cms/pages/new/page.tsx",
    "app/admin/(dashboard)/cms/pages/[id]/edit/page.tsx",
    "app/admin/(dashboard)/sites/[id]/page.tsx",
  ]) {
    const source = readCode(file);
    assert.match(source, /getAdminPagesAll\(/, file);
    assert.doesNotMatch(source, /\bgetAdminPages\(/, file);
  }
});

test("collectAllPages traverses every batch and preserves records in service order", async () => {
  const source = Array.from({ length: 1_001 }, (_, index) => ({ id: index + 1 }));
  const offsets: number[] = [];

  const records = await collectAllPages(async (skip, limit) => {
    offsets.push(skip);
    return source.slice(skip, skip + limit);
  }, 500);

  assert.deepEqual(offsets, [0, 500, 1_000]);
  assert.equal(records.length, 1_001);
  assert.equal(records[0].id, 1);
  assert.equal(records.at(-1)?.id, 1_001);
});

test("collectAllPages deduplicates overlap and stops if an endpoint ignores offsets", async () => {
  const repeated = Array.from({ length: 2 }, (_, index) => ({ id: index + 1 }));
  let calls = 0;

  const records = await collectAllPages(async () => {
    calls += 1;
    return repeated;
  }, 2);

  assert.equal(calls, 2);
  assert.deepEqual(records, repeated);
});
