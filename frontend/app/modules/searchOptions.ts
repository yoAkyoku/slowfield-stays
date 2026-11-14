import type { Locale } from "./i18n";

/**
 * Canonical, fixed search options from the design brief (網站修改.pptx slide 3).
 * The facility list and party-size ranges are click-to-select and identical
 * everywhere (hero + /stays), independent of what any single villa happens to
 * be tagged with. For the facility filter to RETURN results, each villa must
 * carry the matching tag in the admin (the `value` strings below).
 */

export type SearchOpt = { value: string; label: string };

/** 服務設施 — the ten canonical facility tags (value = the zh tag stored on villas). */
export const SERVICE_FACILITIES: { value: string; zh: string; en: string }[] = [
  { value: "戲水池", zh: "戲水池", en: "Pool" },
  { value: "湯池", zh: "湯池", en: "Hot Spring" },
  { value: "KTV", zh: "KTV", en: "KTV" },
  { value: "電動麻將", zh: "電動麻將", en: "Mahjong" },
  { value: "Switch", zh: "Switch", en: "Switch" },
  { value: "桌遊", zh: "桌遊", en: "Board Games" },
  { value: "烤肉區", zh: "烤肉區", en: "BBQ Area" },
  { value: "寵物友善", zh: "寵物友善", en: "Pet Friendly" },
  { value: "手作早餐", zh: "手作早餐", en: "Handmade Breakfast" },
  { value: "慢域餐桌", zh: "慢域餐桌", en: "Private Dining" },
];

/** 人數 — party-size ranges → lower-bound `guests` value (backend: max_guests >= guests). */
export const GUEST_RANGES: { value: string; zh: string; en: string }[] = [
  { value: "3", zh: "3–5 人", en: "3–5 guests" },
  { value: "6", zh: "6–8 人", en: "6–8 guests" },
  { value: "9", zh: "9–12 人", en: "9–12 guests" },
  { value: "13", zh: "13 人以上", en: "13+ guests" },
];

/**
 * Read a filter list configured in site settings. The lists above are the
 * fallback, not the source of truth — staff can rename an option or add one
 * without a deploy. A missing/non-array value means "not configured" and uses
 * the bundled fallback. An explicit empty array is authoritative: staff chose
 * to remove every option, so the filter disappears instead of resurrecting
 * hard-coded choices they just deleted.
 */
function configured(
  raw: unknown,
  locale: Locale,
  defaults: { value: string; zh: string; en: string }[] = [],
): SearchOpt[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return [];
  const rows = (raw as Record<string, unknown>[])
    .map((item) => {
      const label = item.label as Record<string, string> | string | undefined;
      const value = String(item.value ?? "").trim();
      const zhText = typeof label === "string" ? label.trim() : String(label?.zh ?? "").trim();
      const requested = typeof label === "string" ? label.trim() : String(label?.[locale] ?? "").trim();
      const builtIn = defaults.find((option) => option.value === value);
      // Older settings copied zh into en when English was blank. For bundled
      // facilities we know the intended translation and can repair it safely.
      const repaired = locale === "en" && builtIn && (!requested || requested === zhText)
        ? builtIn.en
        : requested;
      const text = repaired || zhText || (typeof label === "string" ? "" : String(label?.en ?? "").trim());
      return { value, label: text };
    })
    .filter((o) => o.value && o.label);
  return rows;
}

export function serviceOptions(locale: Locale, settings?: Record<string, unknown> | null): SearchOpt[] {
  return (
    configured(settings?.search_facilities, locale, SERVICE_FACILITIES) ??
    SERVICE_FACILITIES.map((s) => ({ value: s.value, label: locale === "zh" ? s.zh : s.en }))
  );
}

/** 慢域體驗 has no built-in vocabulary: staff owns the list in site settings. */
export function experienceOptions(locale: Locale, settings?: Record<string, unknown> | null): SearchOpt[] {
  return configured(settings?.search_experiences, locale) ?? [];
}

/**
 * 民宿類型 — matched against each villa's tags by the API's `tag` filter.
 *
 * Unlike facilities and party sizes there is no sensible built-in list: what
 * counts as a "type" is the client's own vocabulary. An unconfigured site
 * returns none and the field is left out of the bar entirely, rather than
 * showing a filter with nothing in it.
 */
export function typeOptions(locale: Locale, settings?: Record<string, unknown> | null): SearchOpt[] {
  return configured(settings?.search_types, locale) ?? [];
}

/**
 * The word a site counts people in — 人, 位, guests, pax.
 *
 * The range editor bakes this into each label it saves, so a site that edited
 * its ranges already shows the right word. A site that only changed the word
 * and left the ranges alone saved the setting and saw nothing change, because
 * the bundled defaults spell 人 / guests literally. Substituting it here closes
 * that: the setting means the same thing whether or not the rows were touched.
 */
function guestUnit(settings: Record<string, unknown> | null | undefined, locale: Locale): string | null {
  const raw = settings?.search_guest_ranges_unit;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const word = String((raw as Record<string, unknown>)[locale] ?? "").trim();
  return word || null;
}

export function guestOptions(locale: Locale, settings?: Record<string, unknown> | null): SearchOpt[] {
  const fromSettings = configured(settings?.search_guest_ranges, locale);
  if (fromSettings) return fromSettings;

  const unit = guestUnit(settings, locale);
  return GUEST_RANGES.map((g) => {
    const label = locale === "zh" ? g.zh : g.en;
    if (!unit) return { value: g.value, label };
    // zh writes the unit mid-string ("3–5 人", "13 人以上"); en writes it last
    // ("3–5 guests"). Replacing the default word in place keeps both shapes.
    return { value: g.value, label: label.replace(locale === "zh" ? "人" : "guests", unit) };
  });
}
