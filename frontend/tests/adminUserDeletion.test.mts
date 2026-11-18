import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readCode } from "./readCode";
import { callArguments, compileDeclarations, evaluateExpression, jsxTags } from "./sourceEval";
import { t } from "../app/modules/i18n.ts";
import { roleLabel } from "../app/modules/roleLabel.ts";

/**
 * 帳號管理's 刪除 / 復原 / 永久刪除, and the two rows that must not be offered one.
 *
 * The routes behind these are super-admin-only and refuse three things outright
 * — deleting yourself, deleting the last account that can administer the
 * network, and being called by anyone who is not a super-admin. Every refusal
 * is correct on the server and none of them is a reason to draw the button:
 * a control whose only possible outcome is an error dialog is how an operator
 * learns to stop trusting the column it sits in, and the one that says
 * "確定要刪除?" is the worst place to teach that.
 *
 * So the screen has to agree with the server about all three, and the way it
 * counts super-admins is the half that is easy to get wrong: `roleLabels` calls
 * BOTH "super_admin" and "owner" 超級管理者, and the 角色 screen can hand "*" to
 * a role with any name at all. A census by NAME reads the owner as nobody and
 * refuses a deletion that is perfectly safe — the same defect
 * `_super_admin_role_ids` carries a docstring about on the other side.
 *
 * The census is run rather than grepped: `isLastSuperAdmin` is lifted out of
 * the page and called over real rows, so a version that counts by name goes red
 * here instead of passing a substring check.
 */

const PAGE = "app/admin/(dashboard)/users/page.tsx";
const ACTIONS = "app/admin/modules/userActions.ts";
const API = "app/admin/modules/adminApi.ts";
const PAGE_SRC = readCode(PAGE);
const ACTIONS_SRC = readCode(ACTIONS);

// ── the three verbs reach the three routes ──────────────────────────────────

const ROUTES: [string, string, string][] = [
  ["deleteAdminUserAction", "delete", "/admin/users"],
  ["restoreAdminUserAction", "restore", "/admin/users?status=deleted"],
  ["purgeAdminUserAction", "purge", "/admin/users?status=deleted"],
];

for (const [action, segment, target] of ROUTES) {
  test(`${action} POSTs to /users/{id}/${segment}`, () => {
    const body = ACTIONS_SRC.slice(ACTIONS_SRC.indexOf(`export async function ${action}`));
    assert.ok(body.startsWith(`export async function ${action}`), `${action} is gone from userActions.ts`);
    const decl = body.slice(0, body.indexOf("\n}") + 2);
    assert.match(
      decl,
      new RegExp(`adminJsonRequest\\(\`/users/\\$\\{id\\}/${segment}\``),
      `${action} no longer calls the ${segment} route`,
    );
    assert.match(decl, /"POST"/, `${action} does not POST — the routes accept nothing else`);
    assert.ok(
      decl.includes(`actionRedirect(result, "${target}")`),
      `${action} lands somewhere other than ${target}`,
    );
  });
}

test("the two verbs pressed from 已刪除 come back to 已刪除", () => {
  /* Not to the live list. 復原 and 永久刪除 exist only in the bin, so landing on
     the default view answers the press by navigating away from the thing that
     changed — and after 復原 the operator cannot see that the row has left. */
  for (const action of ["restoreAdminUserAction", "purgeAdminUserAction"]) {
    const body = ACTIONS_SRC.slice(ACTIONS_SRC.indexOf(`export async function ${action}`));
    assert.match(body.slice(0, 400), /actionRedirect\(result, "\/admin\/users\?status=deleted"\)/, action);
  }
});

