import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * A banner's own typography — `translations._type`.
 *
 * 客戶: banner 字體需要能單獨改字體、大小、對齊. The banner form had one size
 * dropdown and one alignment, and that alignment moved the eyebrow, the
 * headline, the subtitle and the button together, so "a centred headline over a
 * left-aligned subtitle" was not expressible at all.
 *
 * The fix is deliberately not a second set of banner-only controls: the block
 * editors already have per-role formatting, the hero already renders the same
 * four roles, and two panels writing two shapes for one feature is how they
 * drift. So the banner reuses RoleTypeControls and its reducer, and what these
 * tests guard is the seam — that the shared control is really mounted, and that
 * what it produces reaches the `translations` payload intact and *absent* when
 * nothing is set.
 *
 * Absence is the load-bearing part. `_style` and `_type` both live in
 * translations and the renderer treats a present key as an instruction, so an
 * empty `_type: {}` is not a harmless leftover — it is a stored value where the
 * render side reads the lack of one, and in the panel it makes every untouched
 * banner look customised.
 *
 * BannerFormEditor.tsx is a .tsx and node --experimental-strip-types will not
 * load JSX, so — as in roleTypeControls.test.mts — the fenced, JSX-free region
 * is lifted out of the real file and run rather than restated here. The wiring
 * that cannot be executed (the control being mounted, the hidden input calling
 * the builder) is checked against the source, anchored to whole elements.
 */

const EDITOR = "app/admin/(dashboard)/cms/BannerFormEditor.tsx";
const FORMS = "app/admin/modules/blockForms.tsx";

const src = readFileSync(EDITOR, "utf8");
const formsSrc = readFileSync(FORMS, "utf8");

/** Lift a fenced region out of the file that actually ships. */
function fenced(file: string, text: string, tag: string, mustDeclare: string[]): string {
  const start = `/* @${tag}:start */`;
  const end = `/* @${tag}:end */`;
  assert.equal(text.split(start).length, 2, `${file} has no single ${start} fence`);
  assert.equal(text.split(end).length, 2, `${file} has no single ${end} fence`);
  const from = text.indexOf(start) + start.length;
  const to = text.indexOf(end);
  assert.ok(to > from, `${file}'s ${tag} fences are the wrong way round`);
  const region = text.slice(from, to);
  // Anchor the slice: a truncated or moved region would leave every assertion
  // below measuring nothing at all.
  for (const fn of mustDeclare) {
    assert.ok(region.includes(`export function ${fn}`), `${fn} is outside ${file}'s ${tag} region`);
  }
  return region;
}

async function run<T>(ts: string): Promise<T> {
  const js = stripTypeScriptTypes(ts, { mode: "strip" });
  return (await import(
    "data:text/javascript;base64," + Buffer.from(js, "utf8").toString("base64")
  )) as T;
}

const { buildBannerTranslations } = await run<{
  buildBannerTranslations: (
    fields: Record<string, Record<string, string>>,
    style: { size: string; align: string; valign: string },
    roleTypes: Record<string, unknown>,
  ) => Record<string, unknown>;
}>(fenced(EDITOR, src, "bannerTranslations-pure", ["buildBannerTranslations"]));

// The real reducer, so the "nothing set stores nothing" test below runs on what
// the control actually hands over rather than on a hand-built {}.
const { setRoleTypeField, readRoleTypes } = await run<{
  setRoleTypeField: (
    c: Record<string, unknown>,
    role: string,
    field: string,
    value: string,
  ) => Record<string, unknown>;
  readRoleTypes: (c: Record<string, unknown>) => Record<string, unknown>;
}>(
  fenced(FORMS, formsSrc, "roleType-pure", ["setRoleTypeField", "readRoleTypes"]),
);

const FIELDS = { zh: { title: "山中的家", subtitle: "副標" }, en: { title: "A house in the hills" } };
const STYLE = { size: "lg", align: "left", valign: "top" };

/** Comments stripped, so a note that names a thing does not read as the thing. */
const code = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

/* ── 1. the shared control is really on the banner form ── */

