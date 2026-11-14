/**
 * Reading and writing a block config field that may still be a plain string.
 *
 * Kept out of blockFields.tsx so the migration rule below can be unit tested:
 * that file carries JSX, and the test runner strips types without compiling it.
 */

/** The two locales a config field can carry. */
export type FieldLocale = "zh" | "en";

/** Read a localised text value; plain strings are treated as the value itself. */
export function getVal(c: Record<string, unknown>, key: string, locale: string): string {
  const val = c[key];
  if (val != null && typeof val === "object" && !Array.isArray(val)) {
    return String((val as Record<string, string>)[locale] ?? "");
  }
  return String(val ?? "");
}

const CJK = /[㐀-鿿豈-﫿　-〿＀-￯]/;

/**
 * Which slot a legacy plain-string value belongs in once the field goes bilingual.
 *
 * Seeding both slots with it was a guess that came out wrong in one direction
 * on every site here: these are zh-authored, so the first edit of any field
 * stamped Chinese into the English slot, where it is afterwards
 * indistinguishable from a real translation (to the admin's own locale tabs, to
 * anyone auditing what still needs translating, and to any reader that treats a
 * filled English slot as "no bundled default needed", which is how the consent
 * copy now works). Seeding only the locale being edited was rejected for the
 * opposite reason: editing the English tab of a Chinese-only field would drop
 * the Chinese entirely.
 *
 * The site's own default_locale would be the other candidate for this decision,
 * but setVal has ~70 call sites across three editors and threading a site
 * through all of them buys nothing: the language an old value was typed in is
 * not necessarily the site's current default. The site editor already resolves
 * legacy consent strings the same way (a plain string is read as zh).
 */
export function legacyValueLocale(value: string): FieldLocale {
  return CJK.test(value) ? "zh" : "en";
}

/**
 * Write a localised text value, preserving the other locale.
 *
 * A legacy plain string is migrated on first edit into the slot for the
 * language it was written in (see legacyValueLocale), never into both. An
 * already-bilingual value is copied untouched apart from the edited slot, so a
 * populated English field can never be blanked by editing the Chinese one.
 */
export function setVal(
  c: Record<string, unknown>,
  key: string,
  locale: string,
  value: string,
): Record<string, unknown> {
  const prev = c[key];
  let obj: Record<string, string>;
  if (prev != null && typeof prev === "object" && !Array.isArray(prev)) {
    obj = { ...(prev as Record<string, string>) };
  } else {
    const legacy = String(prev ?? "");
    obj = legacy ? { [legacyValueLocale(legacy)]: legacy } : {};
  }
  obj[locale] = value;
  return { ...c, [key]: obj };
}
