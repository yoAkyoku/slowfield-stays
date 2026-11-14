import assert from "node:assert/strict";
import test from "node:test";
import { evaluateExpression, jsxTags } from "./sourceEval";
import { readCode } from "./readCode";

/**
 * No two rows of 表單聯絡 are handed React the same key.
 *
 * The list is one desk over two tables — `inquiries` and `booking_requests` —
 * and each numbers itself, both from 1. AdminTable keyed a row by `row.id`, so
 * enquiry 3 and booking 3 arrived as the same child, twice. React's documented
 * answer to that is that children "may be duplicated and/or omitted", and
 * measured in a production build it was both: soft-deleting the top row left a
 * table of eight rows where the data had five — a ghost of the row just
 * deleted, still showing 新建 and still offering 已聯繫, plus two other rows drawn
 * twice. Pressing 已聯繫 on the ghost filed a record that had already left the
 * list and changed nothing on screen, which is what a control that does nothing
 * looks like from the desk. 刪除 and 永久刪除 kept working throughout — their
 * action is a ConfirmSubmitButton prop React refreshes on every render, not
 * markup left over from an earlier one — so the page read as selectively
 * broken, with the two `<form action={…}>` controls the ones that showed it.
 *
 * Asserted by running the real expressions — the one AdminTable hands React and
 * the one the page passes down — over the row set the page really builds. A
 * substring check would pass on a `rowKey` that returns a constant.
 */

const TABLE = "app/admin/modules/AdminTable.tsx";
const INBOX = "app/admin/(dashboard)/inquiries/page.tsx";

type Row = { id: number; kind: string };

/** The expression AdminTable gives its body `<tr>` as a key. */
function tableKeyExpression(): string {
  const row = jsxTags(TABLE).find((tag) => tag.tag === "tr" && tag.attrs.has("key"));
  assert.ok(row, "AdminTable's body row has no key — React would key it by position");
  return row!.attrs.get("key")!;
}

/** The `rowKey` the merged inbox passes down, as source. */
function inboxRowKeyExpression(): string {
  const table = jsxTags(INBOX).find((tag) => tag.tag === "AdminTable");
  assert.ok(table, "表單聯絡 no longer renders AdminTable — re-anchor this test");
  const rowKey = table!.attrs.get("rowKey");
  assert.ok(
    rowKey,
    "表單聯絡 lets AdminTable key its rows by id again, and the two tables both number from 1",
  );
  return rowKey!;
}

/** The keys React would receive for `rows`, through both expressions. */
function keysFor(rows: Row[]): string[] {
  const rowKey = evaluateExpression(inboxRowKeyExpression())({}) as (row: Row, index: number) => string;
  const keyOf = evaluateExpression(tableKeyExpression(), ["rowKey", "row", "index"]);
  return rows.map((row, index) => String(keyOf({ rowKey, row, index })));
}

/** What the page builds: both tables' newest first, ids from 1 in each. */
const MERGED: Row[] = [
  { kind: "inquiry", id: 3 },
  { kind: "inquiry", id: 2 },
  { kind: "inquiry", id: 1 },
  { kind: "booking", id: 3 },
  { kind: "booking", id: 2 },
  { kind: "booking", id: 1 },
];

test("the inbox really is two tables in one list", () => {
  /* The premise of everything below. If the merge goes away the collision goes
     with it, and this test should be reconsidered rather than left passing over
     a list that no longer has two id spaces in it. */
  const source = readCode(INBOX);
  for (const kind of ["inquiry", "booking"]) {
    assert.ok(
      source.includes(`kind: "${kind}" as const`),
      `表單聯絡 no longer merges the ${kind} table into the list`,
    );
  }
});

test("an enquiry and a booking with the same id are two different rows", () => {
  const keys = keysFor(MERGED);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  assert.deepEqual(
    duplicates,
    [],
    `React is handed ${duplicates.join(", ")} twice, so it may duplicate or omit these rows`,
  );
});

test("the key still tells two rows of the same table apart", () => {
  // The other direction. Separating the two tables is not enough on its own —
  // a rowKey of `row.kind` would do that and then hand all three enquiries the
  // same key, which is the same defect one table further in.
  const inquiries = MERGED.filter((row) => row.kind === "inquiry");
  assert.equal(new Set(keysFor(inquiries)).size, inquiries.length, "one table's rows collapsed into one key");
});

test("AdminTable uses the key it is given, and keys by id when it is not", () => {
  const keyOf = evaluateExpression(tableKeyExpression(), ["rowKey", "row", "index"]);
  const row = { id: 3, kind: "booking" };
  assert.equal(
    keyOf({ rowKey: (r: Row, i: number) => `k${r.kind}${r.id}${i}`, row, index: 5 }),
    "kbooking35",
    "AdminTable ignores rowKey, so a merged list cannot fix its own keys",
  );
  assert.equal(
    String(keyOf({ rowKey: undefined, row, index: 5 })),
    "3",
    "the single-table lists lost their id-based key",
  );
});
