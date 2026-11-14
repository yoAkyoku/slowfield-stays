import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { declarationText, evaluateExpression, initialiserText, jsxTags } from "./sourceEval";
import { trs } from "../app/modules/tr.ts";

/** The shared row-action component the three list pages render. */
const STATUS_ACTIONS = "app/admin/modules/StatusActions.tsx";

/**
 * A delete in this admin asks before it runs, and says what it is deleting.
 *
 * 刪除內容頁, 刪除住宿 and 刪除橫幅 were plain submit buttons: one press on the
 * editor sidebar — two rows under 儲存, same width, same weight — took the
 * record off the public site with nothing in between. The row 刪除 on the
 * newsletter campaigns, the newsletter subscribers and 表單聯絡 were the same
 * shape at the end of a row of identical buttons in a paginated table, where
 * the failure a dialog exists to catch is aiming one row off.
 *
 * The pattern was already here and these were the ones that skipped it: the
 * block editors guard `remove` with a named `confirm`, and every other
 * destructive server action comes through ConfirmSubmitButton's themed dialog
 * (刪除站台, the four 永久刪除, every 批次刪除). So this is about them rejoining
 * it, not about a new mechanism.
 *
 * Two things have to hold, and they fail independently:
 *
 *   1. No destructive action is reachable as a form submit. That is the whole
 *      defect — a `<form action={deleteX}>` or a `formAction={deleteX}` runs on
 *      the first click, dialog or no dialog elsewhere on the page.
 *   2. Each dialog NAMES its subject. A dialog that asks "確定嗎？" about
 *      nothing in particular cannot be used to check the aim, which is the only
 *      thing it is for, and it is the one everybody learns to dismiss without
 *      reading — at which point the 永久刪除 dialog stops working too.
 */

/* ── The sweep: nothing destructive submits ──────────────────────────────── */

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...tsxFiles(path));
    else if (entry.endsWith(".tsx")) out.push(path.split("\\").join("/"));
  }
  return out;
}

const ADMIN_FILES = tsxFiles("app/admin");

/** The identifier an action expression starts with — `deletePageAction` out of
 *  `deletePageAction.bind(null, id, returnTo)`. */
function callee(expression: string): string {
  return expression.trim().match(/^[A-Za-z_$][\w$]*/)?.[0] ?? "";
}

/**
 * Names that mean "this removes something".
 *
 * Matched on the leading identifier rather than anywhere in the expression, so
 * a `returnTo` that happens to mention deleted rows is not an action. Bare
 * `remove` / `purge` are in because 表單聯絡 aliases its two endpoints to those
 * names per row (`const remove = isBooking ? deleteBookingAction : …`).
 */
const DESTRUCTIVE = /^(bulkDelete|delete|purge|remove)/i;

/**
 * A destructive form is fine when the dialog is the only way to submit it.
 *
 * 刪除站台 is built that way: ConfirmSubmitButton with no `action` prop calls
 * `requestSubmit()` on the form it sits in, so the site id can travel as a
 * hidden field. Nothing else inside that form can submit, so the first click
 * still only opens the dialog. Any plain submit control alongside puts the
 * unguarded path back, which is why both halves are checked.
 */
function gatedByDialog(element: string): boolean {
  if (!element.includes("<ConfirmSubmitButton")) return false;
  return !element.includes("<SubmitButton") && !element.includes('type="submit"');
}

test("the destructive-name test itself recognises the real action names", () => {
  // Otherwise the sweep below is a loop that never matches anything and reports
  // a clean admin whatever is in it.
  for (const expression of [
    "deletePageAction.bind(null, params.id, returnTo)",
    "purgeCampaignAction.bind(null, c.id, BIN_RETURN)",
    "remove.bind(null, String(row.id))",
    "bulkDeleteStaysAction",
    "deleteAction",
  ]) {
    assert.ok(DESTRUCTIVE.test(callee(expression)), expression);
  }
  for (const expression of ["restorePageAction.bind(null, id)", "updateStayAction", "action", "setStatus.bind(null, id)"]) {
    assert.ok(!DESTRUCTIVE.test(callee(expression)), expression);
  }
});

