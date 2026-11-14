import type { Locale } from "./i18n";

/**
 * Resolve a translated field from an item's `translations` dict.
 *
 * Order: this locale → the item's own column → the other locale.
 *
 * The last step is the one that matters and it has to come last. The base
 * column is often the English one (`name: "Cloud Villa"`) with only a zh
 * translation stored beside it, so borrowing before reading the column would
 * put Chinese on the English page for every such record. Reading the column
 * first keeps that correct and only reaches across when the column is empty —
 * which used to render nothing at all. That was visible on the parent
 * homepage: a hero slide with `translations.zh` and no base title showed its
 * headline in Chinese and, in English, showed no headline whatsoever.
 *
 * Usage:
 *   trs(stay, "name", locale)   // "Pool Villa" or "泳池別墅"
 *   trs(banner, "title", locale)
 */
export function trs<T extends Record<string, unknown>>(
  item: T,
  field: string & keyof T,
  locale: Locale,
): string {
  const translations = item.translations as Record<string, Record<string, string>> | undefined;
  const translated = translations?.[locale]?.[field];
  if (translated) return translated;
  const own = String(item[field] ?? "");
  if (own) return own;
  const other: Locale = locale === "zh" ? "en" : "zh";
  return translations?.[other]?.[field] ?? "";
}

/**
 * Localised tag list for a CMS page.
 *
 * Tags are stored as a plain string[] in the page's own language. A translated
 * set lives in translations[locale].tags — either an array or a comma-separated
 * string, since the admin field is free text. Falls back to the untranslated
 * list, so a page with no translation keeps showing its tags rather than none.
 */
