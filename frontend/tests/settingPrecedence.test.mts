import assert from "node:assert/strict";
import test from "node:test";
import { cssRules, readStyles, splitSelectorList } from "./readCode.mts";

/**
 * 站群設定 → 內容塊設定 → 角色設定, in that order, each one replacing the last.
 *
 * That is what the three panels imply and it is not what the cascade gave. Every
 * case below was measured in a browser with a three-layer probe (site vars on an
 * ancestor, the block's inline style and class on the wrapper, the role vars on
 * the wrapper) before and after the fix.
 *
 *   字級, before:  site 22px + block 31px → paragraph rendered 22px
 *   字級, after:   … → 31px, and 13px once 內文字級 is set
 *
 * The mechanism is always the same and worth stating once: a paragraph set to
 * `font-size: inherit` takes its size from its CONTAINER, so unless the
 * container is in the `.is-font-size` list too, the block's figure never gets
 * as far as the text. The 行距 group learned this first; the 字級 group had the
 * identical hole.
 */

const CSS = readStyles("app/globals.css");

/** Declaration blocks of every rule whose selector list contains `selector`. */
function ruleWith(selector: string): string[] {
  const want = selector.split(/\s+/).filter(Boolean).join(" ");
  return cssRules(CSS)
    .filter((r) => splitSelectorList(r.selector).includes(want))
    .map((r) => r.body);
}

test("內容塊的字體大小 beats a site 字級, because the body CONTAINERS carry it", () => {
  /* Measured before this: a site with 內文 22px saved, a block set to 31px, and
     the paragraph rendered 22px — the block-level control did nothing on any
     site that had ever opened the 字級 panel. */
  for (const container of [
    ".property-block-styled.is-font-size .property-rich-text-body",
    ".property-block-styled.is-font-size .stay-faq-answer",
    ".property-block-styled.is-font-size .block-about-body",
    ".property-block-styled.is-font-size .content-detail-body",
  ]) {
    const rules = ruleWith(container);
    assert.ok(rules.length > 0, `${container} is not in the is-font-size list — 字體大小 stops at the container`);
    assert.ok(
      rules.some((r) => /font-size:\s*var\(--r-body-size,\s*inherit\)/.test(r)),
      `${container} does not pass the block's figure through`,
    );
  }
  // The same list the 行距 group already has, so the two controls behave alike.
  for (const container of [
    ".property-block-styled.is-line-height .property-rich-text-body",
    ".property-block-styled.is-line-height .stay-faq-answer",
    ".property-block-styled.is-line-height .block-about-body",
    ".property-block-styled.is-line-height .content-detail-body",
  ]) {
    assert.ok(ruleWith(container).length > 0, `${container} left the is-line-height list`);
  }
});