test("the banner form mounts the block editors' control, not a copy of it", () => {
  // Scoped to the blockForms import list rather than swept for anywhere in the
  // file: a same-named import from somewhere else is not this component.
  const imported = /import \{([^}]*)\} from "[^"]*blockForms";/.exec(src)?.[1] ?? "";
  assert.ok(imported, `${EDITOR} does not import from blockForms at all`);
  assert.match(imported, /\bRoleTypeControls\b/, "RoleTypeControls is not imported from blockForms");
  assert.match(imported, /\breadRoleTypes\b/, "the banner reads _type without the shared normaliser");

  // The element as a whole, not three loose substrings that could belong to
  // three different tags — and \b so a renamed <RoleTypeControlsX> is a miss.
  const el = /<RoleTypeControls\b[\s\S]*?\/>/.exec(code)?.[0];
  assert.ok(el, `${EDITOR} does not render RoleTypeControls`);
  assert.match(el, /\bc=\{typeConfig\}/, "the control is not fed the banner's _type config");
  assert.match(el, /\bzh=\{zh\}/, "the control is not told which admin language is on");
  assert.match(el, /\bonChange=\{/, "the control's writes are dropped");
  assert.match(el, /setTypeConfig\(/, "the control's writes do not reach the form's state");
});

test("the form never assembles a role object itself", () => {
  // The reducer's whole job is that an emptied control leaves nothing behind.
  // A hand-built `_type: { title: { align: "" } }` here would put the "" back
  // and the tests in roleTypeControls.test.mts would never see it.
  assert.doesNotMatch(code, /_type:\s*\{\s*(eyebrow|title|body|cta)\b/, "the form writes a role object by hand");
  assert.doesNotMatch(code, /\b(align|font|weight)\s*:\s*"(left|center|right|title|body|ui|[0-9]{3})"/, "the form hardcodes a role value");
});

/* ── 2. the payload the hidden input serialises ── */

test("the hidden input serialises the tested builder", () => {
  // Anchored to the whole element: the builder can be exhaustively tested and
  // still be dead code if the input goes on stringifying its own object.
  const inputs = code.match(/<input\b[^>]*name="translations"[^>]*\/>/g) ?? [];
  assert.equal(inputs.length, 1, `expected exactly one translations input, found ${inputs.length}`);
  const el = inputs[0];

  assert.match(el, /value=\{JSON\.stringify\(/, "the translations field is not serialised");
  assert.match(el, /buildBannerTranslations\(/, "the hidden input builds its own payload instead");
  assert.match(el, /\bi18nFields\b/, "the per-locale copy is not in the payload");
  assert.match(el, /size:\s*titleSize/, "_style.size is not wired to its control");
  assert.match(el, /align:\s*titleAlign/, "_style.align is not wired to its control");
  assert.match(el, /valign:\s*titleVAlign/, "_style.valign is not wired to its control");
  assert.match(el, /readRoleTypes\(typeConfig\)/, "the role settings are not in the payload");
});

test("a styled banner saves both the whole-hero style and the per-role overrides", () => {
  let c: Record<string, unknown> = {};
  c = setRoleTypeField(c, "title", "align", "center");
  c = setRoleTypeField(c, "title", "size", "clamp(28px,5vw,64px)");
  c = setRoleTypeField(c, "body", "align", "left");

  const out = buildBannerTranslations(FIELDS, STYLE, readRoleTypes(c));

  // Spelled out whole rather than probed key by key: the failure this guards
  // against is one of the two keys quietly replacing the other.
  assert.deepEqual(out, {
    zh: { title: "山中的家", subtitle: "副標" },
    en: { title: "A house in the hills" },
    _style: { size: "lg", align: "left", valign: "top" },
    _type: {
      title: { align: "center", size: "clamp(28px,5vw,64px)" },
      body: { align: "left" },
    },
  });
});

test("the per-locale copy is not disturbed by either presentation key", () => {
  const out = buildBannerTranslations(FIELDS, STYLE, readRoleTypes(setRoleTypeField({}, "cta", "weight", "700")));
  assert.deepEqual(out.zh, FIELDS.zh);
  assert.deepEqual(out.en, FIELDS.en);
  assert.deepEqual(Object.keys(out), ["zh", "en", "_style", "_type"]);
});

/* ── 3. nothing set means no _type at all ── */

test("a banner nobody has restyled stores no _type", () => {
  const out = buildBannerTranslations(FIELDS, STYLE, {});
  // Three ways of saying it, because `out._type === undefined` passes on a key
  // that is present with an empty object in some engines' eyes but not others'.
  assert.equal(out._type, undefined, "an empty _type came back as a value");
  assert.ok(!Object.prototype.hasOwnProperty.call(out, "_type"), "the _type key survived empty");
  assert.doesNotMatch(JSON.stringify(out), /_type/, "_type reached the database anyway");
});

test("clearing the last role clears _type from the payload too", () => {
  // The round trip the editor actually performs: set something, empty the box.
  const set = setRoleTypeField({}, "title", "size", "40px");
  assert.ok(buildBannerTranslations(FIELDS, STYLE, readRoleTypes(set))._type, "the size never stored");

  const cleared = setRoleTypeField(set, "title", "size", "");
  const out = buildBannerTranslations(FIELDS, STYLE, readRoleTypes(cleared));
  assert.ok(!Object.prototype.hasOwnProperty.call(out, "_type"), "an emptied control left _type behind");
  assert.equal(JSON.stringify(out._style), '{"size":"lg","align":"left","valign":"top"}');
});

/* ── 4. _style is still there — the renderer and every saved banner rely on it ── */

test("the whole-hero style survives, keys and values", () => {
  // HomeHeroCarousel reads all three off every slide; dropping one silently
  // resets every banner that had it set.
  const out = buildBannerTranslations(FIELDS, { size: "", align: "center", valign: "center" }, {});
  assert.deepEqual(out._style, { size: "", align: "center", valign: "center" });
  // Present even when the size is blank: "" is this control's default and the
  // renderer falls back on it, unlike _type where "" would be an override.
  assert.ok(Object.prototype.hasOwnProperty.call(out._style as object, "size"));
});

test("the three whole-hero controls are still on the form", () => {
  for (const [state, setter] of [
    ["titleSize", "setTitleSize"],
    ["titleAlign", "setTitleAlign"],
    ["titleVAlign", "setTitleVAlign"],
  ] as [string, string][]) {
    assert.match(code, new RegExp(`value=\\{${state}\\}`), `the ${state} control is gone from the form`);
    assert.match(code, new RegExp(`${setter}\\(e\\.target\\.value\\)`), `the ${state} control no longer writes`);
  }
  // And they are still read back from the stored banner, not reset on every edit.
  assert.match(code, /initialStyle\.size/, "_style.size is no longer read back");
  assert.match(code, /initialStyle\.align/, "_style.align is no longer read back");
  assert.match(code, /initialStyle\.valign/, "_style.valign is no longer read back");
});

test("a saved banner's role settings come back into the form", () => {
  // Without this the panel opens blank on a banner that is styled, and the
  // first save wipes the settings it never showed.
  const init = /useState<Record<string, unknown>>\(\(\) => \{[\s\S]*?\}\);/.exec(code)?.[0];
  assert.ok(init, "the _type state is no longer initialised from the banner");
  assert.match(init, /banner\?\.translations[\s\S]*?\)\?\._type/, "_type is not read back from the saved banner");
  assert.match(init, /readRoleTypes\(/, "the stored _type is handed back unnormalised");
});

test("the panel says which of the two settings wins", () => {
  // Both write to the same slide and the per-role one silently beats the
  // banner-wide one; an editor who cannot see that from the panel reads it as
  // a control that does nothing.
  const zh = /蓋過[^<]*整體設定|整體設定[^<]*蓋過/.test(src);
  const en = /overrides the banner-wide setting/.test(src);
  assert.ok(zh && en, "the relationship between _style and _type is unexplained in one language");
});
