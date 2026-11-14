import assert from "node:assert/strict";
import test from "node:test";
import { callArguments, evaluateExpression, initialiserText, jsxTags } from "./sourceEval";

/**
 * Keeping a block editor's work when the save is rejected.
 *
 * `updatePropertyPageAction` and `updateHomepageAction` both redirect on
 * failure exactly as they do on success (adminUtils.actionRedirect), so a 422
 * from a publish guard re-navigates to the same URL, the page re-fetches, and
 * the editor comes back seeded from the last SAVED content. An afternoon of
 * blocks gone, `?error=` in the address bar to show for it, and — until this
 * work — no undo either.
 *
 * `useFormDraft` was written for exactly this and its own comment names the
 * villa page editor as one of the ones going without. It had simply never been
 * attached: neither page passed `saveFailed`, so neither editor could tell a
 * rejected save from a fresh open.
 *
 * The hook's own behaviour is covered by formDraft.test.mts. What is checked
 * here is the wiring, because the wiring is what was missing — and in
 * particular that no submitted field is left out of the restore, since a
 * half-restored editor is worse than a warning: it looks complete.
 */

const PROPERTY = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx";
const PROPERTY_PAGE = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/page.tsx";
const HOMEPAGE = "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx";
const HOMEPAGE_PAGE = "app/admin/(dashboard)/homepage/page.tsx";

const EDITORS = [
  { name: "villa page", editor: PROPERTY, page: PROPERTY_PAGE, tag: "PropertyBlockEditor", identity: ["_site_id", "_site_json", "_page_key"] },
  { name: "homepage", editor: HOMEPAGE, page: HOMEPAGE_PAGE, tag: "HomepageBlockEditor", identity: ["_site_id", "_site_json"] },
];

test("both pages tell their editor when a save came back rejected", () => {
  for (const { name, page, tag } of EDITORS) {
    const mounted = jsxTags(page).find((t) => t.tag === tag);
    assert.ok(mounted, `${name}: the editor is no longer mounted here`);
    const flag = mounted!.attrs.get("saveFailed");
    assert.ok(flag, `${name}: saveFailed is not passed, so a 422 still empties the editor`);
    /* It has to come from the error the action redirected with. Anything else
       — a constant, a notice — either never restores or restores over a save
       that worked. */
    assert.match(flag!, /searchParams\.error/, `${name}: saveFailed is not derived from the redirect's error (${flag})`);
  }
});

test("both editors hand the hook that flag, not a guess", () => {
  for (const { name, editor } of EDITORS) {
    const args = callArguments(editor, "useFormDraft");
    assert.equal(args.length, 1, `${name}: useFormDraft is not called exactly once`);
    assert.equal(args[0][1], "saveFailed", `${name}: the hook is told something other than saveFailed (${args[0][1]})`);
    assert.match(args[0][2] ?? "", /onRestore/, `${name}: nothing puts the recovered values back into state`);
  }
});

test("one page's draft cannot surface in another page's editor", () => {
  /* Both editors are reached over and over in one tab — a villa's 關於, then
     its 聯絡, then the parent's homepage. With one key for all of them, opening
     the next page after a rejected save would restore the previous page's
     blocks over it, which is a worse outcome than the loss this rescues. */
  const villaKey = evaluateExpression(initialiserText(PROPERTY, "draftKey"), ["site", "pageKey"]);
  const a = villaKey({ site: { id: 1 }, pageKey: "contact" });
  const b = villaKey({ site: { id: 1 }, pageKey: "about" });
  const c = villaKey({ site: { id: 7 }, pageKey: "contact" });
  assert.notEqual(a, b, "two pages of one site share a draft key");
  assert.notEqual(a, c, "two sites' identically named pages share a draft key");
  assert.equal(a, villaKey({ site: { id: 1 }, pageKey: "contact" }), "the key is not stable, so no draft is ever found");

  const homeKey = evaluateExpression(initialiserText(HOMEPAGE, "draftKey"), ["site"]);
  assert.notEqual(homeKey({ site: { id: 1 } }), homeKey({ site: { id: 2 } }), "two sites share a homepage draft key");
  assert.notEqual(homeKey({ site: { id: 1 } }), a, "the homepage and a villa page share a draft key");
});

/** The onRestore body, as written in the editor. */
function restoreBody(path: string): string {
  return callArguments(path, "useFormDraft")[0][2];
}

test("every field the editor submits is put back", () => {
  /* The dangerous shape is a PARTIAL restore. Everything here lives in React
     state and reaches the server through hidden inputs, so a field the DOM
     restore touches but `onRestore` does not is overwritten by state on the
     very next render — and the editor then looks fully recovered while
     quietly holding the last saved value for that one field. */
  for (const { name, editor, identity } of EDITORS) {
    const body = restoreBody(editor);
    const hidden = jsxTags(editor).filter((t) => t.tag === "input" && t.attrs.get("type") === "hidden");
    assert.ok(hidden.length > 3, `${name}: the hidden state inputs were not found`);
    for (const input of hidden) {
      const field = input.attrs.get("name") ?? "";
      if (identity.includes(field)) continue;
      assert.match(body, new RegExp(`\\b${field}\\b`), `${name}: "${field}" is submitted but never restored`);
    }
  }
});

test("a restored draft is a load, not an edit the editor can undo away", () => {
  /* Both editors now have an undo stack. Pushing the recovered blocks onto it
     puts the un-restored state one Ctrl+Z away — from an editor who has just
     been told their work came back, and whose first instinct after a failed
     save is often to undo something. `reset` forgets the past instead. */
  for (const { name, editor } of EDITORS) {
    const body = restoreBody(editor);
    assert.match(body, /history\.reset\(/, `${name}: the restored blocks are pushed onto the undo stack`);
    assert.doesNotMatch(body, /setBlocks\(/, `${name}: the restored blocks go through the undoable setter`);
  }
});

test("the form is registered and stashed, or there is nothing to recover", () => {
  for (const { name, editor } of EDITORS) {
    const form = jsxTags(editor).find((t) => t.tag === "form");
    assert.ok(form, `${name}: the editor's form is gone`);
    // Without the ref the hook has no fields to restore on mount; without the
    // submit hook there is no draft to restore in the first place.
    assert.equal(form!.attrs.get("ref"), "registerForm", `${name}: the form is not handed to the draft hook`);
    assert.match(form!.attrs.get("onSubmit") ?? "", /stashDraft/, `${name}: the work is not written down before the save`);
  }
});

test("the recovery says so out loud", () => {
  /* A silent restore is indistinguishable from the save having worked, which
     is the one thing that must not be ambiguous after a failure: the editor
     would leave believing the page is published. */
  for (const { name, editor } of EDITORS) {
    const notice = jsxTags(editor).find((t) => (t.attrs.get("className") ?? "").includes("draft-recovered"));
    assert.ok(notice, `${name}: a recovered draft is restored without telling anyone`);
    // A plain element carries role="status"; the admin kit's <Callout> takes live="status".
    assert.equal(notice!.attrs.get("role") ?? notice!.attrs.get("live"), "status", `${name}: the recovery notice is not announced`);
    assert.match(notice!.fullText, /儲存失敗/, `${name}: the notice no longer says the save failed`);
    assert.match(notice!.fullText, /The save failed/, `${name}: the notice has no English`);
  }
});
