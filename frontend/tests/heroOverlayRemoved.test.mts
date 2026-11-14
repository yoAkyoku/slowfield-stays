import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { cssRules, readStyles, readCode } from "./readCode.mts";

/** Does any component under app/ still emit this class? */
function rendered(cls: string, dir = "app"): boolean {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory() ? rendered(cls, p) : /\.tsx?$/.test(e.name) && readFileSync(p, "utf8").includes(cls)) return true;
  }
  return false;
}

/**
 * The page-hero photos are not washed over any more (客戶: 所有頁面的 hero 為何都
 * 有 mask? 這個能移除? → A, remove).
 *
 * Twelve rules used to paint a gradient over these heroes — a top vignette and
 * a bottom wash, per page family. Measured on /brand before removing them:
 *
 *   · the coverage peaked at 0.42 at the very top and 0.94 at the very bottom,
 *     where there is no text, and fell to 0.19 across 28–51%, which is exactly
 *     where the title and subtitle sit;
 *   · so white title text still came out at 1.51:1 against the photo — under
 *     the 3:1 WCAG asks of large text even WITH the wash.
 *
 * The wash was therefore darkening the picture without buying legibility. It is
 * gone. Legibility is now a per-page decision: PageHero reads
 * hero_title_color / hero_subtitle_color from the CMS, so a page with a bright
 * photo sets a dark title instead of every page being dimmed for it.
 */

const CSS = readStyles("app/globals.css");

/**
 * Rules whose selector names a page hero and that paint a gradient.
 *
 * Through the shared parser, which unwraps `@media`. Split on "}" — which is
 * what this did — a rule inside a breakpoint has the media query as its
 * "selector", so the `::before|::after` filter dropped it and a wash re-added
 * at one width only would not have been caught.
 */
function heroGradientRules(): string[] {
  return cssRules(CSS)
    .filter((r) => r.body.includes("linear-gradient"))
    .filter((r) => /::(before|after)/.test(r.selector))
    .filter((r) => /(stays-index-hero|content-index-hero|contact-hero|experience-hero)/.test(r.selector))
    .map((r) => (r.atRule ? `${r.atRule} { ${r.selector} }` : r.selector));
}

/**
 * One scrim is allowed back, and only one.
 *
 * The showcase redesign (app/site-refresh.css) puts white display type over
 * every section photo, which the measurements above say does not read without
 * help. So that file paints a single shared scrim — a pool of shade behind the
 * copy, not the old top-and-bottom wash that missed the text — and it steps
 * aside for any page that has set its own Hero 遮罩 in the admin, so the
 * per-page control is still the last word. Anything else is the twelve rules
 * creeping back.
 */
const ALLOWED_SCRIM =
  '.content-index-hero.has-hero-image:not(.has-hero-mask)::before, .contact-hero.has-hero-image:not(.has-hero-mask)::before, .stays-index-hero[style*="background-image"]:not(.has-hero-mask)::before';

test("page heroes carry the one shared scrim and nothing else", () => {
  const found = heroGradientRules();
  assert.deepEqual(
    found,
    [ALLOWED_SCRIM],
    `unexpected hero overlays: ${found.join(" | ")}`,
  );
  /* Every selector in it must yield to the admin mask, or a page that chose its
     own wash gets two. */
  for (const sel of ALLOWED_SCRIM.split(", ")) {
    assert.ok(sel.includes(":not(.has-hero-mask)"), `${sel} would stack on top of the page's own mask`);
  }
});

test("the two heroes that were deliberately left alone still have theirs", () => {
  /* Only the content-page hero family was in scope. The group homepage's own
     hero (0.34) and the villa banner (0.18) are different surfaces with much
     lighter washes; removing them was not asked for, and a blanket "strip every
     gradient" pass would have taken them — as the first attempt at this did,
     along with .dining-highlight-overlay and .home-feature-panel::before. */
  for (const sel of [".hero::before", ".property-hero-banner::before"]) {
    assert.ok(
      CSS.includes(sel),
      `${sel} was removed too; only the content-page heroes were in scope`,
    );
  }
  /* These two belonged to components that no longer exist (the dining
     highlight cards and the old home feature panel); their rules went with the
     rest of the unused CSS. The guard holds for as long as anything renders
     the class. */
  for (const sel of [".dining-highlight-overlay", ".home-feature-panel::before"]) {
    if (rendered(sel.slice(1).split("::")[0])) assert.ok(CSS.includes(sel), `${sel} is not a hero and must not have been touched`);
  }
});

test("hero legibility stays a per-page setting", () => {
  /* This is what replaces the wash. If PageHero stops reading these, a bright
     photo has no remedy at all and the removal becomes a regression. */
  const src = readCode("app/modules/content/PageHero.tsx");
  assert.match(src, /safeCssColor\(config\.hero_title_color\)/, "the per-page title colour is gone");
  assert.match(src, /safeCssColor\(config\.hero_subtitle_color\)/, "the per-page subtitle colour is gone");
});
