import { responsivePad } from "./blockStyle";

/**
 * Per-site font presets.
 *
 * The root layout loads four font families as CSS variables on <html>:
 *   --font-display    Cormorant Garamond (latin display serif)
 *   --font-playfair   Playfair Display   (latin editorial serif)
 *   --font-serif-tc   Noto Serif TC      (Chinese serif, body default)
 *   --font-sans-tc    Noto Sans TC       (Chinese sans, UI default)
 *
 * globals.css :root maps --font-title / --font-body / --font-ui to these.
 * Each site can pick a preset (stored in settings.font_preset); we override
 * those three variables on the site wrapper so the choice is scoped per site.
 * "classic" returns no overrides (uses the globals.css defaults).
 */

export type FontPreset =
  | "classic"
  | "editorial"
  | "modern"
  | "warm"
  | "resort"
  | "coastal"
  | "boutique"
  | "elegant"
  | "script"
  | "kai";

const SERIF_TC = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';
const SANS_TC = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
// 霞鶩文楷 — full Traditional-Chinese kaisho/handwriting face loaded via Google Fonts
// in app/layout.tsx. Used by the "kai" preset to change the *whole* site's Chinese
// text (title + body + UI), since most other presets only vary the latin display font.
const KAI_TC = `"LXGW WenKai TC", ${SERIF_TC}`;
/* The same face with the DOWNLOADED Noto Serif TC behind it rather than only the
   literal family names. `var(--font-serif-tc)` is the family next/font mints, and
   a machine with no Noto Serif TC installed cannot reach it by name — so without
   the var a glyph 文楷 lacks falls to whatever the system happens to have.
   Kept separate from KAI_TC rather than merged into it: KAI_TC is what the legacy
   `kai` PRESET renders on live sites, and widening its fallback would change what
   those sites draw. This one is what the font MENUS resolve to, where 楷書 has
   always carried the var (CJK_FACES.kai). */
const KAI_STACK = `"LXGW WenKai TC", var(--font-serif-tc), ${SERIF_TC}`;