test("no destructive action in the admin runs on the first click", () => {
  const offenders: string[] = [];
  let formsSeen = 0;
  let submitButtonsSeen = 0;

  for (const file of ADMIN_FILES) {
    for (const tag of jsxTags(file)) {
      // A form's own action fires the moment any submit button inside it is
      // pressed, so a destructive one here has no gate at all.
      if (tag.tag === "form" || tag.tag === "SafeForm") {
        formsSeen += 1;
        const action = tag.attrs.get("action") ?? "";
        if (DESTRUCTIVE.test(callee(action)) && !gatedByDialog(tag.fullText)) {
          offenders.push(`${file}: <${tag.tag} action={${action}}>`);
        }
      }
      // formAction overrides the enclosing form's action for one button. This
      // is how 刪除內容頁 / 刪除住宿 / 刪除橫幅 shipped: a submit button beside
      // 儲存, indistinguishable from it until it had run.
      const formAction = tag.attrs.get("formAction");
      if (formAction !== undefined) {
        submitButtonsSeen += 1;
        if (DESTRUCTIVE.test(callee(formAction))) offenders.push(`${file}: <${tag.tag} formAction={${formAction}}>`);
      }
    }
  }

  assert.ok(ADMIN_FILES.length > 40, `the walk found ${ADMIN_FILES.length} admin components — it is not walking`);
  assert.ok(formsSeen > 10, `the walk found ${formsSeen} forms — it is reading tags but not finding any`);
  assert.ok(submitButtonsSeen > 0, "no formAction anywhere — the attribute was renamed, so this half checks nothing");
  assert.deepEqual(
    offenders,
    [],
    "these run on the first click; route them through ConfirmSubmitButton like every other destructive action here",
  );
});

/* ── Each dialog names what it is about to delete ────────────────────────── */

type Guarded = {
  file: string;
  /** The leading identifier of the dialog's `action` prop. */
  action: string;
  label: string;
  /**
   * One binding set per language, with the record's name threaded through
   * whatever the body reads it from. Both are checked: the first attempt at
   * this test only looked for the interpolation somewhere in the expression,
   * and stayed green when the Chinese half of a bilingual body stopped naming
   * the page while the English half still did.
   */
  contexts: (name: string) => Array<Record<string, unknown>>;
};

/**
 * Listed rather than derived from the sweep above.
 *
 * A version of this that collected "every ConfirmSubmitButton with a
 * destructive action" and asserted over that set would pass with an empty set —
 * which is exactly the state this file exists to catch, since removing the
 * dialogs removes the things it would have checked.
 */
const GUARDED: Guarded[] = [
  {
    file: "app/admin/(dashboard)/cms/PageFormEditor.tsx",
    action: "deleteAction",
    label: "刪除內容頁",
    contexts: (name) => [{ locale: "zh", deletedName: name }, { locale: "en", deletedName: name }],
  },
  {
    file: "app/admin/(dashboard)/stays/StayEditor.tsx",
    action: "deleteAction",
    label: "刪除住宿",
    contexts: (name) => [{ defaultLocale: "zh", deletedName: name }, { defaultLocale: "en", deletedName: name }],
  },
  {
    file: "app/admin/(dashboard)/cms/BannerFormEditor.tsx",
    action: "deleteAction",
    label: "刪除橫幅",
    contexts: (name) => [{ locale: "zh", deletedName: name }, { locale: "en", deletedName: name }],
  },
  {
    file: "app/admin/(dashboard)/newsletter/panels/CampaignsPanel.tsx",
    action: "deleteCampaignAction",
    label: "電子報 刪除",
    contexts: (name) => [{ zh: true, c: { subject: name } }, { zh: false, c: { subject: name } }],
  },
  {
    file: "app/admin/(dashboard)/newsletter/panels/CampaignsPanel.tsx",
    action: "purgeCampaignAction",
    label: "電子報 永久刪除",
    contexts: (name) => [{ zh: true, c: { subject: name } }, { zh: false, c: { subject: name } }],
  },
  {
    file: "app/admin/(dashboard)/newsletter/panels/SubscriberPanel.tsx",
    action: "deleteSubscriberAction",
    label: "訂閱者 刪除",
    contexts: (name) => [{ zh: true, s: { email: name } }, { zh: false, s: { email: name } }],
  },
  {
    file: "app/admin/(dashboard)/newsletter/panels/SubscriberPanel.tsx",
    action: "purgeSubscriberAction",
    label: "訂閱者 永久刪除",
    contexts: (name) => [{ zh: true, s: { email: name } }, { zh: false, s: { email: name } }],
  },
  {
    file: "app/admin/(dashboard)/inquiries/page.tsx",
    action: "remove",
    label: "表單聯絡 刪除",
    contexts: (name) => [{ zh: true, sender: name }, { zh: false, sender: name }],
  },
  {
    file: "app/admin/(dashboard)/inquiries/page.tsx",
    action: "purge",
    label: "表單聯絡 永久刪除",
    contexts: (name) => [{ zh: true, sender: name }, { zh: false, sender: name }],
  },
];

