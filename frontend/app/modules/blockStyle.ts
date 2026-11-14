import type { CSSProperties } from "react";
/* The same three sanitizers the site-wide type scale already runs its values
   through, imported rather than re-derived. Each one is the record of a hole
   that was actually open: safeLength's parens rule is why
   `clamp(1px,url(x),2px)` no longer fetches, safeWeight's is why a weight
   cannot carry a second declaration, and safeCssColor's function allow-list is
   why a colour cannot. A block's role settings arrive from the same editor and
   land in the same style attribute, so a second implementation here would be a
   second set of holes to find. */
import { safeCssColor, safeFace, safeLength, safeWeight } from "./fontPresets";
/* The url() wrapper PageHero already runs its hero photo through, for the same
   reason and against the same attack: React serialises a style value verbatim,
   so a stored `x);position:fixed;inset:0` would close the url() and append its
   own declarations. One sanitiser for every image that reaches a style
   attribute rather than a second one here. */
import { cssUrl } from "./safeCss";

/**
 * The per-block styling the block editors write: background colour and opacity,
 * font size, line height, text alignment.
 *
 * This lived only inside PropertyPageRenderer's BlockWrapper, so villa pages
 * honoured it and the group homepage did not — a background set on a homepage
 * block changed the editor preview and nothing on the page. The newsletter
 * block was the exception, because it reads the key itself, which is how the
 * divergence stayed hidden.
 */
/** Spacing a block may set for itself, in px. Vertical is one number applied to
 *  both top and bottom — a block's own padding being uneven top to bottom is a
 *  mistake every time, so it is not expressible. */
export const PAD_PRESETS: Array<{ value: number; zh: string; en: string }> = [
  { value: 0, zh: "無", en: "None" },
  { value: 32, zh: "緊湊", en: "Tight" },
  { value: 56, zh: "標準", en: "Normal" },
  { value: 88, zh: "寬鬆", en: "Roomy" },
  { value: 120, zh: "很寬", en: "Spacious" },
];

/** A CSS length we will inline. Anything else is dropped rather than passed
 *  through: React serialises a style value verbatim on the server, semicolons
 *  and all, so "16px;background-image:url(…)" would become extra declarations
 *  on the block wrapper — and via the preview route that is reachable straight
 *  from a URL. The colour and padding either side of this were already checked;
 *  these three were not. */
export function safeTypeLength(raw: unknown): string {
  const v = String(raw ?? "").trim();
  /* The same units and the same digit count as safeLength, which is the
     sanitiser behind the role 字級 two fields away in the same panel. They had
     drifted apart — this one dropped `2vw` and `1000px` that the other accepts,
     so one control silently refused what its neighbour took. `i`, because 16PX
     is a legal length and was falling through to "unrecognised". */
  return /^\d{1,4}(\.\d+)?(px|rem|em|%|vw|vh)$/i.test(v) ? v : "";
}

export function safeLineHeight(raw: unknown): string {
  const v = String(raw ?? "").trim();
  if (/^\d(\.\d+)?$/.test(v)) return v;
  return /^\d{1,3}(\.\d+)?(px|rem|em|%)$/.test(v) ? v : "";
}

const TEXT_ALIGNS = new Set(["left", "center", "right", "justify"]);

/**
 * Where the copy sits against the picture in a side-by-side block.
 *
 * Three layouts had grown three different answers — 關於 centred its column,
 * the villa split centred its items, and a paired block stretched them — so
 * the same setting produced a different result depending on which one an
 * author reached for (客戶: 所有 block 的文字需要與圖片高度對齊，無論哪種版面).
 * The keys map to flex values rather than storing them, so a stored value can
 * never become an arbitrary declaration.
 */
