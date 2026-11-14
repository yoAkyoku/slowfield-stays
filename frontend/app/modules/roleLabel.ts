/**
 * Role names, split out of i18n.ts so a CLIENT component can ask.
 *
 * i18n.ts imports `next/headers` to resolve the locale, which makes the whole
 * module server-only: importing it from a "use client" file builds fine under
 * tsc and the tests — neither enforces that boundary — and then fails the real
 * `next build`. 角色 is a client component, so the helper lives here, where it
 * has no imports at all. The TABLES stay in i18n.ts and reach this function as
 * an argument, the way the screens already pass them.
 */

/**
 * A role's name for a human, from one of the `roleLabels` tables.
 *
 * Every call site used to be `map[value] ?? value`, which printed the raw
 * database key when a role was not in the table — 站群 shipped a `site_member`
 * role that no table listed, so the 角色 screen showed 站點管理員 / 編輯者 /
 * **site_member** / 超級管理者, one tab in snake_case in both languages
 * (客戶: 怎麼沒有雙語?).
 *
 * The table is still the answer wherever it has one. What changed is the last
 * resort: an unlisted key is spelled as words rather than as an identifier, so
 * a role added later reads as "Site Member" instead of leaking how it is
 * stored. It is not a translation — a new role still needs its two entries
 * above — but it is not a bug report from the client either.
 */
export function roleLabel(map: Record<string, string>, role: string): string {
  const known = map[role];
  if (known) return known;
  return String(role ?? "")
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
