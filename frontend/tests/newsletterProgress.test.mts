import assert from "node:assert/strict";
import test from "node:test";
import { newsletterProgress, newsletterStatusLabel } from "../app/admin/modules/newsletterProgress.ts";
import type { NewsletterCampaign } from "../app/admin/modules/adminApi.ts";

const campaign: NewsletterCampaign = { id: 1, subject: "QA", body: "", status: "queued", target_groups: [], deliveries: 3, sent_count: 2, pending_count: 1 };
test("partial delivery distinguishes successful sends from all recipients", () => {
  assert.deepEqual(newsletterProgress(campaign, true), { primary: "2 / 3", detail: "待寄 1", label: "已寄／收件數" });
  assert.equal(newsletterProgress({ ...campaign, pending_count: 0, sent_count: 1, failed_count: 1, skipped_count: 1 }, false).detail, "Failed 1 · Skipped 1");
});
test("an older API without successful counts is not reported as all sent", () => {
  assert.equal(newsletterProgress({ ...campaign, sent_count: undefined }, true).primary, "— / 3");
});
test("failed or retried deliveries are not labelled as all sent", () => {
  assert.equal(newsletterStatusLabel({ ...campaign, status: "sent", pending_count: 0, failed_count: 1 }, true, "已寄送"), "部分失敗");
  assert.equal(newsletterStatusLabel({ ...campaign, status: "sent" }, true, "已寄送"), "待寄送");
});
