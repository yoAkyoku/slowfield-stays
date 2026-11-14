import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { jsxTags } from "./sourceEval";
import { TYPE_FACES } from "../app/modules/fontPresets.ts";
import { roleTypeVars } from "../app/modules/blockStyle.ts";

/**
 * The banner editor's 首頁文字樣式 panel (客戶: 太醜還很奇怪 要重新設計).
 *
 * The vague half of the complaint has a concrete core: the 字體 control was a
 * bare <select> of three ROLE names, the four role tabs were four identical
 * control sets with nothing to tell them apart, and neither said what the
 * setting would look like. The panel now uses the shared FontFacePicker and
 * draws the role's own sample beneath the controls.
 *
 * What these tests hold is the part a restyle could quietly undo:
 *
 *   · The picker is not wrapped in a Field. Field IS a <label>, and a label
 *     claims its first labellable descendant — wrapping one around a control
 *     that brings its own is the exact defect tests/typeScaleFieldLabels.test.mts
 *     was written for, and it is a click-forwarding bug as well as a naming one.
 *   · Every control still has a name, and the panel is still a native select and
 *     real buttons. This screen is used on an iPad; the reason
 *     tests/rowActionsAlwaysVisible.test.mts exists is that a control which only
 *     appears on hover cannot be reached there at all.
 *   · The preview is drawn from the SAME sanitiser the page uses, so what it
 *     shows is what will ship — including showing nothing when the value will be
 *     rejected.
 */

const FORMS = "app/admin/modules/blockForms.tsx";
const PICKER = "app/admin/modules/FontFacePicker.tsx";
const BANNER = "app/admin/(dashboard)/cms/BannerFormEditor.tsx";

const forms = readCode(FORMS);

/** The source of the RoleTypeControls component, on its own. */
function panelSource(): string {
  const from = forms.indexOf("export function RoleTypeControls(");
  assert.ok(from > 0, "RoleTypeControls is gone from blockForms.tsx");
  const rest = forms.slice(from + 1);
  const to = rest.indexOf("\nexport function ");
  const body = to > 0 ? rest.slice(0, to) : rest;
  assert.ok(body.length > 1000, `only sliced ${body.length} chars of the component`);
  return body;
}

const panel = panelSource();

/* ── the 字體 control ── */

test("the 字體 control is the shared picker, not three role names in a select", () => {
  // The defect verbatim: 眉眼／標題／內文／按鈕 each had a 字體 dropdown offering
  // 標題字體／內文字體／介面字體 (客戶: 字體不是標題、內文，而是 font 字體).
  assert.match(panel, /<FontFacePicker\b/, "the panel no longer uses the shared font picker");
  const oldMenu = /<option value="title">[\s\S]{0,200}<option value="ui">/.exec(panel);
  assert.equal(oldMenu, null, "the three-role <select> is back as the whole 字體 menu");
});

test("跟隨網站 is a group of its own, above the faces", () => {
  /* The three role values stay — every live banner has one stored, and "follow
     the site" is an answer no named face can give. What changed is that they are
     no longer presented as the entire menu. */
  const picker = jsxTags(FORMS).find((t) => t.tag === "FontFacePicker");
  assert.ok(picker, "no FontFacePicker in blockForms");
  const group = /<optgroup[^>]*>([\s\S]*?)<\/optgroup>/.exec(picker!.fullText);
  assert.ok(group, "the follow-the-site options are no longer grouped");
  for (const value of ["title", "body", "ui"]) {
    assert.match(group![1], new RegExp(`<option value="${value}"`), `${value} is gone from the menu`);
  }
  // Ahead of the catalogue: the picker renders `children` before its groups.
  const pickerSrc = readCode(PICKER);
  const at = pickerSrc.indexOf("{children}");
  const groups = pickerSrc.indexOf("TYPE_FACE_GROUP_ORDER.map");
  // Both looked up before they are compared: `indexOf` returns -1 for a slot
  // that is GONE, and -1 is less than everything, so the comparison alone would
  // read a deleted group as a well-placed one.
  assert.ok(at > 0, "the picker no longer renders the caller's own options at all");
  assert.ok(groups > 0, "the picker no longer renders the catalogue");
  assert.ok(at < groups, "the follow-the-site group now sits below forty faces");
});

test("the picker is not wrapped in a Field, which is a label", () => {
  const at = panel.indexOf("<FontFacePicker");
  const before = panel.slice(0, at);
  for (const [open, close] of [["<Field\\b", "</Field>"], ["<label\\b", "</label>"]] as const) {
    const opened = (before.match(new RegExp(open, "g")) ?? []).length;
    const closed = (before.match(new RegExp(close, "g")) ?? []).length;
    assert.equal(opened, closed, `the font picker sits inside a ${open.slice(1, -2)}`);
  }
  // And it is asked for its own visible label instead.
  const picker = jsxTags(FORMS).find((t) => t.tag === "FontFacePicker");
  assert.ok(picker!.attrs.has("label"), "the font picker has no label at all");
});

/* ── every control still has a name ── */

