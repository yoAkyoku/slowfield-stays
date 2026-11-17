import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode";

/**
 * The article card's title is one level below the page, and still looks the
 * same size.
 *
 * Measured on /brand, the outline ran h1 「品牌故事」 then six h3s and nothing in
 * between — the cards ARE the page's content, so the only heading under the h1
 * skipped a level. FeatureCard, the same card in its large form a few lines
 * further down the same file, had always used h2.
 *
 * Raising the level is a two-part change and the second part is easy to forget:
 * the card's type came from `.section h3`, and an h2 in the same place matches
 * `.section h2` instead — the 27-46px page-title scale, four times the size a
 * card title should be. So the card's own rule has to match both levels AND
 * carry the h3 scale itself, or the fix lands as a visual regression.
 *
 * Both are asserted here, plus the specificity arithmetic that decides which of
 * the two rules wins, because that is the part a reader cannot see.
 */

const CSS = readStyles("app/globals.css");
const FACETS = readCode("app/modules/content/ContentFacets.tsx");
const ARTICLES = readCode("app/modules/home/blocks/BlockArticles.tsx");

/** The heading levels a component puts inside `.article-card-body`.
 *
 *  Bounded by the card's closing `</Link>` rather than by a character count:
 *  the body holds a tag row and a long comment before the title, and a fixed
 *  window that fell short would report "no heading" — a green test for a card
 *  that has no heading at all. */
function levelsIn(src: string): number[] {
  const out: number[] = [];
  /* The card is the shared ArticleCard now; its level is the `heading` prop,
     h3 when none is given. */
  for (const m of src.matchAll(/<ArticleCard\b([\s\S]*?)\/>/g)) {
    out.push(Number(/heading="h([1-6])"/.exec(m[1])?.[1] ?? 3));
  }
  const CLASS = /className="article-card-body"/g;
  for (let m = CLASS.exec(src); m; m = CLASS.exec(src)) {
    const end = src.indexOf("</Link>", m.index);
    const chunk = src.slice(m.index, end === -1 ? m.index + 2500 : end);
    for (const h of chunk.matchAll(/<h([1-6])[ >]/g)) out.push(Number(h[1]));
  }
  return out;
}

/** Selectors of every rule whose selector list mentions `.article-card-body`
 *  and a heading, with the rule body. */
function cardTitleRules(): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = RULE.exec(CSS); m; m = RULE.exec(CSS)) {
    const selector = m[1].replace(/\s+/g, " ").trim();
    if (!selector.includes("article-card-body")) continue;
    if (!/h[1-6]/.test(selector)) continue;
    out.push({ selector, body: m[2] });
  }
  return out;
}

/** Does this selector target heading level `n`? */
function targets(selector: string, n: number): boolean {
  const tag = "h" + n;
  // `:is(h2, h3)` and a bare `h3` both count; `h3` inside another word does not.
  return new RegExp("(^|[\\s>+~(,])" + tag + "($|[\\s>+~),])").test(selector);
}

/** (ids, classes, types) — enough to compare against `.section hN`. */
function specificity(selector: string): [number, number, number] {
  const flat = selector.replace(/:is\(([^)]*)\)/g, (_, inner: string) => {
    // :is() takes the specificity of its most specific argument; these are all
    // bare type selectors, so one type selector is the right stand-in.
    const parts = String(inner).split(",").map((s) => s.trim());
    return parts[0] ?? "";
  });
  const ids = (flat.match(/#[\w-]+/g) ?? []).length;
  const classes = (flat.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length;
  const types = (flat.match(/(^|[\s>+~])[a-z][\w-]*/g) ?? []).length;
  return [ids, classes, types];
}

function beats(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

test("the villa index's card title is an h2, not an h3", () => {
  const levels = levelsIn(FACETS);
  assert.ok(levels.length > 0, "no heading found in ContentFacets' article card");
  assert.deepEqual(
    [...new Set(levels)],
    [2],
    "the article card writes h" + levels.join("/h") + "; the page's h1 is the only heading above it, so h2 is the next level",
  );
});

test("the stylesheet follows every level a card actually uses", () => {
  /* Two components render this card and they disagree on the level: the villa
     index writes h2 (its cards sit straight under the page h1), the homepage
     block writes h3 (it has its own section heading above them). They are the
     same card and must look the same, so EVERY rule for the card title has to
     name every level in use — a rule that covers one and not the other is how
     one of the two silently loses its clamp or its type. */
  const used = [...new Set([...levelsIn(FACETS), ...levelsIn(ARTICLES)])].sort();
  assert.ok(used.length > 0, "no card headings found in either component");

  const rules = cardTitleRules();
  assert.ok(rules.length > 0, "no rule styles a heading inside .article-card-body");

  for (const r of rules) {
    const missed = used.filter((level) => !targets(r.selector, level));
    assert.deepEqual(
      missed,
      [],
      "`" + r.selector + "` skips h" + missed.join("/h") +
        ", which a card does render — that card falls back to the page heading rules",
    );
  }
});

test("the card title carries its own scale, so the page-title rule cannot claim it", () => {
  const rules = cardTitleRules();
  const base = rules.find((r) => targets(r.selector, 2) && /font-size/.test(r.body));
  assert.ok(
    base,
    "no .article-card-body rule sets font-size for h2 — `.section h2` (clamp(27px, 3.3vw, 46px)) takes over and the card title renders at page-title size",
  );

  // The h3 scale, not the h2 one: the card is a card whatever tag it uses.
  assert.match(
    base.body,
    /--type-h3-size/,
    "the card title is sized from something other than the h3 scale",
  );
  assert.match(base.body, /font-weight/, "the card title does not restate its weight, so `.section h2`'s 500 wins");

  // And it has to outrank the rule it is displacing.
  const mine = specificity(base.selector);
  const theirs = specificity(".section h2");
  assert.ok(
    beats(mine, theirs),
    "`" + base.selector + "` " + JSON.stringify(mine) + " does not outrank `.section h2` " +
      JSON.stringify(theirs) + ", so the page-title scale wins anyway",
  );
});

test("the phone-width override is declared after the rule it overrides", () => {
  /* Media queries add no specificity, so declared first it would tie with the
     base rule and lose at every width — the failure mode
     tests/mediaQueryShadowing.test.mts exists for. */
  const rules = cardTitleRules();
  const base = rules.find((r) => targets(r.selector, 2) && /font-size/.test(r.body));
  assert.ok(base);
  const basePos = CSS.indexOf(base.selector);
  const mobile = CSS.indexOf(base.selector, basePos + 1);
  if (mobile === -1) return; // no responsive override to order
  assert.ok(
    mobile > basePos,
    "the phone-width card-title rule comes before the base rule and is therefore dead",
  );
});
