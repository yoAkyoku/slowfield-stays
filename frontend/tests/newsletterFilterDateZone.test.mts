import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { siteDateKey } from "../app/modules/datetime.ts";

test("campaign date filters use the date shown in Taiwan", () => {
  const source = readFileSync(new URL("../app/admin/(dashboard)/newsletter/panels/CampaignsPanel.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("const d = siteDateKey(raw)"));
  assert.equal(siteDateKey("2026-10-13T16:01:00Z"), "2026-10-14");
  assert.equal(siteDateKey("2026-10-13T15:59:00Z"), "2026-10-13");
});
