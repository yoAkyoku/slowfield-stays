import assert from "node:assert/strict";
import test from "node:test";
import { articleNav } from "../app/modules/content/articleNav.ts";

/**
 * 上一篇 must be the card above in the index, 下一篇 the card below.
 *
 * articleNav used to re-sort its input by `published_at` descending before
 * picking neighbours, taking on faith that the index was newest-first. The API
 * sorts pages by `sort_order, id DESC` — the editor's manual ordering, which
 * knows nothing about dates. On 慢域選品, where the manual order ran opposite
 * to the publish dates, every article's arrows were swapped: standing on the
 * 2nd entry, 上一篇 went to the 3rd and 下一篇 to the 1st.
 *
 * The fixture below reproduces exactly that — list order ascending, dates
 * descending — so a re-sort by date fails it.
 */

const mk = (id: number, slug: string, published_at: string) =>
  ({
    id,
    slug,
    content_type: "curation",
    title: slug,
    published_at,
    translations: {},
    tags: [],
  }) as unknown as Parameters<typeof articleNav>[0][number];

// Index order (sort_order) top to bottom; published_at runs the other way.
const LIST = [
  mk(1, "bath-and-body", "2026-01-03T00:00:00Z"),
  mk(2, "scent-and-unwinding", "2026-01-02T00:00:00Z"),
  mk(3, "living-room-av", "2026-01-01T00:00:00Z"),
];
// Same list, dates now agreeing with the order — must give the same answer.
const REVERSED_DATES = [
  mk(1, "bath-and-body", "2026-01-01T00:00:00Z"),
  mk(2, "scent-and-unwinding", "2026-01-02T00:00:00Z"),
  mk(3, "living-room-av", "2026-01-03T00:00:00Z"),
];

for (const [name, list] of [["dates descending", LIST], ["dates ascending", REVERSED_DATES]] as const) {
  test(`middle entry points at its list neighbours (${name})`, () => {
    const { prev, next } = articleNav(list, list[1], "zh", undefined, "慢域選品");
    assert.ok(prev, "上一篇 missing");
    assert.ok(next, "下一篇 missing");
    assert.match(prev!.href, /bath-and-body/, `上一篇 should be the card above, got ${prev!.href}`);
    assert.match(next!.href, /living-room-av/, `下一篇 should be the card below, got ${next!.href}`);
  });
}

test("the first entry has no 上一篇 and the last no 下一篇", () => {
  const first = articleNav(LIST, LIST[0], "zh", undefined, "慢域選品");
  assert.equal(first.prev, null);
  assert.match(first.next!.href, /scent-and-unwinding/);

  const last = articleNav(LIST, LIST[2], "zh", undefined, "慢域選品");
  assert.equal(last.next, null);
  assert.match(last.prev!.href, /scent-and-unwinding/);
});

test("articleNav does not reorder its input", () => {
  const copy = [...LIST];
  articleNav(LIST, LIST[1], "zh", undefined, "慢域選品");
  assert.deepEqual(LIST.map((p) => p.id), copy.map((p) => p.id), "the caller's array was mutated");
});
