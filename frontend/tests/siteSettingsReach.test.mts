import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";

/**
 * A site-group setting that the admin can save must actually reach the page.
 *
 * This is the single most repeated defect in this codebase: a control exists,
 * saves without error, and no renderer reads it — or reads it with a different
 * default, so the control misreports the current state. `show_search` was the
 * textbook case (written `!== false`, read `=== true`).
 *
 * Two of them were CSS-variable bugs that no type system could catch: a custom
 * property is substituted on the element that DECLARES it, so a value derived
 * once on `:root` can never see a per-site override set further down the tree.
 */

const FONT_PRESETS = readCode("app/modules/fontPresets.ts");
const CSS = readStyles("app/globals.css");

test("--block-y is derived per site, not frozen on :root", () => {
  // .page-block-* spaces itself by --block-y. Derived only on :root it stayed
  // at the stock rhythm, so 版面 → 區塊上下間距 moved .section padding and left
  // every CMS block alone.
  assert.ok(
    FONT_PRESETS.includes('out["--block-y"]'),
    "layoutVars no longer emits --block-y, so section_gap cannot reach page blocks",
  );
  assert.match(
    FONT_PRESETS,
    /--block-y"\] = `calc\(\$\{out\["--section-y"\]\} \* 0\.85\)`/,
    "--block-y is no longer derived from the site's own --section-y",
  );
});

test("--accent-text is derived per site, not frozen on :root", () => {
  assert.ok(
    FONT_PRESETS.includes('out["--accent-text"]'),
    "themeVars no longer emits --accent-text, so a custom accent leaves it stock gold",
  );
});

test("the stylesheet still defines both as :root fallbacks", () => {
  // The per-site values override these; a site that sets neither must still
  // render, so the base declarations have to stay.
  assert.match(CSS, /--block-y:/, "the :root fallback for --block-y is gone");
  assert.match(CSS, /--accent-text:/, "the :root fallback for --accent-text is gone");
});

test("every preview route validates and applies the site's variables", () => {
  // The CMS preview hand-rolled a subset and inlined pageBg raw into
  // `background`, the one place that skipped safeCssBackground — a stored
  // url(https://…) fetched on a super-admin's preview load.
  const preview = readCode("app/admin/preview/content/[id]/page.tsx");
  for (const fn of ["themeVars", "fontVars", "typeScaleVars", "layoutVars", "pageBackgroundStyle"]) {
    assert.ok(preview.includes(`${fn}(`), `the CMS preview no longer applies ${fn}`);
  }
  assert.ok(
    !preview.includes("background: pageBg"),
    "the CMS preview inlines an unvalidated background again",
  );
});

test("inlined rich-text lengths go through the project's guards", () => {
  // React serialises a style value verbatim on the server, and the block
  // preview route takes a caller-supplied ?cfg=.
  const src = readCode("app/modules/property/blocks/BlockRichText.tsx");
  assert.ok(src.includes("safeLineHeight(config._lineHeight)"), "_lineHeight is inlined unchecked");
  assert.ok(src.includes("safeTypeLength(config._letterSpacing)"), "_letterSpacing is inlined unchecked");
});

test("the hero alignment control works on villa pages too", () => {
  // It is offered on every managed page; only the parent routes read it, so on
  // a villa it saved and did nothing.
  const villa = readCode("app/property/[slug]/[...pageSlug]/page.tsx");
  assert.ok(villa.includes("hero_align"), "the villa hero ignores hero_align again");
  assert.ok(
    villa.includes('["left", "center", "right"].includes'),
    "hero_align reaches a class name and a style attribute unchecked",
  );
});

test("hero_height is allow-listed before it becomes a class name", () => {
  const action = readCode("app/admin/modules/propertyPagesActions.ts");
  assert.match(
    action,
    /\["small", "medium", "large", "full"\]\.includes\(rawHeroHeight\)/,
    "hero_height is interpolated into a class name unchecked",
  );
});

test("a gallery image survives the editor's own normalisation", () => {
  // The 相簿 editor rewrites every entry to { url, caption } as soon as anyone
  // touches the list; the renderer cast the array to string[], so those entries
  // reached <img src> as "[object Object]".
  const src = readCode("app/modules/home/blocks/BlockGallery.tsx");
  assert.ok(!src.includes("as string[]"), "the gallery casts objects to strings again");
  assert.ok(src.includes('"url" in item'), "the gallery no longer accepts the editor's shape");
});

