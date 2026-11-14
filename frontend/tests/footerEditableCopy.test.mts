import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import fs from "node:fs";
import path from "node:path";

test("site settings save bilingual footer left copy", () => {
  const editor = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
  const action = readCode("app/admin/modules/siteActions.ts");
  assert.match(editor, /footer_description_zh/);
  assert.match(editor, /footer_description_en/);
  assert.match(editor, /footer_copyright_zh/);
  assert.match(editor, /footer_copyright_en/);
  assert.match(action, /footer_description:\s*footerDescription/);
  assert.match(action, /footer_copyright:\s*footerCopyright/);
});

test("both group and property footers render the editable copy", () => {
  const group = readCode("app/(site)/layout.tsx");
  const property = readCode("app/modules/property/PropertyFooter.tsx");
  assert.match(group, /settings\?\.footer_description/);
  assert.match(property, /s\?\.footer_description/);
  assert.match(group, /settings\?\.footer_copyright/);
  assert.match(property, /s\?\.footer_copyright/);
  assert.match(group, /footerCopyright/);
  assert.match(property, /copyright/);
  const publicSiteApi = fs.readFileSync(path.resolve(process.cwd(), "../backend/app/modules/sites/routes.py"), "utf8");
  assert.match(publicSiteApi, /"footer_description"/);
  assert.match(publicSiteApi, /"footer_copyright"/);
});

test("group footer phone has an explicit visibility switch", () => {
  const editor = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
  const action = readCode("app/admin/modules/siteActions.ts");
  const group = readCode("app/(site)/layout.tsx");
  const publicSiteApi = fs.readFileSync(path.resolve(process.cwd(), "../backend/app/modules/sites/routes.py"), "utf8");

  assert.match(editor, /show_footer_phone/);
  assert.match(action, /show_footer_phone:/);
  assert.match(group, /show_footer_phone/);
  assert.match(publicSiteApi, /"show_footer_phone"/);
  assert.match(editor, /admin-switch-row/);
  assert.match(editor, /admin-switch-track/);
});

test("article categories use the shared compact multi-picker", () => {
  const editor = readCode("app/admin/(dashboard)/cms/PageFormEditor.tsx");
  const css = readCode("app/globals.css");
  assert.match(editor, /<PickerModal/);
  assert.match(editor, /label=\{contentVocabulary\[editLocale\]\.category\}/);
  assert.match(editor, /type="hidden" name="content_type"/);
  assert.doesNotMatch(editor, /cms-category-membership-grid/);
  assert.match(css, /\.amenity-checkbox input\s*\{[^}]*inline-size:\s*18px[^}]*block-size:\s*18px/s);
});

test("the role editor offers site member, editor and site admin", () => {
  const users = readCode("app/admin/(dashboard)/users/page.tsx");
  assert.match(users, /name: "site_member"/);
  assert.match(users, /r\.name === "admin" \|\| r\.name === "editor"/);
});

test("footer columns share a top alignment baseline", () => {
  const css = readCode("app/globals.css");
  assert.match(css, /\.footer-brand,\s*\.footer-nav,\s*\.footer-subscribe\s*\{[^}]*padding-top:\s*0/s);
  assert.match(css, /\.footer-brand strong\s*\{[^}]*line-height:/s);
  assert.match(css, /\.footer-brand strong\s*\{[^}]*margin:\s*-0\.22em/s);
});
