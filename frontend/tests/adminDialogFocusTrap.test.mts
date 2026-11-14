import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { callArguments, evaluateExpression, jsxTags } from "./sourceEval";
import { assertKitDialogContract, findKitDialogs, kitDialogControls } from "./kitDialog";

/**
 * A panel that says `aria-modal="true"` has to mean it.
 *
 * That attribute tells assistive tech the rest of the page is unavailable. A
 * panel that claims it and then lets Tab walk out behind itself is worse than
 * one that never claimed to be modal: the reader is told the page is gone,
 * tabs once, and is typing into a form they have been told is not there and
 * cannot see.
 *
 * These four were the destructive ones — 刪除站台 and 刪除頁面 both come through
 * ConfirmSubmitButton, the media delete, the media bulk delete, and every
 * 批次刪除 in the admin including the permanent purge — and none of them had an
 * Escape handler either. The only way out was to find 取消 with the mouse.
 *
 * `app/modules/useOverlay.ts` already does all four jobs (Escape, scroll lock,
 * focus restore, Tab trap) and its own comment says `trapFocus` is REQUIRED by
 * anything claiming aria-modal. What these assert is that each dialog uses it,
 * and that the ref it hands over is the element that actually holds the
 * buttons — a trap pointed at the wrong node reports as wired and traps nothing.
 */

type Dialog = {
  file: string;
  label: string;
  /** The state setter the dismiss callback is expected to drive. */
  setter: string;
  /** Optional open flag when a source file contains multiple overlays. */
  active?: string;
  /** Distinguish multiple dialogs declared in the same source file. */
  modalText?: string;
  /** Values captured by the dismiss callback in addition to its state setter. */
  context?: Record<string, unknown>;
};

const DIALOGS: Dialog[] = [
  { file: "app/admin/modules/ConfirmSubmitButton.tsx", label: "刪除站台 / 刪除頁面 confirmation", setter: "setOpen" },
  {
    file: "app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx",
    label: "site account role editor",
    setter: "setShowAccountModal",
    active: "showAccountModal",
    modalText: "變更此使用者在本網站的角色",
  },
  {
    file: "app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx",
    label: "site page create / edit dialog",
    setter: "setShowPageEditModal",
    active: "showPageEditModal",
    modalText: "Slug",
    context: { creatingPage: false },
  },
  { file: "app/admin/(dashboard)/media/DeleteMediaButton.tsx", label: "media delete", setter: "setOpen" },
  { file: "app/admin/(dashboard)/media/MediaLibraryView.tsx", label: "media bulk delete", setter: "setConfirming" },
  { file: "app/admin/modules/BulkSelectForm.tsx", label: "批次刪除 / 永久刪除", setter: "setConfirming" },
  {
    file: "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx",
    label: "villa page tag picker",
    setter: "setTagPickerOpen",
  },
];

