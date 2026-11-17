import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readEditorSurface } from "./readCode";
import { stripTypeScriptTypes } from "node:module";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * Per-role text formatting — `config._type`.
 *
 * One `_textAlign` moved a block's eyebrow, heading, paragraph and button
 * together, so "the eyebrow and the heading stay in step, the copy aligns on
 * its own" was not expressible in the panel at all (客戶: 所有 block 的眉眼和
 * 標題的對齊是同步的，內容需要另外分開對齊), and a banner could not be given its
 * own face or size (客戶: banner 字體需要能單獨改字體、大小、對齊).
 *
 * The whole contract with the render side is the *absence* of a key. The
 * renderer applies only what `_type` states and leaves the block's own
 * stylesheet to do the rest, so an unset control must leave nothing behind:
 * not "", not null, not the key with an empty value. A stored "" is a value,
 * and a value overrides the design — which is the failure mode these tests
 * exist for, and it is invisible in the panel because a blank box and a stored
 * blank look identical.
 *
 * blockForms.tsx is a .tsx, and node --experimental-strip-types will not load
 * JSX. So rather than restate the reducer here — a copy that cannot fail when
 * the real one does — the fenced, JSX-free region is lifted out of the real
 * file and run. If the fences move, these tests fail loudly instead of quietly
 * measuring nothing.
 */

const FORMS = "app/admin/modules/blockForms.tsx";
const HOME_EDITOR = "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx";
const PAGE_EDITOR = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx";

const src = readFileSync(FORMS, "utf8");

const START = "/* @roleType-pure:start */";
const END = "/* @roleType-pure:end */";

/** The reducer's own source, out of the file the editor actually ships. */
function pureRegion(): string {
  assert.equal(src.split(START).length, 2, `${FORMS} has no single ${START} fence`);
  assert.equal(src.split(END).length, 2, `${FORMS} has no single ${END} fence`);
  const from = src.indexOf(START) + START.length;
  const to = src.indexOf(END);
  assert.ok(to > from, "the pure-region fences are the wrong way round");
  const region = src.slice(from, to);
  // Anchor the slice: an empty or truncated region would make every behavioural
  // assertion below pass against nothing.
  for (const fn of ["setRoleTypeField", "clearRoleType", "readRoleType", "roleTypeValue", "hasRoleType"]) {
    assert.ok(region.includes(`export function ${fn}`), `${fn} is outside the fenced region`);
  }
  return region;
}

const js = stripTypeScriptTypes(pureRegion(), { mode: "strip" });
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(js, "utf8").toString("base64")
) as {
  setRoleTypeField: (c: Record<string, unknown>, role: string, field: string, value: string) => Record<string, unknown>;
  clearRoleType: (c: Record<string, unknown>, role: string) => Record<string, unknown>;
  writeRoleType: (c: Record<string, unknown>, role: string, next: Record<string, unknown>) => Record<string, unknown>;
  readRoleType: (c: Record<string, unknown>, role: string) => Record<string, unknown>;
  readRoleTypes: (c: Record<string, unknown>) => Record<string, unknown>;
  roleTypeValue: (c: Record<string, unknown>, role: string, field: string) => string;
  hasRoleType: (c: Record<string, unknown>, role: string) => boolean;
  ROLE_NAMES: string[];
  ROLE_TYPE_FIELDS: string[];
};

const { setRoleTypeField, clearRoleType, readRoleType, roleTypeValue, hasRoleType } = mod;

/** `_type` as it would reach the database. */
const stored = (c: Record<string, unknown>) => (c as { _type?: unknown })._type;

/* ── 1. a setting lands on one role and one role only ── */

test("the four roles are the four the render side is expecting", () => {
  assert.deepEqual(mod.ROLE_NAMES, ["eyebrow", "title", "body", "cta"]);
  assert.deepEqual(mod.ROLE_TYPE_FIELDS, ["align", "font", "size", "weight", "color"]);
});

test("setting one role's field writes that role and leaves the others alone", () => {
  const before = { title: "Hi", _type: { eyebrow: { align: "center" }, body: { size: "18px" } } };
  const after = setRoleTypeField(before, "title", "align", "right");

  // Spelled out in full rather than probed key by key: a reducer that wrote to
  // the wrong role would still satisfy "title.align is right".
  assert.deepEqual(stored(after), {
    eyebrow: { align: "center" },
    title: { align: "right" },
    body: { size: "18px" },
  });
  assert.equal(after.title, "Hi", "the rest of the block's config was dropped");
});

test("the config handed in is not mutated — it is React state", () => {
  const before = { _type: { eyebrow: { align: "center" } } };
  const snapshot = JSON.stringify(before);
  setRoleTypeField(before, "title", "align", "left");
  assert.equal(JSON.stringify(before), snapshot, "the reducer edited the caller's object in place");
});

