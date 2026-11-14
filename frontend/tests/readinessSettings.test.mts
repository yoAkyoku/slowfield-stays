import assert from "node:assert/strict";
import test from "node:test";
import { adCodeSetting, noticeSummary, socialLinksSetting } from "../app/admin/modules/readinessSettings.ts";

/**
 * Run with: npm test
 *
 * The readiness compliance rows read `ad_code` and flat `facebook` /
 * `instagram`; the site editor writes `ads_code`, `social_facebook` and
 * `social_instagram`. Both rows were therefore red on every site, however
 * completely it had been filled in. These fix the reader against the keys that
 * are actually stored.
 */

test("the ad code row reads the key the site editor writes", () => {
  assert.equal(adCodeSetting({ ads_code: "gtag('config','AW-1')" }), "gtag('config','AW-1')");
  // The key the row used to read: nothing writes it, so it must not count.
  assert.equal(adCodeSetting({ ad_code: "gtag('config','AW-1')" }), "");
  assert.equal(adCodeSetting({}), "");
  assert.equal(adCodeSetting(undefined), "");
  assert.equal(adCodeSetting({ ads_code: "   " }), "");
});

test("the social row counts links saved under social_*", () => {
  const value = socialLinksSetting({
    social_facebook: "https://facebook.com/x",
    social_instagram: "https://instagram.com/x",
  });
  assert.equal(value, "https://instagram.com/x / https://facebook.com/x");
});

test("a site with only Threads still counts as configured", () => {
  assert.equal(socialLinksSetting({ social_threads: "https://threads.net/@x" }), "https://threads.net/@x");
  assert.equal(socialLinksSetting({}), "");
});

test("a legacy nested social_links object is still counted", () => {
  assert.equal(socialLinksSetting({ social_links: { facebook: "https://fb.com/x" } }), "https://fb.com/x");
});

test("bilingual consent copy previews as text, not [object Object]", () => {
  const notice = { zh: "本網站使用 Cookie", en: "We use cookies" };
  assert.equal(noticeSummary(notice, "en"), "We use cookies");
  assert.equal(noticeSummary(notice, "zh"), "本網站使用 Cookie");
  // Written in one language only: the row is still "set", and shows what there is.
  assert.equal(noticeSummary({ zh: "本網站使用 Cookie", en: "" }, "en"), "本網站使用 Cookie");
  assert.equal(noticeSummary({ zh: "", en: "" }, "zh"), "");
  assert.equal(noticeSummary("legacy string", "en"), "legacy string");
  assert.equal(noticeSummary(undefined, "en"), "");
});
