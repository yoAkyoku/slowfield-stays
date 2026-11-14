import assert from "node:assert/strict";
import test from "node:test";
import { compileDeclarations } from "./sourceEval.mts";
import { readCode } from "./readCode.mts";

const VIEW = "app/admin/(dashboard)/roles/RolesTabView.tsx";
const PAGE = "app/admin/(dashboard)/roles/page.tsx";
const hasVisiblePermissionResults = compileDeclarations(VIEW, ["hasVisiblePermissionResults"])({})
  .hasVisiblePermissionResults as (groups: { permissions: string[] }[], allPermissions: string[]) => boolean;

test("role search detects only permissions available in this installation", () => {
  assert.equal(hasVisiblePermissionResults([], ["cms:read"]), false);
  assert.equal(hasVisiblePermissionResults([{ permissions: ["unknown:permission"] }], ["cms:read"]), false);
  assert.equal(hasVisiblePermissionResults([{ permissions: ["cms:read"] }], ["cms:read"]), true);
});

test("role search has an announced empty state and no clean save action", () => {
  const view = readCode(VIEW);
  const page = readCode(PAGE);
  assert.match(view, /roles-search-empty" role="status"/);
  assert.match(view, /!hasVisiblePermissions \?/);
  assert.match(view, /canWrite && !grantsEverything\(activeRole\) && dirty/);
  assert.match(page, /noResultsLabel=\{zh \?/);
});