export function fontPresetVars(preset: string | undefined): Record<string, string> {
  switch (preset) {
    case "editorial":
      return {
        "--font-title": `var(--font-playfair), var(--font-serif-tc), "Playfair Display", ${SERIF_TC}`,
        "--font-body": `var(--font-serif-tc), ${SERIF_TC}`,
        "--font-ui": `var(--font-sans-tc), ${SANS_TC}`,
      };
    case "modern":
      return {
        "--font-title": `var(--font-sans-tc), ${SANS_TC}`,
        "--font-body": `var(--font-sans-tc), ${SANS_TC}`,
        "--font-ui": `var(--font-sans-tc), ${SANS_TC}`,
      };
    case "warm":
      return {
        "--font-title": `var(--font-display), var(--font-serif-tc), "Cormorant Garamond", ${SERIF_TC}`,
        "--font-body": `var(--font-sans-tc), ${SANS_TC}`,
        "--font-ui": `var(--font-sans-tc), ${SANS_TC}`,
      };
    case "resort":
      // Classical, inscriptional — evokes grand-hotel / resort signage.
      return {
        "--font-title": `var(--font-marcellus), var(--font-serif-tc), "Marcellus", ${SERIF_TC}`,
        "--font-body": `var(--font-serif-tc), ${SERIF_TC}`,
        "--font-ui": `var(--font-sans-tc), ${SANS_TC}`,
      };
    case "coastal":
      // Soft modern serif headings over a clean sans body — relaxed travel-luxe.
      return {
        "--font-title": `var(--font-fraunces), var(--font-serif-tc), "Fraunces", ${SERIF_TC}`,
        "--font-body": `var(--font-sans-tc), ${SANS_TC}`,
        "--font-ui": `var(--font-sans-tc), ${SANS_TC}`,
      };
    case "boutique":
      // Fraunces throughout (display + serif body) — characterful editorial stay.
      return {
        "--font-title": `var(--font-fraunces), var(--font-serif-tc), "Fraunces", ${SERIF_TC}`,
        "--font-body": `var(--font-serif-tc), ${SERIF_TC}`,
        "--font-ui": `var(--font-sans-tc), ${SANS_TC}`,
      };
    case "elegant":
      // High-contrast book serif — refined, understated luxury.
      return {
        "--font-title": `var(--font-ebgaramond), var(--font-serif-tc), "EB Garamond", ${SERIF_TC}`,
        "--font-body": `var(--font-serif-tc), ${SERIF_TC}`,
        "--font-ui": `var(--font-sans-tc), ${SANS_TC}`,
      };
    case "script":
      // Flowing calligraphy headings (latin) over a clean body — invitation feel.
      // CJK headings fall back to Noto Serif since script faces are latin-only.
      return {
        "--font-title": `var(--font-pinyon), var(--font-serif-tc), "Pinyon Script", ${SERIF_TC}`,
        "--font-body": `var(--font-sans-tc), ${SANS_TC}`,
        "--font-ui": `var(--font-sans-tc), ${SANS_TC}`,
      };
    case "kai":
      // 手寫楷書 — a true Traditional-Chinese handwriting face for the CONTENT
      // (headings + body) across all pages. Nav / menu / footer keep the legible
      // sans (--font-ui) like every other preset, so small UI chrome stays crisp.
      return {
        "--font-title": KAI_TC,
        "--font-body": KAI_TC,
        "--font-ui": `var(--font-sans-tc), ${SANS_TC}`,
      };
    case "classic":
    default:
      return {}; // use globals.css defaults
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Granular font picker — heading vs body, each split into a Chinese (CJK)
 * face and a Latin (English/number) face. Stored per site in
 * settings.font_config = { title_cjk, title_latin, body_cjk, body_latin }.
 * When a site has no font_config we fall back to the legacy `font_preset`
 * (fontPresetVars) so existing sites render unchanged. Nav / menu / footer
 * keep the globals.css --font-ui (sans), so this only styles page content.
 * ──────────────────────────────────────────────────────────────────────── */

/* ── What the four site menus USED to offer ──────────────────────────────
 *
 * Three lists — three Chinese faces, seven Latin heading faces, two Latin body
 * faces — against the 27 the 字級 panel already had (客戶: 站群的字體的選單也是
 * 要很多的 font 字體，中英都要，要 30+ 選項). The menus now read TYPE_FACES like
 * every other font control on the site, so there is one catalogue rather than
 * four disagreeing ones.
 *
 * These three tables stay because their KEYS are what live sites have stored:
 * `serif` / `sans` / `kai` for the Chinese slots, `cormorant` … `match` for the
 * Latin ones. TYPE_FACES spells the same faces differently (`songti`, `heiti`),
 * so nothing maps across on its own and a plain rename would have restyled every
 * saved site at once. They are no longer consulted at render time — the alias
 * table below is — and tests/siteFontCatalogue.test.mts asserts, entry by entry,
 * that every one of these keys still resolves to the very string it produces
 * here. Treat them as a frozen record of production, not as a list to extend.
 */

// Chinese faces (apply site-wide to content).
export const CJK_FACES: Record<string, string> = {
  serif: `var(--font-serif-tc), ${SERIF_TC}`,        // 宋體
  sans: `var(--font-sans-tc), ${SANS_TC}`,           // 黑體
  kai: KAI_STACK,                                    // 楷書
};

// Latin faces for HEADINGS (display flair; CJK chars fall through to the CJK face).
export const TITLE_LATIN_FACES: Record<string, string> = {
  cormorant: `var(--font-display), "Cormorant Garamond"`,
  playfair: `var(--font-playfair), "Playfair Display"`,
  fraunces: `var(--font-fraunces), "Fraunces"`,
  marcellus: `var(--font-marcellus), "Marcellus"`,
  ebgaramond: `var(--font-ebgaramond), "EB Garamond"`,
  pinyon: `var(--font-pinyon), "Pinyon Script"`,
  sans: `var(--font-sans-tc)`, // 無襯線（與中文黑體一致）
};

// Latin faces for BODY text (kept simple — serif or sans).
export const BODY_LATIN_FACES: Record<string, string> = {
  serif: `var(--font-ebgaramond), "EB Garamond", Georgia`,
  sans: `var(--font-sans-tc)`,
};

/* ── The alias layer ─────────────────────────────────────────────────────
 *
 * Old key → the TYPE_FACES key that draws the same thing. Two tables, not one,
 * because the same word means two different faces depending on the slot it was
 * stored in: `serif` in a Chinese slot is 宋體, `serif` in a Latin slot is EB
 * Garamond. One merged table would have silently swapped one for the other.
 *
 * Only the words TYPE_FACES does not already use need an entry — `cormorant`,
 * `playfair`, `kai` and the rest are spelled the same in both and resolve
 * directly. `match` is not here either: it is not a face but an instruction
 * (draw Latin in the Chinese face), handled in fontVars.
 */
export const LEGACY_CJK_ALIASES: Record<string, string> = {
  serif: "songti",
  sans: "heiti",
};

export const LEGACY_LATIN_ALIASES: Record<string, string> = {
  serif: "ebgaramond",
  sans: "heiti", // the Latin half of 思源黑體 — same var the old `sans` pointed at
};

export type FontConfig = {
  title_cjk?: string;
  title_latin?: string;
  body_cjk?: string;
  body_latin?: string;
};

// Default 4-way config derived from each legacy preset — used for the admin
// form's initial values so editing a preset site starts from its current look.
export function presetToFontConfig(preset: string | undefined): Required<FontConfig> {
  const M: Record<string, Required<FontConfig>> = {
    classic: { title_latin: "cormorant", title_cjk: "serif", body_latin: "serif", body_cjk: "serif" },
    editorial: { title_latin: "playfair", title_cjk: "serif", body_latin: "serif", body_cjk: "serif" },
    modern: { title_latin: "sans", title_cjk: "sans", body_latin: "sans", body_cjk: "sans" },
    warm: { title_latin: "cormorant", title_cjk: "serif", body_latin: "sans", body_cjk: "sans" },
    resort: { title_latin: "marcellus", title_cjk: "serif", body_latin: "serif", body_cjk: "serif" },
    coastal: { title_latin: "fraunces", title_cjk: "serif", body_latin: "sans", body_cjk: "sans" },
    boutique: { title_latin: "fraunces", title_cjk: "serif", body_latin: "serif", body_cjk: "serif" },
    elegant: { title_latin: "ebgaramond", title_cjk: "serif", body_latin: "serif", body_cjk: "serif" },
    script: { title_latin: "pinyon", title_cjk: "serif", body_latin: "sans", body_cjk: "sans" },
    kai: { title_latin: "ebgaramond", title_cjk: "kai", body_latin: "serif", body_cjk: "kai" },
  };
  return M[preset ?? "classic"] ?? M.classic;
}

/**
 * A stored (or preset-derived) font_config with every slot spelled in catalogue
 * keys — what the admin form's four menus are listing.
 *
 * Without this a site still holding `title_cjk: "serif"` would open the form
 * with NOTHING selected in that menu: a <select> whose value matches no option
 * renders unselected, showing the first option instead, and the next save would
 * post that wrong face. So the legacy word is translated on the way in, the menu
 * opens on the face the site is actually using, and the save writes the
 * catalogue key from then on. `match` passes through untouched — it names an
 * instruction (draw Latin in the Chinese face), not a face.
 */
export function canonicalFontConfig(fc: FontConfig | undefined): Required<FontConfig> {
  const latin = (v: unknown, fallback: string) =>
    String(v ?? "") === "match" ? "match" : (latinFaceKey(v) || fallback);
  return {
    title_cjk: cjkFaceKey(fc?.title_cjk) || "songti",
    title_latin: latin(fc?.title_latin, "cormorant"),
    body_cjk: cjkFaceKey(fc?.body_cjk) || "songti",
    body_latin: latin(fc?.body_latin, "ebgaramond"),
  };
}

/**
 * Resolve a site's content font CSS variables. Prefers the granular
 * settings.font_config; falls back to the legacy font_preset for sites that
 * haven't been migrated, so nothing changes until they save the new fields.
 */
export function fontVars(settings: Record<string, unknown> | undefined): Record<string, string> {
  const fc = settings?.font_config as FontConfig | undefined;
  // No granular config → keep exact legacy behaviour.
  if (!fc || !fc.title_cjk) {
    return fontPresetVars(typeof settings?.font_preset === "string" ? settings.font_preset : undefined);
  }
  /* Every slot goes through the one catalogue, with the legacy words aliased on
     the way in — so a site still storing `serif` renders exactly what it renders
     today, and a site saved from the new menus can name any of the 40-odd faces.
     An unrecognised key falls back to the same face it always did rather than
     emitting nothing: this is the whole site's body text, and no font-family at
     all would drop it to the browser's default. */
  const tc = cjkFaceStack(fc.title_cjk) || cjkFaceStack("serif");
  const bc = cjkFaceStack(fc.body_cjk) || cjkFaceStack("serif");
  /* "match" means: draw Latin in the Chinese face too. The Noto TC families
     carry a full Latin set, so English then renders in the same face as the
     Chinese beside it instead of in a separate display serif.
     Until this existed, only 黑體 had a Latin twin (the `sans` entry); a site
     on 宋體 had no way to ask for the same face and English always came out as
     EB Garamond or Cormorant (客戶: 英文字體如何設定成與中文一樣). */
  const tl = fc.title_latin === "match"
    ? tc
    : (latinFaceHead(fc.title_latin) || latinFaceHead("cormorant"));
  const bl = fc.body_latin === "match"
    ? bc
    : (latinFaceHead(fc.body_latin) || latinFaceHead("serif"));
  return {
    "--font-title": `${tl}, ${tc}, ${SERIF_TC}`,
    "--font-body": `${bl}, ${bc}, ${SERIF_TC}`,
    // Nav / menu / footer intentionally untouched — they use globals' --font-ui (sans).
  };
}

/**
 * Per-level type scale from site settings.
 *
 * Marking a paragraph as H2 in the editor says what it *is*; this says how big
 * an H2 looks on this site. Keeping the two apart is what lets a later change
 * to the site's typography move every heading at once, instead of leaving
 * behind text that someone sized by hand.
 *
 * Only levels that have been configured emit a variable. Every rule in
 * globals.css reads `var(--type-h2-size, <the existing clamp>)`, so a site that
 * has never opened this panel renders exactly as it does today.
 */
/* ── Faces a type level may be set to ────────────────────────────────
   THE catalogue. One list for every font control on the site — the type scale,
   the four site-wide menus, and a block or banner's per-role face — so a heading
   and its body text are chosen the same way rather than through separate
   title/body controls that only ever offered a handful each. Every face ends in
   the Chinese stack: a Latin face has no Chinese glyphs, and without the
   fallback the browser picks one at random.

   The first group is downloaded (loaded once in app/layout.tsx); everything
   after it is already on the reader's machine, so the list is long without the
   page paying for it. That is also the rule for extending it: a
   Traditional-Chinese webfont is several megabytes, so the 中文 additions are
   faces Windows / macOS / iOS ship — 標楷體, 細明體, 微軟正黑體, 蘋方 — and each
   still ends in the downloaded Noto TC so a machine without the face degrades to
   something correct rather than to whatever the browser picks.

   `zh` and `en` are BARE NAMES. They used to carry a parenthetical gloss —
   宋體（思源宋體）, Cormorant（襯線）, Verdana（易讀） — which the client asked
   to be rid of (客戶: 不要加補充說明). For a Latin face the two labels are the
   same word, so anything showing both must show only one of them; see
   `faceLabel`.

   `group` is for the menus: 40 options in one flat list is a scroll, in five
   named groups it is a choice. */
export type TypeFaceGroup = "cjk" | "display" | "serif" | "sans" | "mono";

export const TYPE_FACES: Array<{ key: string; zh: string; en: string; stack: string; group: TypeFaceGroup }> = [
  // — 中文（下載） —
  { key: "songti", zh: "宋體", en: "Noto Serif TC", group: "cjk", stack: `var(--font-serif-tc), ${SERIF_TC}` },
  { key: "heiti", zh: "黑體", en: "Noto Sans TC", group: "cjk", stack: `var(--font-sans-tc), ${SANS_TC}` },
  { key: "kai", zh: "楷書", en: "LXGW WenKai TC", group: "cjk", stack: KAI_STACK },
  // — 中文（系統內建，不需下載） —
  { key: "dfkai", zh: "標楷體", en: "DFKai-SB", group: "cjk", stack: `"DFKai-SB", "BiauKai", "Kaiti TC", "STKaiti", ${SERIF_TC}` },
  { key: "mingliu", zh: "細明體", en: "MingLiU", group: "cjk", stack: `MingLiU, PMingLiU, "MingLiU_HKSCS", ${SERIF_TC}` },
  { key: "songtitc", zh: "宋體-繁", en: "Songti TC", group: "cjk", stack: `"Songti TC", "Songti SC", STSong, ${SERIF_TC}` },
  { key: "lisong", zh: "儷宋體", en: "LiSong Pro", group: "cjk", stack: `"LiSong Pro", "Apple LiSung", ${SERIF_TC}` },
  { key: "jhenghei", zh: "微軟正黑體", en: "Microsoft JhengHei", group: "cjk", stack: `"Microsoft JhengHei", "Microsoft JhengHei UI", ${SANS_TC}` },
  { key: "pingfang", zh: "蘋方", en: "PingFang TC", group: "cjk", stack: `"PingFang TC", "PingFang SC", ${SANS_TC}` },
  { key: "heititc", zh: "黑體-繁", en: "Heiti TC", group: "cjk", stack: `"Heiti TC", "Hiragino Sans CNS", ${SANS_TC}` },
  { key: "yuanti", zh: "圓體-繁", en: "Yuanti TC", group: "cjk", stack: `"Yuanti TC", "Yuanti SC", ${SANS_TC}` },
  { key: "lihei", zh: "儷黑體", en: "LiHei Pro", group: "cjk", stack: `"LiHei Pro", "Apple LiGothic", ${SANS_TC}` },
  // — 下載的拉丁字型 —
  { key: "cormorant", zh: "Cormorant", en: "Cormorant Garamond", group: "display", stack: `var(--font-display), "Cormorant Garamond", ${SERIF_TC}` },
  /* Georgia sits between EB Garamond and the Chinese tail because the legacy
     `body_latin: "serif"` stack had it there, and that key aliases here. */
  { key: "ebgaramond", zh: "EB Garamond", en: "EB Garamond", group: "display", stack: `var(--font-ebgaramond), "EB Garamond", Georgia, ${SERIF_TC}` },
  { key: "playfair", zh: "Playfair", en: "Playfair Display", group: "display", stack: `var(--font-playfair), "Playfair Display", ${SERIF_TC}` },
  { key: "fraunces", zh: "Fraunces", en: "Fraunces", group: "display", stack: `var(--font-fraunces), "Fraunces", ${SERIF_TC}` },
  { key: "marcellus", zh: "Marcellus", en: "Marcellus", group: "display", stack: `var(--font-marcellus), "Marcellus", ${SERIF_TC}` },
  { key: "pinyon", zh: "Pinyon", en: "Pinyon Script", group: "display", stack: `var(--font-pinyon), "Pinyon Script", ${SERIF_TC}` },
  // — 系統襯線 —
  { key: "georgia", zh: "Georgia", en: "Georgia", group: "serif", stack: `Georgia, "Times New Roman", ${SERIF_TC}` },
  { key: "times", zh: "Times", en: "Times New Roman", group: "serif", stack: `"Times New Roman", Times, ${SERIF_TC}` },
  { key: "palatino", zh: "Palatino", en: "Palatino", group: "serif", stack: `Palatino, "Palatino Linotype", "Book Antiqua", ${SERIF_TC}` },
  { key: "baskerville", zh: "Baskerville", en: "Baskerville", group: "serif", stack: `Baskerville, "Libre Baskerville", Georgia, ${SERIF_TC}` },
  { key: "garamond", zh: "Garamond", en: "Garamond", group: "serif", stack: `Garamond, "Apple Garamond", Georgia, ${SERIF_TC}` },
  { key: "didot", zh: "Didot", en: "Didot", group: "serif", stack: `Didot, "Bodoni MT", "Playfair Display", ${SERIF_TC}` },
  { key: "hoefler", zh: "Hoefler", en: "Hoefler Text", group: "serif", stack: `"Hoefler Text", Georgia, ${SERIF_TC}` },
  { key: "cambria", zh: "Cambria", en: "Cambria", group: "serif", stack: `Cambria, Constantia, Georgia, ${SERIF_TC}` },
  { key: "rockwell", zh: "Rockwell", en: "Rockwell", group: "serif", stack: `Rockwell, "Rockwell Nova", "Roboto Slab", Georgia, ${SERIF_TC}` },
  { key: "copperplate", zh: "Copperplate", en: "Copperplate", group: "serif", stack: `Copperplate, "Copperplate Gothic Light", "Marcellus", ${SERIF_TC}` },
  // — 系統無襯線 —
  { key: "helvetica", zh: "Helvetica", en: "Helvetica", group: "sans", stack: `Helvetica, "Helvetica Neue", Arial, ${SANS_TC}` },
  { key: "arial", zh: "Arial", en: "Arial", group: "sans", stack: `Arial, Helvetica, ${SANS_TC}` },
  { key: "avenir", zh: "Avenir", en: "Avenir", group: "sans", stack: `Avenir, "Avenir Next", "Segoe UI", ${SANS_TC}` },
  { key: "futura", zh: "Futura", en: "Futura", group: "sans", stack: `Futura, "Century Gothic", "Trebuchet MS", ${SANS_TC}` },
  { key: "optima", zh: "Optima", en: "Optima", group: "sans", stack: `Optima, Candara, "Segoe UI", ${SANS_TC}` },
  { key: "gillsans", zh: "Gill Sans", en: "Gill Sans", group: "sans", stack: `"Gill Sans", "Gill Sans MT", Calibri, ${SANS_TC}` },
  { key: "verdana", zh: "Verdana", en: "Verdana", group: "sans", stack: `Verdana, Geneva, ${SANS_TC}` },
  { key: "tahoma", zh: "Tahoma", en: "Tahoma", group: "sans", stack: `Tahoma, Geneva, ${SANS_TC}` },
  { key: "trebuchet", zh: "Trebuchet", en: "Trebuchet MS", group: "sans", stack: `"Trebuchet MS", Tahoma, ${SANS_TC}` },
  { key: "centurygothic", zh: "Century Gothic", en: "Century Gothic", group: "sans", stack: `"Century Gothic", "URW Gothic", Futura, ${SANS_TC}` },
  { key: "calibri", zh: "Calibri", en: "Calibri", group: "sans", stack: `Calibri, Candara, "Segoe UI", ${SANS_TC}` },
  { key: "lucida", zh: "Lucida", en: "Lucida Grande", group: "sans", stack: `"Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", ${SANS_TC}` },
  { key: "segoe", zh: "Segoe UI", en: "Segoe UI", group: "sans", stack: `"Segoe UI", "Segoe UI Variable Text", ${SANS_TC}` },
  { key: "system", zh: "系統預設", en: "System UI", group: "sans", stack: `system-ui, -apple-system, "Segoe UI", ${SANS_TC}` },
  /* Ends in the Chinese sans, not in `monospace`. A generic family matches every
     glyph, so a bare `monospace` tail swallowed the CJK fallback that would
     otherwise follow it — and in the site menus, where the Latin face is composed
     ahead of the Chinese one, it would have drawn all the Chinese too. */
  { key: "mono", zh: "等寬", en: "Monospace", group: "mono", stack: `ui-monospace, Menlo, Consolas, "Courier New", ${SANS_TC}` },
];

/** What a menu shows for a face. The two labels are the same word for every
 *  Latin face, so joining them unconditionally would print "Georgia Georgia";
 *  the English name is only worth adding when it says something more. */
export function faceLabel(face: { zh: string; en: string }, zh: boolean): string {
  if (!zh) return face.en;
  return face.zh === face.en ? face.zh : `${face.zh} · ${face.en}`;
}

export const TYPE_FACE_GROUP_LABELS: Record<TypeFaceGroup, [string, string]> = {
  cjk: ["中文字體", "Chinese"],
  display: ["設計字體", "Display"],
  serif: ["襯線字體", "Serif"],
  sans: ["無襯線字體", "Sans-serif"],
  mono: ["等寬字體", "Monospace"],
};

export const TYPE_FACE_GROUP_ORDER: TypeFaceGroup[] = ["cjk", "display", "serif", "sans", "mono"];

const TYPE_FACE_BY_KEY: Record<string, string> = Object.fromEntries(
  TYPE_FACES.map((f) => [f.key, f.stack]),
);

/** The face a level was set to, or "" when it was left on the theme's own. */
export function safeFace(v: unknown): string {
  // hasOwn, not a bare lookup: "constructor" and friends resolve on
  // Object.prototype, and ?? does not catch a function, so the value would be
  // stringified into a font-family declaration.
  const key = String(v ?? "");
  return Object.prototype.hasOwnProperty.call(TYPE_FACE_BY_KEY, key) ? TYPE_FACE_BY_KEY[key] : "";
}

/**
 * The catalogue key a stored site-font value names, or "" when it names none.
 *
 * Two hasOwn calls and never a bare lookup, for the same reason safeFace has
 * one: both the alias table and the catalogue are plain objects, so
 * `aliases["constructor"]` and `BY_KEY["toString"]` both resolve to a function
 * on Object.prototype — and a function stringified into an inline font-family
 * is admin input reaching a style attribute unchecked.
 */
function faceKey(raw: unknown, aliases: Record<string, string>): string {
  const stored = String(raw ?? "");
  const key = Object.prototype.hasOwnProperty.call(aliases, stored) ? aliases[stored] : stored;
  return Object.prototype.hasOwnProperty.call(TYPE_FACE_BY_KEY, key) ? key : "";
}

/** The catalogue key a Chinese slot names, legacy words included. */
export function cjkFaceKey(raw: unknown): string {
  return faceKey(raw, LEGACY_CJK_ALIASES);
}

/** The catalogue key a Latin slot names, legacy words included. */
export function latinFaceKey(raw: unknown): string {
  return faceKey(raw, LEGACY_LATIN_ALIASES);
}

/** The full stack for one of the two Chinese slots. */
export function cjkFaceStack(raw: unknown): string {
  const key = cjkFaceKey(raw);
  return key ? TYPE_FACE_BY_KEY[key] : "";
}

/**
 * A face with its Chinese tail removed, for one of the two Latin slots.
 *
 * fontVars composes `<latin>, <chinese>, <fallback>`, so a Latin face that
 * brought its own Chinese tail would put that tail AHEAD of the face the site
 * actually chose for Chinese: a site on 黑體 headings with Cormorant Latin would
 * have drawn its Chinese in Noto **Serif**, because Cormorant's own fallback got
 * there first. Stripping the tail is also what makes the legacy keys resolve to
 * the byte-identical strings TITLE_LATIN_FACES / BODY_LATIN_FACES held.
 */
export function latinFaceHead(raw: unknown): string {
  const key = latinFaceKey(raw);
  if (!key) return "";
  const stack = TYPE_FACE_BY_KEY[key];
  for (const tail of [SERIF_TC, SANS_TC]) {
    if (stack.endsWith(`, ${tail}`)) return stack.slice(0, stack.length - tail.length - 2);
  }
  return stack;
}

export type TypeScale = Record<string, { size?: string; weight?: string; line?: string; font?: string }>;

const TYPE_LEVELS = ["h1", "h2", "h3", "h4", "body", "small"] as const;

/** A CSS length we are willing to inline: a number with a unit, or a clamp(). */
export function safeLength(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  /* First, and for both branches. `/` and `*` are in the class below because
     calc() needs them, so `/*` spells a CSS comment — and an unterminated one
     runs to the end of the style attribute, taking every declaration after it
     with it. `roleTypeVars` writes twenty properties into one attribute, so a
     mistyped eyebrow SIZE silently voided the title, body and cta panels: the
     same hole safeCssValue closes, reached through the other sanitiser.
     Measured through react-dom's own SSR, not reasoned about. It also stops a
     comment placed between a function's name and its paren, which walks past
     both the blocklist below and callsAllowed — neither of them sees a function
     call at all once a comment splits the token. */
  if (s.includes("/*") || s.includes("*/")) return "";
  /* The units a designer actually types. `%` is here because safeTypeLength —
     the sanitiser behind 基準字級, two fields up the same panel — has always
     accepted it, and one panel rejecting what the other takes is a bug report
     waiting to happen. Four digits, so 1000px is a size rather than an error. */
  if (/^\d{1,4}(\.\d+)?(px|rem|em|%|vw|vh)$/.test(s)) return s;
  // clamp()/calc() are how the responsive steps are written, so allow them —
  // but only the arithmetic they actually need. An earlier version accepted any
  // letters inside the parens, which let clamp(1px,url(x),2px) through: a CSS
  // url() inside a length still fetches.
  if (/(url|image|element|expression|attr|var)\s*\(/i.test(s)) return "";
  if (!/^(clamp|calc|min|max)\([\d.,\s%a-z()+*/-]{1,80}\)$/i.test(s)) return "";
  // Balanced, and every call named. The blocklist above is a blocklist: it does
  // not match `image-set(`, `src(` or `paint(` — the hyphen and the different
  // spellings walk straight past it. Naming what is allowed closes that, and
  // the balance check closes the other half: `calc(()` passed the pattern, and
  // an unclosed function swallows the rest of the attribute exactly as a
  // comment does.
  return balanced(s) && callsAllowed(s, LENGTH_FUNCTIONS) ? s : "";
}

export function safeWeight(v: unknown): string {
  const s = String(v ?? "").trim();
  return /^(100|200|300|400|500|600|700|800|900)$/.test(s) ? s : "";
}

function safeLine(v: unknown): string {
  const s = String(v ?? "").trim();
  return /^\d(\.\d+)?$/.test(s) ? s : "";
}

/* ── Theme colours ──────────────────────────────────────────────
   theme_config lands in an inline style on every page, so its values are CSS a
   site admin controls. Villa sites share an origin with the group site, and
   that is the boundary worth holding: a colour must not be able to fetch a URL.
   pageBg was the sharp one — it feeds the `background` shorthand, where
   url(https://…) is perfectly valid and would call out on every page load. */

/** Parens all closed, and never closed more than opened. */
function balanced(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

/** Every `name(` in the string is one we expect. */
function callsAllowed(s: string, allowed: string[]): boolean {
  const call = /([a-zA-Z][a-zA-Z0-9-]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = call.exec(s)) !== null) {
    if (!allowed.includes(m[1].toLowerCase())) return false;
  }
  return true;
}

/* No "var": the blocklist above rejects `var(` outright, so naming it here only
   made the two disagree with each other. A custom property is not needed to
   express a size in this box, and leaving it out keeps one answer to "what may
   appear inside a length". */
const LENGTH_FUNCTIONS = ["clamp", "calc", "min", "max"];

const COLOR_FUNCTIONS = [
  "rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch",
  "color", "color-mix", "var", "calc", "clamp", "min", "max",
];

const BACKGROUND_FUNCTIONS = [
  ...COLOR_FUNCTIONS,
  "linear-gradient", "radial-gradient", "conic-gradient",
  "repeating-linear-gradient", "repeating-radial-gradient", "repeating-conic-gradient",
];

function safeCssValue(v: unknown, allowed: string[]): string {
  const s = String(v ?? "").trim();
  if (!s || s.length > 200) return "";
  // A colour needs no quote, semicolon, brace, backslash or angle bracket, and
  // each of those is a way out of the declaration it sits in.
  if (!/^[-a-zA-Z0-9#%.,()\s+*/]+$/.test(s)) return "";
  // `/` and `*` are both in the class above — they belong to calc() — so `/*`
  // spells a CSS comment, and an unterminated one runs to the end of the style
  // attribute. Same blast radius as an unclosed paren below: the declarations
  // that follow are consumed, so one bad colour silently voids the rest of the
  // role panel. Measured in a browser, not reasoned about.
  if (s.includes("/*") || s.includes("*/")) return "";
  if (!balanced(s)) return "";
  // Every function call has to be one we expect. url() cannot spell itself any
  // other way, so naming what is allowed is enough — and unlike a blocklist, a
  // function nobody thought of is rejected rather than trusted.
  return callsAllowed(s, allowed) ? s : "";
}

/** A colour we are willing to inline. Returns "" for anything else. */
export function safeCssColor(v: unknown): string {
  return safeCssValue(v, COLOR_FUNCTIONS);
}

/** As safeCssColor, plus the gradient functions a page background may use. */
export function safeCssBackground(v: unknown): string {
  return safeCssValue(v, BACKGROUND_FUNCTIONS);
}

/**
 * 主色 / 強調色 for a site that has never picked one.
 *
 * There were four of these pairs. globals.css `:root` said #202820/#8a6b42,
 * themeVars below said #283d34/#a56d43, the picker in 網站設定 showed
 * #2f4638/#b78b58, and the save paths wrote #2f4638/#b78b58 into theme_config
 * the first time ANY tab was saved. So a site with no colour of its own was
 * shown one pair, drew a second, and silently became a third — and because
 * themeVars always emits both variables on the site wrapper, the `:root` pair
 * could never reach a public page at all.
 *
 * This pair is the one the pages render today, so it is the one that survives:
 * any other choice repaints every site that has not set a colour.
 *
 * Import it — do not retype it. The picker default, the four save-payload
 * defaults and the fallback below all read these two constants.
 */
export const DEFAULT_PRIMARY_COLOR = "#283d34";
export const DEFAULT_ACCENT_COLOR = "#a56d43";

/** The CSS custom properties a site's theme_config sets, validated. Shared by
 *  the group layout and the villa layout, which built this list twice. */
export function themeVars(theme: Record<string, string> | undefined): Record<string, string> {
  const cfg = theme ?? {};
  const out: Record<string, string> = {
    "--forest": safeCssColor(cfg.primaryColor) || DEFAULT_PRIMARY_COLOR,
    "--accent": safeCssColor(cfg.accentColor) || DEFAULT_ACCENT_COLOR,
  };
  /* Same trap as --block-y: --accent-text was derived from --accent once on
     :root, so a site with its own accent still got the stock gold text shade on
     every eyebrow, chip and small CTA. Derived here instead, from the accent
     this site actually resolved to. */
  out["--accent-text"] = `color-mix(in srgb, ${out["--accent"]} 76%, #000)`;
  const optional: Array<[string, string]> = [
    ["navBg", "--nav-bg"],
    ["navText", "--nav-text"],
    ["footerBg", "--footer-bg"],
    ["footerText", "--footer-text"],
    ["buttonBg", "--button-bg"],
    ["buttonText", "--button-text"],
    /* The 立即預約 button in the header and the 訂閱 button in the footer are
       two different buttons in two different places, so they get two settings
       rather than one shared 按鈕 colour that repaints both — and neither
       touches the ordinary .button used throughout the page body. */
    ["navButtonBg", "--nav-button-bg"],
    ["navButtonText", "--nav-button-text"],
    ["footerButtonBg", "--footer-button-bg"],
    ["footerButtonText", "--footer-button-text"],
  ];
  for (const [key, cssVar] of optional) {
    const value = safeCssColor(cfg[key]);
    if (value) out[cssVar] = value;
  }
  return out;
}

/** The page-background style a theme sets, or nothing when it sets none. */
export function pageBackgroundStyle(
  theme: Record<string, string> | undefined
): { background: string; minHeight: string } | Record<string, never> {
  const bg = safeCssBackground(theme?.pageBg);
  return bg ? { background: bg, minHeight: "100vh" } : {};
}

/** Page rhythm the site owner controls: how much room runs down the sides, how
 *  far apart the blocks sit, and how large the small furniture (icons, footer,
 *  captions) is drawn. All three were fixed in the stylesheet, so "the gaps are
 *  too big" and "the icons are too small" were both a deploy. */
/* Steps spread wide enough that switching one is obvious, not a couple of pixels
   (客戶: 感覺沒變化). Each roughly doubles the side room of the one before it. */
const SPACE_STEPS: Record<string, string> = {
  narrow: "clamp(12px, 2vw, 40px)",
  normal: "clamp(28px, 6vw, 112px)",
  wide: "clamp(56px, 11vw, 220px)",
};

/* The whole ladder moved down a step. Measured on the live sites, two adjacent
   blocks sat ~148px apart at 1440px — the client asked for 「大概一半一半就好
   了」「甚至更少」and 「區塊跟區塊中間的間距要再調再窄一點，要密集一點」across
   both the group site and the villa, and both are on `normal`.
   Halving `normal` on its own would have collapsed it into `tight`, so what was
   normal is now roomy and each step keeps its distance from the next — a site
   that wants the old rhythm has it one setting away rather than not at all. */
const SECTION_STEPS: Record<string, string> = {
  tight: "clamp(14px, 2vw, 26px)",
  normal: "clamp(22px, 2.7vw, 38px)",
  roomy: "clamp(40px, 5vw, 72px)",
};

/** 0.85–1.4: below that text stops being legible, above it the furniture
 *  competes with the content it is meant to sit beside. */
function safeScale(raw: unknown): string {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 0.85 || n > 1.4) return "";
  return String(n);
}

export function layoutVars(settings: Record<string, unknown> | undefined): Record<string, string> {
  const layout = (settings?.layout ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};

  const gutter = String(layout.gutter ?? "");
  if (SPACE_STEPS[gutter]) out["--gutter"] = SPACE_STEPS[gutter];
  // A hand-typed px gutter is a desktop figure; on a phone it would eat the
  // screen, so it caps the same way a block's own side spacing does — the same
  // function, not the same formula typed twice: both write --gutter, and the
  // site gutter and a block's own must give way at the same width. The named
  // steps are already clamp()s and need no help.
  else if (/^\d{1,3}$/.test(gutter)) out["--gutter"] = responsivePad(Number(gutter));
  /* The same value under a second name, emitted only when the site has actually
     set one. :root defines --gutter as the stock rhythm, so `var(--gutter, X)`
     can never reach X — a container that wants to keep its own narrower default
     until the setting is used has no way to express that with --gutter alone.
     The contact page, the category index and the content detail page each
     hard-coded a narrower gutter for exactly that reason, and so ignored the
     setting entirely. Same trick as --block-pad-x at the block level. */
  if (out["--gutter"]) out["--site-gutter"] = out["--gutter"];

  const section = String(layout.section_gap ?? "");
  if (SECTION_STEPS[section]) out["--section-y"] = SECTION_STEPS[section];
  else if (/^\d{1,3}$/.test(section)) out["--section-y"] = `${section}px`;
  /* --block-y is what every .page-block-* rule spaces itself by, and it was
     derived once on :root as calc(var(--section-y) * .85). A custom property is
     substituted on the element that declares it, so redefining --section-y down
     here could never change a --block-y inherited from :root — the admin's
     區塊上下間距 moved .section padding and left every CMS block on the default
     rhythm. Derived again wherever --section-y is, so the two stay in step. */
  if (out["--section-y"]) out["--block-y"] = `calc(${out["--section-y"]} * 0.85)`;

  const ui = safeScale(layout.ui_scale);
  if (ui) out["--ui-scale"] = ui;

  return out;
}

export function typeScaleVars(settings: Record<string, unknown> | undefined): Record<string, string> {
  const scale = settings?.type_scale as TypeScale | undefined;
  if (!scale || typeof scale !== "object") return {};
  const out: Record<string, string> = {};
  for (const level of TYPE_LEVELS) {
    const cfg = scale[level];
    if (!cfg) continue;
    const size = safeLength(cfg.size);
    const weight = safeWeight(cfg.weight);
    const line = safeLine(cfg.line);
    // Only a key from the list resolves to a stack, so nothing a caller invents
    // reaches a font-family declaration.
    const face = safeFace(cfg.font);
    if (size) out[`--type-${level}-size`] = size;
    if (weight) out[`--type-${level}-weight`] = weight;
    if (line) out[`--type-${level}-line`] = line;
    if (face) out[`--type-${level}-family`] = face;
  }
  return out;
}
