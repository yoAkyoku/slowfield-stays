import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode } from "./readCode";

/**
 * 已刪除 is one of the status filter's options, not a link beside it.
 *
 * As a separate <a> it wrapped onto its own row under the filter bar and read
 * as a stray button (客戶: 已刪除按鈕移到狀態的選單中).
 *
 * The trap in moving it: "deleted" names a VIEW, not a row status. Feed it to
 * the same `status === row.status` narrowing as the real statuses and the bin
 * always renders empty, because no row carries status "deleted".
 */

const SRC = readCode("app/admin/(dashboard)/inquiries/page.tsx");
const bare = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("the status select offers the bin", () => {
  assert.match(bare, /<option value="deleted">/, "已刪除 is not an option on the status select");
});

test("the standalone deleted link is gone", () => {
  assert.doesNotMatch(
    bare,
    /visibility=deleted"\s*\n?\s*>/,
    "the separate 已刪除 link is still rendered beside the filters",
  );
});

test("selecting the bin switches the view", () => {
  /* Anchored on the showDeleted line specifically. Matching the bare string
     `searchParams.status === "deleted"` anywhere passes on the statusFilter
     line below, so dropping it from HERE — which is what actually stops the
     dropdown working — went undetected. */
  assert.match(
    bare,
    /const showDeleted =[^;]*searchParams\.status === "deleted"/,
    "the select's value never reaches the visibility decision",
  );
  assert.match(bare, /const visibility = showDeleted \? "deleted" : "active"/);
});

test("the bin is not also used to narrow by row status", () => {
  // The whole failure mode: every row in the bin fails `status === "deleted"`.
  assert.match(
    bare,
    /statusFilter = searchParams\.status === "deleted" \? "" :/,
    "\"deleted\" is passed through as a row-status filter and would empty the bin",
  );
  assert.match(bare, /!statusFilter \|\| inquiry\.status === statusFilter/);
  assert.doesNotMatch(bare, /inquiry\.status === searchParams\.status/, "the list still narrows on the raw param");
});

test("existing ?visibility=deleted links keep working", () => {
  assert.match(bare, /searchParams\.visibility === "deleted"/, "old links and bookmarks would break");
});
