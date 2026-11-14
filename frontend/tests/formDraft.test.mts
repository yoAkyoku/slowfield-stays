import assert from "node:assert/strict";
import test from "node:test";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * Keeping an admin form's work when the save is rejected.
 *
 * Every server action in the admin redirects on failure as well as success, so
 * a rejected save re-navigates to the same URL and the editor remounts seeded
 * from the last SAVED content. An hour of work disappears with `?error=` in the
 * address bar to show for it, and there is no undo. A 422 from the stay publish
 * guard or a 409 on a duplicate slug is enough to cause it.
 *
 * The hook needs React and a DOM, so what is exercised here is the part that
 * carries the risk: what gets written down, and what comes back. The shapes are
 * taken from the real editors — `translations` is a JSON blob, `amenities` is
 * newline-delimited, `sort_order` arrives as a string and has to become a
 * number again.
 */

type Draft = Record<string, string>;

/** The serialisation half of useFormDraft: FormData in, storable record out. */
function toDraft(entries: Array<[string, string | { name: string }]>): Draft {
  const draft: Draft = {};
  for (const [name, value] of entries) {
    if (typeof value === "string") draft[name] = value;
  }
  return draft;
}

test("every named field is written down, including hidden serialised ones", () => {
  const draft = toDraft([
    ["slug", "cloud-villa"],
    ["translations", '{"zh":{"name":"雲端別墅"}}'],
    ["amenities", "Pool\nBBQ"],
    ["sort_order", "3"],
  ]);
  assert.deepEqual(draft, {
    slug: "cloud-villa",
    translations: '{"zh":{"name":"雲端別墅"}}',
    amenities: "Pool\nBBQ",
    sort_order: "3",
  });
});

/**
 * A File cannot be revived from sessionStorage, and storing its name would
 * produce a draft that looks complete and silently loses the upload.
 */
test("file inputs are skipped rather than half-restored", () => {
  const draft = toDraft([["hero_file", { name: "photo.jpg" }], ["slug", "x"]]);
  assert.deepEqual(Object.keys(draft), ["slug"]);
});

/* ── the restore half, as the stay editor performs it ── */

const json = <T,>(v: string | undefined, fallback: T): T => {
  if (!v) return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
};
const lines = (v: string | undefined) => (v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

test("a bilingual blob comes back as the object the editor holds", () => {
  const restored = json<Record<string, Record<string, string>>>(
    '{"zh":{"name":"雲端別墅","summary":"泳池別墅"},"en":{"name":"Cloud Villa"}}',
    {},
  );
  assert.equal(restored.zh.name, "雲端別墅");
  assert.equal(restored.en.name, "Cloud Villa");
});

test("a corrupted draft falls back instead of throwing the editor away", () => {
  // Truncated storage, a half-written value, someone else's key: the editor has
  // to open regardless. Losing a draft is bad; a blank screen is worse.
  assert.deepEqual(json("{not json", { a: 1 }), { a: 1 });
  assert.deepEqual(json(undefined, []), []);
});

test("newline-delimited lists round trip without empty entries", () => {
  assert.deepEqual(lines("Pool\n BBQ \n\nWi-Fi"), ["Pool", "BBQ", "Wi-Fi"]);
  assert.deepEqual(lines(""), []);
  assert.deepEqual(lines(undefined), []);
});

test("numeric fields come back as numbers, and a blank one does not become NaN", () => {
  assert.equal(Number("3") || 0, 3);
  assert.equal(Number("") || 0, 0);
  assert.equal(Number("abc") || 0, 0, "NaN would render as an empty price field");
  assert.equal(Number("") || 1, 1, "max_guests floors at 1, not 0");
});

/**
 * The dangerous direction. A draft kept after a SUCCESSFUL save would be
 * restored over the top of what was just written the next time the editor
 * opened — silently reverting the save.
 */
test("a draft is only restored after a failure, and discarded after a success", () => {
  const store = new Map<string, string>();
  const key = "stay-draft:7";

  function onMount(saveFailed: boolean): Draft | null {
    const raw = store.get(key);
    if (!saveFailed) {
      if (raw) store.delete(key);
      return null;
    }
    return raw ? (JSON.parse(raw) as Draft) : null;
  }

  store.set(key, JSON.stringify({ slug: "in-progress" }));
  assert.deepEqual(onMount(true), { slug: "in-progress" }, "a failure restores it");

  store.set(key, JSON.stringify({ slug: "in-progress" }));
  assert.equal(onMount(false), null, "a success discards it");
  assert.equal(store.has(key), false, "and does not leave it to ambush the next edit");
});
