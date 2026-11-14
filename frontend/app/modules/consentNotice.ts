import type { Locale } from "./i18n";

/**
 * Consent copy, and how to resolve it in the reader's own language.
 *
 * Shared by the group layout and the villa layout. The group layout had been
 * fixed to stop borrowing the other language while the villa layout still did
 * it, so a villa whose consent copy was only ever written in Chinese put a
 * Chinese cookie banner in front of every English visitor: consent text is the
 * one thing on a page that has to be understood before it is agreed to, so a
 * bundled default in the right language beats accurate text in the wrong one.
 * Copying the defaults into the second layout would have left the same drift in
 * place one file over, which is how this diverged the first time.
 */

/**
 * Bundled consent copy, used when a site has not written its own for the
 * language being read. Drafted to describe what these sites actually do (they
 * set a preference cookie and measure traffic) rather than to be legal advice;
 * the client should have their own wording reviewed and put it in Site
 * settings, which overrides this.
 */
export const DEFAULT_COOKIE_NOTICE: Record<Locale, string> = {
  zh: "本網站使用 Cookie 與類似技術，以記住您的語言與偏好、分析流量並提升瀏覽體驗。繼續使用本網站，即表示您同意我們使用 Cookie。",
  en: "We use cookies and similar technologies to remember your language and preferences, measure traffic, and improve the site. By continuing to browse, you agree to our use of cookies.",
};

export const DEFAULT_GDPR_NOTICE: Record<Locale, string> = {
  zh: "若您位於歐盟或英國：我們僅為回覆您的詢問、處理訂房與營運本網站而處理個人資料，不會將其出售或用於其他目的。您可隨時來信要求查閱、更正或刪除我們持有的資料。",
  en: "If you are in the EU or the UK: we process personal data only to answer your enquiry, handle a booking, and run this site. We do not sell it or use it for anything else. Write to us at any time to see, correct, or delete what we hold.",
};

/**
 * The site's own wording for this locale when it has one, the bundled default
 * otherwise. Never the other language.
 *
 * A legacy plain string is taken at face value: it predates the split into
 * zh/en fields, and it is the only wording the site has.
 */
export function consentNotice(value: unknown, locale: Locale, fallback: Record<Locale, string>): string {
  if (typeof value === "string") return value || fallback[locale];
  if (value && typeof value === "object") {
    const o = value as Record<string, string>;
    return o[locale] || fallback[locale];
  }
  return fallback[locale];
}

/**
 * settings.footer_notice — 頁尾法律聲明 — in the language being read.
 *
 * Unlike the consent copy above there is no bundled default: a site that has
 * not written one shows no notice at all, so "" is the right answer and the
 * other language is better than nothing when only one half was filled in.
 *
 * Lives here rather than inside a footer because it had exactly one reader.
 * The field is in the site editor's 進階 / 法規 tab for EVERY site, and only
 * PropertyFooter ever rendered it — so an admin on the group site typed a
 * copyright notice into 頁尾法律聲明, saved it, and no page of theirs ever
 * showed it. Both footers call this now, so neither can be the one that forgets.
 */
export function footerNotice(value: unknown, locale: Locale): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const o = value as Record<string, string>;
    return o[locale] || o.zh || o.en || "";
  }
  return "";
}

/** The notice split into the paragraphs it was typed as, blank lines dropped. */
export function noticeLines(notice: string): string[] {
  return notice.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
