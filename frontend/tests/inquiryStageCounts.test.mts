import assert from "node:assert/strict";
import test from "node:test";
import { inquiryStageCounts, inquiryCreatedDate } from "../app/admin/modules/inquiryPresentation.ts";
import { readCode } from "./readCode.mts";

test("waiting, follow-up and closed counts never overlap", () => {
  assert.deepEqual(inquiryStageCounts([{status:"new"}]), {newCount:1,activeCount:0,closedCount:0});
  assert.deepEqual(inquiryStageCounts(["new","pending","contacted","quoted","closed","unknown"].map(status=>({status}))), {newCount:2,activeCount:2,closedCount:1});
});

test("date filters use the same Taipei calendar day displayed in the row", () => {
  assert.equal(inquiryCreatedDate("2026-10-17T18:30:00Z"), "2026-10-18");
  assert.equal(inquiryCreatedDate("2026-10-17T18:30:00"), "2026-10-18");
  assert.equal(inquiryCreatedDate(undefined), "");
});

test("the inbox uses the shared stage and calendar-day rules", () => {
  const source = readCode("app/admin/(dashboard)/inquiries/page.tsx");
  assert.match(source, /inquiryStageCounts\(inquiries\)/);
  assert.match(source, /inquiryCreatedDate\(inquiry.created_at\)/);
});