/**
 * The body expression, following one hop through a local const.
 *
 * The three editors build theirs above the JSX so the sidebar stays readable;
 * the row dialogs write theirs inline. Both end up as an expression that can be
 * compiled and run, which is the point — the assertion below reads the sentence
 * an editor would actually see, not the source that produces it.
 */
function bodyExpression(file: string, body: string): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(body)) return body;
  const declared = declarationText(file, [body]).get(body);
  assert.ok(declared, `${file}: body={${body}} but there is no declaration of ${body}`);
  return initialiserText(file, body);
}

for (const { file, action, label, contexts } of GUARDED) {
  const dialogs = jsxTags(file).filter(
    (tag) => tag.tag === "ConfirmSubmitButton" && callee(tag.attrs.get("action") ?? "") === action,
  );

  test(`${label}: goes through the themed dialog`, () => {
    assert.equal(dialogs.length, 1, `${file}: found ${dialogs.length} ConfirmSubmitButton for ${action}, expected one`);
  });

  test(`${label}: the dialog names the record, in both languages`, () => {
    const body = dialogs[0]?.attrs.get("body");
    assert.ok(body, `${file}: the ${action} dialog has no body`);

    const sentinel = "Sakura-Trail-77";
    const [first] = contexts(sentinel);
    const render = evaluateExpression(bodyExpression(file, body!), Object.keys(first));

    for (const ctx of contexts(sentinel)) {
      const text = String(render(ctx));
      assert.ok(
        text.includes(sentinel),
        `${file}: the ${action} dialog reads "${text}" — it names no record, so it cannot be used to check the aim`,
      );
    }
  });
}

/* ── The row dialogs that reach the dialog through StatusActions ─────────── */

/**
 * StatusActions renders the delete and purge dialogs for every row of the CMS
 * page list, the banner list and the stay catalogue. Its `labels` prop is one
 * object shared by the whole table, so those two sentences named no record —
 * the same words on all 24 rows, which is the state the dialogs above were
 * given names to escape. The name has to come from the caller, because the
 * caller is what has the row.
 *
 * Checked from the CALLER rather than from StatusActions: the body is only as
 * good as the expression passed in, and StatusActions cannot name a row it was
 * never told about. `trs` is the real one, so a body that read the wrong field
 * (a slug, an id) would not carry the sentinel and this would fail.
 */
type RowNamed = {
  file: string;
  prop: "confirmDeleteBody" | "confirmPurgeBody";
  label: string;
  contexts: (name: string) => Array<Record<string, unknown>>;
};

const ROW_NAMED: RowNamed[] = [
  ...(["confirmDeleteBody", "confirmPurgeBody"] as const).flatMap((prop) => [
    {
      file: "app/admin/(dashboard)/cms/CmsPagesTable.tsx",
      prop,
      label: `內容頁列 ${prop === "confirmDeleteBody" ? "刪除" : "永久刪除"}`,
      contexts: (name: string) => [
        { locale: "zh", page: { title: name }, trs },
        { locale: "en", page: { title: name }, trs },
      ],
    },
    {
      file: "app/admin/(dashboard)/cms/CmsBannersTable.tsx",
      prop,
      label: `橫幅列 ${prop === "confirmDeleteBody" ? "刪除" : "永久刪除"}`,
      contexts: (name: string) => [
        { locale: "zh", banner: { title: name }, trs },
        { locale: "en", banner: { title: name }, trs },
      ],
    },
    {
      file: "app/admin/(dashboard)/stays/page.tsx",
      prop,
      label: `住宿列 ${prop === "confirmDeleteBody" ? "刪除" : "永久刪除"}`,
      contexts: (name: string) => [
        { locale: "zh", stay: { name }, trs },
        { locale: "en", stay: { name }, trs },
      ],
    },
  ]),
];