test("every control in the picker is named and keyboard-reachable", () => {
  const tags = jsxTags(PICKER);
  const select = tags.find((t) => t.tag === "select");
  assert.ok(select, "the picker is no longer a native <select>");
  // Named either by the visible <label htmlFor> or by aria-label — and the id
  // that ties them together is not optional.
  assert.ok(select!.attrs.has("id"), "the select has no id for its label to point at");
  assert.ok(select!.attrs.has("aria-label"), "the select has no aria-label fallback");
  const label = tags.find((t) => t.tag === "label");
  assert.ok(label, "the picker lost its visible label");
  assert.equal(label!.attrs.get("htmlFor"), "selectId", "the label is not tied to the control");

  /* Nothing here may be a div pretending to be a control. A hand-rolled listbox
     is where the keyboard and the iPad both stop working, which is why this
     stayed a platform select. */
  assert.doesNotMatch(readCode(PICKER), /role="(listbox|option|combobox)"/, "the picker grew a fake listbox");
});

test("no control in the panel appears only on hover", () => {
  // tests/rowActionsAlwaysVisible.test.mts exists because of exactly this on a
  // tablet: a control revealed by :hover cannot be reached by touch at all.
  for (const src of [panel, readCode(PICKER)]) {
    assert.doesNotMatch(src, /onMouseEnter|onMouseOver/, "a control in the font panel is gated on hover");
  }
});

/* ── the preview ── */

test("the panel previews the role, and each role previews as itself", () => {
  assert.match(panel, /<RoleTypePreview\b/, "the panel no longer shows what the settings do");
  // Four different samples, one per role — four identical control sets with one
  // shared sample would be as unreadable as before.
  const samples = readCode(FORMS).match(/const ROLE_SAMPLES[\s\S]*?\n\};/)?.[0];
  assert.ok(samples, "ROLE_SAMPLES is gone");
  for (const role of ["eyebrow", "title", "body", "cta"]) {
    assert.match(samples!, new RegExp(`\\b${role}:`), `${role} has no preview sample`);
  }
});

test("the preview runs the size through the sanitiser the page uses", () => {
  /* Not a second rule written here. If the preview drew a size the renderer
     rejects, the panel would be lying — and the editor's usual next move is to
     save and wonder why the page ignored it. */
  /* Sliced between the two declarations rather than by a brace rule: the
     component's own parameter list closes with a `}` in the first column, so
     "up to the next top-level }" would have measured its arguments and nothing
     else — and every assertion below would have passed against six lines. */
  const from = forms.indexOf("function RoleTypePreview(");
  const to = forms.indexOf("export function RoleTypeControls(");
  assert.ok(from > 0 && to > from, "RoleTypePreview is gone, or moved away from the panel it draws for");
  const fn = forms.slice(from, to);
  assert.ok(fn.includes("ROLE_SAMPLES[role]"), "the slice missed the component body");
  assert.match(fn, /safeLength\(size\)/, "the preview no longer checks the size the way the page does");
  assert.match(fn, /safeFace\(font\)/, "the preview resolves the face by some other route than the page");
  // The face must never be the typed string echoed into a style.
  assert.doesNotMatch(fn, /fontFamily:\s*font\b/, "the preview echoes the stored value into a font-family");
  // A clamp() for a hero headline resolves past 60px; full size in a sidebar
  // would push the rest of the panel off screen.
  assert.match(fn, /min\(\$\{okSize\}, 44px\)/, "the preview no longer caps a hero-sized clamp");
});

/* ── the banner still stores what the renderer reads ── */

test("the banner panel is the block panel, wired to the same reducer", () => {
  const banner = readCode(BANNER);
  const imported = /import \{([^}]*)\} from "[^"]*blockForms";/.exec(banner)?.[1] ?? "";
  assert.match(imported, /\bRoleTypeControls\b/, "the banner editor grew its own copy of the panel");
  const el = /<RoleTypeControls\b[\s\S]*?\/>/.exec(banner)?.[0];
  assert.ok(el, "the banner editor no longer renders the panel");
  assert.match(el!, /\bc=\{typeConfig\}/);
  assert.match(el!, /\bonChange=\{\(cfg\) => setTypeConfig\(cfg\)\}/);
  // readRoleTypes on the way out is what keeps a face key the renderer knows
  // from being saved beside one it does not.
  assert.match(banner, /readRoleTypes\(typeConfig\)/, "the banner writes _type without normalising it");
});

test("a face picked on a banner reaches the hero as a font-family", () => {
  /* Saved-but-never-read, end to end: the hero reads translations._type through
     the very same roleTypeVars the blocks use. */
  const face = TYPE_FACES.find((f) => f.key === "dfkai")!;
  const vars = roleTypeVars({ _type: { title: { font: "dfkai", size: "clamp(28px,5vw,64px)" } } });
  assert.equal(vars["--r-title-font"], face.stack);
  assert.equal(vars["--r-title-size"], "clamp(28px,5vw,64px)");
  const hero = readCode("app/modules/home/HomeHeroCarousel.tsx");
  assert.match(hero, /roleTypeVars\(/, "the hero stopped reading the per-role settings");
});
