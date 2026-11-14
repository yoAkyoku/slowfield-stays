import assert from "node:assert/strict";
import test from "node:test";
import { siteContentTypesFromConfig } from "../app/admin/modules/siteContentTypes";
import { contentTypeEntries } from "../app/modules/contentTypes";
import { readCode } from "./readCode";

const site={id:1,parent_site_id:null,settings:{article_categories:{news:{label:{zh:"新聞分類",en:"News category"},status:"active",sort_order:0},travel:{label:{zh:"旅行",en:"Travel"},status:"active",sort_order:1},old:{label:{zh:"舊分類",en:"Old"},status:"archived",sort_order:2}},pages:{news:{label:{zh:"最新消息頁面"},content_type:"news"},intro:{label:{zh:"一般介紹"},page_type:"blocks"}}}};
test("editor categories come from registry, not website pages",()=>{
 const categories=siteContentTypesFromConfig(site as any);
 assert.deepEqual(categories.map(c=>c.key),["news","travel"]);
 assert.equal(categories[0].label.zh,"新聞分類");
 assert.equal(categories[1].pageKey,undefined);
});
test("an explicitly empty registry remains empty",()=>{
 assert.deepEqual(siteContentTypesFromConfig({...site,settings:{...site.settings,article_categories:{}}} as any),[]);
});
test("public collections use independent category labels",()=>{
 assert.deepEqual(contentTypeEntries(site,"zh").map(c=>c.label),["新聞分類","旅行"]);
 assert.ok(contentTypeEntries(site,"zh",true).some(c=>c.type==="old"));
});
test("new website page creation does not create a CMS article",()=>{
 const editor=readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
 assert.doesNotMatch(editor,/await createPageAction\(fd\)/);
 assert.match(editor,/await addPropertyPageAction\(fd\)/);
 const action=readCode("app/admin/modules/propertyPagesActions.ts");
 assert.match(action,/page_type: existing\?\.page_type \?\? "blocks"/);
 assert.match(action,/article_categories: existing\?\.article_categories \?\? \[\]/);
});
test("public listing reads selected categories and deduplicates",()=>{
 const renderer=readCode("app/modules/content/CategoryPage.tsx");
 assert.match(renderer,/listingCategoriesForPage\(contentType, pageConfig\)/);
 assert.match(renderer,/new Map\(lists\.flat\(\)\.map/);
 const villa=readCode("app/property/[slug]/[...pageSlug]/page.tsx");
 assert.match(villa,/new Map\(lists\.flat\(\)\.map/);
});

test("editor previews actual listing pages rather than category names",()=>{
 const editor=readCode("app/admin/(dashboard)/cms/PageFormEditor.tsx");
 assert.match(editor,/articleListingLocations\(site, selectedCategories/);
 assert.match(editor,/listingPlacements\.map/);
 assert.match(editor,/尚未有列表頁收錄此分類/);
});

test("category navigation does not also highlight article workspace",async()=>{
 const { sidebarHrefIsActive }=await import("../app/admin/modules/sidebarActive");
 assert.equal(sidebarHrefIsActive("/admin/cms","/admin/cms/categories",""),false);
 assert.equal(sidebarHrefIsActive("/admin/cms/categories","/admin/cms/categories",""),true);
});

test("existing archived categories keep their names in article editors",()=>{
 const editor=readCode("app/admin/(dashboard)/cms/PageFormEditor.tsx");
 assert.match(editor,/contentTypeCatalogue\(site, editLocale\)\.get\(normalized\)\?\.label/);
});

test("legacy public listing categories match the admin page and article placement views", async()=>{
 const {listingCategoriesForPage,listingIndexHref}=await import("../app/modules/contentRoutes");
 const {articleListingLocations,listingFilterLocations}=await import("../app/admin/modules/articlePlacement");
 const site={id:1,parent_site_id:null,settings:{article_categories:{news:{label:{zh:"最新消息",en:"News"},status:"active",sort_order:0}},pages:{news:{page_type:"blocks",content_type:"news",label:{zh:"最新消息",en:"News"}}}}} as any;
 assert.deepEqual(listingCategoriesForPage("news",site.settings.pages.news),["news"]);
 assert.deepEqual(articleListingLocations(site,["news"],true),["最新消息"]);
 assert.deepEqual(listingFilterLocations(site,["news"],true),["最新消息"]);
 assert.equal(listingIndexHref(site,"news"),"/news");
});

test("explicitly empty or hidden article lists stay empty and custom-rendered routes are excluded", async()=>{
 const {listingCategoriesForPage}=await import("../app/modules/contentRoutes");
 assert.deepEqual(listingCategoriesForPage("brand-story",{page_type:"blocks",article_categories:[]}),[]);
 assert.deepEqual(listingCategoriesForPage("news",{content_type:"news",show_cms_list:false}),[]);
 assert.deepEqual(listingCategoriesForPage("contact",{content_type:"news"}),[]);
});
