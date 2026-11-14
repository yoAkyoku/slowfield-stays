import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { listingPublicHref } from "../app/admin/modules/listingPublicHref";

test("website pages provide direct creation and saved-result actions",()=>{
 const page=readCode("app/admin/(dashboard)/content-pages/page.tsx");
 assert.match(page, /CreateWebsitePageModal/);
 assert.match(page, /savedPage/);
 assert.match(page, /listingPublicHref\(site,savedPage\)/);
 assert.match(page, /接著編輯版面/);
});
test("page creation has controlled fields, inline errors and pending feedback",()=>{
 const modal=readCode("app/admin/(dashboard)/content-pages/CreateWebsitePageModal.tsx");
 assert.match(modal,/useActionState\(createWebsitePage/);
 assert.match(modal,/value=\{name\}/);
 assert.match(modal,/<CategoryPicker categories=\{active\} values=\{selected\} onChange=\{setSelected\}/);
 assert.match(modal,/(role|live)="alert"/);
 assert.match(modal,/disabled=\{pending\}/);
});
test("category code is optional and kept in advanced settings",()=>{
 const modal=readCode("app/admin/(dashboard)/cms/categories/CategoryModal.tsx");
 assert.match(modal,/進階設定/);
 assert.match(modal,/留白自動產生/);
 assert.doesNotMatch(modal,/name="key" required/);
 assert.match(modal,/value=\{name\}/);
 assert.match(modal,/(role|live)="alert"/);
});
test("unlinked categories provide a next step with the selected category",()=>{
 const page=readCode("app/admin/(dashboard)/cms/categories/page.tsx");
 assert.match(page,/設定(?:前台)?入口/);
 assert.match(page,/content-pages\?category=\$\{encodeURIComponent\(c.key\)\}/);
});
test("public preview links keep child site context and encode segments",()=>{
 assert.equal(listingPublicHref({parent_site_id:null,slug:"main"},"news"),"/news");
 assert.equal(listingPublicHref({parent_site_id:1,slug:"qa-child"},"news"),"/stays/qa-child/news");
 assert.equal(listingPublicHref({parent_site_id:1,slug:"qa-child"},"a/b"),"/stays/qa-child/a%2Fb");
});
test("tables retain sticky names and a mobile scroll instruction",()=>{
 const css=readCode("app/globals.css");
 // .content-management-table became the kit table plus .cms-sticky-first.
 assert.match(css,/\.cms-sticky-first th:first-child,[\s\S]*?position: sticky; left: 0/);
 assert.match(css,/\.a-table-hint \{ display: none;[\s\S]*?@media \(max-width: 760px\) \{ \.a-table-hint \{ display: block; \} \}/);
 for (const page of ["app/admin/(dashboard)/content-pages/page.tsx","app/admin/(dashboard)/cms/categories/page.tsx"]) {
  const src=readCode(page);
  assert.match(src,/cms-sticky-first/, `${page} lost its sticky name column`);
  assert.match(src,/scrollHint=\{zh \? "在表格內左右滑動/, `${page} lost its mobile scroll instruction`);
 }
});

test("listing-category errors keep the chosen checkboxes in the modal",()=>{
 const modal=readCode("app/admin/(dashboard)/content-pages/ListingCategoriesModal.tsx");
 assert.match(modal,/useActionState\(saveListingCategories/);
 assert.match(modal,/<CategoryPicker categories=\{available\} values=\{values\} onChange=\{setValues\}/);
 assert.match(modal,/(role|live)="alert"/);
});


test("category picker preserves hidden selections and supports review and undo",()=>{
 const picker=readCode("app/admin/(dashboard)/content-pages/CategoryPicker.tsx");
 assert.match(picker,/values.map\(value => <input key=\{value\} type="hidden" name="categories"/);
 // The all / selected-only switch is the kit <Segmented> (aria-pressed per option).
 assert.match(picker,/<Segmented[\s\S]*?value=\{selectedOnly \? "selected" : "all"\}/);
 assert.match(readCode("app/admin/ui/Controls.tsx"),/aria-pressed=\{active\}/);
 assert.match(picker,/checked=\{values.includes/);
 assert.match(picker,/確認收錄分類/);
 assert.match(picker,/onChange\(cleared\)/);
});

test("tag tables group compact purpose labels and use region scrolling",()=>{
 const page=readCode("app/admin/(dashboard)/cms/tags/page.tsx");
 const css=readCode("app/globals.css");
 // Purpose labels are a kit <Chips> row of <Badge>s; the table is a labelled, scrollable TableFrame.
 assert.match(page,/<Chips>[\s\S]*?<Badge/);
 assert.match(page,/<TableFrame\b[^\n]*label=\{zh \? "文章標籤表格"[^}]*\} scrollHint=/);
 assert.match(css,/\.a-chips \{[^}]*flex-wrap: wrap/);
});