test("a refusal reaches the operator as the server's own sentence", () => {
  /* `resultFromResponse` lifts a 400's `detail` into the message and
     `actionRedirect` puts it in ?error=, which AdminFlash renders. The fourth
     argument is only the no-body fallback — if an action passed it as the
     message, "This is the last super-admin…" would arrive as
     "Admin user delete failed" and the operator would have no idea what to do
     about it. */
  assert.match(ACTIONS_SRC, /actionRedirect\(result, "\/admin\/users"\)/);
  for (const [action] of ROUTES) {
    const body = ACTIONS_SRC.slice(ACTIONS_SRC.indexOf(`export async function ${action}`), ACTIONS_SRC.length);
    assert.match(body.slice(0, 400), /adminJsonRequest\([\s\S]*?"POST",\s*"Admin user [a-z]+ failed"\)/, action);
  }
  // And the page still has somewhere to show it.
  const flashes = jsxTags(PAGE).filter((tag) => tag.tag === "AdminFlashes");
  assert.ok(
    flashes.some((f) => f.attrs.get("error") === "searchParams.error"),
    "帳號管理 has no error flash, so a refusal would arrive as a silent no-op",
  );
});

// ── the census: who counts as another super-admin ───────────────────────────

const census = compileDeclarations(PAGE, ["isSuperAdmin", "isLastSuperAdmin", "deleteRefusal"])({}) as {
  isSuperAdmin: (u: unknown) => boolean;
  isLastSuperAdmin: (u: unknown, others: unknown[]) => boolean;
  deleteRefusal: (u: unknown, others: unknown[], callerId: number) => string;
};

type Row = { id: number; permissions?: string[]; status: string; deleted_at?: string | null };

const row = (id: number, over: Partial<Row> = {}): Row => ({
  id,
  permissions: [],
  status: "active",
  deleted_at: null,
  ...over,
});

/** The two names that mean the same thing, plus one that does not announce itself. */
const ROOT = row(1, { permissions: ["*"] });
const OWNER = row(2, { permissions: ["*"] });
const FOUNDER = row(3, { permissions: ["*"] });
const EDITOR = row(4, { permissions: ["cms:read", "cms:write"] });
const OPS = row(5, { permissions: ["global_users:read", "global_users:write"] });

test("a super-admin is one by permission, not by the name of the role", () => {
  assert.equal(census.isSuperAdmin(ROOT), true);
  assert.equal(census.isSuperAdmin(OWNER), true);
  // The caller the route's own permission gate lets through and the handler
  // then refuses: global_users:write is not "*".
  assert.equal(census.isSuperAdmin(OPS), false);
  assert.equal(census.isSuperAdmin(EDITOR), false);
  assert.equal(census.isSuperAdmin({}), false, "a row with no permissions field must not throw");
});

test("an owner counts as another super-admin", () => {
  /* The one a name-based count gets wrong, in the direction that matters: it
     would hide 刪除 on a network that has two people who can administer it. */
  assert.equal(census.isLastSuperAdmin(ROOT, [ROOT, OWNER, EDITOR]), false);
});

test("a bespoke role carrying the wildcard counts too", () => {
  assert.equal(census.isLastSuperAdmin(ROOT, [ROOT, FOUNDER, EDITOR]), false);
});

test("the only super-admin left is not offered 刪除", () => {
  assert.equal(census.isLastSuperAdmin(ROOT, [ROOT, EDITOR, OPS]), true);
});

test("an account that cannot sign in is not cover", () => {
  // 停用 and 已刪除 both stop a login, and reactivating either is itself the
  // super-admin work nobody would be left to do.
  assert.equal(census.isLastSuperAdmin(ROOT, [ROOT, row(9, { permissions: ["*"], status: "archived" })]), true);
  assert.equal(
    census.isLastSuperAdmin(ROOT, [ROOT, row(9, { permissions: ["*"], deleted_at: "2026-08-30T00:00:00Z" })]),
    true,
  );
});

test("an account is not its own cover", () => {
  // The list the page holds includes the row being deleted, so a census that
  // forgot to exclude it would never refuse anything.
  assert.equal(census.isLastSuperAdmin(ROOT, [ROOT]), true);
});

test("a row that is not a super-admin is never the last one", () => {
  // Otherwise the last EDITOR on the network would lose its 刪除 button too.
  assert.equal(census.isLastSuperAdmin(EDITOR, [EDITOR]), false);
  assert.equal(census.isLastSuperAdmin(OPS, [OPS]), false);
});

