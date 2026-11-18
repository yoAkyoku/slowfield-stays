import assert from "node:assert/strict";
import test from "node:test";

import { readCode, readStyles } from "./readCode";

const STAYS = readCode("app/modules/home/blocks/BlockStays.tsx");
const FORM = readCode("app/admin/modules/blockForms.tsx");
const PAGE_FORM = readCode("app/admin/(dashboard)/cms/PageFormEditor.tsx");
const TAGS = readCode("app/admin/(dashboard)/cms/tags/page.tsx");
const STYLES = readStyles("app/globals.css");

test("multi-source content collections deduplicate the merged page list", () => {
  assert.match(STAYS, /export function dedupeContentPages\(/);
  assert.match(STAYS, /pages = dedupeContentPages\(perSource\.flat\(\)\.sort\(\(a, b\) => b\.id - a\.id\), staySlug\)/);
});

test("content collection tag pickers include the managed bilingual catalogue", () => {
  assert.match(FORM, /export type ManagedTagOption/);
  assert.match(FORM, /mergeManagedTagOptions\(/);
  assert.match(FORM, /managedTags\?: ManagedTagOption\[\]/);
  assert.match(FORM, /contentTags=\{contentTags\}/);
});

test("article tag picker keeps the clear action out of an empty selection", () => {
  assert.match(PAGE_FORM, /const selectedTagLabels = selectedTagsFor\(editLocale\)/);
  assert.match(PAGE_FORM, /clearLabel=\{selectedTagLabels\.length\s*>\s*0/);
  assert.match(FORM, /className="[^"]*picker-shell/);
  assert.match(STYLES, /\.picker-shell\s*\{/);
});

test("hero scroll cue has a text default and rejects numeric placeholders", () => {
  assert.match(readCode("app/modules/heroScrollLabel.ts"), /export function editableHeroScrollLabel\(/);
  assert.match(FORM, /editableHeroScrollLabel\(c.scroll_label, editLocale\)/);
  assert.match(STAYS.replace(/BlockStays/g, ""), /dedupeContentPages/);
});

test("tag management follows the CMS workspace list layout", () => {
  // Same kit skeleton as the article workspace: Page + PageHeader, a Toolbar of
  // filters, and the list in a labelled TableFrame.
  assert.match(TAGS, /<Page\b/);
  assert.match(TAGS, /<PageHeader\b/);
  assert.match(TAGS, /<Toolbar\b/);
  assert.match(TAGS, /<TableFrame\b/);
  assert.doesNotMatch(TAGS, /ContentManagementNav/);
  assert.match(TAGS, /TagUsageModal/);
  assert.match(TAGS, /usage\.relatedArticles\.map/);
  assert.doesNotMatch(TAGS, /content-tag-readiness-grid|quickFilters/);
});