for (const { file, label, setter, active: activeFlag, modalText, context = {} } of DIALOGS) {
  const src = readCode(file);
  const tags = jsxTags(file);
  const modals = tags.filter((t) =>
    t.attrs.get("aria-modal") === "true" &&
    (!modalText || t.fullText.includes(modalText)),
  );
  const overlays = callArguments(file, "useOverlay").filter(([flag]) => !activeFlag || flag === activeFlag);
  // Built on the admin kit <Dialog>: the panel, aria-modal and hook live in Dialog.tsx.
  const kit = modals.length === 0 ? findKitDialogs(file, { active: activeFlag, modalText }) : [];
  const usesKit = kit.length > 0;

  test(`${label}: is a client component, so the overlay hook can run at all`, () => {
    // useOverlay is "use client". A server component importing it fails the
    // build, but the failure names the hook, not the dialog — worth stating.
    assert.match(src.slice(0, 200), /^\s*"use client";/, `${file} is not a client component`);
  });

  test(`${label}: declares aria-modal exactly where the dialog is`, () => {
    if (usesKit) { assert.equal(kit.length, 1, `${file} renders ${kit.length} matching kit Dialogs`); assertKitDialogContract(); return; }
    assert.equal(modals.length, 1, `${file} has ${modals.length} aria-modal elements — expected one dialog`);
    assert.equal(modals[0].attrs.get("role"), "dialog", "aria-modal on something that is not a dialog");
  });

  test(`${label}: Escape and the Tab trap come from the shared overlay hook`, () => {
    if (usesKit) { assertKitDialogContract(); return; }
    assert.equal(overlays.length, 1, `${file} calls useOverlay ${overlays.length} times — expected once`);
    const [active, , options] = overlays[0];
    assert.ok(active, "useOverlay has no active flag");
    assert.ok(options, `${file} calls useOverlay with no options — that is the version with no focus trap`);
    assert.match(options, /trapFocus\s*:/, "useOverlay is called without trapFocus, which aria-modal requires");
  });

  test(`${label}: the trapped ref is the dialog itself, not a bystander`, () => {
    if (usesKit) { assertKitDialogContract(); return; }
    const options = overlays[0][2];
    const ref = options.match(/trapFocus\s*:\s*([A-Za-z_$][\w$]*)/)?.[1];
    assert.ok(ref, `could not read the trapFocus ref out of ${options}`);
    assert.equal(
      modals[0].attrs.get("ref"),
      ref,
      "trapFocus points at a ref that is not on the aria-modal element — the trap holds nothing",
    );
  });

  test(`${label}: the trapped element contains the dialog's own controls`, () => {
    // A ref on the backdrop instead of the panel passes the check above and
    // still traps correctly; a ref on a header or a sibling does not. The
    // buttons a reader must reach have to be inside whatever is trapped.
    if (usesKit) {
      // The kit Dialog supplies the dismiss (its close button); the caller must supply the action.
      assert.ok(kitDialogControls(kit[0]) >= 1, `the ${label} dialog holds no action of its own`);
      return;
    }
    const inside = modals[0].fullText;
    // A raw <button>, or a component that renders one — BulkSelectForm's confirm
    // is <BulkSubmitButton>, which is still a control a reader must reach.
    const buttons = (inside.match(/<(button\b|[A-Z][\w$]*Button\b)/g) ?? []).length;
    assert.ok(buttons >= 2, `the trapped element holds ${buttons} controls — a dismiss and an action are the minimum`);
  });

  test(`${label}: the state the hook watches is the state that renders the dialog`, () => {
    const active = usesKit ? kit[0].attrs.get("open") ?? "" : overlays[0][0];
    assert.match(
      active,
      /^[A-Za-z_$][\w$]*$/,
      `useOverlay watches ${active}, which is not the plain open flag`,
    );
    // The dialog is rendered behind the same flag, so the hook can never be
    // armed while the panel is absent (or the reverse — Escape doing nothing).
    // For a kit <Dialog> that flag is its `open` prop, which both renders the
    // panel and arms the hook inside Dialog.tsx.
    if (usesKit) { assertKitDialogContract(); return; }
    assert.match(
      src,
      new RegExp(`\\{\\s*${active}\\s*(\\?|&&)`),
      `${active} does not gate the dialog's rendering`,
    );
  });

  test(`${label}: Escape actually closes it`, () => {
    // Run the dismiss callback the hook is given, rather than trusting that a
    // callback shaped like a close is one. A stale `setOpen(true)` here reads
    // fine and makes Escape a no-op.
    const dismiss = usesKit ? kit[0].attrs.get("onClose") ?? "" : overlays[0][1];
    let closedWith: unknown = "never called";
    const fn = evaluateExpression(dismiss, [setter, ...Object.keys(context)])({
      [setter]: (v: unknown) => { closedWith = v; },
      ...context,
    }) as () => void;
    fn();
    assert.equal(closedWith, false, `dismissing the ${label} dialog did not close it`);
  });
}

