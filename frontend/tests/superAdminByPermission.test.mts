import assert from "node:assert/strict";
import test from "node:test";
import { compileDeclarations, evaluateExpression } from "./sourceEval.mts";
import { readCode } from "./readCode.mts";

/**
 * Who counts as the untouchable administrator — by grant, not by name.
 *
 * `roleLabels` calls BOTH `super_admin` and `owner` 超級管理者, and the roles
 * screen can put `*` on a role called anything at all. Two screens still asked
 * for the literal name:
 *
 *   * 角色 locked its permission grid on `activeRole.name === "super_admin"`, so
 *     an `owner` — or any bespoke role holding the wildcard — arrived fully
 *     editable and could be demoted out of `*`. Every route that could put one
 *     back is itself super-admin work, so that is the one change nobody left can
 *     undo, and it is exactly what the lock existed to prevent.
 *   * 帳號 let the same rows have their role reassigned, and offered the
 *     wildcard roles in the destination list.
 *
 * The backend already counts by permission (`_super_admin_role_ids`, and the
 * deletion guards cover an `owner` and a bespoke `*` role explicitly). These
 * pin the front end to the same rule, so the two agree for every role rather
 * than only for the one that happens to be named.
 */

const ROLES_VIEW = "app/admin/(dashboard)/roles/RolesTabView.tsx";
const USERS_PAGE = "app/admin/(dashboard)/users/page.tsx";

const grantsEverything = compileDeclarations(ROLES_VIEW, ["grantsEverything"])({})
  .grantsEverything as (role: { permissions?: string[] } | undefined) => boolean;

test("the wildcard is what makes a role untouchable", () => {
  assert.equal(grantsEverything({ permissions: ["*"] }), true);
  assert.equal(grantsEverything({ permissions: ["cms:write", "*"] }), true);
});

test("a role named super_admin without the wildcard is not it", () => {
  /* The lock follows the grant. A role that no longer holds everything is not
     the one the network cannot climb back without. */
  assert.equal(grantsEverything({ permissions: ["cms:read", "cms:write"] }), false);
});

test("owner and a bespoke wildcard role both count", () => {
  // The two the name check missed. Named differently, same power.
  assert.equal(grantsEverything({ permissions: ["*"] }), true, "owner");
  assert.equal(grantsEverything({ permissions: ["*"] }), true, "a role called anything at all");
});

test("a role with nothing, or no role at all, is not untouchable", () => {
  // Must not throw on the way to rendering: `roles.find` returns undefined for
  // an account whose role row is missing.
  assert.equal(grantsEverything({ permissions: [] }), false);
  assert.equal(grantsEverything({}), false);
  assert.equal(grantsEverything(undefined), false);
});

test("a near-miss permission is not the wildcard", () => {
  /* Substring matching here would be a privilege escalation: `"*"` has to be an
     ENTRY in the list, not a character inside one. */
  assert.equal(grantsEverything({ permissions: ["cms:*"] }), false);
  assert.equal(grantsEverything({ permissions: ["**"] }), false);
  assert.equal(grantsEverything({ permissions: ["sites:*", "roles:*"] }), false);
});

test("neither screen asks for the role's name any more", () => {
  for (const path of [ROLES_VIEW, USERS_PAGE]) {
    const src = readCode(path)
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    assert.doesNotMatch(
      src,
      /name\s*[!=]==\s*"super_admin"/,
      `${path} still decides by the literal role name, so an owner slips past it`,
    );
  }
});

test("帳號 offers no wildcard role as a destination", () => {
  /* The other half: locking the row is no use if the role can be handed out
     from the dropdown beside it. The real filter, run over real rows. */
  const src = readCode(USERS_PAGE);
  const m = src.match(/roles\.filter\(\([^)]*\) => [^)]*\)/);
  assert.ok(m, `${USERS_PAGE}: the assignable-roles filter is gone or was rewritten`);
  const filtered = evaluateExpression(m![0], ["roles", "isSuperAdmin"])({
    roles: [
      { name: "super_admin", permissions: ["*"] },
      { name: "owner", permissions: ["*"] },
      { name: "chief", permissions: ["*"] },
      { name: "editor", permissions: ["cms:read", "cms:write"] },
      { name: "site_member", permissions: [] },
    ],
    isSuperAdmin: (r: { permissions?: string[] }) => (r.permissions ?? []).includes("*"),
  }) as Array<{ name: string }>;
  assert.deepEqual(
    filtered.map((r) => r.name),
    ["editor"],
    "帳號 must offer only assignable site roles and never a wildcard or global placeholder role",
  );
});

test("停用 is withheld from the same two rows 刪除 is", () => {
  /* Deactivating yourself is a 422 and locks you out between this request and
     the next; the last super-admin is refused one door along from the delete.
     Only on the way OUT of service — putting an account back is never refused. */
  const src = readCode(USERS_PAGE);
  const m = src.match(/const statusRefusal = [^;]+;/);
  assert.ok(m, `${USERS_PAGE}: 停用 no longer consults a refusal at all`);
  const run = (isActive: boolean, id: number) =>
    evaluateExpression(m![0].replace(/^const statusRefusal = /, "").replace(/;$/, ""),
      ["isActive", "deleteRefusal", "row", "users", "profile"])({
      isActive,
      deleteRefusal: (r: { id: number }, _u: unknown, callerId: number) => (r.id === callerId ? "self" : ""),
      row: { id }, users: [], profile: { id: 7 },
    });
  assert.equal(run(true, 7), "self", "an active row for the signed-in account still offers 停用");
  assert.equal(run(true, 8), "", "somebody else's active account lost its 停用");
  assert.equal(run(false, 7), "", "an already-deactivated row must still offer 啟用");
});
