import assert from "node:assert/strict";
import test from "node:test";
import { collectedArticles, articleCollectionPlacements, siteCollections, listingFilterLocations } from "../app/admin/modules/articlePlacement.ts";
import { sidebarHrefIsActive } from "../app/admin/modules/sidebarActive.ts";
const pages = [1,2,3].map(id => ({id,status:"published",content_type:"news",categories:["experience"],tags:["親子"],translations:{},deleted_at:null})) as any;
test("collection deduplication and per-source limit match actual inclusion", () => {
  assert.deepEqual(collectedArticles({source:"news",extra_sources:["experience"],limit:2},pages,true).map(p=>p.id),[3,2]);
  assert.deepEqual(collectedArticles({source:"news",filter_tags:["夏天"]},pages,true),[]);
  assert.deepEqual(collectedArticles({source:"news",pick_mode:"manual",picked_ids:[1,3]},pages,true).map(p=>p.id),[1,3]);
});
test("draft placement preview respects limits and disabled collections", () => {
  const site={settings:{homepage:{blocks:[{id:"news",type:"stays",config:{source:"news",limit:1}},{id:"hidden",enabled:false,type:"stays",config:{source:"news"}}]}}} as any;
  assert.equal(siteCollections(site,true).length,1);
  assert.equal(articleCollectionPlacements(pages[0],pages,site,true).length,0);
  assert.equal(articleCollectionPlacements({...pages[0],id:4,status:"draft"},pages,site,true).length,1);
});
test("banner navigation does not select the article workbench", () => {
  assert.equal(sidebarHrefIsActive("/admin/cms","/admin/cms","tab=banners"),false);
  assert.equal(sidebarHrefIsActive("/admin/cms?tab=banners","/admin/cms","tab=banners"),true);
  assert.equal(sidebarHrefIsActive("/admin/cms?tab=banners","/admin/cms/tags","tab=banners"),false);
});

test("public filter labels use the page label when its article type has a different key",()=>{
 const site={settings:{pages:{latest:{page_type:"cms_list",content_type:"news",label:{zh:"最新消息",en:"News"}}}}} as any;
 assert.deepEqual(listingFilterLocations(site,["news"],true),["最新消息"]);
});