test("a villa page marked noindex is actually kept out of the index", () => {
  // The control is offered on villa pages but only the parent route read it,
  // so the page was still handed to crawlers.
  const villa = readCode("app/property/[slug]/[...pageSlug]/page.tsx");
  assert.ok(villa.includes("pageSettingsSeo("), "the villa route no longer reads the page's SEO settings");
  assert.ok(villa.includes("noIndex: settingsSeo.noIndex"), "noindex is dropped on villa pages again");
});

test("a picked amenity icon is not discarded", () => {
  // The amenity checkboxes write emoji; ICON_PATHS is keyed by slug, so all
  // eighteen fell through to one generic diamond.
  const src = readCode("app/modules/property/blocks/BlockFeatureBadges.tsx");
  assert.ok(src.includes("feature-badge-glyph"), "an emoji amenity icon is thrown away again");
});

test("the 交通聯繫 controls mean the same thing on every surface", () => {
  // The block is drawn by two renderers. Each implemented a different half:
  // the group-content one had 通訊處 and the card toggle but not 版型; the villa
  // one had 版型 but silently dropped the offices and ignored the toggle.
  const villa = readCode("app/modules/property/blocks/BlockContactInfo.tsx");
  const group = readCode("app/modules/content/PageBlocks.tsx");

  // Offices: one shared component, used by both.
  for (const [name, src] of [["villa", villa], ["group", group]] as const) {
    assert.ok(src.includes("<ContactOffices"), `${name} renderer drops the 通訊處 list`);
  }
  // The card toggle reaches the villa renderer too.
  assert.ok(villa.includes("config.show_primary !== false"), "the villa renderer ignores the card toggle");
  // 版型 reaches the group renderer, without a second copy of the classic layout.
  assert.ok(group.includes('cfg.layout === "classic"'), "版型 does nothing on group content pages");
});

test("the parent nav honours the anchor link mode", () => {
  // The villa header has always honoured it; the group nav built its href
  // straight from the page key, so the setting saved and the link still went
  // to the sub-page.
  /* The nav rules moved out of the route into modules/siteNav so the order
     聯絡我們 sits in could be tested directly — the guarantee below did not
     change, only its address. The layout must still be the module's caller,
     or this would pass against a copy nothing renders. */
  const nav = readCode("app/modules/siteNav.ts");
  assert.ok(nav.includes("function navHref("), "the parent nav has no anchor support");
  assert.ok(nav.includes('mode === "anchor" && anchor'), "the anchor mode is not applied");
  const layout = readCode("app/(site)/layout.tsx");
  assert.match(layout, /import \{ buildNavLinks \} from "\.\.\/modules\/siteNav"/,
    "the parent layout no longer builds its nav from the shared rules");
  const footer = readCode("app/modules/property/PropertyFooter.tsx");
  assert.ok(footer.includes("navHref("), "the villa footer still hardcodes the sub-page URL");
});

test("a one-string page label is not wiped by an unrelated save", () => {
  const editor = readCode("app/admin/(dashboard)/sites/[id]/pages/[pageKey]/page.tsx");
  assert.ok(editor.includes('typeof lbl === "string"'), "a string label is discarded on load again");
  const action = readCode("app/admin/modules/propertyPagesActions.ts");
  assert.ok(
    action.includes("Object.values(label).some"),
    "an empty label object overwrites the stored name again",
  );
});

test("the group site's own chrome colours are wired to the settings", () => {
  // nav/footer had zero readers on the parent: every consumer was a .property-*
  // selector, so the fields saved and nothing changed.
  const css = readStyles("app/globals.css");
  for (const [selector, variable] of [
    /* The scrolled bar, not the top state: the header floats transparent over
       the hero by design, and pointing both states at one variable made
       "導覽列背景 = transparent" produce an invisible scrolled nav. */
    [".site-header.is-scrolled", "--nav-bg"],
    [".footer", "--footer-bg"],
    // Two buttons in two places, two settings.
    [".header-book", "--nav-button-bg"],
    [".footer-newsletter-form button", "--footer-button-bg"],
  ] as const) {
    const at = css.lastIndexOf(`${selector} {`);
    assert.ok(at > -1, `${selector} is gone`);
    const rule = css.slice(at, css.indexOf("}", at));
    assert.ok(rule.includes(`var(${variable}`), `${selector} does not read ${variable}`);
  }
});

