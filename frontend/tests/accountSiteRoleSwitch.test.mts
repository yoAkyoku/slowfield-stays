import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readCode } from "./readCode";

test("account role editor displays the current site's saved role", () => {
  const page = readCode("app/admin/(dashboard)/users/page.tsx");
  const api = readCode("app/admin/modules/adminApi.ts");
  assert.match(api, /site_role\?: string/);
  assert.match(page, /row\.site_role \|\| globalRole/);
  assert.match(page, /currentRole=\{displayRole\}/);
  assert.match(page, /hasPermission\(profile\.permissions, "site_users:write"\)/);
  assert.match(page, /!canChangeSiteRoles/);
});

test("the users API returns the AdminUserSite role changed by the PATCH route", () => {
  const backend = fs.readFileSync(path.resolve(process.cwd(), "../backend/app/modules/admin/routes.py"), "utf8");
  assert.match(backend, /site_role_by_user/);
  assert.match(backend, /"site_role": site_role_by_user\[user\.id\]\.name/);
  assert.match(backend, /site_role_by_user\[user\.id\]\.permissions/);
});