test("the eyebrow and the heading can now differ from the copy", () => {
  // The complaint this exists for: one alignment for the eyebrow and the
  // heading, another for the paragraph.
  let c: Record<string, unknown> = {};
  c = setRoleTypeField(c, "eyebrow", "align", "center");
  c = setRoleTypeField(c, "title", "align", "center");
  c = setRoleTypeField(c, "body", "align", "left");
  assert.deepEqual(stored(c), {
    eyebrow: { align: "center" },
    title: { align: "center" },
    body: { align: "left" },
  });
});

test("a banner can carry its own face, size and alignment", () => {
  // 客戶: banner 字體需要能單獨改字體、大小、對齊 — a clamp() has to survive,
  // so `size` is a free length and not a list of px presets.
  let c: Record<string, unknown> = {};
  c = setRoleTypeField(c, "title", "font", "title");
  c = setRoleTypeField(c, "title", "size", "clamp(28px,5vw,64px)");
  c = setRoleTypeField(c, "title", "align", "left");
  c = setRoleTypeField(c, "title", "weight", "700");
  c = setRoleTypeField(c, "title", "color", "#ffffff");
  assert.deepEqual(stored(c), {
    title: { align: "left", font: "title", size: "clamp(28px,5vw,64px)", weight: 700, color: "#ffffff" },
  });
  // A weight is stored as a number, not as the string the <select> handed over.
  assert.equal(typeof (readRoleType(c, "title") as { weight?: unknown }).weight, "number");
});

/* ── 2. clearing removes the key. Not "" — absent. ── */

test("clearing a field removes the key rather than storing an empty string", () => {
  const before = setRoleTypeField({}, "title", "size", "24px");
  const after = setRoleTypeField(
    setRoleTypeField(before, "title", "align", "center"),
    "title",
    "size",
    "",
  );

  const role = (stored(after) as Record<string, Record<string, unknown>>).title;
  // Three separate ways of saying it, because `role.size === ""` passes an
  // `=== undefined` check nowhere but reads as "unset" everywhere else.
  assert.equal(role.size, undefined, "the cleared field came back as a value");
  assert.ok(!Object.prototype.hasOwnProperty.call(role, "size"), "the key survived with an empty value");
  assert.deepEqual(Object.keys(role), ["align"], "a cleared field is still occupying the role");
  // And the shape that actually reaches the database carries no trace of it.
  assert.equal(JSON.stringify(stored(after)), '{"title":{"align":"center"}}');
});

test("every field clears the same way, and none of them stores a blank", () => {
  for (const [field, value] of [
    ["align", "center"],
    ["font", "body"],
    ["size", "18px"],
    ["weight", "600"],
    ["color", "#112233"],
  ] as [string, string][]) {
    const set = setRoleTypeField({}, "body", field, value);
    assert.ok(hasRoleType(set, "body"), `${field} did not store at all`);
    const cleared = setRoleTypeField(set, "body", field, "");
    assert.equal(stored(cleared), undefined, `${field} left something behind when cleared`);
    assert.equal(roleTypeValue(cleared, "body", field), "", `${field} still reads back as set`);
  }
});

test("whitespace is not a value either", () => {
  // A box the author selected and deleted can leave a stray space behind; that
  // must clear the setting, not store " " and override the block's design.
  const set = setRoleTypeField({}, "title", "size", "  20px  ");
  assert.deepEqual(stored(set), { title: { size: "20px" } }, "the stored length was not trimmed");
  assert.equal(stored(setRoleTypeField(set, "title", "size", "   ")), undefined);
});

test("a value outside the closed sets is refused, not written through", () => {
  // align / font / weight are ours to choose from; anything else would be a raw
  // CSS string arriving from a stale config or a hand-edited JSON.
  for (const [field, bad] of [
    ["align", "justify"],
    ["align", "left;color:red"],
    ["font", "Comic Sans"],
    ["weight", "800"],
    ["weight", "bold"],
  ] as [string, string][]) {
    const c = setRoleTypeField({}, "title", field, bad);
    assert.equal(stored(c), undefined, `${field} accepted ${bad}`);
  }
});

/* ── 3. the empty levels collapse ── */

test("clearing a role's last field removes the role", () => {
  let c: Record<string, unknown> = {};
  c = setRoleTypeField(c, "eyebrow", "align", "center");
  c = setRoleTypeField(c, "title", "weight", "600");
  c = setRoleTypeField(c, "title", "color", "#334455");

  c = setRoleTypeField(c, "title", "weight", "");
  assert.deepEqual(stored(c), { eyebrow: { align: "center" }, title: { color: "#334455" } });

  c = setRoleTypeField(c, "title", "color", "");
  assert.deepEqual(stored(c), { eyebrow: { align: "center" } }, "an empty role is still listed in _type");
  assert.ok(!Object.prototype.hasOwnProperty.call(stored(c) as object, "title"));
});

test("clearing the last role removes _type from the config entirely", () => {
  const c = setRoleTypeField(
    setRoleTypeField({ heading: "Rooms" }, "cta", "color", "#000000"),
    "cta",
    "color",
    "",
  );
  assert.equal(stored(c), undefined);
  assert.ok(!Object.prototype.hasOwnProperty.call(c, "_type"), "_type is present but empty");
  assert.deepEqual(Object.keys(c), ["heading"], "clearing _type disturbed the rest of the config");
  assert.equal(JSON.stringify(c), '{"heading":"Rooms"}');
});

