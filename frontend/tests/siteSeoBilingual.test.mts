import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { seoTextForLocale } from "../app/modules/seo.ts";

test("site SEO editor stores independent Chinese and English values", () => {
  const editor = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
  assert.match(editor, /name="seo_title" value=\{cleanBilingualSeo\(seoTitle\)\}/);
  assert.match(editor, /name="seo_description" value=\{cleanBilingualSeo\(seoDescription\)\}/);
  assert.match(editor, /splitBilingualSeo\(seoTitle/);
  assert.match(editor, /中文與英文 SEO 需分別填寫/);
});

test("new sites submit bilingual names and SEO instead of discarding the English tab", () => {
  const form = readCode("app/admin/(dashboard)/sites/new/NewSiteForm.tsx");
  assert.match(form, /_name_translations_json/);
  assert.match(form, /formData\.set\("seo_title", bilingualValue\("seo_title"\)\)/);
  assert.match(form, /formData\.set\("seo_description", bilingualValue\("seo_description"\)\)/);
  assert.match(form, /seo_og_image/);
});

test("public metadata resolves site-wide SEO in the requested locale", () => {
  const seo = readCode("app/modules/seo.ts");
  const homepage = readCode("app/(site)/page.tsx");
  const property = readCode("app/property/[slug]/page.tsx");
  assert.match(seo, /seoTextForLocale\(site\?\.seo_defaults\?\.description/);
  assert.match(homepage, /seoTextForLocale\(site\.seo_defaults\?\.title, locale\)/);
  assert.match(property, /seoTextForLocale\(site\.seo_defaults\?\.description, locale\)/);
});

test("English category metadata does not borrow a Chinese-only custom label", () => {
  const categoryRoute = readCode("app/(site)/[category]/page.tsx");
  assert.match(categoryRoute, /label\?\.\[locale\] \|\| i18nCopy\?\.title \|\| contentType/);
  assert.doesNotMatch(categoryRoute, /label\?\.zh \|\| label\?\.en/);
});

test("structured site SEO does not mistake title punctuation for a language separator", () => {
  const stored = JSON.stringify({
    zh: "思選旅宿｜宜蘭精品包棟",
    en: "Slowfield Stays | Yilan Private Villas",
  });
  assert.equal(seoTextForLocale(stored, "zh"), "思選旅宿｜宜蘭精品包棟");
  assert.equal(seoTextForLocale(stored, "en"), "Slowfield Stays | Yilan Private Villas");
});
