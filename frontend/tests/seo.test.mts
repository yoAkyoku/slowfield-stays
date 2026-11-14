import assert from "node:assert/strict";
import test from "node:test";
import { buildMetadata, cmsEntrySeo, excerpt, pageSettingsSeo, siteUrl } from "../app/modules/seo.ts";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * What is worth protecting here is the fallback order. Every one of these
 * chains exists because something upstream of it was silently unused: the
 * per-page SEO an admin typed, the English half of a bilingual field, a page's
 * own summary. When any link is dropped the page does not break, it just goes
 * back to describing itself with the site-wide default like every other page —
 * which is exactly the failure nobody notices without a test.
 */

const site = {
  id: 1,
  name: "慢域旅遊",
  slug: "select",
  domain: "",
  status: "active",
  default_locale: "zh",
  theme_config: {},
  contact_config: {},
  seo_defaults: { title: "慢域旅遊", description: '{"zh":"全站預設描述","en":"Default site description"}' },
  settings: {} as Record<string, unknown>,
};

/* ── excerpt ── */

test("short copy is used whole, with no ellipsis", () => {
  assert.equal(excerpt("A quiet villa."), "A quiet villa.");
});

test("whitespace and newlines collapse, so a body block does not arrive as a wall", () => {
  assert.equal(excerpt("one\n\n  two\tthree"), "one two three");
});

test("latin copy is cut on a word boundary", () => {
  const out = excerpt("word ".repeat(60), 40);
  assert.ok(out.endsWith("…"));
  assert.ok(!out.includes("wor…"), out);
  assert.ok(out.length <= 41, out);
});

test("CJK copy has no spaces to cut on, so it takes a hard cut rather than returning nothing", () => {
  const out = excerpt("宜蘭冬山的輕奢泳池民宿".repeat(40), 30);
  assert.equal(out.length, 31);
  assert.ok(out.endsWith("…"));
});

test("missing body yields an empty string, not the word undefined", () => {
  assert.equal(excerpt(undefined), "");
  assert.equal(excerpt(null), "");
});

/* ── cmsEntrySeo ── */

test("the reader's locale wins over the flat primary-locale copy", () => {
  const page = {
    seo: { title: "中文標題", description: "中文描述", og_image: "/a.jpg", canonical: "" },
    translations: { en: { seo_title: "English title", seo_description: "English description" } },
  };
  const en = cmsEntrySeo(page, "en");
  assert.equal(en.title, "English title");
  assert.equal(en.description, "English description");
  // The Chinese reader still gets the flat copy, which is where the primary
  // locale is stored.
  assert.equal(cmsEntrySeo(page, "zh").title, "中文標題");
});

test("an entry saved before the bilingual editor existed still resolves", () => {
  const page = { seo: { title: "舊標題", description: "舊描述" }, translations: {} };
  assert.equal(cmsEntrySeo(page, "zh").title, "舊標題");
  assert.equal(cmsEntrySeo(page, "en").title, "");
});

test("CMS SEO maps stored as JSON strings resolve the requested locale", () => {
  const page = {
    seo: { title: '{"zh":"中文標題","en":"English title"}', description: '{"zh":"中文描述","en":"English description"}' },
    translations: {},
  };
  assert.equal(cmsEntrySeo(page, "zh").title, "中文標題");
  assert.equal(cmsEntrySeo(page, "en").description, "English description");
});

test("no seo at all is empty strings, so callers fall through to their own chain", () => {
  assert.deepEqual(cmsEntrySeo({}, "zh"), { title: "", description: "", image: "", canonical: "" });
});

/* ── pageSettingsSeo ── */

test("per-page overrides are read out of settings.pages[key].seo", () => {
  const withPages = {
    settings: { pages: { brand: { seo: { title: { zh: "品牌", en: "Brand" }, description: { zh: "描述", en: "Desc" }, canonical: "/brand" } } } },
  };
  assert.equal(pageSettingsSeo(withPages, "brand", "en").title, "Brand");
  assert.equal(pageSettingsSeo(withPages, "brand", "zh").description, "描述");
  assert.equal(pageSettingsSeo(withPages, "brand", "en").canonical, "/brand");
});

test("an unconfigured page is empty rather than throwing on the missing key", () => {
  const empty = { title: "", description: "", image: undefined, noIndex: false };
  assert.deepEqual(pageSettingsSeo({ settings: {} }, "brand", "zh"), empty);
  assert.deepEqual(pageSettingsSeo(undefined, "brand", "zh"), empty);
});

/* ── buildMetadata ── */

test("a page with no description of its own inherits the site default", async () => {
  const meta = await buildMetadata({ title: "聯繫我們", site });
  assert.equal(meta.description, "Default site description");
});

test("the site name is appended once, never twice", async () => {
  assert.equal((await buildMetadata({ title: "品牌介紹", site })).title, "品牌介紹 | 慢域旅遊");
  assert.equal((await buildMetadata({ title: "慢域旅遊", site })).title, "慢域旅遊");
});

test("og:type is website by default and article where a route asks for it", async () => {
  assert.equal((await buildMetadata({ title: "x", site })).openGraph?.type, "website");
  assert.equal((await buildMetadata({ title: "x", site, type: "article" })).openGraph?.type, "article");
});

test("the twitter card grows to the large format only when there is an image", async () => {
  assert.equal((await buildMetadata({ title: "x", site })).twitter?.card, "summary");
  assert.equal((await buildMetadata({ title: "x", site, image: "/hero.jpg" })).twitter?.card, "summary_large_image");
});

