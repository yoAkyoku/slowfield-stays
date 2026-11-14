import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode.mts";

/**
 * The hero mask is a per-page setting now (客戶: 給每個頁面編輯加個 mask，可調
 * 顏色和透明度), not twelve fixed gradients in the stylesheet.
 *
 * Why it replaced them rather than being added alongside: measured on /brand,
 * the old wash peaked at 0.42 at the top and 0.94 at the bottom — where no text
 * sits — and fell to 0.19 across the 28–51% band the title and subtitle occupy.
 * It darkened every photograph on the site and still left white text at 1.51:1,
 * under the 3:1 WCAG asks of large text. A page can now use exactly as much as
 * its own photograph needs, and most need none.
 */

const HERO = readCode("app/modules/content/PageHero.tsx");
const EDITOR = readCode("app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx");
const ACTION = readCode("app/admin/modules/propertyPagesActions.ts");
const CSS = readStyles("app/globals.css");

test("the mask colour goes through the same sanitiser as the other colours", () => {
  /* It lands in a style attribute. The file already carries a note about what
     an unsanitised colour did here: `red;background-image:url(https://evil…)`
     was emitted verbatim and honoured, i.e. an outbound beacon on page load. */
  assert.match(HERO, /safeCssColor\(config\.hero_mask_color\)/,
    "hero_mask_color reaches a style attribute without safeCssColor");
});

