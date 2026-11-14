"use server";

import { adminJsonRequest } from "./adminRequest";
import { actionRedirect } from "./adminUtils";

export async function createAdminUserAction(formData: FormData) {
  const siteSlug = String(formData.get("site_slug") ?? "").trim();
  const result = await adminJsonRequest("/users", {
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? "admin"),
    ...(siteSlug ? { site_slug: siteSlug } : {})
  });
  actionRedirect(result, "/admin/users");
}

export async function updateAdminUserStatusAction(id: string, status: string) {
  const result = await adminJsonRequest(`/users/${id}/status`, { status }, "PATCH");
  actionRedirect(result, "/admin/users");
}

/* ── 刪除 / 復原 / 永久刪除 ──────────────────────────────────────────────────
   The same three verbs 住宿 / 內容 / 橫幅 / 表單聯絡 already have, against the
   super-admin-only routes in admin/routes.py. Every refusal there is a 400 or
   403 carrying a sentence written for the operator ("This is the last
   super-admin. Give another account the super-admin role first."), and
   `resultFromResponse` lifts `detail` straight into the result message — so
   `actionRedirect` puts THAT sentence in `?error=`, where AdminFlash shows it.
   The fallback below is only ever reached when the API answers with no body at
   all, which is why it is worded as a status rather than as an explanation. */

/** Soft delete. The account leaves the list and is signed out; the row stays in
 *  the database, in 已刪除, where 復原 can reach it. */
export async function deleteAdminUserAction(id: string) {
  const result = await adminJsonRequest(`/users/${id}/delete`, {}, "POST", "Admin user delete failed");
  actionRedirect(result, "/admin/users");
}

/* Both of these land back in 已刪除 rather than on the live list: that is the
   view the button was pressed from, and after 復原 it is where the operator can
   see the account is gone from. */
export async function restoreAdminUserAction(id: string) {
  const result = await adminJsonRequest(`/users/${id}/restore`, {}, "POST", "Admin user restore failed");
  actionRedirect(result, "/admin/users?status=deleted");
}

/** The second delete, offered only from 已刪除. This one does not come back. */
export async function purgeAdminUserAction(id: string) {
  const result = await adminJsonRequest(`/users/${id}/purge`, {}, "POST", "Admin user delete failed");
  actionRedirect(result, "/admin/users?status=deleted");
}

export async function updateAdminUserRoleAction(id: string, formData: FormData) {
  const result = await adminJsonRequest(
    `/users/${id}/role`,
    { role: String(formData.get("role") ?? "") },
    "PATCH"
  );
  actionRedirect(result, "/admin/users");
}

export async function updateRolePermissionsAction(id: string, formData: FormData) {
  const result = await adminJsonRequest(
    `/roles/${id}/permissions`,
    { permissions: formData.getAll("permissions").map(String) },
    "PATCH"
  );
  /* Back to the role that was just edited, not to the first tab. The redirect
     remounts the client view, whose active tab is seeded from roles[0] — so
     saving 編輯者 landed the user on 站點管理員's permission grid, which looks
     identical. A second round of clicks then edited a role nobody chose. The
     name is validated rather than interpolated: it reaches the redirect target,
     and this action is reachable by anyone who can post the form. */
  const roleName = String(formData.get("role_name") ?? "");
  const target = /^[a-z0-9_]{1,40}$/.test(roleName)
    ? `/admin/roles?role=${encodeURIComponent(roleName)}`
    : "/admin/roles";
  actionRedirect(result, target);
}