const TEXT_VALIGNS: Record<string, string> = {
  /* Neither editor writes "top" — both spell that position as the empty string,
     labelled 從圖頂開始, and the stylesheet's own fallback is flex-start. It is
     kept as an accepted alias rather than deleted: it costs nothing, it is what
     a hand-written or migrated config is most likely to contain, and dropping it
     would send such a config down the "unrecognised value" path, which returns
     no style object at all. Offering it in the forms as a SECOND option meaning
     the same thing as the default would be the worse answer. */
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

function padValue(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 400) return null;
  return n;
}

/**
 * The editor's side spacing is a fixed px figure, which is the right unit on a
 * desktop and ruinous on a phone: "寬鬆 (88)" left 214px of a 390px screen for
 * the content, and a block set to 180 left 186px — headings broke every four
 * characters and cards shrank to a column of single words. So the number is a
 * ceiling that gives way on a narrow screen, not a constant.
 *
 * The cap used to be `8vw` alone, which quietly ate every larger figure: 8vw is
 * 154px on a 1920px monitor, so a block set to 280 rendered at 154 and the
 * editor's number did nothing at all above roughly 190. The comment here even
 * claimed the opposite. 8vw only reaches 280px on a ~3500px screen.
 *
 * The third term is what lets a large figure through: a quarter of the window
 * beyond a 320px baseline, which reaches 280px at 1440px wide and keeps growing.
 * `max()` takes whichever cap is most generous, so small screens still fall back
 * to 8vw (with the 20px floor) and behave exactly as before.
 *
 *   375px  → cap 30px   (8vw wins; a phone keeps its narrow margin)
 *   768px  → cap 112px
 *   1440px → cap 280px  (the linear term wins; 280 is honoured)
 *   1920px → cap 400px  (anything the editor allows is honoured)
 */
export function responsivePad(px: number): string {
  return `min(${px}px, max(20px, 8vw, calc((100vw - 320px) * 0.25)))`;
}

/* ── Per-role typography ────────────────────────────────────────────────
 * A block's four text roles — the small label above a heading, the heading,
 * the paragraph beneath it, the button — each get their own alignment, face,
 * size, weight and colour, stored under config._type.
 *
 * Every one is emitted as a custom property rather than a CSS property,
 * because the role a value belongs to is an element deeper in the block than
 * the wrapper this style lands on: `font-size` written here would resize the
 * whole block, not its eyebrow. The stylesheet's rules read
 * `var(--r-title-size, <the existing value>)`, which is also why an unset
 * property must emit nothing at all — an empty or "initial" value would win
 * over the fallback and flatten the block to the browser's defaults.
 */
const ROLES = ["eyebrow", "title", "body", "cta"] as const;

/* The three alignments a role may be set to, and what each one becomes for a
   CTA. One table rather than a list plus a converter: an alignment is valid
   exactly when it has an align-self to map to, so the two can never disagree
   about which values exist. The keys map to values rather than storing them,
   so a stored string can never become an arbitrary declaration. */
const ROLE_ALIGNS: Record<string, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

/* The three site roles a role's face may FOLLOW.
   Keys, not stored values: the three site faces are already resolved into
   --font-title / --font-body / --font-ui by fontVars, so a role points at one
   instead of naming a family. A stored string can therefore never become an
   arbitrary font-family declaration, and a role still follows the site when
   its fonts are changed.

   These three were the whole menu, which is why a banner's 字體 dropdown offered
   標題／內文／介面 — three ROLES — where the client was looking for a typeface
   (客戶: 字體不是標題、內文，而是 font 字體). They stay, and stay first, for two
   reasons: they are the values every live banner has stored, and "follow the
   site" is a real answer that a named face cannot give. A role may now also be
   set to any key in TYPE_FACES, resolved by safeFace — the same catalogue and
   the same allow-list the site's own type scale runs on, so the second option
   is no weaker a guard than the first. Two hasOwn lookups against two closed
   tables; nothing an author types is ever echoed into the declaration. */
const ROLE_FONTS: Record<string, string> = {
  title: "var(--font-title)",
  body: "var(--font-body)",
  ui: "var(--font-ui)",
};

