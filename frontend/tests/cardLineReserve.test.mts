import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles } from "./readCode";

/**
 * The two-line reserve on a card only works if `lh` and the rendered line are
 * the same height, and `lh` resolves from the COMPUTED line-height.
 *
 * This bug survived two fixes because each one addressed the previous symptom:
 *   1. the reserve was `2em * 1.6`, a hand-kept number that had drifted from
 *      the stylesheet's own 1.7 — replaced with `2lh`;
 *   2. `2lh` was still wrong, because the type-scale rules set
 *      `line-height: var(--type-body-line, inherit)` and with no admin value
 *      the `inherit` fallback resolved to `normal`. For CJK text the metric
 *      `normal` reports is shorter than the box the text draws, so the reserve
 *      was 42px against a real 46px and a one-line summary still came up short.
 *
 * So the invariant is not "use 2lh" — it is "these elements must compute a
 * NUMERIC line-height". A bare `inherit`/`normal` fallback reintroduces the bug
 * with the reserve still looking correct.
 */

const CSS = readStyles("app/globals.css");

/** The six elements that carry a two-line reserve: a title and a summary in
 *  each of the three card families. */
const RESERVED = [
  ".home-collection-card-body strong",
  ".stay-card-body h3",
  ".home-news-body h3",
  ".home-collection-card-body p",
  ".stay-card-body p",
  ".home-news-body p",
];

/** Top-level rules whose selector list contains exactly `selector`.
 *  Split on commas: these declarations are written in comma groups, and a
 *  substring search finds only the selector that happens to be written last. */
function rulesFor(selector: string): RegExpMatchArray[] {
  return [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) =>
    m[1].split(",").map((one) => one.trim()).includes(selector),
  );
}

test("every element that reserves two lines also gets a numeric line-height", () => {
  /* RESERVED was declared and never read, so nothing checked the pairing it
     names. The failure it exists for is per-element, and the two tests below
     cannot see it: they check that SOME numeric declaration wins the cascade,
     not that each reserving element is covered by one. Add a fourth card
     family to the `2lh` group and forget the line-height group and `lh`
     resolves from `normal` for that family alone — the reserve is short on one
     row of cards and correct on the others, which reads as a content problem
     rather than a stylesheet one. */
  for (const selector of RESERVED) {
    const own = rulesFor(selector);
    assert.ok(
      own.some((m) => /min-height:\s*2lh/.test(m[2])),
      `${selector} is listed as reserving two lines but declares no 2lh reserve`,
    );
    assert.ok(
      own.some((m) => /line-height:\s*var\(--type-[a-z0-9]+-line,\s*[0-9]/.test(m[2])),
      `${selector} reserves 2lh but never gets a numeric line-height, so lh ` +
        `resolves from the inherit/normal fallback and the reserve comes up short`,
    );
  }
});

test("the reserve is expressed in lh, not a hand-kept multiplier", () => {
  assert.match(CSS, /min-height:\s*2lh;/, "the 2em fallback alone will drift from the real line-height again");
});

test("the numeric line-height wins the cascade", () => {
  /* Position, not presence. The first fix declared the numeric line-height
     next to the min-height rule near the top of the sheet — 30,000 lines
     before the type-scale block that sets the same property on the same
     elements — so it lost and changed nothing on the live site.

     A selector-name check cannot catch this: the clobbering rule is written
     against `.home-news-card p` while the reserve is on `.home-news-body p`.
     Different selectors, same elements. So compare file positions instead.

     The card TITLE now resolves through --type-h3-line rather than
     --type-h4-line: it took its size, weight and family from the H3 group and
     its leading from the H4 one, and cardHeadingTypeLevel.test.mts owns that
     change. The number (1.3) is untouched, so every reserve measured here is
     the same; only the name it is read under moved. `.section h3` — the group
     that clobbers a card title with `inherit` — is counted below for the same
     reason, so this stays a comparison against the rule that actually competes. */
  const lastInherit = Math.max(
    CSS.lastIndexOf("line-height: var(--type-body-line, inherit)"),
    CSS.lastIndexOf("line-height: var(--type-h3-line, inherit)"),
    CSS.lastIndexOf("line-height: var(--type-h4-line, inherit)"),
  );
  const bodyFix = CSS.lastIndexOf("line-height: var(--type-body-line, 1.7)");
  const titleFix = CSS.lastIndexOf("line-height: var(--type-h3-line, 1.3)");

  assert.ok(bodyFix > 0, "the card body line-height rule is missing");
  assert.ok(titleFix > 0, "the card title line-height rule is missing");
  assert.ok(
    bodyFix > lastInherit,
    `the body rule (offset ${bodyFix}) comes before the type-scale rule (offset ${lastInherit}) and loses the cascade`,
  );
  assert.ok(
    titleFix > lastInherit,
    `the title rule (offset ${titleFix}) comes before the type-scale rule (offset ${lastInherit}) and loses the cascade`,
  );
});

test("no hero height is capped by a bare length", () => {
  /* The phone rule used to read `min(var(--hero-h, 46vh), 52vh)`. That second
     term is a flat cap: set 全螢幕 and you still got 52vh, with the admin
     showing the setting as applied.

     `min(var(--hero-h, …), calc(100dvh - var(--site-header-h, …)))` is a
     different thing and is correct — it is not a cap on the setting, it is the
     screen minus the sticky header, which is what 全螢幕 means on a page whose
     header is opaque. So the check forbids a bare length as the second term
     and leaves the header-subtraction form alone. */
  const bad = [...CSS.matchAll(/min-height:\s*min\(\s*var\(--hero-h[^;]*?\)\s*,\s*([^;)]+)\)/g)]
    .map((m) => m[1].trim())
    .filter((second) => !second.includes("--site-header-h"));
  assert.deepEqual(bad, [], "hero heights capped by a flat length: " + bad.join(" | "));
});