// ── the two rows the screen must not offer 刪除 ──────────────────────────────

test("your own row is refused before anything else is asked", () => {
  assert.equal(census.deleteRefusal(ROOT, [ROOT, OWNER], 1), "self");
  // Both at once — the sole super-admin looking at their own row. "self" is
  // the honest reason: it is the one that would still hold if someone else
  // were promoted.
  assert.equal(census.deleteRefusal(ROOT, [ROOT], 1), "self");
});

test("someone else's row is refused only when it is the last super-admin", () => {
  assert.equal(census.deleteRefusal(ROOT, [ROOT, EDITOR], 4), "last");
  assert.equal(census.deleteRefusal(EDITOR, [ROOT, EDITOR], 1), "");
  assert.equal(census.deleteRefusal(ROOT, [ROOT, OWNER], 2), "");
});

test("the page asks about the row, against the live list, as the signed-in account", () => {
  /* Three arguments and each one is a way to get this wrong: the census run
     over `rows` would be the FILTERED list, so a keyword search that hid the
     other super-admin would take 刪除 away from the one still shown; and a
     caller id read from anywhere but the profile is not who the API will
     compare against. */
  const calls = callArguments(PAGE, "deleteRefusal");
  /* Every call, not one call. 停用 now asks the same question — the API refuses
     it for the same two rows, one door along — so pinning the COUNT would make
     adding a second correct caller fail while a single wrong one passed. What
     must not drift is the arguments: `rows` in place of `users` is the filtered
     list, so a keyword search that hid the other super-admin would take the
     button away from the one still shown. */
  assert.ok(calls.length >= 1, "the page no longer consults deleteRefusal at all");
  for (const call of calls) {
    assert.deepEqual(call, ["row", "users", "profile.id"], "deleteRefusal is asked the wrong question");
  }
});

// ── what the screen draws ───────────────────────────────────────────────────