export function tagsT(
  item: { tags?: string[] | null; translations?: unknown },
  locale: Locale,
): string[] {
  const translations = item.translations as Record<string, Record<string, unknown>> | undefined;
  const raw = translations?.[locale]?.tags;
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : null;
  const cleaned = list?.map((t) => String(t).trim()).filter(Boolean);
  if (cleaned && cleaned.length) return cleaned;
  return (item.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
}

/**
 * Labels that an editor explicitly chose to print on a card.
 *
 * This is deliberately separate from `tagsT`: article tags remain the
 * searchable taxonomy, while `card_tags` is only the small, reader-facing
 * label set for cards. The value lives in the already bilingual translations
 * JSON so old rows need no migration. A missing key is the compatibility path
 * for existing articles and returns their ordinary tags unchanged; an explicit
 * empty key means the editor chose to hide the card labels.
 */
export function hasCardTags(
  item: { translations?: unknown },
  locale: Locale,
): boolean {
  const translations = item.translations as Record<string, Record<string, unknown>> | undefined;
  const data = translations?.[locale];
  return Boolean(data && Object.prototype.hasOwnProperty.call(data, "card_tags"));
}

export function cardTagsT(
  item: { tags?: string[] | null; translations?: unknown },
  locale: Locale,
): string[] {
  const translations = item.translations as Record<string, Record<string, unknown>> | undefined;
  const data = translations?.[locale];
  if (data && Object.prototype.hasOwnProperty.call(data, "card_tags")) {
    const raw = data.card_tags;
    const list = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? raw.split(",")
        : [];
    return list.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return tagsT(item, locale);
}

/**
 * Comparison key for a tag.
 *
 * Tags are free text in the admin, so the same category arrives spelled several
 * ways — "Local", "local", " Local " — and every comparison that used the raw
 * string treated them as different categories. On the parent homepage that put
 * Local and local in the filter row as two chips, each showing only the entries
 * that happened to match its spelling.
 *
 * Compare on this; keep the original string for display, so the reader still
 * sees the casing the editor typed.
 */
export function tagKey(tag: unknown): string {
  return String(tag ?? "").trim().toLowerCase();
}

/**
 * Resolve one value that may be a plain string or a bilingual { zh, en } map.
 *
 * Renderer after renderer grew its own copy of this. They agreed on the answer,
 * which is exactly why nobody noticed how many there were.
 */
export function pickT(val: unknown, locale: Locale, fallback = ""): string {
  if (val != null && typeof val === "object" && !Array.isArray(val)) {
    const obj = val as Record<string, string>;
    if (obj[locale]) return obj[locale];
    const other = locale === "zh" ? "en" : "zh";
    if (obj[other]) return obj[other];
    return fallback;
  }
  if (typeof val === "string" && val) return val;
  return fallback;
}

/**
 * Read a localised value from a homepage block config field.
 *
 * Supports both legacy plain-string values and new `{en, zh}` objects.
 * Falls back: locale value -> other locale -> plain string -> fallback.
 *
 * Usage:
 *   cfgT(config, "title", locale)
 *   cfgT(config, "eyebrow", locale, h.selected)
 */
export function cfgT(
  config: Record<string, unknown> | undefined,
  key: string,
  locale: Locale,
  fallback = "",
): string {
  if (!config) return fallback;
  return pickT(config[key], locale, fallback);
}

/**
 * Eyebrow text where clearing the field in the admin actually clears it.
 *
 * cfgT cannot express this on its own: it reads an empty string the same as a
 * missing key and hands back the fallback either way, so a block whose eyebrow
 * had been emptied kept showing its built-in label. Here an absent key still
 * takes the default, while a key that is present and empty resolves to "" —
 * and callers render the element only when the result is non-empty, so no
 * empty node is left holding space.
 */
export function clearableT(
  config: Record<string, unknown> | undefined,
  key: string,
  locale: Locale,
  fallback = "",
): string {
  if (!config || !(key in config)) return fallback;
  const val = config[key];

  if (val != null && typeof val === "object" && !Array.isArray(val)) {
    const obj = val as Record<string, string>;
    // Cleared in this locale means cleared. cfgT would reach for the other
    // locale here, so emptying the Chinese value while English still held one
    // put the English text on the Chinese page — the field looked as though it
    // refused to clear. Only a locale that is absent altogether borrows from
    // the other one.
    if (locale in obj) return obj[locale] ?? "";
    const other: Locale = locale === "zh" ? "en" : "zh";
    return obj[other] ?? "";
  }

  if (typeof val === "string") return val;
  return fallback;
}

/** The same rule for the eyebrow field, which asked for it first. */
export function eyebrowT(
  config: Record<string, unknown> | undefined,
  locale: Locale,
  fallback = "",
): string {
  return clearableT(config, "eyebrow", locale, fallback);
}

/**
 * Amenities/specs are stored as one combined "中文 English" string (e.g.
 * "14 米中庭泳池 Courtyard Pool", "24 小時管家 24h Butler"). Return only the
 * locale-appropriate half for display. Splits at the end of the last CJK run,
 * so the English tail may start with a digit. Single-language strings
 * (e.g. "Wi-Fi", "泳池") are returned unchanged.
 *
 * Note: this is display-only — keep the full original string as the value when
 * it is used as a form/filter key, or the backend's exact match will break.
 */
export function localizeAmenity(s: string, locale: Locale): string {
  const str = String(s).trim();
  const separator = str.match(/\s*(?:·|｜|\|)\s*/);
  if (separator && separator.index !== undefined) {
    const zh = str.slice(0, separator.index).trim();
    const en = str.slice(separator.index + separator[0].length).trim();
    if (zh || en) return locale === "zh" ? (zh || en) : (en || zh);
  }
  const cjk = /[㐀-鿿豈-﫿]/g;
  let lastCjkEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = cjk.exec(str)) !== null) lastCjkEnd = m.index + 1;
  if (lastCjkEnd <= 0) return str; // no Chinese → single-language string
  const zh = str.slice(0, lastCjkEnd).trim();
  // Strip any CJK punctuation/space that trails the Chinese clause (。，、！？： etc.)
  // so the English half doesn't start with a stray full-width mark.
  const en = str.slice(lastCjkEnd).replace(/^[\s。，、！？：；）】」』.,!?)]+/, "").trim();
  if (!/[A-Za-z]/.test(en)) return str; // no English tail → Chinese-only
  return locale === "zh" ? zh : en;
}

/**
 * Resolve a "中文 · English" (or "中文 English") combined string to one language.
 * Used for stay fields that carry both languages in a single value (house rules,
 * room name/description). Prefers an explicit " · " / "｜" / " | " separator;
 * otherwise falls back to the CJK-boundary split used for amenities.
 */
export function bilingual(s: string, locale: Locale): string {
  const str = String(s ?? "").trim();
  if (!str) return "";
  const sep = str.match(/\s*(?:·|｜|\|)\s*/);
  if (sep && sep.index !== undefined) {
    const zh = str.slice(0, sep.index).trim();
    const en = str.slice(sep.index + sep[0].length).trim();
    if (zh && en) return locale === "zh" ? zh : en;
  }
  return localizeAmenity(str, locale);
}

/**
 * Bilingual resolver for SEO title/description and similar fields. Like
 * bilingual(), but when the EN locale yields a value with no Latin letters
 * (the admin supplied only a Chinese half), it returns `fallback` instead of
 * leaking Chinese text into an English page's <title>/meta. Also falls back
 * when the field is empty.
 */