test("site page dialog keeps its focus trap and does not close mid-save", () => {
  /* This was a native <dialog> with a hand-written Tab loop; it is the kit
     <Dialog> now, whose trap and Escape come from useOverlay (contract checked
     in kitDialog.mts). What stays this file's job: the dialog is the page
     editor's, it cannot be dismissed by a stray backdrop click, and a dismiss
     while a save is running is ignored. */
  const file = "app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx";
  const [kitDialog] = findKitDialogs(file, { active: "showPageEditModal" });
  if (kitDialog) {
    assertKitDialogContract();
    assert.equal(kitDialog.attrs.get("dismissible"), "false", "a backdrop click can throw away a half-typed page");
    assert.match(kitDialog.attrs.get("onClose") ?? "", /if \(!creatingPage\)/, "Escape closes the dialog while the page is being saved");
    return;
  }
  const pageDialog = jsxTags(file).find((tag) => tag.attrs.get("aria-labelledby") === "site-page-modal-title");
  assert.ok(pageDialog, "site page dialog is missing");
  assert.match(pageDialog.fullText, /onKeyDown=\{event =>/);
  assert.match(pageDialog.fullText, /document\.activeElement === last/);
  assert.match(pageDialog.fullText, /last\.focus\(\)/);
  assert.match(pageDialog.fullText, /document\.activeElement === first/);
  assert.match(pageDialog.fullText, /first\.focus\(\)/);

  const overlay = callArguments(file, "useOverlay").find(([active]) => active === "showPageEditModal");
  assert.ok(overlay, "site page dialog is missing the shared Escape/focus behavior");
  assert.match(overlay[2], /lockScroll:\s*false/, "native showModal scroll handling is being layered with a body lock");
  assert.match(readCode(file), /dialog\.showModal\(\)/, "the page dialog is not opened in the native modal layer");
});

test("site page preview forwards Escape and Tab boundaries from its iframe", () => {
  const src = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
  assert.match(src, /contentDocument\?\.addEventListener\("keydown", onFrameKeyDown, true\)/);
  assert.match(src, /function onFrameKeyDown\(event: KeyboardEvent\)[\s\S]*?event\.key === "Escape"[\s\S]*?setPagePreview\(null\)/);
  assert.match(src, /active === items\[0\][\s\S]*?previewCloseControlRef\.current\?\.focus\(\)/);
  assert.match(src, /active === items\[items\.length - 1\][\s\S]*?previewFirstControlRef\.current\?\.focus\(\)/);
});

test("the shared hook still treats trapFocus as a requirement of aria-modal", () => {
  // If this contract is ever relaxed, the five tests above are asserting a rule
  // that no longer exists and should be revisited rather than left to rot.
  const hook = readCode("app/modules/useOverlay.ts");
  assert.match(hook, /trapFocus\?:\s*RefObject/, "useOverlay no longer offers trapFocus");
  assert.match(hook, /document\.addEventListener\("keydown", onKey\)/, "useOverlay no longer listens for Escape");
});

test("user permission read-only dialog has an accessible name and keyboard trap", () => {
  const src = readCode("app/admin/(dashboard)/users/UserPermissionLink.tsx");
  const [kitDialog] = findKitDialogs("app/admin/(dashboard)/users/UserPermissionLink.tsx", { active: "open" });
  if (kitDialog) {
    // Name (aria-labelledby → title), labelled close button and the trap all come from the kit Dialog.
    assertKitDialogContract();
    assert.ok(kitDialog.attrs.get("title"), "the permission dialog has no title to be named by");
    assert.ok(kitDialog.attrs.get("closeLabel"), "the close button falls back to an English-only label");
    assert.match(kitDialog.attrs.get("onClose") ?? "", /^(closeDialog|\(\) => setOpen\(false\))$/, "dismissing does not close the dialog");
    return;
  }
  assert.match(src, /aria-labelledby=\{titleId\}/);
  assert.match(src, /aria-modal="true"/);
  assert.match(src, /aria-label=\{closeLabel\}/);
  assert.match(
    src,
    /useOverlay\(open,\s*closeDialog,\s*\{[\s\S]*?lockScroll:\s*false,[\s\S]*?trapFocus:\s*ref/,
  );
  assert.match(src, /const closeDialog = \(\) => \{[\s\S]*?setOpen\(false\);[\s\S]*?\};/);
});