/**
 * Which 排版樣式 a 精選內容 block can actually draw, per data source.
 *
 * The renderer has two branches — one over the stay catalogue, one over CMS
 * pages — and three of the six layouts exist in only one of them. 精選大圖 is
 * built from stays; 最新消息卡 and 編號列表 are built from pages. Offering all
 * six against both sources meant three of them silently rendered as 網格.
 *
 * Defined here rather than in either side so the dropdown and the renderer
 * cannot disagree: the editor lists these, the renderer falls back to `grid`
 * for anything outside them.
 */
export function staysVariantsFor(isStays: boolean): string[] {
  return isStays
    ? ["grid", "list", "compact", "feature"]
    : ["grid", "list", "compact", "index", "news"];
}

export function roleTypeVars(config: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  // Absent is the common case; a string, an array or null is what a
  // half-migrated block or a hand-edited JSON payload arrives as, and none of
  // them may throw on the way to rendering a page.
  const raw = config?._type;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const roles = raw as Record<string, unknown>;

  for (const role of ROLES) {
    const cfg = roles[role];
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) continue;
    const r = cfg as Record<string, unknown>;

    const alignKey = String(r.align ?? "");
    const align = Object.prototype.hasOwnProperty.call(ROLE_ALIGNS, alignKey) ? alignKey : "";
    // hasOwn, not a bare lookup: "constructor" and friends resolve on
    // Object.prototype, and ?? does not catch a function, so the value would
    // be stringified into a font-family declaration. safeFace is the same guard
    // over the face catalogue, so a key in neither table resolves to "" and the
    // role simply keeps the block's own face.
    const fontKey = String(r.font ?? "");
    const font = Object.prototype.hasOwnProperty.call(ROLE_FONTS, fontKey)
      ? ROLE_FONTS[fontKey]
      : safeFace(fontKey);
    const size = safeLength(r.size);
    const weight = safeWeight(r.weight);
    const color = safeCssColor(r.color);

    // Each property stands alone: a rejected size must not cost the role its
    // colour, which is what a single `if (all four) …` would do.
    if (align) {
      out[`--r-${role}-align`] = align;
      /* The CTA is `display: inline-flex; width: fit-content` inside a flex
         column, and a flex item is placed by the cross-axis rules, not by the
         parent's text-align — so --r-cta-align alone moved nothing at all.
         align-self is what places it, and it does not speak left/center/right,
         hence the second variable. Both are emitted rather than one: some CTAs
         render as a block element, and those do read text-align. */
      if (role === "cta") out["--r-cta-self"] = ROLE_ALIGNS[align];
    }
    if (font) out[`--r-${role}-font`] = font;
    if (size) out[`--r-${role}-size`] = size;
    if (weight) out[`--r-${role}-weight`] = weight;
    if (color) out[`--r-${role}-color`] = color;
  }
  return out;
}

/**
 * Block types that paint their own background, so the generic one must not.
 *
 * The newsletter draws a band with its own colour and its own 版面寬度 —
 * 滿版 or 留白置中 — and its own form (NewsletterConfigForm) deliberately
 * writes `bg_color` and strips `_bgColor` for that reason. The generic block
 * inspector offered `_bgColor` for every type regardless, and a colour set
 * there was painted twice: once by the band and once by this wrapper, which
 * also gives the wrapper `width: 100vw`, so 留白置中 could never be seen.
 * Measured on /admin/preview/block with `_bgColor: "#ff0000"` — wrapper and
 * band both rgb(255, 0, 0), both 1157.6px wide inside a 1158px window.
 *
 * Two UIs and two painters for one decision; the block's own form is the one
 * that knows, so the type is named here and both the wrapper and the inspector
 * read this list.
 */
export const SELF_PAINTING_BLOCK_TYPES: readonly string[] = ["newsletter"];

