import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

/**
 * The newsletter composer's 即時預覽 updates as you type.
 *
 * 客戶: 那是預覽嗎 / 好像沒有很同步 / 他的同步功能有稍微再點一下其他地方就有了.
 *
 * The panel read `editorRef.current.innerHTML` during render, and the input
 * handler only wrote to a hidden form field — nothing set state, so a keystroke
 * caused no re-render and the preview stayed on whatever the last unrelated
 * render had captured. Reading a ref during render is also why it appeared to
 * "catch up" when anything else on the panel changed.
 */

const PANEL = readCode("app/admin/(dashboard)/newsletter/panels/ComposePanel.tsx");
/* The mail mock is a shared component now — the composer and the campaign
   detail rendered two copies of it — so the render half of these checks reads
   it there, and the panel is checked for handing it the state. */
const PREVIEW = readCode("app/admin/(dashboard)/newsletter/EmailPreview.tsx");

test("the preview renders from state, not from a ref read during render", () => {
  assert.ok(
    !/__html: sanitizeRichHtml\(editorRef\.current/.test(PANEL),
    "the preview reads the editor's DOM during render again — a keystroke will not update it",
  );
  assert.match(PANEL, /<EmailPreview bodyHtml=\{bodyHtml\}/, "the preview is not fed the stored html");
  assert.match(PREVIEW, /__html: sanitizeRichHtml\(bodyHtml\)/, "the preview no longer renders the stored html");
  assert.match(PANEL, /const \[bodyHtml, setBodyHtml\] = useState\(""\)/, "the composed html is no longer held in state");
});

test("one value feeds the editor, the form field and the preview", () => {
  /* The panel used to keep the body in the DOM and copy it out on every input
     event, so the invariant was "syncBody writes to both places". It is the
     shared RichTextEditor now (客戶: 內容塊同款), which is a controlled
     component — the same state drives all three, and there is no copy to fall
     out of step. The invariant is the same; only the mechanism that guarantees
     it changed, so this asserts the new one rather than the old call. */
  assert.match(
    PANEL,
    /<RichTextEditor\s[^>]*value=\{bodyHtml\}/,
    "the editor is no longer driven by the state the preview reads",
  );
  assert.match(PANEL, /onChange=\{setBodyHtml\}/, "typing no longer writes back to that state");
  assert.match(
    PANEL,
    /<input type="hidden" name="body" value=\{bodyHtml\} readOnly \/>/,
    "the submitted body is no longer the value on screen",
  );
  // The old failure mode was reading the editor's DOM instead of state; it must
  // not come back by any route.
  assert.ok(!/editorRef/.test(PANEL), "the panel is reading the editor's DOM node again");
});

test("the empty state follows the same source", () => {
  // Otherwise the placeholder and the preview can disagree about whether there
  // is any content.
  assert.match(PREVIEW, /\{bodyHtml \? \([\s\S]*?nl-preview-placeholder/, "the placeholder still tests the editor's DOM");
});