/** The conditional expression `cond ? … : …`, as its two halves' source. */
function branches(source: string, condition: string): { whenFalse: string; whenTrue: string } {
  const file = ts.createSourceFile(PAGE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found: ts.ConditionalExpression | null = null;
  const visit = (node: ts.Node): void => {
    if (ts.isConditionalExpression(node) && node.condition.getText(file).replace(/\s+/g, " ") === condition) {
      found = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(found, `no \`${condition} ? … : …\` in ${PAGE}`);
  const conditional = found as unknown as ts.ConditionalExpression;
  return { whenFalse: conditional.whenFalse.getText(file), whenTrue: conditional.whenTrue.getText(file) };
}

test("刪除 is drawn for a live row and 復原 / 永久刪除 only for one in 已刪除", () => {
  /* The same button meaning two different things in two views is the defect
     StatusActions carries a comment about; here the split is by `deleted`. */
  const { whenFalse, whenTrue } = branches(PAGE_SRC, "deleted");
  assert.match(whenTrue, /restoreAdminUserAction/, "已刪除 has no way back");
  assert.match(whenTrue, /purgeAdminUserAction/, "已刪除 cannot be emptied");
  assert.doesNotMatch(whenTrue, /deleteAdminUserAction/, "the bin offers a second soft delete, which is a no-op");
  assert.doesNotMatch(
    whenTrue,
    /updateAdminUserStatusAction/,
    "the bin offers 停用 / 啟用, which the API answers 400 — a deleted account has no status to file",
  );
  assert.match(whenFalse, /deleteAdminUserAction/, "the live list lost 刪除");
  assert.doesNotMatch(whenFalse, /purgeAdminUserAction/, "永久刪除 escaped the bin and is on the live list");
});

test("刪除 is drawn only when the API would accept it", () => {
  assert.match(
    PAGE_SRC,
    /\{canRemove && !refusal \? \(\s*<ConfirmSubmitButton\s+action=\{deleteAdminUserAction/,
    "刪除 is drawn without consulting the refusal, so the two blocked rows get a button that always errors",
  );
});

test("a blocked row says why, in words, in the button's place", () => {
  /* Not a disabled button and not a tooltip: neither says anything to a finger,
     and this admin is used on an iPad. */
  assert.match(PAGE_SRC, /\{canRemove && refusal \? \(\s*<span className="admin-public-state">/);
  const reason = PAGE_SRC.slice(PAGE_SRC.indexOf("{canRemove && refusal ? ("), PAGE_SRC.indexOf("{canRemove && !refusal"));
  for (const words of ["本人帳號，無法刪除", "You cannot delete your own account", "唯一的超級管理者，無法刪除", "The last super admin cannot be deleted"]) {
    assert.ok(reason.includes(words), `the blocked row never says "${words}"`);
  }
});

test("the trio is gated on the wildcard, not on global_users:write", () => {
  /* `global_users:write` is grantable to a bespoke role from the 角色 screen and
     that role passes the route's own permission gate — the handler then refuses
     it with 403. /auth/me answers ["*"] for a super-admin and for nobody else,
     which is the only thing that matches what the routes actually check. */
  assert.match(PAGE_SRC, /const canRemove = \(profile\.permissions \?\? \[\]\)\.includes\("\*"\);/);
  assert.doesNotMatch(
    PAGE_SRC,
    /const canRemove = hasPermission\(/,
    "canRemove is back to a permission a non-super-admin can hold",
  );
});

// ── the dialogs name the account ────────────────────────────────────────────

/** The `body` of the ConfirmSubmitButton whose action is `action`. */
function confirmBody(action: string): string {
  const tag = jsxTags(PAGE).find((t2) => t2.tag === "ConfirmSubmitButton" && (t2.attrs.get("action") ?? "").includes(action));
  assert.ok(tag, `no ConfirmSubmitButton wired to ${action} — the verb is unconfirmed`);
  const body = tag!.attrs.get("body");
  assert.ok(body, `${action}'s dialog has no body`);
  return body!;
}

const NAMED = compileDeclarations(PAGE, ["account", "accountEn"], ["accountName", "accountEmail"]);

test("the account label is built from the row's own name and email", () => {
  const withName = NAMED({ accountName: "陳小明", accountEmail: "ming@example.com" }) as unknown as Record<string, string>;
  assert.ok(withName.account.includes("陳小明"));
  assert.ok(withName.account.includes("ming@example.com"));
  assert.ok(withName.accountEn.includes("陳小明"));
  assert.ok(withName.accountEn.includes("ming@example.com"));
  // The email alone when there is no name — an admin row without one is
  // ordinary, and a dialog about 「」 names nothing.
  const noName = NAMED({ accountName: "", accountEmail: "ops@example.com" }) as unknown as Record<string, string>;
  assert.equal(noName.account, "ops@example.com");
  assert.equal(noName.accountEn, "ops@example.com");
});

for (const [verb, action] of [["刪除", "deleteAdminUserAction"], ["永久刪除", "purgeAdminUserAction"]] as const) {
  test(`${verb}'s dialog names the account, in both languages`, () => {
    /* The rows of an admin list are near-identical — the same role words, the
       same 啟用 badge — and the email is the only thing on one that is unique.
       A dialog that names nothing cannot be used to check the aim, which is the
       whole reason it is asked. Run rather than grepped: a body that
       interpolates a variable holding the wrong thing still goes red. */
    const render = evaluateExpression(confirmBody(action), ["zh", "account", "accountEn"]);
    const named = { account: "陳小明（ming@example.com）", accountEn: "Ming Chen (ming@example.com)" };
    const zhText = String(render({ zh: true, ...named }));
    const enText = String(render({ zh: false, ...named }));
    assert.ok(zhText.includes("ming@example.com"), `${verb}'s Chinese dialog does not say which account`);
    assert.ok(zhText.includes("陳小明"), `${verb}'s Chinese dialog drops the name`);
    assert.ok(enText.includes("ming@example.com"), `${verb}'s English dialog does not say which account`);
    assert.ok(enText.includes("Ming Chen"), `${verb}'s English dialog drops the name`);
    /* Bilingual for real, not one language shown to both. The two dialogs are
       built from the same two words the row is labelled with, so the only thing
       that can tell them apart is the sentence around them. */
    assert.match(zhText, /[一-鿿]/, `${verb}'s Chinese dialog has no Chinese in it`);
    assert.doesNotMatch(enText, /[一-鿿]/, `${verb}'s English dialog is not English`);
    assert.notEqual(zhText, enText);
  });
}

test("永久刪除 says it is permanent and 刪除 says it is not", () => {
  // The two dialogs are one word apart on screen; the sentence is what
  // separates a recoverable action from an irreversible one.
  const render = (action: string, zh: boolean) =>
    String(evaluateExpression(confirmBody(action), ["zh", "account", "accountEn"])({ zh, account: "a@b.c", accountEn: "a@b.c" }));
  assert.match(render("purgeAdminUserAction", true), /無法還原/);
  assert.match(render("purgeAdminUserAction", false), /cannot be restored/);
  assert.match(render("deleteAdminUserAction", true), /可在該處復原/);
  assert.match(render("deleteAdminUserAction", false), /can be restored/);
});

// ── the bin is a view, not a status ─────────────────────────────────────────

test("已刪除 is fetched, not filtered out of the live list", () => {
  assert.match(PAGE_SRC, /const visibility = showDeleted \? "deleted" : "active";/);
  assert.deepEqual(callArguments(PAGE, "getAdminUsers"), [["visibility"]], "帳號管理 never asks the API for the bin");
  assert.match(readCode(API), /getAdminUsers\(visibility\?: string\)[\s\S]{0,120}withVisibility\("\/users", visibility\)/);
});

test("choosing 已刪除 does not also narrow the list by status", () => {
  /* "deleted" names a view, not an account status: every row in the bin is
     啟用 or 停用, so leaving it in the status filter empties the bin. */
  assert.match(PAGE_SRC, /const statusFilter = searchParams\.status === "deleted" \? "" : \(searchParams\.status \?\? ""\);/);
  assert.match(PAGE_SRC, /\.filter\(\(user\) => !statusFilter \|\| user\.status === statusFilter\)/);
  assert.doesNotMatch(
    PAGE_SRC,
    /\.filter\(\(user\) => !searchParams\.status \|\| user\.status === searchParams\.status\)/,
    "the raw status param filters the rows again, so 已刪除 lists nothing",
  );
});

// ── the three fixed bugs this screen must not reintroduce ───────────────────

test("the new buttons live in the row-action bar that is always visible", () => {
  /* rowActionsAlwaysVisible.test.mts owns the CSS half. This is the other half:
     the buttons have to be IN the container that test checks, or its coverage
     does not reach them. */
  // The always-visible bar is the admin kit's <RowActions> (no hover gating).
  const bar = jsxTags(PAGE).find((tag) => tag.tag === "RowActions" || (tag.tag === "div" && tag.attrs.get("className") === "admin-row-actions"));
  assert.ok(bar, "帳號管理's actions are no longer in .admin-row-actions");
  for (const action of ["deleteAdminUserAction", "restoreAdminUserAction", "purgeAdminUserAction"]) {
    assert.ok(bar!.fullText.includes(action), `${action} is outside the row-action bar`);
  }
});

test("帳號管理 introduces no hover-gated class of its own", () => {
  const classes = jsxTags(PAGE)
    .map((tag) => tag.attrs.get("className") ?? "")
    .join(" ");
  const CSS = readCode("app/globals.css").replace(/\/\*[\s\S]*?\*\//g, " ");
  for (const name of new Set(classes.split(/[\s"'`{}$()?:.]+/).filter((c) => /^[a-z][a-z0-9-]+$/.test(c)))) {
    const hidden = new RegExp(`\\.${name}[^{,]*\\{[^{}]*(opacity\\s*:\\s*0\\b|pointer-events\\s*:\\s*none)`, "g");
    const rule = hidden.exec(CSS);
    assert.equal(rule, null, `.${name} is hidden by default, so its buttons cannot be tapped: ${rule?.[0]}`);
  }
});

test("the role mix keys by the role's name, which is what is unique", () => {
  /* `roleLabels` maps "super_admin" AND "owner" to 超級管理者, so a network that
     ships both handed React the same key twice — the defect
     adminTableRowKeys.test.mts exists for, one list over. Run over the real
     labels: a key expression of `role.label` collapses the two. */
  const roles = [
    { name: "super_admin", permissions: ["*"] },
    { name: "owner", permissions: ["*"] },
    { name: "admin", permissions: [] },
    { name: "editor", permissions: [] },
  ];
  const built = compileDeclarations(PAGE, ["roleCounts"], ["roles", "roleLabel", "copy", "users"])({
    roles,
    roleLabel,
    copy: t("zh"),
    users: [],
  }) as unknown as { roleCounts: { label: string; name: string }[] };
  assert.equal(
    new Set(built.roleCounts.map((r) => r.label)).size,
    3,
    "the premise is gone: 超級管理者 is no longer two roles' label, so re-read this test",
  );
  // Each role is a <Badge> in the role mix now.
  const keyTag = jsxTags(PAGE).find((tag) => (tag.tag === "p" || tag.tag === "Badge") && tag.attrs.has("key"));
  assert.ok(keyTag, "the role mix rows are keyed by position now");
  const keyOf = evaluateExpression(keyTag!.attrs.get("key")!, ["role"]);
  const keys = built.roleCounts.map((r) => String(keyOf({ role: r })));
  assert.equal(new Set(keys).size, keys.length, `React is handed ${keys.join(", ")} — two of them the same`);
});

test("帳號管理 resolves every role name through the shared helper", () => {
  /* `map[key] ?? key` is what shipped `site_member` to the screen in both
     languages. The permission tables keep their own lookup — `sites:read` is
     not a role name and roleLabel would Title-Case it into nonsense. */
  assert.match(PAGE_SRC, /roleLabel\(copy\.admin\.roleLabels,/);
  assert.doesNotMatch(
    PAGE_SRC,
    /labelFromMap\(copy\.admin\.roleLabels/,
    "a role name is back on the raw-key fallback",
  );
  assert.equal(
    (PAGE_SRC.match(/copy\.admin\.roleLabels/g) ?? []).length,
    (PAGE_SRC.match(/roleLabel\(copy\.admin\.roleLabels/g) ?? []).length,
    "one of the roleLabels lookups does not go through roleLabel()",
  );
});
const usersEmptyState = compileDeclarations(PAGE, ["getAdminUsersEmptyState"])({}) as {
  getAdminUsersEmptyState: (locale: string, showDeleted: boolean, hasFilters: boolean) => [string, string];
};

test("帳號空狀態會區分空清單與篩選無結果", () => {
  assert.deepEqual(usersEmptyState.getAdminUsersEmptyState("zh", false, false), [
    "尚未有管理員帳號",
    "新增第一個管理員，並確認角色與站台權限。",
  ]);
  assert.deepEqual(usersEmptyState.getAdminUsersEmptyState("zh", false, true), [
    "沒有符合條件的帳號",
    "請調整關鍵字或狀態，或按「重設」清除篩選。",
  ]);
  assert.deepEqual(usersEmptyState.getAdminUsersEmptyState("zh", true, false), [
    "「已刪除」中沒有帳號",
    "從列表刪除的管理員帳號會收在這裡，可以復原或永久刪除。",
  ]);
  assert.deepEqual(usersEmptyState.getAdminUsersEmptyState("en", true, true), [
    "No deleted accounts match",
    "Change the keyword or clear the filter.",
  ]);
});

test("帳號篩選表單會隨查詢條件重建，重設後不留舊的原生欄位值", () => {
  const filterFormKey = PAGE_SRC.match(/<form key=\{`([^`]+)`\}(?: className="admin-filters")?>/)?.[1] ?? "";
  assert.notEqual(filterFormKey, "", "帳號篩選表單需要以查詢條件為 key，讓重設連結卸載舊的 uncontrolled 欄位");
  assert.match(filterFormKey, /searchParams\.keyword/);
  assert.match(filterFormKey, /searchParams\.status/);
  assert.match(filterFormKey, /searchParams\.visibility/);
});