for (const { file, prop, label, contexts } of ROW_NAMED) {
  test(`${label}: the row's own name reaches the dialog, in both languages`, () => {
    const tags = jsxTags(file).filter((tag) => tag.tag === "StatusActions");
    assert.equal(tags.length, 1, `${file}: expected one <StatusActions>, found ${tags.length}`);

    const body = tags[0].attrs.get(prop);
    assert.ok(
      body,
      `${file}: <StatusActions> passes no ${prop}, so this row's dialog falls back to the `
        + "table-wide sentence and names nothing",
    );

    const sentinel = "Sakura-Trail-77";
    const [first] = contexts(sentinel);
    const render = evaluateExpression(body, Object.keys(first));
    for (const ctx of contexts(sentinel)) {
      const text = String(render(ctx));
      assert.ok(
        text.includes(sentinel),
        `${file}: ${prop} reads "${text}" — it names no record, so it cannot be used to check the aim`,
      );
    }
  });
}

test("StatusActions actually puts those props in the dialogs", () => {
  /* The other half. Every caller could pass a perfectly named sentence and the
     component still show the shared one — the tests above read the callers, and
     this is the join. */
  const dialogs = jsxTags(STATUS_ACTIONS).filter((tag) => tag.tag === "ConfirmSubmitButton");
  for (const [prop, action] of [
    ["confirmDeleteBody", "actions.deleteItem"],
    ["confirmPurgeBody", "actions.purgeItem"],
  ] as const) {
    const dialog = dialogs.find((tag) => tag.attrs.get("action") === action);
    assert.ok(dialog, `StatusActions no longer has a dialog for ${action}`);
    assert.match(
      dialog.attrs.get("body") ?? "",
      new RegExp(prop),
      `StatusActions' ${action} dialog ignores ${prop}, so the name the caller threaded through `
        + "never reaches the reader",
    );
  }
});

/* ── What makes the dialog safe to drop into an existing form ────────────── */

/**
 * 刪除內容頁, 刪除住宿 and 刪除橫幅 sit INSIDE the editor's own <form>, whose
 * action saves the record. The dialog is only safe there because its trigger is
 * a plain button and the server action is called from the confirm step, not by
 * submitting the form. Turn the trigger into a submit and the delete button
 * silently becomes a second 儲存.
 */
const CONFIRM = "app/admin/modules/ConfirmSubmitButton.tsx";

test("the dialog trigger cannot submit the form it is placed in", () => {
  const trigger = jsxTags(CONFIRM).find((t) => t.tag === "button" && t.attrs.get("ref") === "buttonRef");
  assert.ok(trigger, "ConfirmSubmitButton no longer has a trigger button carrying buttonRef");
  assert.equal(trigger!.attrs.get("type"), "button", "the trigger is a submit button — it fires the surrounding form");
  assert.equal(trigger!.attrs.get("onClick"), "() => setOpen(true)", "the trigger does something other than open the dialog");
});

test("the action runs from the confirm step, and only from there", () => {
  // The confirm step is the kit Dialog's danger button.
  const confirmButton = jsxTags(CONFIRM).find(
    (t) =>
      (t.tag === "button" && t.attrs.get("className") === "admin-confirm-primary") ||
      (t.tag === "Button" && t.attrs.get("variant") === "danger"),
  );
  assert.ok(confirmButton, "the dialog has no primary confirm button");
  assert.equal(confirmButton!.attrs.get("onClick"), "submit", "the confirm button no longer runs submit()");

  const submit = declarationText(CONFIRM, ["submit"]).get("submit");
  assert.ok(submit, "ConfirmSubmitButton has no submit() — renamed, or commented out");
  // The bound-argument path the six deletes above use: the action carries its
  // own id, so it is invoked directly rather than by submitting a form.
  assert.match(submit!, /startTransition\(\(\) => action\(new FormData\(\)\)\)/);
});