test("the generic button is NOT repainted by the theme setting", () => {
  // Wiring `.button` to --button-bg turned every ordinary button on the group
  // site the accent colour — and the stored value was the old colour swatch's
  // auto-fill, not a colour anyone chose (客戶: 按鈕要還原).
  //
  /* Was `lastIndexOf(".button {")`, which inspected exactly one rule. A
     negative assertion proves nothing when it looks at a single occurrence:
     `.unsubscribe-actions .button`, `.booking-cta-actions .button` and
     `.property-mega-menu-booking .button` also style generic buttons, and
     wiring --button-bg into any of them brought the regression back with the
     test still green. Every rule whose selector carries a `.button` token is
     checked instead. */
  const css = readStyles("app/globals.css").replace(
    /\/\*[\s\S]*?\*\//g,
    (c) => " ".repeat(c.length),
  );
  const offenders: string[] = [];
  let seen = 0;
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = RULE.exec(css); m; m = RULE.exec(css)) {
    const selectors = m[1].split(",").map((s) => s.trim());
    // A `.button` token ends at a quote, a space, a colon or a brace — never at
    // a hyphen, so `--nav-button-bg` and `.footer-newsletter-form button` do
    // not count as matches.
    if (!selectors.some((s) => /(^|[\s>+~])\.button(?![\w-])/.test(s))) continue;
    seen += 1;
    if (m[2].includes("--button-bg")) offenders.push(m[1].trim());
  }
  assert.ok(seen >= 4, `expected the .button rules to still be here, found ${seen}`);
  assert.deepEqual(
    offenders,
    [],
    `these generic-button rules follow the theme colour again: ${offenders.join(" / ")}`,
  );
});

test("a new theme colour survives an unrelated save", () => {
  // These payloads are a full replace: a field they do not name is cleared, so
  // saving the homepage would wipe a colour set in the site settings.
  /* A bare file-wide `includes(key)` was satisfied by any mention of the name,
     and each of these files mentions them twice — so deleting the line under
     test did not turn this red. The three files also make the guarantee in two
     different ways, which one shared assertion could not express:
     · siteActions is where the colour is EDITED, so it reads the submitted form
     · the other two must CARRY the stored value forward, because their payload
       is a full replace and a key they omit is cleared. */
  const source = (from: string) => `${from}: String(formData`;
  const carried = (from: string) => `${from}: site.theme_config?.`;

  const siteActions = readCode("app/admin/modules/siteActions.ts");
  for (const key of ["nav_button_bg", "footer_button_bg"]) {
    assert.ok(
      siteActions.includes(source(key)),
      `siteActions no longer reads ${key} out of the submitted form`,
    );
  }

  const homepage = readCode("app/admin/modules/homepageActions.ts");
  for (const key of ["nav_button_bg", "footer_button_bg"]) {
    assert.ok(
      homepage.includes(`${key}: theme.`),
      `saving the homepage clears ${key} instead of carrying it forward`,
    );
  }

  const villaPages = readCode("app/admin/modules/propertyPagesActions.ts");
  for (const key of ["nav_button_bg", "footer_button_bg"]) {
    assert.ok(
      villaPages.includes(carried(key)),
      `saving a villa page clears ${key} instead of carrying it forward`,
    );
  }
});

test("the hero block's own settings are read", () => {
  // 高度 / 標題 / 副標 / two colour pickers all existed and none was read.
  const src = readCode("app/modules/home/HomeHeroCarousel.tsx");
  for (const key of ["config?.height", "blockTitle", "blockSubtitle", "blockScrollLabel", "titleColor", "subtitleColor"]) {
    assert.ok(src.includes(key), `the hero block ignores ${key}`);
  }
  assert.ok(
    src.includes('["small", "medium", "large", "full"].includes'),
    "the hero height reaches a class name unchecked",
  );
  const editor = readCode("app/admin/modules/blockForms.tsx");
  assert.ok(editor.includes('resolveHeroScrollLabel(c.scroll_label, editLocale)'), "the hero block has no bilingual scroll cue field");
  assert.ok(editor.includes('setVal(c, "scroll_label", editLocale'), "the hero block scroll cue is not saved per locale");
});

test("the hero CTA comes from the banner it sits on", () => {
  // Every banner carries cta_label and cta_href. The label was editable in the
  // admin and thrown away, and the button always went to /stays however the
  // banner was worded.
  const src = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.ok(src.includes('trs(active, "cta_label"'), "the banner's CTA label is ignored again");
  assert.ok(src.includes("safeLinkHref(active?.cta_href)"), "the banner's CTA link is ignored again");
  // It is admin text that becomes an href, so it must be checked.
  assert.ok(src.includes("safeLinkHref("), "the CTA link reaches an href unchecked");

  const editor = readCode("app/admin/(dashboard)/cms/BannerFormEditor.tsx");
  assert.ok(editor.includes('name="cta_href"'), "a banner has no way to set its CTA link");
});