/** Whether `type` paints its own background — see SELF_PAINTING_BLOCK_TYPES. */
export function paintsOwnBackground(type: unknown): boolean {
  return typeof type === "string" && SELF_PAINTING_BLOCK_TYPES.includes(type);
}

/**
 * The side-by-side wrapper's own spacing, from the block that declares the pair.
 *
 * `.property-block-pair` carries `padding: clamp(48px, 6vw, 80px) clamp(16px,
 * 4vw, 48px)` in the stylesheet, and nothing in the admin reached it. Setting
 * 上下留白 and 左右留白 to 0 on both halves therefore changed the blocks INSIDE
 * the pair and left the wrapper at 65px / 43px on a 1199px screen — the control
 * worked, on something other than the box the client was looking at
 * (客戶: 為何上下和左右留白設定為0 還有那麼多留白?).
 *
 * Read from the FIRST block's config, which is already the pair's control
 * surface: `_pairNext` is what forms the pair at all, and `_pairReverse` and
 * `_pairDirection` are read from the same place. One block decides the pair's
 * shape; it decides its spacing too.
 *
 * Only the axes actually set are returned, so a pair nobody has touched keeps
 * the stylesheet's clamp — which is deliberately matched to a standalone
 * block's, so that "one block built from two" is spaced like its neighbours.
 * Plain px rather than `responsivePad()`: the wrapper is a container, not a
 * text column, and the blocks within it do their own narrow-screen giving-way.
 */
export function blockPairStyle(
  config: Record<string, unknown>,
  nextConfig?: Record<string, unknown>,
): CSSProperties | undefined {
  /* Outer edges only, one from each column (客戶: 並排版型留白只採取第一欄位的
     左留白與第二欄位的右留白，避免並排內容之間距離太寬). The inner edges get
     nothing: the space between the two columns is the grid gap, and padding
     there just pushes them apart twice over. Falls back to the first block's
     value when the second sets none, so a pair configured only on its first
     block still gets a symmetrical inset.

     The VERTICAL pair does not follow it, and that asymmetry is deliberate.
     PAD_PRESETS above states the rule this module keeps: "Vertical is one number
     applied to both top and bottom — a block's own padding being uneven top to
     bottom is a mistake every time, so it is not expressible." Taking the bottom
     from the second column breaks that, and it has no meaning to break it for:
     the two columns of a row pair occupy the SAME vertical band, so "the second
     one's bottom" is an arbitrary choice between two numbers, not a second edge.
     One value, from the first block, as the presets promise — and the editor
     hides 上下留白 on the second column instead, because a control that cannot
     act is worse than no control. */
  const padTop = padValue(config._padY);
  const padBottom = padTop;
  const padLeft = padValue(config._padX);
  const padRight = nextConfig ? padValue(nextConfig._padX) ?? padLeft : padLeft;
  if (padTop === null && padBottom === null && padLeft === null && padRight === null) return undefined;
  const style: CSSProperties = {};
  if (padTop !== null) style.paddingTop = `${padTop}px`;
  if (padBottom !== null) style.paddingBottom = `${padBottom}px`;
  if (padLeft !== null) style.paddingLeft = `${padLeft}px`;
  if (padRight !== null) style.paddingRight = `${padRight}px`;
  return style;
}

/** The same config with its padding keys removed.
 *
 *  Inside a pair the padding belongs to the pair wrapper, and the same config
 *  also reaches each column's own wrapper — so the first column was inset twice
 *  and the second once, which shows as misalignment under `align-items:
 *  stretch`. Stripped here rather than at the call site so both columns and any
 *  joined blocks go through one rule. */
export function withoutPad(config: Record<string, unknown>): Record<string, unknown> {
  if (config._padY === undefined && config._padX === undefined) return config;
  const rest = { ...config };
  delete rest._padY;
  delete rest._padX;
  return rest;
}

