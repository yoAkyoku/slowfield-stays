import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode.mts";

test("site page creation preserves validation failures instead of redirecting as success", () => {
  const source = readCode("app/admin/modules/propertyPagesActions.ts");
  const create = source.slice(source.indexOf("export async function addPropertyPageAction"), source.indexOf("export async function deletePropertyPageAction"));
  assert.doesNotMatch(create, /stampedRedirect\(/);
  assert.match(create, /return \{ ok: false, message: `Page/);
  assert.match(create, /return result/);
  assert.match(create, /pageSlug === "homepage"/);
});

test("site page create dialog exposes validation errors and a modal boundary", () => {
  /* The native <dialog> became the kit <Dialog>: it is named by its title,
     traps focus and hands focus back to whatever opened it (useOverlay's
     restoreFocus), which the hand-written pageModalTrigger.focus() used to do. */
  const source = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
  assert.match(source, /<Dialog[\s\S]*?open=\{showPageEditModal\}/);
  assert.match(source, /pageModalError && <Callout (live="alert" )?tone="danger"/);
  assert.match(source, /if \(!result.ok\)/);
  assert.match(readCode("app/modules/useOverlay.ts"), /const restoreFocus = options\?\.restoreFocus \?\? true;/);
});

test("shared cover-image media picker traps focus and cancels obsolete fetches", () => {
  const source = readCode("app/admin/(dashboard)/stays/HeroImageField.tsx");
  // The library is a kit <Dialog> (focus trap + aria-modal inside Dialog.tsx).
  assert.match(source, /<Dialog[\s\S]*?open=\{showLibrary\}/);
  const dialog = readCode("app/admin/ui/Dialog.tsx");
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /trapFocus: ref/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /controller.abort\(\)/);
});