test("the opacity is clamped, and 0 is not confused with unset", () => {
  /* `||` would fold an explicit 0 into "never configured". They mean different
     things: one is a mask the editor turned off, the other is a page that has
     never had one. */
  assert.match(HERO, /Math\.min\(100, Math\.max\(0,/, "the opacity is not clamped to 0-100");
  assert.doesNotMatch(HERO, /config\.hero_mask_opacity \|\|/,
    "`||` treats an explicit 0 as unset");
});

test("no mask configured paints nothing at all", () => {
  /* Not an invisible element over every hero: the class is what the stylesheet
     hangs the ::after on, so withholding it is what makes "no mask" free. */
  assert.match(HERO, /hasMask \? " has-hero-mask" : ""/,
    "the marker class is applied unconditionally");
  assert.match(HERO, /Boolean\(image\) && Boolean\(maskColor\) && maskPct !== null && maskPct > 0/,
    "a mask is drawn without a picture, without a colour, or at zero strength");
});

test("the stylesheet paints it under the copy, not over it", () => {
  const rule = CSS.split("}").find((chunk) => chunk.includes(".page-hero.has-hero-mask::after"));
  assert.ok(rule, "the mask rule is gone");
  /* 0, and it matters. The two heroes carrying `page-hero` lift their copy to
     different levels — the parent's to 2, the villa banner's to 1 — and an
     ::after paints after the element's children at equal z-index. A mask at 1
     therefore covered the villa's title while looking right on every parent
     page: the exact "does the mask affect the text" case, visible on one route
     family only. */
  const z = /z-index:\s*(-?\d+)/.exec(rule!);
  assert.ok(z, "the mask sets no z-index at all");
  assert.ok(Number(z![1]) <= 0, `mask z-index is ${z![1]}; the villa hero lifts its copy to only 1`);
  assert.match(rule!, /opacity:\s*var\(--hero-mask-opacity/, "the strength is not driven by the page's own value");
  assert.match(rule!, /background:\s*var\(--hero-mask\)/, "the colour is not driven by the page's own value");
  assert.match(rule!, /pointer-events:\s*none/, "the mask swallows clicks meant for the hero");
});

test("the setting survives a round trip through the editor and the save", () => {
  /* The failure this guards is the one that keeps recurring here: a control
     that moves, saves without error, and changes nothing on the page. */
  for (const key of ["_hero_mask_color", "_hero_mask_opacity"]) {
    assert.ok(EDITOR.includes(`name="${key}"`), `${key} is never posted by the form`);
    assert.ok(EDITOR.includes(`d.${key} !== undefined`), `a recovered draft loses ${key}`);
    assert.ok(ACTION.includes(`formData.get("${key}")`), `the save action ignores ${key}`);
  }
  for (const key of ["hero_mask_color", "hero_mask_opacity"]) {
    /* Anchored on the assignment, not on the bare substring. `hero_mask_color:`
       is satisfied by the INPUT key `_hero_mask_color` this same file reads two
       lines up, so the earlier form of this could not tell "written to the page
       config" from "read off the form" — the one distinction it exists to make.
       The value has to be the local the action built from that input. */
    /* Lines, not a regex: building one by interpolation is how the escapes get
       eaten (`\w` in a template literal is a plain `w`). A line whose trimmed
       form STARTS with the key cannot be the underscore-prefixed input. */
    const assigned = ACTION.split("\n").some((l) => l.trim().startsWith(`${key}:`) && l.trim().length > key.length + 1);
    assert.ok(assigned, `${key} is read but never written to the page config`);
  }
  // In the unsaved-work guard, or the toggle looks free of consequence.
  assert.match(EDITOR, /heroMaskColor: string;/, "not part of the snapshot type");
  assert.match(EDITOR, /v\.heroMaskColor/, "not serialised into the snapshot");
  assert.match(EDITOR, /heroMaskColor: initialHeroMaskColor/, "the baseline snapshot omits it");
});

test("the control only appears where it can do something", () => {
  /* The mask is scoped to `.has-hero-image` in CSS. Offering it on a hero with
     no photograph would be a control that saves and does nothing. */
  assert.match(EDITOR, /\{heroImage && \(\s*\n\s*<Field label=\{zh \? "Hero 遮罩"/,
    "the mask field is offered on heroes that have no picture");
});

test("the mask can never cover the title, subtitle or CTA", () => {
  /* Asserted against EVERY hero that can carry the mask, because they do not
     agree on where their copy sits:

       .content-index-hero / .contact-hero  copy at z-index 2
       .property-hero-banner-content        copy at z-index 1

     A mask has to be below the lowest of them. Written as "below the minimum"
     rather than "equals 0" so that raising one of the copy levels does not
     quietly re-break it. */
  const zOf = (needle: string): number | null => {
    for (const chunk of CSS.split("}")) {
      const brace = chunk.indexOf("{");
      if (brace === -1) continue;
      if (!chunk.slice(0, brace).includes(needle)) continue;
      const m = /z-index:\s*(-?\d+)/.exec(chunk.slice(brace + 1));
      if (m) return Number(m[1]);
    }
    return null;
  };

  const copyLevels = [
    [".content-index-hero.has-hero-image > *", zOf(".content-index-hero.has-hero-image > *")],
    [".property-hero-banner-content", zOf(".property-hero-banner-content")],
  ] as Array<[string, number | null]>;
  for (const [sel, z] of copyLevels) {
    assert.ok(z !== null, `${sel} no longer sets a z-index; the mask has nothing to sit under`);
  }
  const maskZ = zOf(".page-hero.has-hero-mask::after");
  assert.ok(maskZ !== null, "the mask sets no z-index");

  const lowest = Math.min(...copyLevels.map(([, z]) => z as number));
  assert.ok(
    (maskZ as number) < lowest,
    `mask is at z-index ${maskZ}, the lowest hero copy at ${lowest} — it would cover the text there`,
  );

  // And it must not eat clicks meant for a CTA sitting in that copy.
  const rule = CSS.split("}").find((c) => c.includes(".page-hero.has-hero-mask::after"));
  assert.match(rule!, /pointer-events:\s*none/);
});

test("every hero renderer honours the setting, not just the parent's", () => {
  /* The control lives in the page editor that villa sites use too. Wired to
     PageHero alone, a villa admin could pick a colour and a strength, save, and
     watch the page not change — the silent no-op this route already carries a
     note about for 「Hero 對齊」, which shipped exactly that way.

     THREE, not two. The stays index renders its own hero by hand and was left
     out of the earlier version of this list, so it read the picture and the
     height from the page editor and ignored the other six fields entirely. A
     count of renderers is the thing this test keeps getting wrong, so each one
     is named. */
  const VILLA = readCode("app/property/[slug]/[...pageSlug]/page.tsx");
  const STAYS = readCode("app/(site)/stays/page.tsx");
  for (const [name, src] of [["PageHero", HERO], ["the villa hero", VILLA], ["the stays index hero", STAYS]] as const) {
    assert.match(src, /safeCssColor\((?:pageCfg|config)\.hero_mask_color\)/,
      `${name} does not sanitise the mask colour`);
    assert.match(src, /Math\.min\(100, Math\.max\(0,/, `${name} does not clamp the opacity`);
    assert.match(src, /has-hero-mask/, `${name} never emits the marker class`);
    /* Both, not just the strength: `background: var(--hero-mask)` with no value
       paints nothing, so a renderer that emitted the opacity and forgot the
       colour would have passed the earlier version of this. */
    assert.match(src, /"--hero-mask"/, `${name} never emits the mask colour`);
    assert.match(src, /"--hero-mask-opacity"/, `${name} never emits the strength`);
  }
  /* And the wash has to be able to land on it: the stays hero carries no
     `page-hero` class, so the rule had to name it. */
  assert.match(CSS, /\.stays-index-hero\.has-hero-mask::after/,
    "the stays hero can never paint the mask — the rule does not name it");
});

test("the stays index hero reads the rest of the page editor's hero fields", () => {
  /* It read hero_image and hero_height and nothing else, while the same editor
     saved 標題／副標／兩個顏色／對齊 — six controls that saved cleanly and
     changed nothing on this one page. */
  const STAYS = readCode("app/(site)/stays/page.tsx");
  for (const key of ["hero_title", "hero_subtitle", "hero_title_color", "hero_subtitle_color", "hero_align"]) {
    assert.ok(STAYS.includes(key), `the stays index hero ignores ${key}`);
  }
  assert.match(STAYS, /"hero_title" in pageCfg/,
    "a title the editor deliberately cleared must stay cleared, not fall back to the bundled copy");
});
