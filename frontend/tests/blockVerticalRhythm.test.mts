import assert from "node:assert/strict";
import test from "node:test";
import { readStyles, cssRules, splitSelectorList } from "./readCode";
import { blockStyle } from "../app/modules/blockStyle.ts";

/**
 * 上下留白 reaches every block, including the ones with a padding of their own.
 *
 * 客戶: 上下的間距不同 請QA. Measured on /brand at 1440, block by block: every
 * `.section` paid 32.3px top and bottom, `.block-about` paid 79.2 and the pair
 * 80 — so one page ran three vertical rhythms and the gaps between blocks came
 * out 112, 112, 112, 140.
 *
 * The pair was reachable all along (blockPairStyle writes inline padding, which
 * outranks the stylesheet). `.block-about` was not: it pays `--about-pad-y`, a
 * clamp of its own, and blockStyle only wrote `--block-y` / `--section-y`. So
 * the control saved a number and moved nothing — the defect class this whole
 * change set exists to close, in the one block that had its own opinion.
 */

const CSS = readStyles("app/globals.css");
const RULES = cssRules(CSS);

test("設定 the vertical padding emits a name a block with its own clamp can read", () => {
  const s = blockStyle({ _padY: 56 }) as Record<string, string>;
  assert.equal(s["--block-y"], "56px", "the section rhythm variable is gone");
  assert.equal(s["--section-y"], "56px");
  assert.equal(s["--block-pad-y"], "56px", "上下留白 no longer reaches a block that pays its own padding");
  /* Only when set. A block nobody touched must emit nothing, or every existing
     page shifts the moment this ships — the reason it cannot simply read
     --block-y, which is always defined at :root. */
  assert.equal(blockStyle({})?.["--block-pad-y" as keyof object], undefined);
  assert.equal(blockStyle({ _bgColor: "#ff0000" })?.["--block-pad-y" as keyof object], undefined);
});

test("the about block reads that name, and keeps its own figure when nobody set one", () => {
  const rule = RULES.find(
    (r) => r.atRule === "" && splitSelectorList(r.selector).some((x) => x.trim() === ".block-about") && /--about-pad-y/.test(r.body),
  );
  assert.ok(rule, ".block-about no longer declares --about-pad-y — re-anchor this test");
  assert.match(
    rule.body,
    /--about-pad-y:\s*var\(--block-pad-y,\s*clamp\(44px, 5\.5vw, 84px\)\)/,
    "the about block either stopped honouring 上下留白, or its untouched default moved",
  );
  /* Not --block-y: that is defined at :root, so the fallback would never fire
     and every untouched about block on the site would jump to the section
     rhythm. */
  assert.doesNotMatch(rule.body, /--about-pad-y:\s*var\(--block-y/, "the fallback can never fire from --block-y");
});

test("stacked, the control still reaches the about block's outer edges", () => {
  /* Below 900 the halves stack and a media query hard-codes their vertical
     padding, so 上下留白 was ignored one breakpoint further down: measured at
     375 with the control set to 56, every neighbouring block paid 56 and this
     one paid 24 top and bottom.

     The two edges are not interchangeable. Stacked, the block's OUTER edges are
     the picture's top and the copy's bottom; the copy's TOP is the gap between
     the photo and the words it belongs to, and that one has to stay small — it
     is the band this media query was written to close. So the control reaches
     three of the four and deliberately not the fourth. */
  const stacked = RULES.filter((r) => /@media \(max-width: 900px\)/.test(r.atRule) && /padding-block/.test(r.body));
  const copy = stacked.find((r) => splitSelectorList(r.selector).some((x) => x.trim() === ".block-about-copy"));
  const media = stacked.find((r) => splitSelectorList(r.selector).some((x) => x.trim() === ".block-about-media"));
  assert.ok(copy && media, "the stacked about rules no longer set padding-block — re-anchor this test");
  assert.match(
    media.body,
    /padding-block:\s*var\(--block-pad-y,\s*clamp\(24px, 5vw, 40px\)\)\s+0/,
    "the stacked picture's top edge stopped following 上下留白 (or its untouched default moved)",
  );
  assert.match(
    copy.body,
    /padding-block:\s*clamp\(24px, 5vw, 40px\)\s+var\(--block-pad-y,\s*clamp\(24px, 5vw, 40px\)\)/,
    "the stacked copy's outer (bottom) edge stopped following 上下留白, or its inner gap started following it",
  );
});

test("both halves of the about block still take that one figure", () => {
  /* The media and copy columns are held on the same lines by sharing
     --about-pad-y; if one of them stops reading it they drift apart, which is
     what naming the variable was meant to prevent. */
  const users = RULES.filter((r) => /padding[^;]*var\(--about-pad-y\)/.test(r.body)).map((r) => r.selector);
  assert.ok(
    users.some((s) => /\.block-about-copy/.test(s)) && users.some((s) => /\.block-about-media/.test(s)),
    `only ${users.join(" / ")} pays --about-pad-y; both columns must`,
  );
});

test("a heading sits the same distance from its content on every page", () => {
  /* 客戶: 住宿卡片與標題太遠. `.section-header` had margin-bottom
     clamp(36px, 5vw, 56px) — 80px from a heading to its content once the box's
     own 24px is counted. The homepage had already measured that as too far and
     fixed it with a `.site-home` override, and the fix stopped there: the same
     collection of stay cards sat 56px under its heading on / and 80px under it
     on /brand.

     Pinned as the exact clamp because it is a judgement someone made against a
     rendered page, not a derived figure — and because the failure mode is
     silent: nothing breaks, the page just goes loose again. */
  const base = RULES.find(
    (r) => r.atRule === "" && splitSelectorList(r.selector).some((x) => x.trim() === ".section-header") && /margin-bottom/.test(r.body),
  );
  assert.ok(base, ".section-header is gone — re-anchor this test");
  assert.match(
    base.body,
    /margin-bottom:\s*clamp\(22px, 2\.6vw, 32px\)/,
    "the heading-to-content gap moved off the figure the homepage measured and accepted",
  );
  /* And no PAGE may quietly take a different one. A block that wants a tighter
     header of its own is fine — `.property-features` legitimately asks for 12px
     — but a wrapper that scopes the gap to one page is exactly how the homepage
     and the content pages came apart, and left the client looking at the same
     block spaced two ways. */
  const pageScoped = RULES.filter(
    (r) =>
      r.atRule === "" &&
      /margin-bottom/.test(r.body) &&
      splitSelectorList(r.selector).some((x) => /^\.(site-home|content-index|contact-page)\s+\.section-header\s*$/.test(x.trim())),
  );
  assert.deepEqual(
    pageScoped.map((r) => r.selector),
    [],
    "a page-scoped .section-header margin is back; that is how the homepage and the content pages came apart",
  );
});
