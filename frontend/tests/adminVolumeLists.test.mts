import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode.mts";

test("operational lists traverse the complete scoped dataset instead of the default 200 rows", () => {
  const code = readCode("app/admin/modules/adminApi.ts");
  for (const type of ["Banner", "AdminInquiry", "AdminBookingRequest", "NewsletterSubscriber", "NewsletterCampaign"]) {
    assert.match(code, new RegExp(`return adminFetchAll<${type}>\\(`));
  }
  assert.match(code, /adminFetchAll<Stay &/);
  assert.match(code, /skip=\$\{skip\}&limit=\$\{limit\}/);
  assert.match(code, /const separator = path.includes\("\?"\) \? "&" : "\?"/);
});
