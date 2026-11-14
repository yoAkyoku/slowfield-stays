import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode.mts";
import { t } from "../app/modules/i18n.ts";
import { roleLabel } from "../app/modules/roleLabel.ts";

/**
 * A role's name on screen is a name, not a database key.
 *
 * The 角色 screen listed 站點管理員 / 編輯者 / **site_member** / 超級管理者 — one
 * tab in snake_case, identical in both languages, because `roleLabels` covered
 * super_admin / owner / admin / editor and the site network ships a fifth role
 * the table never listed. Every call site spelled the fallback the same way,
 * `map[value] ?? value`, so the key went straight to the page (客戶: 怎麼沒有雙語?).
 *
 * This is the third table in this codebase to leak a raw key for a value it did
 * not list — 頁面管理 printed `career`, and the collection block printed
 * `curation` on a Chinese page. So the entries are added AND the last resort is
 * no longer an identifier.
 */

const ZH = t("zh").admin.roleLabels as Record<string, string>;
const EN = t("en").admin.roleLabels as Record<string, string>;

test("every role the admin ships is named in both languages", () => {
  // The four the table always had, plus the one that was missing.
  for (const role of ["super_admin", "owner", "admin", "editor", "site_member"]) {
    assert.ok(ZH[role], `${role} has no Chinese name`);
    assert.ok(EN[role], `${role} has no English name`);
  }
  assert.equal(ZH.site_member, "站點成員");
  assert.equal(EN.site_member, "Site Member");
});

test("a Chinese name is actually Chinese", () => {
  /* The bug was not "no entry" — it was English-shaped text on a Chinese
     screen. An entry that copied the key across would pass a presence check
     and fail the client the same way. */
  for (const role of ["super_admin", "admin", "editor", "site_member"]) {
    assert.match(ZH[role], /[一-鿿]/, `${role}'s Chinese name has no Chinese in it`);
    assert.doesNotMatch(ZH[role], /_/, `${role}'s Chinese name still looks like a key`);
  }
});

test("the table answers whenever it has an answer", () => {
  // The fallback must not shadow a real translation.
  assert.equal(roleLabel(ZH, "admin"), "站點管理員");
  assert.equal(roleLabel(EN, "admin"), "Site Admin");
  assert.equal(roleLabel(ZH, "site_member"), "站點成員");
});

test("a role nobody listed reads as words, not as an identifier", () => {
  /* Not a translation — a new role still needs its two entries — but it must
     not reach the page as snake_case. */
  assert.equal(roleLabel(ZH, "site_member_extra"), "Site Member Extra");
  assert.equal(roleLabel(EN, "billing-manager"), "Billing Manager");
  assert.equal(roleLabel(EN, "guest"), "Guest");
});

test("the fallback survives the values that are not names", () => {
  // Nothing here may throw on the way to rendering a page.
  assert.equal(roleLabel(EN, ""), "");
  assert.equal(roleLabel(EN, "___"), "");
  assert.equal(roleLabel(EN, undefined as unknown as string), "");
});

test("no admin screen still falls back to the raw role key", () => {
  /* The exact expression that caused it, in each of the places that had it —
     pinned by shape so a revert is loud rather than silent. */
  const screens = [
    "app/admin/(dashboard)/roles/RolesTabView.tsx",
    "app/admin/(dashboard)/layout.tsx",
    /* 帳號管理 prints a role name three times — the column, the role picker's
       options, and the permission dialog's heading — and had its own copy of
       the `map[value] ?? value` helper for all three. */
    "app/admin/(dashboard)/users/page.tsx",
  ];
  for (const path of screens) {
    const src = readCode(path);
    assert.match(src, /roleLabel\(/, `${path} no longer resolves role names through the shared helper`);
    assert.doesNotMatch(
      src,
      /roleLabels\[[^\]]+\]\s*\?\?/,
      `${path} is back to printing the raw role key when the table has no entry`,
    );
  }
});
