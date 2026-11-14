import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode } from "./readCode";

/**
 * The 已刪除 view's delete has to be the permanent one.
 *
 * Every admin list soft-deletes, so the bin's own `刪除所選` re-POSTed the same
 * soft delete: it re-stamped `deleted_at` on rows that already carried it,
 * redirected with a success notice, and left the list exactly as it was. There
 * was no way to empty the bin from the admin at all.
 *
 * The fix is one flag, and its two halves have to stay together — the form
 * carries `purge` and the server action reads it. If either side is dropped,
 * the button goes back to silently doing nothing (flag lost on the way out) or
 * starts permanently deleting from the live list (flag stuck on). Both halves
 * are asserted here, per entity.
 */

const ACTIONS = {
  stays: readCode("app/admin/modules/stayActions.ts"),
  cms: readCode("app/admin/modules/cmsActions.ts"),
};
const LISTS = {
  stays: readCode("app/admin/(dashboard)/stays/page.tsx"),
  cms: readCode("app/admin/(dashboard)/cms/page.tsx"),
};
const BULK_FORM = readCode("app/admin/modules/BulkSelectForm.tsx");
const STATUS_ACTIONS = readCode("app/admin/modules/StatusActions.tsx");

for (const [name, source] of Object.entries(ACTIONS)) {
  test(`${name}: the bulk action chooses its endpoint from the purge flag`, () => {
    assert.match(source, /const purge = formData\.get\("purge"\) === "1";/);
    assert.match(source, /\$\{purge \? "purge" : "delete"\}/);
  });
}

for (const [name, source] of Object.entries(LISTS)) {
  test(`${name}: every bulk form is told whether the bin is open`, () => {
    const forms = source.match(/<BulkSelectForm\b[\s\S]*?>/g) ?? [];
    assert.ok(forms.length > 0, "expected at least one bulk form");
    for (const form of forms) assert.match(form, /purge=\{isBin\}/);
  });

  test(`${name}: isBin is the deleted view, not a constant`, () => {
    assert.match(source, /const isBin = visibility === "deleted";/);
  });

  test(`${name}: the bin's bulk wording says permanent`, () => {
    assert.match(source, /isBin \? bulkPurgeLabels\.deleteSelected : copy\.admin\.bulkDeleteSelected/);
  });
}

test("the form only sends the flag when it is in purge mode", () => {
  assert.match(BULK_FORM, /\{purge && <input type="hidden" name="purge" value="1" \/>\}/);
});

test("purge defaults off, so a list that forgets the prop soft-deletes", () => {
  // The safe direction: a missed prop leaves rows recoverable rather than
  // permanently deleting from the live list.
  assert.match(BULK_FORM, /purge = false,/);
});

test("the row-level permanent delete exists only for a row already in the bin", () => {
  assert.match(STATUS_ACTIONS, /\{canWrite && deletedAt && actions\.purgeItem && labels\.purge \? \(/);
});

test("the row-level delete-to-bin is hidden once the row is in the bin", () => {
  // Otherwise the same button would mean two different things in two views.
  assert.match(STATUS_ACTIONS, /\{canWrite && !deletedAt \? \(\s*<ConfirmSubmitButton\s+action=\{actions\.deleteItem\}/);
});