test("a page with no image of its own falls back to the site's configured share image", async () => {
  const withOg = { ...site, settings: { seo_og_image: "https://cdn.example.com/cover.jpg" } };
  const meta = await buildMetadata({ title: "x", site: withOg });
  assert.deepEqual(meta.openGraph?.images, [{ url: "https://cdn.example.com/cover.jpg", width: 1200, height: 630 }]);
  // A page that has its own image keeps it.
  const own = await buildMetadata({ title: "x", site: withOg, image: "https://cdn.example.com/page.jpg" });
  assert.equal((own.openGraph?.images as { url: string }[])[0].url, "https://cdn.example.com/page.jpg");
});

test("an unsafe share image is dropped rather than written into the meta tag", async () => {
  for (const bad of ["javascript:alert(1)", "//evil.example.com/x.jpg", "/\\evil.example.com/x.jpg", "data:image/png;base64,AAAA"]) {
    const meta = await buildMetadata({ title: "x", site: { ...site, settings: { seo_og_image: bad } } });
    assert.equal(meta.openGraph?.images, undefined, bad);
    assert.equal(meta.twitter?.card, "summary", bad);
  }
});

test("site-relative paths are made absolute, because a share target cannot resolve them", async () => {
  const meta = await buildMetadata({ title: "x", site, image: "/uploads/hero.jpg", path: "/brand" });
  assert.match((meta.openGraph?.images as { url: string }[])[0].url, /^https?:\/\/.+\/uploads\/hero\.jpg$/);
  assert.match(String(meta.alternates?.canonical), /^https?:\/\/.+\/brand$/);
});

test("child-site domains are used for metadata URLs and JSON-LD helpers", async () => {
  const child = { ...site, domain: "villa.example.com", settings: { seo_og_image: "/share.jpg" } };
  const meta = await buildMetadata({ title: "x", site: child, image: "/page.jpg", path: "/stays/villa" });
  assert.equal(meta.alternates?.canonical, "https://villa.example.com/stays/villa");
  assert.equal((meta.openGraph?.images as { url: string }[])[0].url, "https://villa.example.com/page.jpg");
  assert.equal(siteUrl("/stays", child), "https://villa.example.com/stays");
});

test("noIndex keeps a tokenised or missing page out of the index but still follows its links", async () => {
  const meta = await buildMetadata({ title: "退訂電子報", noIndex: true, site });
  assert.deepEqual(meta.robots, { index: false, follow: true });
  assert.equal(((await buildMetadata({ title: "x", site })).robots as { index: boolean }).index, true);
});

/* ── the site's own name ── */

/**
 * Renaming the brand in the admin writes `settings.name_translations`. Only the
 * homepage resolved it before building its metadata, via a helper defined
 * privately in its own file; every other route handed `buildMetadata` the raw
 * site and got the database column. So the rename showed up in the header, the
 * footer and the © line on every page — and in the <title> of exactly one,
 * leaving the old name in every search result. Resolving it inside
 * buildMetadata is what makes that unforgettable, so these assert on the
 * ordinary call shape a route uses, not on the helper in isolation.
 *
 * The stubbed `next/headers` reports no locale cookie, so getLocale() answers
 * "en" here; that is why these read the English slot.
 */
test("the admin's bilingual site name reaches the title, not just the page body", async () => {
  const renamed = { ...site, settings: { name_translations: { zh: "慢域旅宿", en: "Slowfield House" } } };
  assert.equal((await buildMetadata({ title: "品牌介紹", site: renamed })).title, "品牌介紹 | Slowfield House");
  assert.equal((await buildMetadata({ title: "品牌介紹", site: renamed })).openGraph?.siteName, "Slowfield House");
});

test("a name translated into only one language leaves the other on the database name", async () => {
  // Deliberately not the borrow-the-other-locale rule used for content: a brand
  // that has an English name and no Chinese one should keep showing whatever it
  // is registered as, rather than adopt its English name on the Chinese site.
  const zhOnly = { ...site, settings: { name_translations: { zh: "慢域旅宿" } } };
  assert.equal((await buildMetadata({ title: "品牌介紹", site: zhOnly })).title, "品牌介紹 | 慢域旅遊");
});

test("no name_translations at all still falls back to the database name", async () => {
  assert.equal((await buildMetadata({ title: "品牌介紹", site })).title, "品牌介紹 | 慢域旅遊");
});




/**
 * The per-page SEO panel writes these; before it had the fields, the renderer
 * read og_image from a place nothing could write to and there was no way to
 * keep a page out of search at all.
 */
test("per-page settings expose the share image and the noindex switch", () => {
  const s2 = {
    settings: {
      pages: {
        contact: {
          seo: {
            title: { zh: "聯繫我們" },
            og_image: "/uploads/contact.jpg",
            noindex: true,
          },
        },
        stays: { seo: {} },
      },
    },
  };
  const contact = pageSettingsSeo(s2, "contact", "zh");
  assert.equal(contact.image, "/uploads/contact.jpg");
  assert.equal(contact.noIndex, true);

  // Anything short of an explicit true stays indexable: silently de-listing a
  // page is the more damaging way to be wrong.
  assert.equal(pageSettingsSeo(s2, "stays", "zh").noIndex, false);
  assert.equal(pageSettingsSeo(undefined, "stays", "zh").noIndex, false);
});