test("字體大小 does not flatten a heading into the body", () => {
  /* A blanket `.is-font-size h2, h3 { font-size: var(--r-title-size, inherit) }`
     used to sit in that group. It did two opposite things depending on the
     heading: `.section h2` has its own rule at equal specificity later in the
     file and was untouched, while a heading without one collapsed to the block's
     body figure. Measured at 字體大小 = 14px: .section h2 stayed 44px, the
     newsletter's h2 went 46px → 14px, an item title 16px → 14px.

     The control's options are 12px–32px and it is paired with 行距: it is the
     block's BODY size. A title has 標題字級. */
  for (const sel of [".property-block-styled.is-font-size h2", ".property-block-styled.is-font-size h3"]) {
    assert.equal(
      ruleWith(sel).length,
      0,
      `${sel} is back — 字體大小 will collapse every heading that has no rule of its own`,
    );
  }
  /* …and the heading still answers to its own control, which is the half that
     must not be lost when the blanket rule goes. */
  const heading = ruleWith(".block-newsletter-copy h2");
  assert.ok(heading.length > 0, ".block-newsletter-copy h2 is gone — re-anchor this test");
  assert.ok(
    heading.some((r) => /font-size:\s*var\(--r-title-size/.test(r)),
    "the newsletter heading no longer reads 標題字級",
  );
});

test("行距 DOES carry the headings, and that asymmetry is deliberate", () => {
  /* A ratio cannot flatten a heading into its body copy the way an absolute
     14px would, so the two controls sitting side by side differ on purpose.
     Measured: block set to 1.2 moved the paragraph to 19.2px and left the h2 at
     50.6px, because the shared heading group is (0,2,1) and sits later. */
  const rules = ruleWith(".property-block-styled.is-line-height :is(.section, .page-block) :is(h2, h3)");
  assert.ok(
    rules.length > 0,
    "the heading override is gone — 行距 will move the body and leave every .section heading behind",
  );
  assert.ok(rules.some((r) => /line-height:\s*inherit/.test(r)));
});

test("a sub-heading inside body copy stays above the paragraph it opens", () => {
  /* `.property-rich-text-body h3 { font-size: 1.15em }` is (0,1,1), and
     `.section h3, .page-block h3` is (0,1,1) as well and sits ~5,000 lines
     later, so it won — with `inherit` as its last resort, i.e. exactly the
     paragraph's size. Measured inside a block: 16px heading, 16px body, which is
     the "reads as body text" the 1.15em was written to prevent.

     Deliberately NOT threaded with --r-title-size: 標題字級 is the block's title,
     and a sub-heading jumping to the h2's figure is a worse answer than the
     relative one. */
  const sel = ":is(.section, .page-block) :is(.property-rich-text-body, .stay-faq-answer, .block-newsletter-copy) :is(h3, h4, h5)";
  const rules = ruleWith(sel);
  assert.ok(rules.length > 0, "the sub-heading size is outranked again");
  assert.ok(rules.some((r) => /font-size:\s*1\.15em/.test(r)));
  assert.ok(
    !rules.some((r) => /--r-title-size/.test(r)),
    "a sub-heading now follows 標題字級 and will jump to the block title's size",
  );
});

test("留白 replaces rather than adds, at both levels", () => {
  /* 客戶: 改取代. The block writes the same variables the site writes, on a
     nearer element, so the block's figure substitutes for the site's instead of
     stacking on top of it. Measured: site 90/120, block 12/40 → 12/40. */
  const block = readStyles("app/modules/blockStyle.ts");
  for (const v of ["--block-y", "--section-y", "--gutter", "--block-pad-x"]) {
    assert.ok(block.includes(v), `blockStyle no longer writes ${v} — the block's spacing cannot replace the site's`);
  }
  /* `=`, not `:`. The code this forbids is an ASSIGNMENT —
     `style.paddingTop = \`${padY}px\`;` — and the earlier form of this line
     looked for a colon, so it matched neither the current file, nor the reverted
     code, nor blockPairStyle's own live assignments. It was true unconditionally:
     the one assertion guarding the padding fix could not fail. */
  assert.doesNotMatch(
    block,
    /style\.padding(Top|Bottom)\s*=\s*`\$\{pad(Y|ding)/,
    "blockStyle writes an inline padding again, which ADDS to the section's own instead of replacing it",
  );
  /* And the pair wrapper, which legitimately DOES set padding, still does. */
  assert.match(block, /style\.paddingTop = `\$\{padTop\}px`/, "blockPairStyle stopped setting the pair's inset");
});

test("a card or item title is not flattened into its own body copy", () => {
  /* Two shared rules ended in `inherit` — `.section h3` and the H4 item group —
     and both sit later than each card's own rule, so the figures written for
     these headings were unreachable and every one of them rendered at exactly
     the body's size. Measured on a villa page: card title 16px, card copy
     14.5px, with the card's own clamp(19px…23px) never applying.

     `inherit` is also why the same heading was BIGGER on a phone (20.3px) than
     on a desktop (16px): the breakpoint rule has always carried a real figure
     and the base rule did not. */
  const flattening = [
    [".section h3", "--type-h3-size"],
    [".property-features h3", "--type-h4-size"],
  ] as const;
  for (const [sel, scale] of flattening) {
    const rules = ruleWith(sel).filter((r) => /(^|;)\s*font-size\s*:/.test(r));
    assert.ok(rules.length > 0, `${sel} declares no size — re-anchor this test`);
    for (const rule of rules) {
      const value = /font-size\s*:\s*([^;]+)/.exec(rule)![1];
      assert.match(value, /var\(--r-title-size/, `${sel} does not read 標題字級`);
      assert.match(value, new RegExp(scale.replace(/[-]/g, "[-]")), `${sel} skips the site scale`);
      assert.doesNotMatch(
        value,
        /,\s*inherit\)\)?\s*$/,
        `${sel} falls back to inherit, which is the body's size — the heading disappears into its own copy`,
      );
    }
  }
  /* The two that DO have a figure of their own must keep it rather than the
     group's. */
  const news = ruleWith(".home-news-body h3").filter((r) => /font-size/.test(r));
  assert.ok(
    news.some((r) => /var\(--r-title-size,\s*var\(--type-h4-size,\s*clamp\(19px/.test(r)),
    "the news card title lost its own 19–23px figure",
  );
  const about = ruleWith(".block-about-feature-info h3").filter((r) => /font-size/.test(r));
  assert.ok(
    about.some((r) => /clamp\(14px/.test(r)),
    "the about item title lost its own 14–16px figure",
  );
});

test("the phone h3 is a step down from the desktop one, not up", () => {
  /* min(24px, 5.4vw) put the phone above the desktop figure across the whole
     range they share, so crossing 768px the heading shrank. Measured after:
     768px → 20px, 770px → 19px. */
  const mobile = ruleWith(".section h3").filter((r) => /min\(/.test(r));
  assert.ok(mobile.length > 0, "the breakpoint rule is gone — re-anchor this test");
  /* 19, which is the desktop clamp's FLOOR. The first version of this pinned 20
     — one better than the 24 it replaced, but still above what the desktop rule
     renders across the whole range the two share, because `1.55vw` only passes
     19px above 1225px. A cap must be compared against the floor, not against the
     ceiling. */
  assert.ok(
    mobile.some((r) => /--type-h3-size,\s*19px/.test(r)),
    "the phone cap is back above the desktop figure",
  );
  const desktop = ruleWith(".section h3").filter((r) => /clamp\(/.test(r));
  assert.ok(
    desktop.some((r) => /clamp\(19px/.test(r)),
    "the desktop floor moved — the phone cap has to move with it",
  );
});
