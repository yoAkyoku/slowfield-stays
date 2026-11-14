import assert from "node:assert/strict";
import test from "node:test";
import { trs } from "../app/modules/tr.ts";
import { bookingLabel, navLabel, pageLabel } from "../app/modules/property/types.ts";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * What a page shows an English visitor when only the Chinese was ever filled in.
 *
 * The site's rule is that untranslated content falls back to the language it
 * was written in — nothing is ever hidden for want of a translation. Three
 * resolvers broke that rule in two different ways, and both failures were
 * invisible in Chinese, which is the language everything gets checked in.
 */

/* ── trs: record fields ── */

test("a translation is used when the locale has one", () => {
  const stay = { name: "Cloud Villa", translations: { zh: { name: "雲端別墅" } } };
  assert.equal(trs(stay, "name", "zh"), "雲端別墅");
  assert.equal(trs(stay, "name", "en"), "Cloud Villa");
});

/**
 * The ordering constraint. Most records store English in the base column with a
 * zh translation beside it, so a resolver that borrowed the other locale before
 * reading its own column would serve Chinese to every English visitor — a far
 * worse bug than the one being fixed. The column has to win first.
 */
test("the item's own column beats the other locale", () => {
  const stay = { name: "Cloud Villa", translations: { zh: { name: "雲端別墅" } } };
  assert.equal(trs(stay, "name", "en"), "Cloud Villa", "must not borrow over a populated column");
});

/**
 * The parent homepage hero. Slides carry their text in `translations` with an
 * empty base column, so the largest text on the site rendered in Chinese and,
 * in English, rendered as nothing at all — no headline, just the CTAs.
 */
test("an empty column falls back to the other locale rather than to nothing", () => {
  const slide = { title: "", subtitle: "", translations: { zh: { title: "慢域住宿", subtitle: "慢下來" } } };
  assert.equal(trs(slide, "title", "en"), "慢域住宿");
  assert.equal(trs(slide, "subtitle", "en"), "慢下來");
  assert.equal(trs(slide, "title", "zh"), "慢域住宿");
});

test("a field nobody filled in resolves to empty, not to undefined", () => {
  assert.equal(trs({ title: "", translations: {} }, "title", "en"), "");
  assert.equal(trs({ title: undefined } as Record<string, unknown>, "title", "en"), "");
});

/* ── navLabel / bookingLabel: config fields ── */

test("a nav label borrows the other language before falling back to the URL key", () => {
  const item = { key: "about", href: "/about", label: { zh: "關於我們" } };
  assert.equal(navLabel(item, "zh"), "關於我們");
  assert.equal(navLabel(item, "en"), "關於我們", "the key is a last resort, not a translation");
});

test("the URL key is still the last resort", () => {
  assert.equal(navLabel({ key: "experience", href: "/x", label: {} }, "en"), "experience");
});

test("a legacy plain-string label is used as-is in both locales", () => {
  assert.equal(navLabel({ key: "about", href: "/x", label: "About" }, "zh"), "About");
});

/**
 * The booking button had the same shape of bug with a sharper edge: its default
 * was the English "Book Now" in *both* languages, so a villa that filled in only
 * the Chinese CTA got English on its Chinese page.
 */
test("the booking CTA borrows across locales and keeps a per-locale default", () => {
  assert.equal(bookingLabel({ cta_label: { zh: "立即訂房" } }, "en"), "立即訂房");
  assert.equal(bookingLabel({}, "zh"), "立即預約");
  assert.equal(bookingLabel({}, "en"), "Book Now");
});

/**
 * The page heading had the same shape of bug as navLabel: `label[locale] ??
 * label.en ?? key` left an English visitor to a villa whose page labels were
 * only ever filled in Chinese with a blank/`about` heading. It now borrows the
 * other language before giving up, using `||` so a blank string falls through.
 */
test("a page label borrows the other language before falling back to the key", () => {
  const pages = { about: { label: { zh: "關於品牌" } } };
  assert.equal(pageLabel("about", pages, "zh"), "關於品牌");
  assert.equal(pageLabel("about", pages, "en"), "關於品牌", "the key is a last resort, not a translation");
});

test("a page label falls through an empty string to the other locale, then its system name", () => {
  const pages = { about: { label: { en: "", zh: "關於品牌" } } };
  assert.equal(pageLabel("about", pages, "en"), "關於品牌", "an empty en must not win over a populated zh");
  assert.equal(pageLabel("space", { space: { label: {} } }, "en"), "Space");
});

test("a legacy plain-string page label is used as-is in both locales", () => {
  assert.equal(pageLabel("about", { about: { label: "About" } }, "zh"), "About");
});