test("the Instagram gradient id cannot drift between server and client", () => {
  // It was built from useId(), which is only stable while server and client
  // render the same tree in the same order. This icon appears in the site
  // header, the villa header and the mobile menu, the counter drifted, and
  // hydration reported a mismatch on both the <radialGradient id> and the
  // <rect fill> that points at it — which React does not patch up, so the fill
  // could reference an id that is not in the document.
  const src = readCode("app/modules/icons/SocialIcons.tsx");
  // Matched against code with comments stripped: the note above the fix
  // names the hook it replaced, and a raw search reads that as a relapse.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!code.includes("useId"), "the gradient id is generated per-render again");
  assert.ok(src.includes('const id = "ig-grad"'), "the gradient id is no longer deterministic");
});

test("the header's top state stays transparent regardless of the setting", () => {
  // 客戶: 滑下來的 navbar 應該是白色，在最上方固定是透明.
  // The two states are meant to look opposite — transparent with white type
  // over the hero, a solid bar with dark type once scrolled. One variable
  // driving both meant setting it to transparent hid the scrolled nav
  // entirely: no background and white text on white.
  const css = readStyles("app/globals.css");
  /* Every rule for the top state, not the last one. `.site-header {` appears
     five times; a negative assertion that reads one of them proves nothing —
     wiring --nav-bg into the base rule left this green. */
  const tops: string[] = [];
  for (let at = css.indexOf(".site-header {"); at > -1; at = css.indexOf(".site-header {", at + 1)) {
    tops.push(css.slice(at, css.indexOf("}", at)));
  }
  assert.ok(tops.length, ".site-header has no rule at all");
  assert.ok(
    tops.some((r) => r.includes("background: transparent")),
    "the top state follows the setting again",
  );
  const wired = tops.filter((r) => r.includes("--nav-bg"));
  assert.deepEqual(wired, [], "a top-state rule is wired to --nav-bg again");

  const scrolledAt = css.lastIndexOf(".site-header.is-scrolled {");
  const scrolled = css.slice(scrolledAt, css.indexOf("}", scrolledAt));
  assert.ok(scrolled.includes("var(--nav-bg"), "the scrolled bar no longer follows the setting");
  assert.ok(scrolled.includes("var(--nav-text"), "the scrolled bar's text no longer follows the setting");
});

test("the newsletter icon cannot push the form out of the band", () => {
  // The band's grid is two columns — what it is, then how to subscribe. The
  // icon was rendered as a third grid child, so on every surface except the
  // contact page (which carried its own three-column override) the form was
  // pushed onto its own row and the block fell apart. The icon belongs with
  // the copy it decorates.
  const src = readCode("app/modules/home/blocks/BlockNewsletter.tsx");
  const inner = src.slice(src.indexOf("block-newsletter-inner"), src.indexOf("</section>"));
  const head = inner.indexOf("block-newsletter-head");
  const icon = inner.indexOf("block-newsletter-icon");
  const copy = inner.indexOf("block-newsletter-copy");
  const form = inner.indexOf("block-newsletter-form");
  assert.ok(head > -1, "the icon/copy wrapper is gone");
  assert.ok(head < icon && icon < copy, "the icon is no longer wrapped with the copy");
  assert.ok(copy < form, "the form must follow the head, as the second grid child");

  // And the disc must be styled for the block, not for one page.
  const css = readStyles("app/globals.css");
  assert.ok(
    css.includes("\n.block-newsletter-icon {"),
    "the icon disc is scoped to a page again, so it is unstyled elsewhere",
  );
});

test("the contact page's stacked panels sit on even whitespace", () => {
  // 客戶: 留白(上下)要一樣 — the section had a deliberately heavier bottom, so
  // the band sat far below the offices and close to the enquiry sheet.
  const css = readStyles("app/globals.css");
  const at = css.lastIndexOf(".contact-page .contact-split {");
  assert.ok(at > -1, "the contact spacing rule is gone");
  const rule = css.slice(at, css.indexOf("}", at));
  const pad = rule.match(/padding-block:\s*([^;]+);/);
  const gap = rule.match(/gap:\s*([^;]+);/);
  assert.ok(pad && gap, "padding-block and gap must both be set");
  assert.equal(pad[1].trim(), gap[1].trim(), "the gap between panels must match the space around them");
});

