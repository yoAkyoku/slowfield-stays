import { labelFromMap } from "./adminUtils";

/**
 * How permissions are grouped on screen: the roles page and the new-user form.
 *
 * Each page had its own list and they had drifted — content and media were one
 * group on the roles page and two on the user form, in a different order and
 * under different names — so the same permission sat under a different heading
 * depending on which screen granted it. One list now.
 */
export type PermissionGroup = { id: string; label: string; labelEn: string; permissions: string[] };

export function permissionGroups(zh: boolean): PermissionGroup[] {
  return [
    { id: "sites", label: zh ? "群站管理" : "Site Network", labelEn: zh ? "SITE NETWORK" : "", permissions: ["sites:read", "sites:write"] },
    { id: "global_users", label: zh ? "全域帳號" : "Global Users", labelEn: zh ? "GLOBAL USERS" : "", permissions: ["global_users:read", "global_users:write"] },
    { id: "roles", label: zh ? "角色管理" : "Roles", labelEn: zh ? "ROLES" : "", permissions: ["roles:read", "roles:write"] },
    { id: "stays", label: zh ? "住宿管理" : "Accommodations", labelEn: zh ? "ACCOMMODATIONS" : "", permissions: ["stays:read", "stays:write"] },
    { id: "content", label: zh ? "內容與媒體" : "Content & Media", labelEn: zh ? "CONTENT & MEDIA" : "", permissions: ["cms:read", "cms:write", "media:read", "media:write"] },
    { id: "comms", label: zh ? "表單聯絡" : "Form contacts", labelEn: zh ? "FORM CONTACTS" : "", permissions: ["inquiries:read", "inquiries:write"] },
    { id: "newsletter", label: zh ? "電子報" : "Newsletter", labelEn: zh ? "NEWSLETTER" : "", permissions: ["newsletter:read", "newsletter:write"] },
    { id: "site_users", label: zh ? "站點帳號" : "Site Users", labelEn: zh ? "SITE USERS" : "", permissions: ["site_users:read", "site_users:write"] },
  ];
}

export type GrantedGroup = { label: string; permissions: Array<{ key: string; label: string; desc: string }> };

/**
 * The groups one account actually holds, for the 查看權限 dialogs on the
 * account page and the users list. Both pages wrote the list out again by hand,
 * under older names (住宿 / 內容) than the roles page uses for the same groups.
 * `*` holds everything; a group the account holds nothing in is dropped.
 */
export function grantedPermissionGroups(
  zh: boolean,
  held: readonly string[],
  labels: Record<string, string>,
  descriptions: Record<string, string>,
): GrantedGroup[] {
  const set = new Set(held);
  const all = set.has("*");
  return permissionGroups(zh)
    .map((g) => ({
      label: g.label,
      permissions: g.permissions
        .filter((p) => all || set.has(p))
        .map((p) => ({ key: p, label: labelFromMap(labels, p), desc: labelFromMap(descriptions, p) })),
    }))
    .filter((g) => g.permissions.length > 0);
}