test("the reset button drops one role and only that role", () => {
  let c: Record<string, unknown> = { anchor: "about" };
  c = setRoleTypeField(c, "title", "align", "center");
  c = setRoleTypeField(c, "title", "size", "32px");
  c = setRoleTypeField(c, "body", "align", "left");

  const one = clearRoleType(c, "title");
  assert.deepEqual(stored(one), { body: { align: "left" } });
  assert.equal(one.anchor, "about");

  assert.equal(stored(clearRoleType(one, "body")), undefined, "resetting the last role left _type behind");
});

test("a block nobody has restyled stores nothing at all", () => {
  const c = setRoleTypeField({ heading: "Rooms" }, "title", "align", "");
  assert.ok(!Object.prototype.hasOwnProperty.call(c, "_type"), "clearing an unset control created _type");
  assert.equal(hasRoleType(c, "title"), false);
});

/* ── reading a config that was not written here ── */

test("junk in _type reads as nothing rather than reaching the page", () => {
  for (const junk of [null, undefined, "", "center", 42, [], [{ align: "left" }]]) {
    assert.deepEqual(readRoleType({ _type: junk } as Record<string, unknown>, "title"), {});
    assert.equal(hasRoleType({ _type: junk } as Record<string, unknown>, "title"), false);
  }
  // A role that stores only blanks is a role that sets nothing.
  assert.equal(hasRoleType({ _type: { title: { align: "", size: "  " } } }, "title"), false);
});

test("a weight stored as a string still reads back", () => {
  // Older configs and hand edits both produce "600"; the control must show it
  // as selected rather than silently falling back to Default.
  assert.equal(roleTypeValue({ _type: { title: { weight: "600" } } }, "title", "weight"), "600");
  assert.equal(readRoleType({ _type: { title: { weight: "600" } } }, "title").weight, 600);
});

/* ── 4. the control is wired into both editors ── */

test("the component writes through the reducer instead of touching _type", () => {
  // The pure tests above are worth nothing if the panel builds its own object:
  // that is exactly how an "" would get past them and into a stored role.
  const from = src.indexOf("export function RoleTypeControls(");
  assert.ok(from > 0, "RoleTypeControls is gone from blockForms.tsx");
  const rest = src.slice(from + 1);
  const to = rest.indexOf("\nexport function ");
  const body = to > 0 ? rest.slice(0, to) : rest;
  assert.ok(body.length > 1000, `only sliced ${body.length} chars of the component`);

  assert.match(body, /setRoleTypeField\(/, "the component does not use the tested reducer");
  assert.match(body, /clearRoleType\(/, "no way to reset a role");
  assert.doesNotMatch(body, /_type\s*:/, "the component writes _type directly, bypassing the reducer");
  assert.doesNotMatch(body, /\{\s*\.\.\.c\s*,/, "the component spreads the config itself instead of writing through the reducer");
});

test("both editors offer it, inside the text-format section", () => {
  for (const file of [HOME_EDITOR, PAGE_EDITOR]) {
    const s = readEditorSurface(file);

    // Scoped to the blockForms import list rather than swept for anywhere in
    // the file: a same-named import from somewhere else is not this component.
    const imported = [...s.matchAll(/import \{([^}]*)\} from "[^"]*blockForms";/g)].map((m) => m[1]).join(",");
    assert.ok(imported, `${file} does not import from blockForms at all`);
    assert.match(imported, /\bRoleTypeControls\b/, `${file} does not import RoleTypeControls from blockForms`);

    /* Inside the text group specifically — "somewhere in the file" would pass
       on a control stranded in the wrong fold, which is a panel nobody would
       find. The title is no longer a literal in the editor: both editors take
       it from blockCatalogue, so the same group cannot be called two different
       things on two pages the way the pairing group was. */
    const open = s.indexOf('FoldSection title={groupTitle("text", zh)}');
    assert.ok(open > 0, `${file} has no text-appearance section any more`);
    const close = s.indexOf("</FoldSection>", open);
    assert.ok(close > open, `${file}'s 文字格式 section is never closed`);
    const section = s.slice(open, close);

    // The element as a whole, not three loose substrings that could belong to
    // three different tags — and \b so a renamed <RoleTypeControlsX> is a miss.
    const el = /<RoleTypeControls\b[\s\S]*?\/>/.exec(section)?.[0];
    assert.ok(el, `${file} does not render the control in 文字格式`);
    assert.match(el, /\bc=\{selected\.config\}/, `${file} does not feed the control the selected block's config`);
    assert.match(el, /\bzh=\{zh\}/, `${file} does not tell the control which admin language is on`);
    assert.match(el, /\bonChange=\{\(cfg\) => updateConfig\(selected\.id, cfg\)\}/, `${file} drops the control's writes`);
  }
});