export function blockStyle(config: Record<string, unknown>, type?: string): CSSProperties | undefined {
  /* A block that paints its own background gets none from the wrapper — not
     even a stale `_bgColor` an earlier save left in its config. `_bgOpacity` is
     only ever read inside the branch below, so it falls away with it. */
  const bgColor = !paintsOwnBackground(type) && typeof config._bgColor === "string" ? config._bgColor : "";
  const bgOpacity = typeof config._bgOpacity === "number" ? config._bgOpacity : 100;
  /* A photograph behind the block, on the same terms as the colour: withheld
     from a self-painting type, and dropped outright if it is not a plausible
     URL. The colour and its opacity become the SCRIM over it rather than a
     second background — a picture with no wash under white copy is unreadable,
     and two separate opacity controls for one surface is the same confusion as
     the newsletter's two disagreeing colour fields. */
  const bgImage = !paintsOwnBackground(type) ? cssUrl(config._bgImage) : undefined;
  const fontSize = safeTypeLength(config._fontSize);
  const lineHeight = safeLineHeight(config._lineHeight);
  const textAlign = TEXT_ALIGNS.has(String(config._textAlign ?? "")) ? String(config._textAlign) : "";
  const padY = padValue(config._padY);
  const padX = padValue(config._padX);
  /* hasOwn, for the reason spelled out on ROLE_FONTS below: a bare lookup
     resolves "constructor" and "toString" on Object.prototype, `??` does not
     catch a function, and the function's source text was stringified into the
     style attribute. The one bare lookup left in this file. */
  const vAlignKey = String(config._textVAlign ?? "");
  const textVAlign = Object.prototype.hasOwnProperty.call(TEXT_VALIGNS, vAlignKey)
    ? TEXT_VALIGNS[vAlignKey]
    : "";
  const roleVars = roleTypeVars(config);

  // A block whose only setting is per-role typography still needs a style
  // object: leaving it out of this test would drop every role variable on the
  // floor and the editor's panel would do nothing at all.
  if (
    !bgColor && !bgImage && !fontSize && !lineHeight && !textAlign && !textVAlign
    && padY === null && padX === null && Object.keys(roleVars).length === 0
  ) {
    return undefined;
  }

  const style: CSSProperties = {};
  // A colour the editor could not produce is ignored rather than written out
  // as "rgba(NaN, …)", which the browser drops and which would take the
  // full-bleed geometry below with it.
  const rgb = bgColor ? hexToRgb(bgColor) : null;
  const tint = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampOpacity(bgOpacity) / 100})` : "";
  if (bgImage) {
    /* The scrim rides in the SAME declaration as the picture, as the first
       layer of a two-layer background, rather than as a backgroundColor —
       a colour sits BEHIND an opaque `cover` photo, where no amount of it is
       ever visible. A flat gradient is the ordinary way to spell "one
       translucent sheet" in a background-image list. */
    style.backgroundImage = tint ? `linear-gradient(${tint}, ${tint}), ${bgImage}` : bgImage;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
    style.backgroundRepeat = "no-repeat";
  } else if (tint) {
    style.backgroundColor = tint;
  }
  if (bgImage || tint) {
    // The band spans the viewport while the content keeps its column.
    style.width = "100vw";
    style.marginLeft = "calc(-50vw + 50%)";
    style.paddingLeft = "calc(50vw - 50%)";
    style.paddingRight = "calc(50vw - 50%)";
  }
  /* One value, both edges, and it REPLACES the block's own vertical space
     rather than adding to it — the same treatment the horizontal axis already
     gets below, and the answer to 客戶: 為何上下和左右留白設定為 0 還有那麼多留白.
     The wrapper has no padding of its own, so writing paddingTop/Bottom here
     only ever stacked on top of the inner section's `--section-y` / `--block-y`:
     「無 (0)」 was a guaranteed no-op and every other value was the editor's
     number PLUS the site's. Setting both variables the section padding already
     reads makes the number in the panel the number on the page, on the group
     homepage (which reads --section-y) as well as on villa and content pages
     (which read --block-y). */
  if (padY !== null) {
    (style as Record<string, unknown>)["--block-y"] = `${padY}px`;
    (style as Record<string, unknown>)["--section-y"] = `${padY}px`;
    /* The same figure under a third name, for the blocks that cannot read the
       first two. `.block-about` pays `--about-pad-y`, a clamp of its own, so
       上下留白 moved every `.section` on a page and left the 圖文介紹 block at
       79.2px — one page with two vertical rhythms and a control that saved
       without doing anything. It cannot read --block-y either, for the reason
       --block-pad-x exists beside --gutter: --block-y is always defined at
       :root, so a `var(--block-y, <clamp>)` fallback would never fire and every
       untouched block would shift. A name that exists only when an author set
       something keeps "unset" and "set to the site default" distinguishable. */
    (style as Record<string, unknown>)["--block-pad-y"] = `${padY}px`;
  }
  // Side spacing REPLACES the page's gutter for this block instead of adding to
  // it. Choosing "寬鬆 (88)" used to mean 88px on top of whatever the site's
  // gutter was — on the homepage that made 156px and squeezed the content
  // column to 71% of the window, which is the "central whitespace is too large"
  // the client reported. Setting the variable the section padding already reads
  // makes the number in the editor the number on the page.
  //
  // A coloured block is full-bleed, so it still needs the extra half-window of
  // padding to keep its text in the column.
  if (padX !== null) {
    /* `style.width` alone, not `bgColor && style.width`: width is set in one
       place — the surface branch above — and that branch now also fires for a
       block whose surface is a photograph with no colour on it. Naming the
       colour here meant an image-only block took the uncoloured path and lost
       the half-window of padding that keeps its text in the column. */
    if (style.width) {
      style.paddingLeft = `calc(50vw - 50% + ${responsivePad(padX)})`;
      style.paddingRight = `calc(50vw - 50% + ${responsivePad(padX)})`;
      /* …and the inner .section must stop adding its own. This branch wrote the
         inline padding and left --gutter at the site value, so a coloured block
         got the chosen figure PLUS the site gutter while an uncoloured one got
         the chosen figure INSTEAD of it — the same control behaving two
         different ways depending on whether a background had been picked, and
         the editor's number matching the page in only one of them. Zeroing both
         here makes the wrapper's inline padding the whole inset, which is what
         the uncoloured branch already achieves by replacing the variable. */
      (style as Record<string, unknown>)["--gutter"] = "0px";
      (style as Record<string, unknown>)["--block-pad-x"] = "0px";
    } else {
      (style as Record<string, unknown>)["--gutter"] = responsivePad(padX);
      /* The same figure under a second name, for the rules that cannot read
         --gutter. `.property-block-full-bleed > .section` outweighs the
         `.section` rule that consumes --gutter, so a full-bleed block ignored
         this setting entirely. It cannot read --gutter either: that variable is
         always defined at :root, so a `var(--gutter, <old clamp>)` fallback
         would never fire and every untouched full-bleed block would shift. A
         name that exists only when an author set something keeps "unset" and
         "set to the site default" distinguishable. */
      (style as Record<string, unknown>)["--block-pad-x"] = responsivePad(padX);
    }
  }

  if (fontSize) style.fontSize = fontSize;
  if (lineHeight) style.lineHeight = lineHeight;
  if (textAlign) style.textAlign = textAlign as CSSProperties["textAlign"];
  // A variable rather than a property: the three side-by-side layouts each
  // apply it on a different element (a grid item, a flex row, a pair wrapper),
  // so the value travels down and each rule spends it where it belongs. A
  // property set here would only reach the wrapper.
  if (textVAlign) (style as Record<string, unknown>)["--block-text-valign"] = textVAlign;
  // Variables too, and for the same reason: each role's rule lives on a
  // different element inside the block, so the value has to travel down.
  Object.assign(style as Record<string, unknown>, roleVars);
  return style;
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, value));
}

/**
 * Whether a stored 背景顏色 will actually paint.
 *
 * blockStyle only emits a background when hexToRgb accepts the value, and only
 * reads _bgOpacity inside that same branch — so a colour it rejects takes the
 * full-bleed geometry and the opacity slider down with it, silently. The editor
 * offers a free-text hex box beside the swatch, so "red" and "rgb(255,0,0)" are
 * both things an author can type, save, and never see: measured on the preview
 * route, `_bgColor: "red"` renders with no inline style at all.
 *
 * Exported so the editors can say so at the point of typing rather than letting
 * the page drop it, and so the rule lives in exactly one place — a second copy
 * in the admin is how the two would drift.
 */
export function isBlockBgColor(raw: unknown): boolean {
  return typeof raw === "string" && hexToRgb(raw) !== null;
}

/** #rgb or #rrggbb. Returns null for anything else. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * The id and class list for the element a block renders inside.
 *
 * Separate from the component so it is testable without a DOM: the wrapper
 * existed twice and the copies disagreed about `anchor` — the property renderer
 * emitted the id, the page renderer did not, and the editor offered the 區塊標記
 * field on pages both of them render.
 */
/**
 * A 區塊標記 fit to be an element id.
 *
 * It is typed by an editor and lands in `id=`, where it is also the fragment a
 * menu link jumps to. An empty string is not an anchor — it used to reach the
 * DOM as id="".
 *
 * What is excluded is only what actually breaks: whitespace (an id cannot hold
 * it), `#` and `/` (they end or redirect the fragment), the quote and angle
 * characters, `&` (an entity in an href), and a backslash. Everything else HTML5
 * permits, which matters here specifically: an earlier version of this required
 * `[A-Za-z][-\w:.]*`, and `\w` is ASCII-only — so 「關於」, the obvious thing to
 * type into a zh-Hant CMS, was dropped along with anything starting with a
 * digit. The check that preceded this function accepted both, so those anchors
 * already exist in stored configs and the menu links that point at them are
 * built from the same key elsewhere; tightening beyond what breaks would have
 * silently removed the target from under a working link.
 */
