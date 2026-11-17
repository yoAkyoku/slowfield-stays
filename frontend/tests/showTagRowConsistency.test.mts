import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";

/**
 * The 顯示分類列 switch, and the trap that sits under it.
 *
 * 顯示搜尋框 defaults OFF; this one defaults ON, because every page already
 * renders its chip row and a new flag must not blank them. That inverted
 * default is the whole hazard: read it with `=== true` anywhere — reader,
 * switch, or save path — and every page that has never been saved since this
 * shipped loses its categories the moment someone touches an unrelated field.
 *
 * The save path is the sharpest edge. It parses an absent field as "1", the
 * opposite of _show_search right above it, so posting an older form cannot
 * turn the row off by omission.
 *
 * Scoped to these four files on purpose: `show_tags` (no _row) is a different
 * flag on the stays block's own config and legitimately defaults off.
 */

const EDITOR = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx";
const ACTION = "app/admin/modules/propertyPagesActions.ts";
const FACETS = "app/modules/content/ContentFacets.tsx";
const READERS = [EDITOR, "app/modules/content/CategoryPage.tsx", "app/property/[slug]/[...pageSlug]/page.tsx"];

for (const file of READERS) {
  test(`${file} treats an unset show_tag_row as on`, () => {
    const src = readFileSync(file, "utf8");
    // Property reads only — a comment naming the flag is prose, not a read.
    const uses = src.split(String.fromCharCode(10)).filter((l) => l.includes(".show_tag_row"));
    assert.ok(uses.length > 0, "no show_tag_row read found — renamed?");
    for (const line of uses) {
      assert.ok(
        line.includes("!== false"),
        `${file} reads show_tag_row as "${line.trim()}" — use !== false so absent means on`,
      );
    }
  });
}

test("an older form without the field does not hide the row", () => {
  const action = readFileSync(ACTION, "utf8");
  const parse = action.split(String.fromCharCode(10)).find((l) => l.includes('formData.get("_show_tag_row")'));
  assert.ok(parse, "the save path no longer reads _show_tag_row");
  assert.match(parse!, /\?\?\s*"1"/, `absent must default to "1", got: ${parse!.trim()}`);
});

test("the switch persists the value it shows", () => {
  assert.match(readFileSync(EDITOR, "utf8"), /name="_show_tag_row"/);
  assert.match(readFileSync(ACTION, "utf8"), /show_tag_row: showTags/);
});

test("hiding the row also stops tag filtering", () => {
  // Chips gone but ?tag= still applied = a silent subset with no way back.
  const src = readCode("app/modules/content/ContentFacets.tsx")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
  assert.match(src, /\{showTags && tagChips\.length > 0 &&/, "the chip row is not gated on showTags");
  assert.match(src, /if \(!showTags\) return;/, "the ?tag= effect still runs with the row hidden");
});

test("the two switches are independent", () => {
  const src = readFileSync(EDITOR, "utf8");
  assert.ok(!/showSearch\s*&&\s*showTags|showTags\s*&&\s*showSearch/.test(src), "one switch gates the other");
});

/* ── The cards carry the categories the row filters on ──
   客戶: 旅遊專欄以標籤作為主要分類方式，不另外增加複雜搜尋分類.
   With tags as the only categorisation, the chip row cannot be the only place a
   tag appears: the reader filters to 宜蘭 and lands on cards that never say what
   they are. 最新消息 has printed its category on the card all along; every CMS
   index draws the same "article" card, so 旅遊專欄 gets it from the same place
   rather than growing a second card just for itself. */

/** The `layout === "article"` branch of FacetList — the card every index uses. */
function articleCard() {
  const src = readFileSync(FACETS, "utf8");
  const start = src.indexOf('if (layout === "article")');
  assert.ok(start > -1, "the article card branch is gone — renamed?");
  const end = src.indexOf('if (layout === "magazine"', start);
  assert.ok(end > start, "could not find the end of the article card branch");
  const branch = src.slice(start, end);
  /* The card itself is the shared ArticleCard; the branch hands it the tags.
     Read both, so "the card prints the tags" still means the tags it is given. */
  assert.match(branch, /<ArticleCard[\s\S]*?tags=\{tags\}/, "the article branch no longer hands its tags to ArticleCard");
  const cards = readFileSync("app/modules/content/cards.tsx", "utf8");
  const card = cards.slice(cards.indexOf("export function ArticleCard"));
  return branch + "\n" + card;
}

test("the index card prints the article's selected card labels", () => {
  const card = articleCard();
  assert.match(
    card,
    /cardTagsT\(item as Parameters<typeof cardTagsT>\[0\], locale\)/,
    "the article card never reads the article-level card labels",
  );
  // Rendered, not merely computed: a `tags` const nothing prints is the same
  // blank card with a passing test.
  assert.match(card, /\{tags\.length > 0 && \(/, "the tag row is never rendered on the card");
  assert.match(card, /<span className="tag" key=\{tag\}>\{tag\}<\/span>/, "the tags are not drawn as tag chips");
});

test("the card row uses the card tag style, not the article page's", () => {
  // .article-tags is the article page's trailing row: centred, max-width 680px
  // and margin-top clamp(28px, 4vw, 44px). Inside a card that opens a gap above
  // the title and pushes the summary out of the reserved height. .tags--lead is
  // the row the 最新消息 cards already use, so the two indexes read alike.
  const card = articleCard();
  assert.match(card, /className="tags tags--lead"/, "the card tag row is not .tags--lead");
  // The class, not a mention of it — the note above the row names it too.
  assert.ok(
    !card.includes('className="article-tags"'),
    "the card is back on the article page's tag row",
  );

  const css = readStyles("app/globals.css");
  assert.ok(css.includes("\n.tags--lead {"), ".tags--lead is unstyled, so the card row has no rule");
  assert.ok(css.includes("\n.tag {"), ".tag is unstyled, so the chips render as bare text");
});

test("the card tags follow the same switch as the row", () => {
  // Otherwise an index with 顯示分類列 off shows tags it gives no way to act on.
  const card = articleCard();
  assert.match(card, /const tags = showTags\s*\n?\s*\?/, "the card tags ignore the 顯示分類列 switch");
  const src = readFileSync(FACETS, "utf8");
  assert.match(src, /<FacetList[\s\S]*?showTags=\{showTags\}[\s\S]*?\/>/, "showTags never reaches the card");
});

test("no second search control came in with the tags", () => {
  // 客戶: 不另外增加複雜搜尋分類 — the one search box stays behind its own switch.
  const src = readFileSync(FACETS, "utf8");
  const searches = src.split('type="search"').length - 1;
  assert.equal(searches, 1, `expected one search field, found ${searches}`);
  assert.match(src, /\{showSearch && \(/, "the search field is no longer gated on its switch");
});