test("the room photo floor is suppressed once the card stacks", () => {
  // Absolutely positioned, the ::before is covered by the photo. Stacked, it
  // is not, and it adds its full height as empty space under every picture.
  // Several 900px blocks exist, so check them all rather than the first.
  const blocks = CSS.split("@media (max-width: 900px)").slice(1);
  const suppressed = blocks.some((b) =>
    /\.property-room-media::before\s*\{[^}]*display:\s*none/.test(b.slice(0, 1200)),
  );
  assert.ok(
    suppressed,
    "the aspect floor still applies when the photo is in flow — it stacks instead of being covered",
  );
});

test("the winning hero height declaration reads the admin setting", () => {
  /* Twice now a hero has ignored 頁面 Hero 高度 because ONE declaration was
     wired up and a LATER one still hardcoded a number:
       · the phone rule capped it with min(var(--hero-h), 52vh);
       · .stays-index-hero got var(--hero-h, 78vh) at line ~2069 while a second
         copy 19,000 lines further down still said 88vh, and won.

     Earlier declarations may hardcode freely — the sheet overrides them on
     purpose. What matters is the LAST declaration mentioning each hero in each
     media context, because that is the one the browser uses. Keyed by the hero
     rather than by the selector list, so the same rule written with different
     companions still counts as the same target. */
  const HEROES = [".stays-index-hero", ".content-index-hero.has-hero-image"];
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

  const winner = new Map<string, string>();
  let context = "base";

  for (const m of bare.matchAll(/@media([^{]+)\{|([^{}]+)\{([^}]*)\}|\}/g)) {
    if (m[0].startsWith("@media")) { context = m[1].trim(); continue; }
    if (m[0] === "}") { context = "base"; continue; }
    const sel = (m[2] ?? "").replace(/\s+/g, " ").trim();
    for (const d of (m[3] ?? "").matchAll(/min-height:\s*([^;]+);/g)) {
      for (const hero of HEROES) {
        if (sel.includes(hero)) winner.set(`${context} :: ${hero}`, d[1].trim());
      }
    }
  }

  assert.ok(winner.size > 0, "no hero min-height declarations found — did the selectors change?");
  const bad = [...winner.entries()]
    .filter(([, v]) => !v.includes("var(--hero-h") && v !== "auto")
    .map(([k, v]) => `${k} -> ${v}`);
  assert.deepEqual(bad, [], "hero rules whose winning min-height ignores the setting: " + bad.join(" | "));
});

