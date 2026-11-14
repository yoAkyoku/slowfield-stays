import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

const source = readCode("app/admin/(dashboard)/sites/page.tsx");

test("site setting links are gated by each site's own read permission", () => {
  assert.ok(
    source.includes("getAdminProfile(site.slug)"),
    "site network actions need to resolve permissions separately for each site",
  );
  assert.ok(
    source.includes('hasPermission(siteProfile.permissions, "site_users:read")'),
    "site settings are readable only with that site's site_users:read permission",
  );
  assert.ok(
    source.includes("canReadSiteSettings.get(rootSite.id) && ("),
    "the root site's edit link must respect its own permission",
  );
  assert.ok(
    source.includes("canReadSiteSettings.get(site.id) ? ("),
    "each child site's edit link must respect its own permission",
  );
});
