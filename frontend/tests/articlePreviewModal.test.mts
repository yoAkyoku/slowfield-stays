import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const editor = readFileSync("app/admin/(dashboard)/cms/PageBlockEditor.tsx", "utf8");
/* The overlay chrome is the shared PreviewOverlay (homepage, article and site
   page editors had three copies of it). The editor still owns the trap: it
   hands its ref to the overlay's panel. */
const overlay = readFileSync("app/admin/modules/PreviewOverlay.tsx", "utf8");
test("article modal connects its panel to the shared focus trap", () => {
  assert.match(editor, /useOverlay\(showPreview,.*trapFocus: previewPanelRef/);
  assert.match(editor, /<PreviewOverlay[\s\S]*?panelRef=\{previewPanelRef\}/);
  assert.match(overlay, /className="hpb-overlay__panel"[\s\S]*?ref=\{panelRef\}/);
});
test("article modal is mounted outside editor containers", () => {
  assert.match(editor, /\{showPreview && \(\s*<PreviewOverlay/);
  assert.match(overlay, /return createPortal\([\s\S]*?document\.body\s*\);/);
});
test("mobile draft width cannot exceed the preview stage", () => {
  assert.match(editor, /width: previewDevice === "mobile" \? 390[^\n]+maxWidth: "100%", minWidth: 0/);
});