test("heroes account for the sticky header, each the way its header allows", () => {
  /* A hero set to 100vh has to reckon with the sticky header, and there are two
     correct answers depending on whether that header can be seen through:

       · homepage — `.site-header` is transparent until you scroll, so the hero
         pulls up behind it and the photo really does run edge to edge;
       · every other page — the header renders already `is-scrolled`: solid
         white. Pulling up there hides the top of the photo behind the bar
         (客戶: hero 還是會被擋住), so those heroes start below it and take
         `100dvh - header` instead.

     Getting this backwards is invisible until 頁面 Hero 高度 is actually set to
     全螢幕, which is why it shipped twice. */
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const bodiesFor = (sel: string) =>
    [...bare.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => m[1].includes(sel)).map((m) => m[2]);

  // Transparent header → keeps the pull-up pair.
  const homeBodies = bodiesFor(".hero-carousel");
  assert.ok(
    homeBodies.some((b) => /margin-top:\s*calc\(-1 \* var\(--site-header-h/.test(b)),
    "the homepage hero lost its pull-up — its header is transparent, so the photo should reach the top",
  );

  // Opaque header → must NOT end up pulled up, and must subtract the header.
  for (const sel of [".content-index-hero.has-hero-image", ".stays-index-hero"]) {
    const bodies = bodiesFor(sel);
    const lastMargin = bodies.filter((b) => /margin-top:/.test(b)).pop();
    assert.ok(lastMargin, `${sel} sets no margin-top at all`);
    assert.doesNotMatch(
      lastMargin!,
      /margin-top:\s*calc\(-1 \* var\(--site-header-h/,
      `${sel} is pulled up behind an opaque header, which hides the top of its photo`,
    );
    /* The BASE rule must subtract it, not merely some media-query copy: with
       the base left as a plain var() the desktop hero runs a header past the
       fold while the phone one is fine, and a `some()` check would call that
       covered. */
    const baseBodies = [...bare.replace(/@media[^{]+\{(?:[^{}]|\{[^{}]*\})*\}/g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter((m) => m[1].includes(sel))
      .map((m) => m[2]);
    assert.ok(
      baseBodies.some((b) => /min-height:\s*min\(var\(--hero-h[^;]*100dvh - var\(--site-header-h/.test(b)),
      `${sel}'s base rule does not subtract the header, so 全螢幕 runs past the fold on desktop`,
    );
  }
});

test("the stays search bar takes its measure from the shared block wrapper", () => {
  /* It was a hardcoded bar hand-matched to the homepage's dimensions. It is the
     same `search` block now, inside the same .home-stays-search-wrap, so the
     page must NOT restate the measure — those rules applied on top of the
     wrapper's and made the bar 840 against the homepage's 880. */
  const rule = CSS.match(/\.stays-index \.ssb \{([^}]*)\}/);
  assert.ok(rule, ".stays-index .ssb rule is gone");
  assert.doesNotMatch(rule![1], /max-width/, "the page re-caps a width the block wrapper already sets");
  assert.doesNotMatch(rule![1], /margin/, "the page re-spaces a bar the block wrapper already spaces");
});

test("an empty load-more wrapper takes no space", () => {
  /* The three load-more components render the wrapper unconditionally and put
     null inside when there is nothing more to load, so its 48px/24px padding
     was reserved under every list too short to need a button. */
  const rule = CSS.match(/\.load-more-container:empty\s*\{([^}]*)\}/);
  assert.ok(rule, "no :empty rule — an empty wrapper still reserves its padding");
  assert.match(rule![1], /display:\s*none/);
});

test("the contact page's blocks all sit on one measure", () => {
  /* The 通訊處 list and the newsletter panel carried the same
     `calc(1040px - 2 * var(--gutter))`, but --gutter resolves to 0 in the
     newsletter's subtree and 32px in the contact block's, so the same formula
     gave 1040 and 976 — the list ended up 64px narrower than everything else
     (客戶: 寬度與其他的不同). A gutter-dependent measure cannot be shared
     across subtrees that define the gutter differently. */
  const rule = CSS.match(/\.contact-page \.contact-offices,\s*\n\s*\.contact-page \.page-block-contact > h2 \{([^}]*)\}/);
  assert.ok(rule, "the 通訊處 measure rule is gone");
  assert.doesNotMatch(
    rule![1],
    /max-width:\s*calc\([^)]*var\(--gutter\)/,
    "the measure depends on --gutter again, which differs from the newsletter's subtree",
  );
  /* The measure itself is now the page-level --contact-measure, so widening the
     page is one edit instead of four in step. Pinning the old literal here made
     this test fail for a change that keeps everything it was written to
     protect — the panels still share one width and it still does not depend on
     --gutter. What matters is that the value comes from the shared variable. */
  assert.match(rule![1], /max-width:\s*var\(--contact-measure\)/);
});

test("the publish card's delete button matches the save button's box", () => {
  // Stacked directly under 儲存網站, which is width:100%; as a bare
  // .admin-action-btn the delete shrank to its label and the two widths
  // disagreed (客戶: 刪除按鈕寬度不一致).
  /* Both buttons are the kit's button now, so radius and box model are one
     rule; what still has to be said per button is that both fill the card. */
  const editor = readFileSync("app/admin/(dashboard)/stays/StayEditor.tsx", "utf8");
  assert.match(editor, /<SubmitButton className=\{buttonClass\(\{ variant: "primary"[^}]*block: true \}\)\}/, "the save button no longer fills the card");
  assert.match(editor, /className=\{buttonClass\(\{ variant: "danger-ghost", block: true \}\)\}/, "the delete button shrank to its label again");
  assert.match(CSS, /\.a-btn--block \{ width: 100%; \}/);
});

test("no photo hero height escapes the header subtraction", () => {
  /* Position was not enough. `.stays-index .stays-index-hero` (0,2,0) in the
     768px block outranked the override written as `.stays-index-hero` (0,1,0),
     so the plain `var(--hero-h)` won on phones and the hero ran exactly one
     header past the fold — while the desktop rule, which had no
     higher-specificity rival, looked fine. Checking "the last declaration wins"
     misses this; specificity decides, not order.

     So the invariant is stronger: EVERY min-height on a photo hero goes through
     the subtraction, whatever selector carries it. Then no specificity contest
     can produce a wrong answer. The one exception is the hero with no photo,
     which hugs its own copy and has no viewport-sized height to trim. */
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const plain = [...bare.matchAll(/min-height:\s*(var\(--hero-h[^;]*)/g)].map((m) => m[1].trim());
  const allowed = ["var(--hero-h, 360px)"];
  const bad = plain.filter((v) => !allowed.includes(v));
  assert.deepEqual(
    bad,
    [],
    "hero heights that skip calc(100dvh - header) and can win on specificity: " + bad.join(" | "),
  );
});


test("row action buttons are not squeezed below their labels", () => {
  /* The CMS 操作 column is a 2-up grid. With `1fr` columns it gave up width
     before the rest of the table did, and clipped Preview / Delete / Archive
     mid-word — visible only on the English admin, since the Chinese labels are
     two characters and happened to fit (客戶: 後台頁面被擠壓). A max-content
     floor makes the column ask the table for the width the labels need. */
  /* Row actions are the kit's <RowActions>: a wrapping flex row of buttons
     whose labels never wrap, so a button's minimum width is its label and a
     tight column wraps whole buttons onto a new line instead of clipping them. */
  const button = CSS.match(/\n\.a-btn \{([^}]*)\}/);
  assert.ok(button, "the kit button rule is gone");
  assert.match(button![1], /white-space:\s*nowrap/, "button labels can wrap mid-word again");
  const bar = CSS.match(/\.a-row-actions \{([^}]*)\}/);
  assert.ok(bar, "the row-action bar rule is gone");
  assert.match(bar![1], /flex-wrap:\s*wrap/);
  assert.doesNotMatch(bar![1], /grid-template-columns/, "the bar went back to fixed grid tracks");
});