export function safeAnchor(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  /* CHARACTERS, not code units — the editor's input filter truncates with
     `Array.from(...).slice(0, 64)` so it never cuts an astral character in half,
     and 64 of those is 128 code units. Counting differently here would reject
     exactly what the editor just produced. */
  const chars = Array.from(s);
  if (!s || chars.length > 64) return undefined;
  /* Half a character is not a character. `Array.from` pairs surrogates, so a
     LONE one survives as a single code unit in the surrogate range — which the
     negated class below happily admits, and which round-trips through UTF-8 as
     U+FFFD. Reachable from a config saved before the editor's own truncation
     started counting characters rather than code units. */
  if (chars.some((c) => c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff)) {
    return undefined;
  }
  /* No `u` flag: this file's typecheck target is below es6, and the class is a
     negated set of ASCII characters, which needs no unicode mode to admit CJK. */
  return /^[^\s#"'<>&\/\\]+$/.test(s) ? s : undefined;
}

export function blockWrapperAttrs(
  config: Record<string, unknown>,
  style: CSSProperties | undefined,
): { id?: string; className: string } {
  const id = safeAnchor(config.anchor);
  const bleedClass = config.full_bleed === true ? "property-block-full-bleed" : "property-block-contained";

  if (!style) {
    return { id, className: id ? `property-anchor ${bleedClass}` : bleedClass };
  }
  const className = [
    id ? "property-anchor" : "",
    "property-block-styled",
    style.fontSize ? "is-font-size" : "",
    style.lineHeight ? "is-line-height" : "",
    style.textAlign ? "is-text-align" : "",
    bleedClass,
  ].filter(Boolean).join(" ");
  return { id, className };
}
