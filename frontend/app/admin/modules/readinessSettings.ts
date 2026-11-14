/**
 * Reading site settings the way the public site reads them, for the compliance
 * rows on /admin/readiness.
 *
 * Those rows were reading keys nothing ever writes (`ad_code`, flat `facebook` /
 * `instagram`), so two of them were red on every site however completely it had
 * been filled in. The keys are not the thing to change: content already exists
 * under the names the site editor writes, and the public layouts already read
 * those. Resolving them here, through the same helper the layouts use, is what
 * stops the two sides drifting again.
 */

import { resolveSocialLinks } from "../../modules/socialLinks";

type Settings = Record<string, unknown> | null | undefined;

/** The ad / remarketing snippet: written as `ads_code`, rendered from `ads_code`. */
export function adCodeSetting(settings: Settings): string {
  const raw = (settings ?? {})["ads_code"];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * The social links this row reports on, in one line.
 *
 * Every platform counts, not just Facebook and Instagram: a site that filled in
 * only Threads is configured, and the row saying otherwise is the same false
 * negative in a smaller form.
 */
export function socialLinksSetting(settings: Settings): string {
  const links = resolveSocialLinks(settings as Record<string, unknown> | undefined);
  return Object.values(links).filter(Boolean).join(" / ");
}

/**
 * One line of consent copy for the row's preview.
 *
 * These became bilingual `{zh, en}` objects when the consent editor split into
 * two fields, and String() on one prints "[object Object]" into the readiness
 * report the client is handed.
 */
export function noticeSummary(value: unknown, locale: string): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const o = value as Record<string, string>;
    return Object.values(o).filter(Boolean).length
      ? (o[locale] || Object.values(o).find(Boolean) || "")
      : "";
  }
  return "";
}