test("every page-level field can be cleared, not only set", () => {
  // The saved object is spread over ...existingPage, so a key the save omits
  // keeps whatever was stored before. Each of these was written conditionally
  // (omitted when empty), so a hero image, title, subtitle, colour, height or
  // alignment could be set and then never removed: clearing the field and
  // saving put the old value straight back. `anchor` had the same bug and was
  // fixed on its own; these seven were missed.
  const src = readCode("app/admin/modules/propertyPagesActions.ts");
  const start = src.indexOf("[pageKey]: {");
  assert.ok(start > -1, "the page payload is gone");
  const lines = src
    .slice(start)
    .split(String.fromCharCode(10))
    .slice(0, 40)
    .map((l) => l.trim());

  for (const key of [
    "hero_image",
    "hero_title",
    "hero_subtitle",
    "hero_title_color",
    "hero_subtitle_color",
    "hero_height",
    "hero_align",
    "anchor",
  ]) {
    assert.ok(
      lines.some((l) => l.startsWith(key + ":")),
      key + " is not written on every save, so an emptied field cannot clear it",
    );
    assert.ok(
      !lines.some((l) => l.includes("{ " + key + ":")),
      key + " is written conditionally again",
    );
  }
});

test("a hero title the editor cleared stays cleared", () => {
  // The fallback is for a hero nobody has touched. Once the key is in the page
  // config, emptying the field and saving must show no title — putting the
  // bundled copy back makes the field look broken, because clearing it appears
  // to do nothing.
  const src = readCode("app/modules/content/PageHero.tsx");
  assert.ok(src.includes('"hero_title" in config'), "an emptied title falls back to bundled copy again");
  assert.ok(src.includes('"hero_subtitle" in config'), "an emptied subtitle falls back again");
  assert.ok(src.includes("{title && <Heading"), "an empty title still renders a heading element");
});

test("the contact page's spacing follows the site's spacing setting", () => {
  // It was a bare clamp(), so 版面 → 區塊上下間距 could not move this page, and
  // the band's spacing was a margin that swamped each block's own 上下留白.
  const css = readStyles("app/globals.css");
  const at = css.lastIndexOf(".contact-page .property-block-contained {");
  assert.ok(at > -1, "the contact block spacing rule is gone");
  const rule = css.slice(at, css.indexOf("}", at));
  assert.ok(rule.includes("padding-block"), "spacing is not padding, so the admin value cannot override it");
  assert.ok(rule.includes("var(--block-y"), "spacing ignores the site's 區塊上下間距 setting");
});

test("a paired image is centred by default and fills only when asked", () => {
  // Paired beside a taller block the picture sat at the top with empty page
  // beneath it. It is centred against its neighbour now, and stretches only
  // when the block's 並排時圖片填滿欄高 is ticked.
  // Filling uses flex, not `height: 100%` down the chain: a child asking for
  // 100% of a parent whose height comes from its content is circular, and
  // measured on the live page that ran the whole pair up to 3393px.
  const css = readStyles("app/globals.css");
  // From the section comment, not lastIndexOf: the last match is the mobile
  // override inside the media query, which deliberately has no centring.
  /* Every rule with this selector, not a positional guess at which one matters.
     There are four — padding reset, height, the flex column that does the
     centring, and a phone override that undoes it — and this test first found
     the right one by searching forward from a SECTION COMMENT, so rewording the
     comment failed the test and blamed the rule for being gone. Collecting them
     and asking which does the centring says what is actually guaranteed. */
  const bodies: string[] = [];
  for (let at = css.indexOf(".property-block-pair .property-image-gallery {"); at > -1;
       at = css.indexOf(".property-block-pair .property-image-gallery {", at + 1)) {
    bodies.push(css.slice(at, css.indexOf("}", at)));
  }
  assert.ok(bodies.length >= 3, `expected the paired-gallery rules, found ${bodies.length}`);
  const centring = bodies.filter((b) => b.includes("justify-content: center"));
  assert.equal(
    centring.length,
    1,
    `expected exactly one rule to centre the paired image, found ${centring.length}`,
  );
  assert.ok(centring[0].includes("display: flex"), "the centring rule is no longer a flex column");

  const fillAt = css.lastIndexOf(".property-block-pair .property-image-gallery.is-fill-height .scroll-rail");
  assert.ok(fillAt > -1, "the opt-in fill rule is gone");
  const fill = css.slice(fillAt, css.indexOf("}", fillAt));
  assert.ok(fill.includes("flex:"), "the rail no longer takes the leftover space");
  assert.ok(fill.includes("min-height: 0"), "without min-height:0 the flex item cannot shrink");
  assert.ok(!fill.includes("height: 100%"), "the circular height is back on the rail");

  // And the toggle has to exist for any of it to be reachable.
  const block = readCode("app/modules/property/blocks/BlockImageGallery.tsx");
  assert.ok(block.includes("config.fill_height === true"), "the gallery ignores the toggle");
  const admin = readCode("app/admin/modules/blockForms.tsx");
  assert.ok(admin.includes("fill_height"), "there is no way to turn filling on");
});
