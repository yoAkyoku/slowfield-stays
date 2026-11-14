import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { assertKitDialogContract, findKitDialogs } from "./kitDialog";
import { callArguments, compileDeclarations, evaluateExpression, jsxTags } from "./sourceEval";

/**
 * The other five panels that said `aria-modal="true"` and did not mean it.
 *
 * `tests/adminDialogFocusTrap.test.mts` covers the destructive confirmations.
 * These are the rest: the related-stays picker, the inline media library, the
 * media upload dialog, the front-of-house photo lightbox and the two block
 * pickers. Measured in the browser before the fix:
 *
 *  · Related stays — opening it left focus on the trigger; two Tabs put the
 *    caret in the page body's <textarea> behind the grid.
 *  · Media upload — one Tab off 關閉 landed in the library's search box behind.
 *  · Media library / block pickers — Escape and the Tab wrap hung off
 *    `onKeyDown` on the backdrop. That is a React synthetic handler, so it only
 *    fired while focus was already inside: clicking the dialog's own heading
 *    put focus on <body> and Escape stopped working entirely. Neither locked
 *    the page behind, either.
 *  · Lightbox — its own trap ran before the hook, so by the time the hook read
 *    `document.activeElement` to remember where to give focus back, the trap
 *    had already moved it into the dialog. Escape returned focus to a button
 *    that no longer existed, i.e. nowhere.
 *
 * All six now hand the panel to `useOverlay`, whose own comment says that is
 * required of anything claiming aria-modal.
 */

type Dialog = {
  file: string;
  label: string;
  /** Which aria-modal element / useOverlay call, for the file with two. */
  index?: number;
  /** The state setter the dismiss callback should drive, when it is an inline
   *  arrow that a test can run. */
  setter?: string;
};

const DIALOGS: Dialog[] = [
  { file: "app/admin/(dashboard)/cms/RelatedStaysPicker.tsx", label: "related stays picker", setter: "setOpen" },
  { file: "app/admin/(dashboard)/homepage/ImageUploadInput.tsx", label: "inline media library", setter: "setShowLibrary" },
  { file: "app/admin/(dashboard)/media/MediaUploadModal.tsx", label: "media upload" },
  { file: "app/modules/property/LightboxGallery.tsx", label: "photo lightbox" },
  { file: "app/admin/modules/blockForms.tsx", label: "block picker (PickerModal)", index: 0, setter: "setOpen" },
  { file: "app/admin/modules/blockForms.tsx", label: "block tag picker", index: 1, setter: "setOpen" },
];

