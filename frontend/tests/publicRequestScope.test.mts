import test from "node:test";
import assert from "node:assert/strict";
import { withPublicRequestScope } from "../app/modules/publicRequestScope.ts";
import { readCode } from "./readCode.mts";

test("explicit villa site wins over host request scope with one site parameter", () => {
  const result = withPublicRequestScope("/cms/pages?content_type=news&site=qa-child", "?host=localhost%3A3317&site=parent");
  const params = new URL(result, "http://internal.invalid").searchParams;
  assert.deepEqual(params.getAll("site"), ["qa-child"]);
  assert.equal(params.get("content_type"), "news");
  assert.equal(params.get("host"), "localhost:3317");
});
test("implicit public calls inherit scope and existing host is preserved", () => {
  assert.equal(withPublicRequestScope("/cms/pages", "?site=parent"), "/cms/pages?site=parent");
  assert.equal(withPublicRequestScope("/cms/pages?host=original", "?host=other"), "/cms/pages?host=original");
  assert.equal(withPublicRequestScope("/cms/pages?ids=1%2C2", ""), "/cms/pages?ids=1%2C2");
});
test("villa listing, siblings and shared article resolution explicitly target the villa", () => {
  const source=readCode("app/property/[slug]/[...pageSlug]/page.tsx");
  assert.match(source, /getPages\(contentType, staySlug, undefined, staySlug\)/);
  assert.match(source, /getPages\(cmsPage.content_type, params.slug, undefined, params.slug\)/);
  assert.match(source, /getPages\(type, params.slug, undefined, params.slug\)/);
});

test("villa configured article metadata uses the same explicit scope as its body", () => {
  const source=readCode("app/property/[slug]/[...pageSlug]/page.tsx");
  const metadata=source.slice(source.indexOf("export async function generateMetadata"), source.indexOf("export default"));
  assert.match(metadata, /resolvePage\(contentType, identifier, params.slug\)/);
  assert.match(metadata, /resolveSharedPage\(contentType, identifier, params.slug\)/);
  assert.match(metadata, /if \(!cmsPage\) return buildMetadata\(\{ title: publicUiText\(locale\).notFound, noIndex: true \}\)/);
  assert.doesNotMatch(metadata, /resolvePage\(contentType, identifier\)/);
});
