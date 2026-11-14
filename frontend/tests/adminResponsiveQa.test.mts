import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("narrow list layout uses available container width and labeled cards", () => {
  const css = readCode("app/globals.css");
  const table = readCode("app/admin/(dashboard)/cms/CmsPagesTable.tsx");
  // The kit TableFrame's stack mode: container query + data-label headings.
  assert.match(css, /container: admin-records \/ inline-size/);
  assert.match(css, /@container admin-records \(max-width: 979px\)/);
  assert.match(css, /td\[data-label\]::before \{ content: attr\(data-label\)/);
  assert.match(table, /<TableFrame stack>/);
  assert.match(table, /data-label=\{categoryLabel\}/);
  assert.match(table, /aria-label=\{`\$\{locale === "zh" \? "選取"/);
});

test("mobile tag fields use grid rather than desktop flex basis heights", () => {
  /* The tag toolbar is the kit <Toolbar> (wrapping flex, no flex-basis heights).
     Fields go to 16px on phones so iOS does not zoom into them on focus. */
  const css = readCode("app/globals.css");
  assert.match(css, /\.a-toolbar \{[^}]*flex-wrap: wrap/);
  assert.match(css, /@media \(max-width: 760px\) \{\s*\.a-input,[^{]*\{ font-size: 16px; \}/);
  assert.match(readCode("app/admin/(dashboard)/cms/tags/page.tsx"), /<Toolbar\b/);
});

test("overview and homepage inspector display localized names", () => {
  const overview = readCode("app/admin/(dashboard)/cms/CmsOverviewPanel.tsx");
  const page = readCode("app/admin/(dashboard)/cms/page.tsx");
  assert.match(overview, /pageTypeLabel\(page.content_type\)/);
  assert.match(page, /pageTypeLabel=\{pageTypeName\}/);
  for (const file of ["app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx", "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx"]) {
    assert.match(readCode(file), /hpb-insp__badge">\{label\(selected.type\)\}/);
  }
});

test("mobile admin back-to-top FAB stays below table actions", () => {
  const css = readCode("app/globals.css");
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.admin-workspace \.scroll-to-top-fab \{[\s\S]*?bottom: calc\(16px \+ env\(safe-area-inset-bottom, 0px\)\);[\s\S]*?right: 16px;/);
});