test("media rename lets the overlay capture its trigger before moving focus", () => {
  const src = readCode("app/admin/(dashboard)/media/RenameMediaButton.tsx");
  assert.doesNotMatch(src, /\bautoFocus\b/);
  // The overlay hook runs inside the kit <Dialog> now; it still captures the
  // trigger before focus moves, because nothing here autofocuses.
  if (findKitDialogs("app/admin/(dashboard)/media/RenameMediaButton.tsx", { active: "open" }).length) assertKitDialogContract();
  else assert.match(src, /useOverlay\(open/);
  assert.match(src, /if \(!displayName \|\| saving\) return/);
  assert.match(src, /aria-label=\{labels.placeholder\}/);
});

for (const { file, label, index = 0, setter } of DIALOGS) {
  const src = readCode(file);
  const modals = jsxTags(file).filter((t) => t.attrs.get("aria-modal") === "true");
  const overlays = callArguments(file, "useOverlay");
  // Built on the admin kit <Dialog>: panel, aria-modal and hook live in Dialog.tsx.
  const kit = modals.length === 0 ? findKitDialogs(file) : [];
  const usesKit = kit.length > index;

  test(`${label}: is a client component, so the overlay hook can run at all`, () => {
    assert.match(src.slice(0, 200), /^\s*"use client";/, `${file} is not a client component`);
  });

  test(`${label}: the dialog is where aria-modal is`, () => {
    if (usesKit) { assertKitDialogContract(); return; }
    assert.ok(modals[index], `${file} has ${modals.length} aria-modal elements — expected at least ${index + 1}`);
    assert.equal(modals[index].attrs.get("role"), "dialog", "aria-modal on something that is not a dialog");
  });

  test(`${label}: Escape and the Tab trap come from the shared overlay hook`, () => {
    if (usesKit) { assertKitDialogContract(); return; }
    assert.ok(overlays[index], `${file} calls useOverlay ${overlays.length} times — expected at least ${index + 1}`);
    const options = overlays[index][2];
    assert.ok(options, `${file} calls useOverlay with no options — that is the version with no focus trap`);
    assert.match(options, /trapFocus\s*:/, "useOverlay is called without trapFocus, which aria-modal requires");
  });

  test(`${label}: the trapped ref is the dialog itself, not a bystander`, () => {
    if (usesKit) { assertKitDialogContract(); return; }
    const ref = overlays[index][2].match(/trapFocus\s*:\s*([A-Za-z_$][\w$]*)/)?.[1];
    assert.ok(ref, `could not read the trapFocus ref out of ${overlays[index][2]}`);
    assert.equal(
      modals[index].attrs.get("ref"),
      ref,
      "trapFocus points at a ref that is not on the aria-modal element — the trap holds nothing",
    );
  });

  test(`${label}: the trapped element holds the controls a reader has to reach`, () => {
    if (usesKit) return; // the kit Dialog renders its own labelled close button inside the trapped panel
    const buttons = (modals[index].fullText.match(/<(button\b|[A-Z][\w$]*Button\b)/g) ?? []).length;
    assert.ok(buttons >= 1, `the trapped element holds ${buttons} controls — the dismiss alone is the minimum`);
  });

  test(`${label}: there is no second, local Tab trap left beside the hook`, () => {
    // Two keydown listeners means two preventDefault-and-focus passes on the
    // same Tab, so a wrap at either edge jumps two controls instead of one —
    // the exact defect the villa tag picker had when its hand-rolled copy was
    // left in place next to the hook.
    assert.doesNotMatch(
      src,
      /e\.key\s*(!==|===)\s*"Tab"/,
      `${file} still handles Tab itself; the trap is the hook's job now`,
    );
  });

  if (setter) {
    test(`${label}: Escape actually closes it`, () => {
      // Run the callback the hook is handed, rather than trusting that
      // something shaped like a close is one.
      const dismiss = usesKit ? kit[index].attrs.get("onClose") ?? "" : overlays[index][1];
      let closedWith: unknown = "never called";
      const fn = evaluateExpression(dismiss, [setter])({
        [setter]: (v: unknown) => { closedWith = v; },
      }) as () => void;
      fn();
      assert.equal(closedWith, false, `dismissing the ${label} dialog did not close it`);
    });

    test(`${label}: the flag the hook watches is the flag that renders the dialog`, () => {
      const active = usesKit ? kit[index].attrs.get("open") ?? "" : overlays[index][0];
      assert.match(active, /^[A-Za-z_$][\w$]*$/, `useOverlay watches ${active}, which is not the plain open flag`);
      if (usesKit) { assertKitDialogContract(); return; } // `open` both renders the kit panel and arms its hook
      assert.match(
        src,
        new RegExp(`\\{\\s*${active}\\s*(\\?|&&)`),
        `${active} does not gate the dialog's rendering`,
      );
    });
  }
}

/* ── The two whose dismiss is not an inline setter ────────────────────── */

test("media upload: Escape closes an idle dialog and only minimises one mid-upload", () => {
  // The hook is handed `handleClose`, so Escape does whatever that does. Run
  // it: an Escape that aborted an upload in flight would be a far worse bug
  // than the missing trap this change is about, and reads identically in the
  // source either way.
  const [uploadKit] = findKitDialogs("app/admin/(dashboard)/media/MediaUploadModal.tsx");
  if (uploadKit) {
    assertKitDialogContract();
    assert.equal(uploadKit.attrs.get("open"), "open");
    assert.equal(uploadKit.attrs.get("onClose"), "handleClose", "Escape no longer goes through handleClose, which is what minimises mid-upload");
  } else {
    const [active, dismiss, options] = callArguments("app/admin/(dashboard)/media/MediaUploadModal.tsx", "useOverlay")[0];
    assert.equal(active, "open");
    assert.equal(dismiss, "handleClose");
    assert.match(options, /trapFocus:\s*dialogRef/);
  }

  const run = (state: { allFinished: boolean; uploading: boolean }) => {
    const seen: Record<string, unknown> = {};
    const aborted: number[] = [];
    const build = compileDeclarations(
      "app/admin/(dashboard)/media/MediaUploadModal.tsx",
      ["handleClose"],
      ["useCallback", "allFinished", "uploading", "abortRef", "setEntries", "setUploading", "setMinimized", "setOpen"],
    );
    const { handleClose } = build({
      useCallback: (fn: unknown) => fn,
      ...state,
      abortRef: { current: new Map([["one", { abort: () => aborted.push(1) }]]) },
      setEntries: (v: unknown) => { seen.entries = v; },
      setUploading: (v: unknown) => { seen.uploading = v; },
      setMinimized: (v: unknown) => { seen.minimized = v; },
      setOpen: (v: unknown) => { seen.open = v; },
    });
    (handleClose as () => void)();
    return { seen, aborted };
  };

  const idle = run({ allFinished: false, uploading: false });
  assert.equal(idle.seen.open, false, "Escape did not close the idle upload dialog");
  assert.equal(idle.seen.minimized, false);

  const busy = run({ allFinished: false, uploading: true });
  assert.equal(busy.seen.open, false, "Escape left the dialog on screen mid-upload");
  assert.equal(busy.seen.minimized, true, "Escape did not fall back to minimising while uploading");
  assert.deepEqual(busy.aborted, [], "Escape aborted an upload that was still running");
});

test("lightbox: Escape closes the viewer the gallery opened", () => {
  const file = "app/modules/property/LightboxGallery.tsx";
  const [active, dismiss, options] = callArguments(file, "useOverlay")[0];
  // The viewer is only mounted while a photo is open, so the flag is the mount.
  assert.equal(active, "true");
  assert.equal(dismiss, "onClose");
  assert.match(options, /trapFocus:\s*dialogRef/);

  const lightbox = jsxTags(file).find((t) => t.tag === "Lightbox");
  assert.ok(lightbox, "the gallery no longer renders a Lightbox");
  let closedWith: unknown = "never called";
  const fn = evaluateExpression(lightbox.attrs.get("onClose")!, ["setOpen"])({
    setOpen: (v: unknown) => { closedWith = v; },
  }) as () => void;
  fn();
  assert.equal(closedWith, null, "closing the lightbox did not put the gallery back");
});

test("lightbox: nothing but the hook moves focus, so it can still be given back", () => {
  // The inert effect runs first, by declaration order. If it focuses anything,
  // the hook records THAT as where the guest came from, and Escape returns
  // focus to an element that has just been unmounted — which is <body>.
  const src = readCode("app/modules/property/LightboxGallery.tsx");
  assert.doesNotMatch(src, /\.focus\(\)/, "the lightbox moves focus itself again; the hook has to be the only one");
});

test("lightbox: the parts that are the lightbox's own are still its own", () => {
  // The trap was shared out; the arrow-key nav and the background inert are
  // this dialog's behaviour and belong here. A refactor that swept them into
  // the hook would make every admin dialog swallow the arrow keys.
  const src = readCode("app/modules/property/LightboxGallery.tsx");
  assert.match(src, /e\.key === "ArrowRight"/, "the lightbox lost its next-photo key");
  assert.match(src, /e\.key === "ArrowLeft"/, "the lightbox lost its previous-photo key");
  assert.match(src, /el\.setAttribute\("inert", ""\)/, "the page behind the lightbox is reachable again");
  assert.match(src, /if \(!inert\) el\.removeAttribute\("inert"\)/, "the inert flags are not restored on close");
});

test("the backdrops no longer carry the focus-dependent key handler", () => {
  // `onKeyDown` on the backdrop is a React synthetic handler: it never fires
  // when focus is on <body>, which is exactly where clicking the dialog's own
  // heading puts it. That was the state in which Escape did nothing.
  for (const file of [
    "app/admin/(dashboard)/homepage/ImageUploadInput.tsx",
    "app/admin/modules/blockForms.tsx",
  ]) {
    for (const tag of jsxTags(file)) {
      const cls = tag.attrs.get("className") ?? "";
      if (!/modal-overlay|bf-modal-backdrop/.test(cls)) continue;
      assert.equal(
        tag.attrs.get("onKeyDown"),
        undefined,
        `${file}: the ${cls} backdrop handles keys again, and cannot hear them from <body>`,
      );
    }
  }
});

test("the shared hook still treats trapFocus as a requirement of aria-modal", () => {
  const hook = readCode("app/modules/useOverlay.ts");
  assert.match(hook, /trapFocus\?:\s*RefObject/, "useOverlay no longer offers trapFocus");
  assert.match(hook, /document\.addEventListener\("keydown", onKey\)/, "useOverlay no longer listens for Escape");
});