/** Han, kana and the CJK compatibility block — what "this is Chinese" means here. */
const CJK_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/g;

/**
 * Chinese enough that an English page should not print it.
 *
 * The test used to be "contains no Latin letter at all", which almost nothing
 * in this domain fails: 禾境 Villa、附 Wi-Fi、KTV、BBQ、SPA — one Latin
 * word is enough, and the guard passed a whole Chinese sentence through to an
 * English <title>. Measured on the live copy, `/stays/detail/yashirocho` under
 * site-locale=en served `<title>宜蘭冬山湯泉草原包棟 Villa</title>` and a
 * Chinese meta description to Google, Facebook and LINE.
 *
 * A share rather than a presence: a name that happens to carry a few Han
 * characters ("八代町 YASHIROCHO") still reads as the property's name in
 * English, while a sentence of Chinese with "Villa" in it does not.
 */
function mostlyCJK(v: string): boolean {
  const cjk = (v.match(CJK_RE) ?? []).length;
  if (!cjk) return false;
  return cjk / (v.replace(/\s/g, "").length || 1) >= 0.3;
}

export function bilingualOr(s: string, locale: Locale, fallback: string): string {
  const v = bilingual(s ?? "", locale);
  if (!v) return fallback;
  if (locale === "en" && mostlyCJK(v)) return fallback;
  return v;
}

/**
 * Short, scannable chip labels for the search "mood chips". Maps a full amenity
 * string (e.g. "14 米中庭泳池 Courtyard Pool") to a one-word label by keyword.
 * Display-only — the submitted value stays the full original string so the
 * backend's exact-match amenity filter still works. Falls back to
 * localizeAmenity() for amenities without a known short form.
 */
const SHORT_AMENITY: Array<[RegExp, { zh: string; en: string }]> = [
  [/包棟|整棟|whole ?villa|entire/i, { zh: "包棟", en: "Whole Villa" }],
  [/戲水|泳池|pool|swim/i, { zh: "泳池", en: "Pool" }],
  [/湯池|溫泉|風呂|hot ?spring|onsen|spa/i, { zh: "湯池", en: "Hot Spring" }],
  [/KTV|卡拉|karaoke/i, { zh: "KTV", en: "KTV" }],
  [/麻將|mahjong/i, { zh: "麻將", en: "Mahjong" }],
  [/switch/i, { zh: "Switch", en: "Switch" }],
  [/桌遊|桌游|board ?game/i, { zh: "桌遊", en: "Board Games" }],
  [/烤爐|烤肉|BBQ|grill/i, { zh: "烤肉", en: "BBQ" }],
  [/管家|butler|concierge/i, { zh: "管家", en: "Butler" }],
  [/私廚|chef/i, { zh: "私廚", en: "Private Chef" }],
  [/餐桌|慢域餐|private dining/i, { zh: "慢域餐桌", en: "Private Dining" }],
  [/早餐|breakfast|手作/i, { zh: "手作早餐", en: "Breakfast" }],
  // Each audience needs its own keyword: a bare 友善 matched 親子友善 and 長者友善
  // too, so a stay tagged both family- and pet-friendly showed 寵物友善 twice.
  [/親子|family|kid/i, { zh: "親子友善", en: "Family Friendly" }],
  [/長者|senior|elder/i, { zh: "長者友善", en: "Senior Friendly" }],
  [/寵物|毛孩|pet/i, { zh: "寵物友善", en: "Pet Friendly" }],
];

/** Admin-managed short-label rule: keyword substring (case-insensitive) → bilingual label. */
export type ShortAmenityRule = { match: string; zh: string; en: string };

export function shortAmenity(s: string, locale: Locale, rules?: ShortAmenityRule[]): string {
  // 1) Admin-managed rules (site settings.amenity_short) — substring keyword match.
  if (Array.isArray(rules)) {
    const low = String(s).toLowerCase();
    for (const r of rules) {
      const k = String(r?.match ?? "").trim().toLowerCase();
      if (k && low.includes(k)) return (locale === "zh" ? r.zh : r.en) || r.zh || r.en;
    }
  }
  // 2) Built-in defaults.
  for (const [re, label] of SHORT_AMENITY) {
    if (re.test(s)) return locale === "zh" ? label.zh : label.en;
  }
  // 3) Fall back to the locale-appropriate half of the full string.
  return localizeAmenity(s, locale);
}
