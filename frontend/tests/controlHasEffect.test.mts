import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readEditorSurface, readStyles, cssRules } from "./readCode";
import { showsVAlign } from "../app/admin/modules/blockVAlign.ts";
import { drawing } from "./blockTypes.mts";

/**
 * A control is offered only where the renderer reads it.
 *
 * The block editor's recurring defect is not a control that saves badly — it is
 * a control that saves perfectly into a branch nothing looks at. The author
 * ticks it, the page does not change, and there is no error to notice: the
 * setting is indistinguishable from a broken one.
 *
 * Each case here is a control that was offered somewhere it had no effect,
 * found by rendering the real components twice (baseline against one changed
 * key) and diffing the markup. They are asserted against the FORM, because the
 * renderers' behaviour is deliberate in every case — 手動挑選 really should
 * ignore the count, 編號列表 really is not a card row. What was wrong is that
 * the editor did not say so.
 */

const FORM = readCode("app/admin/modules/blockForms.tsx");
const STAYS = readCode("app/modules/home/blocks/BlockStays.tsx");

test("the 相片牆 upload cap matches the number the page draws", () => {
  /* The form said 12 and let the author add a twelfth; HomePhotoGallery slices
     to 8. Images 9-12 uploaded, saved, and never appeared, with nothing said. */
  const gallery = readCode("app/modules/home/HomePhotoGallery.tsx");
  const drawn = gallery.match(/images\.slice\(0,\s*(\d+)\)/);
  assert.ok(drawn, "HomePhotoGallery no longer caps the list — check the form's cap too");
  const shown = Number(drawn![1]);

  /* The cap is conditional now, and it has to be: this one form serves 相片拼貼牆
     AND 圖片組, and only the first has a renderer that caps. Applying the cap to
     both took a limit that fits one block and imposed it on another whose
     renderer draws every image it is given. `showLayoutOptions` is the flag that
     separates them everywhere else in this form. */
  const cap = FORM.match(/\{\(showLayoutOptions \|\| images\.length < (\d+)\) && \(/);
  assert.ok(cap, "the 相片牆 add-image gate is gone, or is no longer conditional");
  assert.equal(
    Number(cap![1]),
    shown,
    `the collage editor accepts ${cap![1]} images and the page draws ${shown}`,
  );

  const label = FORM.match(/圖片（最多 (\d+) 張）/);
  assert.ok(label, "the 相片牆 field label is gone");
  assert.equal(Number(label![1]), shown, `the label promises ${label![1]} images and the page draws ${shown}`);

  // …and the label only makes that promise on the block it applies to.
  assert.match(
    FORM,
    /showLayoutOptions\n\s*\? \(zh \? "圖片" : "Images"\)/,
    "圖片組 is told it has an 8-image cap it does not have",
  );
  const imageGallery = readCode("app/modules/property/blocks/BlockImageGallery.tsx");
  assert.ok(
    !/images\.slice\(0,\s*\d+\)/.test(imageGallery),
    "BlockImageGallery caps its list now — the form's cap should follow it rather than stay conditional",
  );
});

/* Both gates below are spelled once now and read by name. Pinning the name
   alone would say nothing about what it admits, so each test pins the
   declaration too — 「stillAutomatic」 has to still mean 「自動, or 手動 with
   nothing ticked yet」 and 「isStays」 has to still mean the catalogue source. */
const GATE_DECLS: Array<[string, RegExp]> = [
  ["isStays", /const isStays = source === "stays";/],
  ["stillAutomatic", /const stillAutomatic = String\(c\.pick_mode \?\? "auto"\) !== "manual" \|\| pickedCount === 0;/],
];

function assertGateDecl(name: string) {
  const decl = GATE_DECLS.find(([n]) => n === name)!;
  assert.match(FORM, decl[1], `${name} no longer means what the gates below assume`);
}

test("內容過濾標籤 is offered only where BlockStays reads it", () => {
  /* filterTags is declared inside the CMS branch, so the 住宿目錄 source never
     sees it; the manual branch returns the ticked ids before any filtering. */
  assert.ok(
    !/const filterTag[\s\S]{0,400}?stayNodes = /.test(STAYS),
    "filter_tag moved above the source split — re-check which branches read it",
  );
  assertGateDecl("isStays");
  assertGateDecl("stillAutomatic");
  const gate = FORM.match(/\{[^\n]*&& \(\n\s*<>\n\s*<ContentTagFilterPicker\b/);
  assert.ok(gate, "the entry filter is offered unconditionally again");
  assert.ok(gate![0].includes("!isStays"), "the entry filter is offered on the 住宿目錄 source, which ignores it");
  assert.ok(gate![0].includes("stillAutomatic"), "the entry filter is offered under 手動挑選, which bypasses it");
  assert.match(STAYS, /hasContentFilterTag\(page\.tags, filterTags\)/, "the page no longer uses the multi-select OR matcher");
});

test("每個來源顯示數量 is hidden under 手動挑選", () => {
  // The manual branch maps picked_ids straight through — no slice, no limit.
  assert.match(
    STAYS,
    /pages = pickedIds\.map\(/,
    "the manual branch no longer maps picked_ids directly — re-check whether limit applies",
  );
  assertGateDecl("stillAutomatic");
  const gate = FORM.match(/\{[^\n]*&& \(\n\s*<Field label=\{isStays\n\s*\? \(zh \? "顯示數量"/);
  assert.ok(gate, "the count is offered unconditionally again");
  assert.ok(gate![0].includes("stillAutomatic"), "the count is offered under 手動挑選, which ignores it");
});

test("橫向滑動 is refused on 編號列表, in the editor and on the page", () => {
  /* .is-rail sets display and overflow-x but never flex-direction, and
     .home-journal-index is a column flex — so the class left the list stacked
     and turned the 240-320px flex basis into every row's HEIGHT, with no
     horizontal scroll. The tick broke the block rather than doing nothing, so
     a value saved before the control was withdrawn has to be refused too. */
  const css = readStyles("app/globals.css");
  const railRule = css.slice(css.indexOf(".is-rail {"), css.indexOf("}", css.indexOf(".is-rail {")));
  assert.ok(railRule.length > 0, ".is-rail is gone");
  assert.ok(
    !railRule.includes("flex-direction"),
    "「.is-rail」 now sets flex-direction, so 編號列表 may be able to use it — re-check this exclusion",
  );

  assert.match(
    STAYS,
    /const useRail = rail && !shortRow && variant !== "index";/,
    "a saved rail:true still reaches 編號列表 and stacks it into 240px-tall rows",
  );
  assert.match(FORM, /variant === "index" \? \(/, "the editor offers 橫向滑動 on 編號列表 again");
});

test("the two tag switches are withheld wherever they change nothing", () => {
  // index draws no tags and is excluded from the chip row; news prints tags
  // unconditionally and brings its own chips.
  const gate = FORM.match(/\{[^\n]*&& \(\n\s*<div className="hpb-field" role="group" aria-label=\{zh \? "卡片標籤與訪客篩選"/);
  assert.ok(gate, "the 標籤 field is offered unconditionally again");
  for (const v of ["feature", "index"]) {
    assert.ok(gate![0].includes(`"${v}"`), `the 標籤 field is offered on ${v}, which reads neither switch`);
  }
  assert.match(
    FORM,
    /\{variant !== "news" && \(<>/,
    "the two switches are offered on 最新消息卡, which ignores both",
  );
});

test("最新消息卡 keeps legacy selection support and directs new edits to articles", () => {
  /* The news variant still narrows its labels by picked_tags. Multi-source
     categories use the locale-safe helper; single-source entries use the
     regular entry-tag helper. */
  assert.match(STAYS, /tags: pageCardTags\(page\)/,
    "news cards must resolve article-owned labels through the shared compatibility helper");
  assert.match(FORM, /前往文章管理卡片標籤/);
  assert.match(STAYS, /c\.filter_by === "category" \|\| c\.filter_by === "tags"/);
});

test("the hero height's default option is not labelled with a size it never uses", () => {
  /* Labelled 預設 (55vh) while the winning declaration with height unset is
     100dvh on .hero and 100vh on .hero.hero-carousel. Picking 中 (55vh) to
     "keep the default" halved the hero. */
  /* The file that actually writes hero_height, not just blockForms. The earlier
     version read only FORM (blockForms.tsx), and the mislabelled option lives in
     PropertyBlockEditor.tsx — the sole writer of the key — so the assertion was
     guarding a string that was not there while the real one shipped. */
  const HEIGHT_EDITOR = readCode("app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx");
  assert.match(HEIGHT_EDITOR, /hero_height/, "PropertyBlockEditor no longer writes hero_height — re-anchor this test");
  for (const [where, src] of [["blockForms", FORM], ["PropertyBlockEditor", HEIGHT_EDITOR]] as const) {
    assert.ok(!src.includes("預設 (55vh)"), `${where}: the default hero height claims 55vh again`);
  }
  const css = readStyles("app/globals.css");
  const carousel = css.slice(css.indexOf(".hero.hero-carousel {"), css.indexOf("}", css.indexOf(".hero.hero-carousel {")));
  assert.ok(carousel.includes("min-height: 100vh"), "the carousel hero's unset height is no longer full screen — relabel the option");
});

test("About images are managed and shown as a carousel, with legacy images retained", () => {
  const about = readCode("app/modules/home/blocks/BlockAbout.tsx");
  const imageConfig = readCode("app/modules/home/blocks/aboutImages.ts");
  assert.match(about, /image \?/, "BlockAbout no longer gates its media column on the main image");
  assert.match(about, /normaliseAboutImages\(c\)/, "BlockAbout does not read the managed carousel image list");
  assert.match(imageConfig, /Array\.isArray\(stored\)/, "the shared reader does not read managed carousel images");
  assert.match(imageConfig, /config\.image, config\.image2/, "existing image and image2 values are no longer migrated into the carousel");
  assert.match(about, /<AboutImageCarousel/, "About images are not rendered by the carousel");
  assert.match(FORM, /新增輪播圖片/, "the editor no longer offers additional About carousel images");
  assert.match(FORM, /setImageAlt/, "the editor no longer allows localized image alt text");
  assert.match(FORM, /moveImage/, "the editor no longer allows carousel ordering");
});

test("the site's 左右留白 reaches the three page containers it used to miss", () => {
  /* .contact-page, .content-index and .content-detail-page each hard-coded a
     narrower gutter, so 版面 → 左右留白 moved every other page and left these
     three alone. `var(--gutter, …)` could not fix it: :root defines --gutter, so
     the fallback never fires and switching would have widened all three from
     56px to 120px on a page nobody had touched. --site-gutter exists only once
     the setting is set. */
  const presets = readCode("app/modules/fontPresets.ts");
  assert.match(
    presets,
    /if \(out\["--gutter"\]\) out\["--site-gutter"\] = out\["--gutter"\];/,
    "layoutVars no longer emits --site-gutter, so the three page containers keep their own gutter forever",
  );

  /* A count of uses, not the guarantee. `=== 3` went red the moment the two
     break-out heroes were fixed to read the same variable, which was a correct
     change — assert what each container does instead. */
  const css = readStyles("app/globals.css");
  assert.ok(
    !css.includes("padding: 0 clamp(20px, 4vw, 56px) 64px"),
    "a page container hard-codes its gutter again",
  );
  for (const sel of [".contact-page", ".content-index", ".content-detail-page"]) {
    const at = css.indexOf(`\n${sel} {`);
    assert.ok(at > -1, `${sel} is gone`);
    const rule = css.slice(at, css.indexOf("}", at));
    assert.ok(
      rule.includes("var(--site-gutter,"),
      `${sel} no longer follows the site's 左右留白`,
    );
  }
});

/** Every top-level rule that applies to this exact element: the selector itself
 *  and the refinements of it — `:not(…)`, `.is-open` — which outrank it.
 *
 *  Scoped to refinements written as `sel + suffix`. A rule that reaches the same
 *  element by a different route (`.content-index-hero.has-hero-image`, which has
 *  equal specificity and wins by position) is NOT covered here; widening this to
 *  full cascade resolution is a different exercise, and a check that covers the
 *  refinement case honestly beats one that claims more than it does. */
function rulesOn(css: string, base: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // Selector first. Computing the brace depth means walking the file from the
    // start, and this stylesheet holds ~10,000 rules in a megabyte — doing that
    // for every one of them made this single test take about a minute. Only a
    // handful of rules can match, so pay for the walk only on those.
    const matched = m[1].split(",").map((one) => one.trim()).filter((one) => {
      if (!one.startsWith(base)) return false;
      const rest = one.slice(base.length);
      return rest === "" || /^[:.[#]/.test(rest);
    });
    if (matched.length === 0) continue;
    let depth = 0;
    for (const ch of css.slice(0, m.index)) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
    }
    if (depth > 0) continue; // inside @media: a different context, not an override
    for (const one of matched) out.push({ selector: one, body: m[2] });
  }
  return out;
}

/** The left/right halves this body sets for `padding`/`margin`, longhand or
 *  shorthand. The shorthand is the trap: `padding: A 0 0` reads as "top A" and
 *  silently sets both horizontal halves to 0. */
function horizontal(body: string, prop: "padding" | "margin"): string[] {
  const out: string[] = [];
  for (const declaration of body.replace(/\/\*[\s\S]*?\*\//g, "").split(";")) {
    const name = declaration.split(":")[0].trim();
    const value = declaration.slice(declaration.indexOf(":") + 1).trim();
    if (!value || !declaration.includes(":")) continue;
    if (name === `${prop}-left` || name === `${prop}-right`) {
      out.push(value);
      continue;
    }
    if (name !== prop) continue;
    // Split on spaces at paren depth 0, so clamp(20px, 4vw, 56px) stays one term.
    const terms: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of value) {
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      if (ch === " " && depth === 0) {
        if (current) terms.push(current);
        current = "";
      } else current += ch;
    }
    if (current) terms.push(current);
    out.push(terms.length === 1 ? terms[0] : terms[1]);
  }
  return out;
}

test("a hero that breaks out of a page container pulls back by the same figure", () => {
  /* The two edge-to-edge heroes cancel their parent's padding with a negative
     margin. The parent moved to --site-gutter and these did not, so a site that
     set a wide 左右留白 indented the page by up to 220px while the hero pulled
     back only 56px: the hero stopped reaching the edge and its inner padding
     stopped lining up with the copy below. Not a setting that failed to apply —
     a visibly broken page, introduced by the fix above. */
  const css = readStyles("app/globals.css");
  for (const sel of [
    ".content-index .content-index-hero",
    ".contact-page .contact-hero",
  ]) {
    const rules = rulesOn(css, sel);
    const base = rules.find((r) => r.selector === sel);
    assert.ok(base, `${sel} is gone`);
    for (const prop of ["margin-left", "margin-right", "padding-left", "padding-right"]) {
      const line = base!.body.split("\n").find((l) => l.trim().startsWith(`${prop}:`));
      assert.ok(line, `${sel} no longer sets ${prop}`);
      assert.ok(
        line!.includes("var(--site-gutter,"),
        `${sel} ${prop} is back to a hard figure, so it no longer cancels its parent's padding`,
      );
    }
    /* Declaring it is not the same as it applying. This half was missing, and
       the bug it would have caught was live: `.contact-page .contact-hero:not(.has-hero-image)`
       is written some 10,000 lines further down, outranks the rule above, and
       set `padding: clamp(48px, 7vw, 104px) 0 0` — a shorthand whose middle
       term zeroes both horizontal halves. The negative margin still applied, so
       the hero broke out to the viewport edge and pulled back nothing.
       Measured on /contact before the fix: hero box at x=0, margin-left
       -62.352px, padding-left 0px. */
    for (const r of rules) {
      for (const prop of ["padding", "margin"] as const) {
        for (const value of horizontal(r.body, prop)) {
          assert.ok(
            value.includes("var(--site-gutter,"),
            `${r.selector} sets a horizontal ${prop} of \`${value}\`. It outranks ` +
              `${sel}, so the breakout is no longer cancelled and the hero's copy ` +
              `sits flush against the viewport edge.`,
          );
        }
      }
    }
  }
});

test("the vertical alignment control is offered only where a picture sits beside the copy", () => {
  /* Was a flat set of three block types, offered whatever the block held.
     .property-rich-split is the only layout that reads --block-text-valign, and
     rich_text and editorial only draw it once they have a picture — so the
     control is offered on those two exactly when config.image is set. */
  const forms = readCode("app/admin/modules/blockForms.tsx");
  /* The predicate moved to blockVAlign.ts so a test can execute it instead of
     matching its source; blockForms re-exports it for the two editors. Assert
     on the module that now owns it, and on the re-export, so neither half can
     disappear quietly. */
  assert.match(readCode("app/admin/modules/blockVAlign.ts"), /export function showsVAlign\(/, "showsVAlign is gone");
  assert.match(forms, /export \{ showsVAlign \} from "\.\/blockVAlign"/, "blockForms no longer re-exports showsVAlign");
  assert.ok(!forms.includes("VALIGN_BLOCKS"), "the flat block-type set is back");
  /* The rule, not the line that expressed it. This used to match the source of
     `if (type === "editorial" || type === "rich_text") return Boolean(config.image);`
     verbatim. That one-liner has since had to grow — editorial gained a third
     placement (大圖在上) with no second column, where --block-text-valign is read
     by nothing and the control must stay hidden — so the pin would have failed
     for exactly the change that made the gate more correct. Executed here
     rather than matched, which is what moving it to a JSX-free module bought. */
  assert.equal(showsVAlign("rich_text", { image: "/a.jpg" }), true, "a picture beside the copy must offer the control");
  assert.equal(showsVAlign("rich_text", {}), false, "no picture means no second column to align against");
  assert.equal(showsVAlign("editorial", { image: "/a.jpg", image_position: "left" }), true);
  assert.equal(showsVAlign("editorial", { image: "/a.jpg", image_position: "top" }), false,
    "picture-on-top has no second column; the control would save and do nothing");

  const css = readStyles("app/globals.css");
  /* Named, not counted. This was `readers === 2`, which failed the moment the
     third layout the hint has always promised — 「關於、圖文分欄、兩區塊並排三種
     版面用同一個設定」 — was finally wired: a count cannot tell a layout being
     added from a layout being lost. Each of the three the hint names is asserted
     on its own rule instead, so losing one is still caught. */
  for (const [rule, prop] of [
    [".block-about-copy", "justify-content"],
    [".property-rich-split", "align-items"],
    [".property-block-pair", "align-items"],
  ]) {
    /* Indexed rather than matched: the selector is a literal with dots in it,
       and building a regex out of it is how this assertion silently matched
       nothing the first time. */
    const open = css.indexOf(`${rule} {`);
    assert.notEqual(open, -1, `${rule} is gone — re-anchor this test`);
    const body = css.slice(open, css.indexOf("}", open));
    assert.match(
      body,
      new RegExp(`${prop}:\\s*var\\(--block-text-valign`),
      `${rule} does not read --block-text-valign, but the hint promises all three ` +
        `layouts share the one control`,
    );
  }

  /* rich_text is only back in the set because its form can now produce a
     picture. The earlier version of this assertion sliced from `case
     "rich_text"` in the block switch rather than from the form, so it was
     reading the wrong region entirely and would have passed either way. */
  const richTextForm = forms.slice(
    forms.indexOf("export function RichTextConfigForm("),
    forms.indexOf("export type FlowStep"),
  );
  assert.ok(richTextForm.length > 200, "RichTextConfigForm moved — re-anchor this slice");
  assert.match(
    richTextForm,
    /<ImageUploadInput[\s\S]{0,200}?onChange=\{\(url\) => onChange\(\{ \.\.\.c, image: url \}\)\}/,
    "rich_text lost its image field, so the alignment control cannot act on anything again",
  );

  for (const file of [
    "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx",
    "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx",
  ]) {
    assert.match(
      readEditorSurface(file),
      /showsVAlign\(selected\.type, selected\.config\)/,
      `${file} offers the control without checking the block's own config`,
    );
  }
});

test("the enquiry routing code is one control, not a list nothing reads", () => {
  /* ContactFormBlock reads inquiry_types[0].value and nothing else; the 顯示文字
     column and every row after the first were fields that saved and could not be
     seen anywhere, because the form's own 諮詢類型 dropdown was removed. */
  const block = readCode("app/modules/content/ContactFormBlock.tsx");
  /* Anchored on the CONFIGURED list. The earlier form of this pinned
     `typeOptions[0]`, which falls through to the built-in options whose first
     entry is 訂房 — so the assertion was keeping the "every enquiry is a
     booking" default in place while claiming to check that the control is read
     at all. */
  assert.match(
    block,
    /source: isBooking \? "booking" : \(inquiryTypes\[0\]\?\.\[1\] \|\| "website"\)/,
    "the renderer reads the inquiry types differently now — re-check the form",
  );
  const forms = readCode("app/admin/modules/blockForms.tsx");
  assert.ok(
    !/addLabel=\{zh \? "\+ 新增詢問類型"/.test(forms),
    "the repeatable inquiry-type list is back, and only its first row is ever read",
  );
  assert.match(forms, /送出後歸類為/, "the single routing-code control is gone");
});

test("欄數 is capped on a phone rather than overruled", () => {
  /* The phone rule was `grid-template-columns: 1fr 1fr !important` — the only
     way to beat an inline template — so a gallery set to one column came out as
     two and there was no way to ask for a single column on a phone. The count
     travels as a variable now, so the rule can cap instead of replace. */
  const gallery = readCode("app/modules/property/blocks/BlockImageGallery.tsx");
  assert.match(gallery, /\["--gallery-cols"[^\]]*\]: String\(cols\)/, "the column count no longer travels as a variable");
  const css = readStyles("app/globals.css");
  /* Scoped to this rule. A bare file-wide search for the old declaration also
     matched `.content-image-grid`, an unrelated rule that legitimately fixes two
     columns — the assertion failed against a correct stylesheet. */
  /* Every rule whose selector IS this class, compared as a whole selector.
     `lastIndexOf` matched the tail of
     `.property-block-pair … .is-fill-height .property-image-gallery-grid {`,
     so the body it read was `height: auto` — and adding a second, winning
     `1fr 1fr !important` to the real phone rule left this green. */
  const offenders: string[] = [];
  let seen = 0;
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = RULE.exec(css); m; m = RULE.exec(css)) {
    const sels = m[1].split(",").map((x) => x.replace(/\s+/g, " ").trim());
    if (!sels.includes(".property-image-gallery-grid")) continue;
    seen += 1;
    if (m[2].includes("1fr 1fr !important")) {
      offenders.push(`L${css.slice(0, m.index).split("\n").length}`);
    }
  }
  assert.ok(seen > 0, "the gallery grid rule is gone");
  assert.deepEqual(
    offenders,
    [],
    `the phone rule forces two columns again, whatever 欄數 says (${offenders.join(", ")})`,
  );
  assert.match(
    css,
    /repeat\(min\(var\(--gallery-cols, 2\), 2\), minmax\(0, 1fr\)\) !important/,
    "the phone cap is gone",
  );
});

test("卡片比例 survives a pairing and the collage hero", () => {
  /* Two rules outranked .has-card-ratio: the pair cleared aspect-ratio to fill
     its column, and the collage hero pinned 16/9. So 卡片比例 moved every tile
     except the one the eye lands on first, and nothing at all in a pair. */
  const css = readStyles("app/globals.css");
  assert.match(
    css,
    /\.property-block-pair \.property-image-gallery:not\(\.has-card-ratio\) \.property-image-gallery-item \{/,
    "a paired gallery clears the chosen card ratio again",
  );
  assert.match(
    css,
    /aspect-ratio: var\(--gallery-card-ratio, 16 \/ 9\);/,
    "the collage hero pins 16/9 again instead of defaulting to it",
  );
  assert.match(
    css,
    /aspect-ratio: var\(--gallery-card-ratio, 4 \/ 3\);/,
    "the collage hero's phone ratio is pinned again",
  );
});

test("every drawn badge icon can be picked in the editor", () => {
  /* BlockFeatureBadges carries 38 line icons keyed by slug, and no admin control
     could produce a slug — the amenity tick-boxes write emoji — so the whole set
     was unreachable and every badge came out emoji or fallback diamond. */
  const component = readCode("app/modules/property/blocks/BlockFeatureBadges.tsx");
  assert.match(component, /export const BADGE_ICON_SLUGS/, "the component no longer exports its icon keys");
  const slugs = [...component.slice(component.indexOf("const ICON_PATHS"), component.indexOf("export const BADGE_ICON_SLUGS"))
    .matchAll(/^ {2}([a-z0-9_]+):/gm)].map((m) => m[1]);
  assert.ok(slugs.length >= 30, `expected the drawn icon set, found ${slugs.length}`);

  const offered = [...FORM.slice(FORM.indexOf("export const BADGE_ICON_KEYS"), FORM.indexOf("export const FEATURE_ICON_KEYS"))
    .matchAll(/\["([a-z0-9_]+)",/g)].map((m) => m[1]);
  assert.deepEqual(
    slugs.filter((s) => !offered.includes(s)),
    [],
    "these drawn icons cannot be chosen from the editor",
  );
  assert.deepEqual(
    offered.filter((s) => !slugs.includes(s)),
    [],
    "the editor offers icons the component cannot draw — they would fall back to the diamond",
  );
  assert.match(FORM, /type: "icon"/, "the badge list no longer uses the icon picker");
});

test("every list marker the stylesheet draws can be chosen", () => {
  // Eight `.property-rich-text-body--ls-*` rules and no control wrote the key.
  const css = readStyles("app/globals.css");
  const drawn = [...css.matchAll(/\.property-rich-text-body--ls-([a-z]+) /g)].map((m) => m[1]);
  const unique = [...new Set(drawn)];
  assert.ok(unique.length >= 8, `expected the list-marker rules, found ${unique.length}`);
  const offered = [...FORM.slice(FORM.indexOf("export const LIST_STYLES"), FORM.indexOf("export function RichTextConfigForm"))
    .matchAll(/\["([a-z]+)",/g)].map((m) => m[1]);
  assert.deepEqual(unique.filter((v) => !offered.includes(v)), [], "these list markers cannot be chosen");
  assert.deepEqual(offered.filter((v) => !unique.includes(v)), [], "the form offers markers the stylesheet does not draw");
});

test("the fields the renderers read all have somewhere to be typed", () => {
  /* Each of these was read by a renderer and offered by no form — a capability
     with no way in. Grouped here because they are one class of defect. */
  for (const [needle, what] of [
    [/onChange\(setVal\(c, "intro", editLocale, v\)\)/, "表格前言"],
    [/onChange\(setVal\(c, "notes", editLocale, v\)\)/, "表格附註"],
    [/onChange\(setVal\(c, "caption", editLocale, v\)\)/, "相簿說明"],
    [/onChange\(\{ \.\.\.c, site: e\.target\.value \|\| undefined \}\)/, "詢問收件匣"],
    [/onChange\(\{ \.\.\.c, image_side: v \}\)/, "圖文分欄的圖片方向"],
  ] as Array<[RegExp, string]>) {
    assert.match(FORM, needle, `${what} has no field again — the renderer reads it and nobody can set it`);
  }

  /* 表格前言/附註 must reach a table wherever one is drawn. This used to be
     stated as "PageBlocks reads them too", because the group content page had
     its own copy of the table block — and reading the same key in two places is
     the shape of the defect, not the fix. There is one table component now and
     both renderers dispatch to it, so the assertion is that the one reader is
     still there and that no renderer has grown a private table again. */
  const table = readCode("app/modules/property/blocks/BlockTable.tsx");
  for (const key of ["intro", "notes"]) {
    // An exact substring rather than a built regex: `\(` inside a template
    // literal is just `(`, which the engine then read as an unclosed group.
    assert.ok(
      table.includes(`const ${key} = cfgT(config, "${key}"`),
      `the table block drops ${key}, so the field can be typed and never appears`,
    );
  }
  for (const file of [
    "app/modules/content/PageBlocks.tsx",
    "app/modules/property/PropertyPageRenderer.tsx",
  ]) {
    assert.match(
      drawing(file, "table") ?? "",
      /^<BlockTable\b/,
      `${file} draws the table block itself again rather than through BlockTable`,
    );
  }
});

test("the routing code survives the renderer's filter", () => {
  /* The two halves of one setting, asserted together because splitting them is
     what broke it. The form was changed to save `{ value }` only — the label it
     used to save is displayed nowhere since the 諮詢類型 dropdown was removed —
     and the renderer's filter still required BOTH. So every configured row was
     dropped, typeOptions fell back to the built-in list, and its first entry is
     住宿詢問: an author who picked 民宿加盟 filed the enquiry as a booking.
     Silent, and wrong in the data rather than on the page. */
  const block = readCode("app/modules/content/ContactFormBlock.tsx");
  assert.match(
    block,
    /\.filter\(\(\[, value\]\) => value\);/,
    "the renderer requires a label again, which the form no longer saves",
  );
  assert.match(
    FORM,
    /inquiry_types: e\.target\.value \? \[\{ value: e\.target\.value \}, \.\.\.rest\] : rest/,
    "the form saves a different shape — re-check the renderer's filter",
  );
  /* The fallback list exists for a block nobody has configured. Its first entry
     is what an unconfigured form files as, so it must not be reached by a form
     that IS configured. */
  const fallbackAt = block.indexOf("sourceOptions: [");
  assert.ok(fallbackAt > -1, "the built-in type list is gone");
  const first = block.slice(fallbackAt, block.indexOf("]", fallbackAt));
  assert.match(first, /"booking"/, "the fallback list changed — re-read why its first entry matters");
});

/* ── Controls whose behaviour is right and whose wording was not ─────────────
   The other half of the same defect. Above, a control was offered where the
   renderer ignored it. Here the renderer does exactly what it should and the
   label or hint describes something else, so the author reads a working
   setting as a broken one — and the report that comes back is the same
   sentence: 「我設定了，可是沒有反應」.

   Each test pins the copy AND the behaviour it describes, because a hint that
   states a condition is only true for as long as the condition is. */

const SITE_EDITOR = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");

/** The slice of `src` between `from` and the first `to` after it — the region
 *  one field's hint lives in, so an assertion about its wording cannot be
 *  satisfied by some other field's copy elsewhere in the same file.
 *
 *  Both anchors have to be code or JSX text, never a comment: readCode blanks
 *  comments, and an anchor that only exists in one would fail as "gone". */
function region(src: string, from: string, to: string): string {
  const at = src.indexOf(from);
  assert.ok(at > -1, `anchor \`${from}\` is gone — re-anchor this slice`);
  const end = src.indexOf(to, at + from.length);
  assert.ok(end > -1, `closing anchor \`${to}\` is gone — re-anchor this slice`);
  return src.slice(at, end);
}

/* `cssRules` used to be redeclared here — the seventh private copy of the same
   idiom, and like the others it treated a rule inside `@media` as unreachable
   (the media query's own `{` is the first one, so the selector read as the
   query). It comes from readCode now, where the at-rule handling lives once. */

test("站台設定 → 按鈕 names the buttons it paints, on both kinds of site", () => {
  /* Measured on the parent site — homepage and /contact, --button-bg and
     --button-text set on documentElement and every element's computed colour
     diffed before and after: --button-bg moved ONE element, the footer 訂閱
     button, and only because 頁尾按鈕背景 is blank and falls back to it;
     --button-text moved none. On a villa page --button-text moved the header
     立即預約 button. Both are deliberate — the ordinary `.button` is excluded
     on purpose (客戶: 按鈕要還原) — but a section headed 「按鈕」 with nothing
     else said reads as "the buttons on my site", which is why it came back as
     a bug rather than as a question. */
  assert.ok(
    !SITE_EDITOR.includes('"按鈕" : "Buttons"'),
    "the 按鈕 section is back to an unqualified name it does not live up to",
  );

  /* Stops at the 導覽列按鈕 heading, not at the field below it: that heading is
     itself 「導覽列按鈕（立即預約）」, so a slice running past it satisfies the
     立即預約 assertion whether this hint mentions the villa CTA or not. */
  const hint = region(SITE_EDITOR, 'name="button_text"', "導覽列按鈕（立即預約）");
  for (const [phrase, missing] of [
    ["訂閱", "which buttons actually read it"],
    ["立即預約", "that a villa site's header button reads it too"],
    ["一般的按鈕", "that ordinary buttons in the page body do not"],
    ["subscribe buttons", "which buttons actually read it (English)"],
    ["Ordinary buttons", "that ordinary buttons in the page body do not (English)"],
  ] as const) {
    assert.ok(hint.includes(phrase), `the 按鈕 hint no longer says ${missing} (looked for 「${phrase}」)`);
  }
});

test("…and that hint is still the whole truth about --button-bg / --button-text", () => {
  /* The hint above is a list, so it goes stale the moment a new selector reads
     one of these variables. Pinned as a set rather than as "at least these":
     wiring --button-bg into a fifth rule has to fail here and send whoever did
     it back to the wording, which is the step that was skipped when these
     settings were last widened. */
  const rules = cssRules(readStyles("app/globals.css"));
  const readersOf = (name: string) =>
    rules.filter((r) => r.body.includes(`var(${name}`)).map((r) => r.selector).sort();

  assert.deepEqual(
    readersOf("--button-bg"),
    [
      ".block-newsletter-form button",
      ".footer-newsletter-form button",
      ".property-booking-cta",
      ".property-header.is-scrolled .property-booking-cta",
    ],
    "the reach of --button-bg changed — the 按鈕 hint lists it, so the wording has to change too",
  );
  assert.deepEqual(
    readersOf("--button-text"),
    [".block-newsletter-form button", ".property-booking-cta"],
    "the reach of --button-text changed — the 按鈕 hint lists it, so the wording has to change too",
  );

  /* And the one exception the hint spells out: the contact page's subscribe
     band carries its own colours at a higher specificity, so the setting really
     does leave that button alone. Every rule with the selector, not the first:
     there are two, and only one of them sets colours. */
  const own = rules.filter((r) => r.selector === ".contact-page .block-newsletter-form button");
  assert.ok(own.length > 0, "the contact page's own subscribe button rules are gone");
  assert.ok(
    own.some((r) => r.body.includes("background:") && r.body.includes("color:")),
    "the contact band no longer overrides both button colours — the 按鈕 hint claims it does",
  );
});

test("交通聯繫 版型 says what each renderer draws, not just the villa one", () => {
  /* 「三張卡片（Reach / 地址 / 如何抵達）」 described BlockContactInfo. The same
     stored value on a group content page goes to PageBlocks' own ContactInfo,
     which draws a labelled TEL / MAIL / LINE / ADDRESS row — /contact is
     designed around that treatment, and routing it elsewhere is not the fix.
     What was wrong is that the option named a layout the author would not get. */
  assert.ok(
    !FORM.includes("三張卡片（Reach / 地址 / 如何抵達）"),
    "the cards option promises the villa layout on every page again",
  );
  assert.ok(
    !FORM.includes("Cards (Reach / Address / How to arrive)"),
    "the English cards option promises the villa layout on every page again",
  );

  const field = region(FORM, '"版型" : "Layout"', "</Field>");
  for (const phrase of ["民宿頁", "站群頁面", "villa page", "group page"]) {
    assert.ok(field.includes(phrase), `the 版型 hint no longer distinguishes 「${phrase}」`);
  }

  // The two drawings the hint names have to still be the two drawings.
  const pageBlocks = readCode("app/modules/content/PageBlocks.tsx");
  assert.match(
    pageBlocks,
    /cfg\.layout === "classic"\s*\?\s*SHARED_BLOCKS\.contact_info\(c\)/,
    "the group renderer routes 版型 differently now — re-read what each value draws",
  );
  assert.match(drawing("app/modules/property/PropertyPageRenderer.tsx", "contact_info") ?? "", /^<BlockContactInfo\b/, "經典 is no longer the villa component");
  const local = region(pageBlocks, "function ContactInfo({", "export default function PageBlocks");
  assert.ok(local.includes("page-block-contact-info"), "the group renderer no longer draws the labelled block");
  assert.ok(local.includes("contact-item"), "the group renderer no longer draws labelled rows");
  assert.ok(
    !local.includes("property-contact-card"),
    "the group renderer draws the villa cards now — the 版型 hint says it does not",
  );
  const villa = readCode("app/modules/property/blocks/BlockContactInfo.tsx");
  assert.ok(
    villa.includes("property-contact-card-num"),
    "the villa renderer no longer draws numbered cards — the 版型 hint says it does",
  );
});

test("主視覺 標題／副標 is offered with the condition that makes it apply", () => {
  /* With no image of its own the hero block falls back to the CMS banners, and
     the banner's title comes with them. That fallback is right — an untouched
     hero block should still show the site's banner — but the hint said the copy
     could be set here with no CMS Banner needed, flatly, so an author who
     filled in 標題 without uploading an image saw the banner's title instead
     and read the field as broken. */
  assert.ok(
    !FORM.includes("不必到 CMS Banner"),
    "the hero hint promises the block's own copy again without naming the condition",
  );
  assert.ok(
    !FORM.includes("no CMS Banner needed"),
    "the English hero hint promises the block's own copy again without naming the condition",
  );

  const hint = region(FORM, 'noun={{ zh: "輪播圖片"', '"標題（每張都會顯示）"');
  assert.ok(hint.includes("沒有圖片"), "the hero hint no longer says what happens with no image here");
  assert.ok(
    hint.includes("only used once this block has one"),
    "the English hero hint no longer states the image condition",
  );

  // The fallback the hint describes, in both hero renderers.
  const carousel = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.match(
    carousel,
    /if \(fromBlock\.length\) return fromBlock/,
    "the hero no longer falls back to the CMS banners when the block has no image of its own",
  );
  assert.match(
    carousel,
    /trs\(active, "title", locale\) : ""\) \|\| blockTitle/,
    "the banner's title no longer wins over the block's — the hint's condition is stale",
  );
  const banner = readCode("app/modules/property/blocks/BlockHeroBanner.tsx");
  const cmsBranch = region(banner, "if (usableBanners.length > 0) {", 'const image = String(config.image');
  assert.ok(
    !/\btitle=\{/.test(cmsBranch),
    "BlockHeroBanner hands the block's title to the CMS-banner carousel now — the hint's condition is stale",
  );
});

test("橫向捲動 says it needs three entries, which is the number that drops it", () => {
  /* shortRow suppresses the rail below three cards by design: one or two cards
     in a scrolling row is a narrow card against an empty strip. Ticking it on a
     two-card row produces byte-identical markup. How many entries the row will
     hold is data — source, count and filters, all resolved at render — so the
     editor cannot gate the control on it. It states the condition instead. */
  const threshold = STAYS.match(/cardCount > 0 && cardCount < (\d+)/);
  assert.ok(threshold, "shortRow no longer has a card-count floor — re-read the 橫向捲動 hint");
  assert.equal(
    Number(threshold![1]),
    3,
    `the rail is now dropped below ${threshold![1]} cards and the hint still says three`,
  );
  assert.match(
    STAYS,
    /const useRail = rail && !shortRow/,
    "a short row no longer drops the rail — re-read the 橫向捲動 hint",
  );

  const field = region(FORM, '"橫向捲動" : "Side-scroll"', "</Field>");
  assert.ok(
    field.includes("至少要有三筆"),
    "the 橫向捲動 hint no longer warns that a row under three entries ignores it",
  );
  assert.ok(
    field.includes("three entries"),
    "the English 橫向捲動 hint no longer warns that a row under three entries ignores it",
  );
});

test("影片比例 「自動」 resolves to a size instead of collapsing the embed", () => {
  /* The option emitted `aspect-ratio: auto`. An iframe's width/height
     attributes are presentational hints for the width/height PROPERTIES and
     give the element no intrinsic ratio, so the stylesheet's `height: auto`
     outranked them and the box fell to the replaced-element default of 150px —
     for every provider, not only Facebook. Measured on /admin/preview/block at
     a 1280px viewport: a Facebook video 460×818 → 460×150 and a YouTube embed
     800×450 → 800×150. They are 460×818 and 800×452 now.

     This is the one behaviour change in the set. Silently ignoring the setting
     was not on offer — that is the defect this whole pass is about — so 自動
     resolves to the size the provider states, which is the only "own height" a
     cross-origin embed can report, and the option says exactly that. */
  const oembed = readCode("app/modules/property/blocks/BlockOembed.tsx");
  assert.match(oembed, /function providerRatio\(/, "the provider's own stated size is no longer read");
  assert.match(
    oembed,
    /config\.embed_ratio === "auto"\) \{\s*const own = html \? providerRatio\(html\) : null;/,
    "the 自動 branch no longer resolves to the provider's stated size",
  );
  assert.ok(
    !/--embed-ratio"\] = "auto"/.test(oembed),
    "the CSS keyword `auto` is emitted again, which collapses every iframe embed to 150px",
  );
  /* The markup that is parsed has to be the markup that is drawn, or the ratio
     would describe an embed the page never renders. */
  assert.match(
    oembed,
    /const embedHtml = data\?\.html \? sanitizeOembedHtml\(data\.html\) : "";/,
    "the sanitised provider markup is no longer held in one value",
  );
  assert.match(oembed, /embedSizeStyle\(config, embedHtml\)/, "the ratio is read out of something else now");
  assert.match(oembed, /__html: embedHtml/, "the page draws markup other than the one the ratio came from");

  /* Why `auto` could not be honoured directly, so a change to either
     declaration is forced back past this reasoning. */
  const css = readStyles("app/globals.css");
  const at = css.indexOf(".property-oembed-content iframe {");
  assert.ok(at > -1, "the embed iframe rule is gone");
  const rule = css.slice(at, css.indexOf("}", at));
  assert.ok(
    rule.includes("height: auto"),
    "the iframe height rule changed — re-check whether 自動 can be honoured directly now",
  );
  assert.ok(rule.includes("aspect-ratio: var(--embed-ratio"), "the ratio no longer drives the embed's height");

  // The fallback the hint promises a Facebook embed, which states no size.
  const fbAt = css.indexOf(".property-oembed-content--fb {");
  assert.ok(fbAt > -1, "the Facebook embed defaults are gone");
  const fb = css.slice(fbAt, css.indexOf("}", fbAt));
  assert.match(fb, /--embed-ratio:\s*9 \/ 16/, "the Facebook fallback ratio the hint names is gone");

  // And the option no longer promises a height nothing can supply.
  assert.ok(!FORM.includes("不限制（依內容高度）"), "the 自動 option claims an unconstrained height again");
  assert.ok(!FORM.includes("Unconstrained"), "the English 自動 option claims an unconstrained height again");
  const field = region(FORM, '"影片比例" : "Aspect ratio"', "</Field>");
  assert.ok(field.includes("依來源提供的尺寸"), "the 自動 option no longer says whose size it follows");
  assert.ok(field.includes("Match the source's size"), "the English 自動 option no longer says whose size it follows");
  /* And the blank option, which is now the one it could be confused with.
     It performs no detection at all: with embed_ratio unset nothing writes
     --embed-ratio, so the embed takes the stylesheet's 16/9 or the Facebook
     container's 9/16 — the two figures the label has to name. */
  assert.ok(!field.includes("自動判斷"), "the blank ratio option claims a detection it does not do again");
  assert.ok(!field.includes('"Automatic"'), "the English blank ratio option claims a detection it does not do again");
  assert.ok(field.includes("預設（16:9；Facebook 影片 9:16）"), "the blank ratio option no longer names what it draws");
  assert.ok(
    field.includes("Default (16:9; 9:16 for Facebook video)"),
    "the English blank ratio option no longer names what it draws",
  );
  /* A bare `includes("Facebook")` passed for the wrong reason: this same
     paragraph opens with the supported-provider list, 「…TikTok、Facebook、
     Twitter 等網址」, so deleting the caveat entirely left it green. The
     assertions name the caveat's own subject and its consequence instead. */
  const hint = region(FORM, "支援 Instagram", "</p>");
  assert.ok(
    hint.includes("Facebook 影片外掛"),
    "the 影片比例 hint no longer names the embed that states no size of its own",
  );
  assert.ok(hint.includes("維持預設比例"), "the 影片比例 hint no longer says what a size-less provider falls back to");
  assert.ok(
    hint.includes("states none"),
    "the English 影片比例 hint no longer says that some providers state no size",
  );
  assert.ok(hint.includes("9:16"), "the 影片比例 hint no longer names the ratio a Facebook embed falls back to");
});
