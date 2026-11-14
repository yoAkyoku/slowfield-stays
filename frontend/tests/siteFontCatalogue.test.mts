import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { evaluateExpression, initialiserText, jsxTags } from "./sourceEval";
import {
  BODY_LATIN_FACES,
  CJK_FACES,
  TITLE_LATIN_FACES,
  TYPE_FACES,
  canonicalFontConfig,
  cjkFaceKey,
  cjkFaceStack,
  faceLabel,
  fontVars,
  latinFaceHead,
  latinFaceKey,
  safeFace,
} from "../app/modules/fontPresets.ts";
import { roleTypeVars } from "../app/modules/blockStyle.ts";

/**
 * One font catalogue, and what it cost to get there.
 *
 * There were four font menus, each with its own list. The site's 網站字體 panel
 * offered three Chinese faces, seven Latin heading faces and two Latin body
 * faces; the 字級 matrix offered twenty-seven; and a block or banner's 字體
 * offered 標題／內文／介面 — three ROLE names and not one typeface (客戶: 字體
 * 不是標題、內文，而是 font 字體 · 站群的字體的選單也是要很多的 font 字體，中英
 * 都要，要 30+ 選項).
 *
 * They all read TYPE_FACES now. The three tests that matter most are about what
 * unifying them could have broken:
 *
 *   · The old words are still stored. Live sites hold `serif`, `sans`, `kai`,
 *     `cormorant` … and TYPE_FACES calls those faces `songti`, `heiti`. Nothing
 *     maps across on its own, so an alias layer translates — and the assertions
 *     below are against the LEGACY TABLES THEMSELVES, entry by entry, so they
 *     cannot drift into agreeing with whatever the new code happens to produce.
 *   · The allow-list did not get weaker. These values land in an inline
 *     font-family set from admin input; a longer list of accepted keys must not
 *     mean a laxer rule about the ones that are not on it.
 *   · A Latin face does not drag its own Chinese fallback ahead of the Chinese
 *     face the site chose.
 */

const LEGACY = "the stack this key renders today";

/* ── 1. every value a live site can be holding still resolves to what it draws ── */

test("every legacy Chinese key resolves to the exact stack it renders today", () => {
  // Not "resolves to something serif-ish": byte-identical, against the table
  // that is the record of production.
  for (const [key, stack] of Object.entries(CJK_FACES)) {
    assert.equal(cjkFaceStack(key), stack, `${key}: ${LEGACY}`);
  }
  // And the three are actually there — an empty CJK_FACES would pass the loop.
  assert.deepEqual(Object.keys(CJK_FACES).sort(), ["kai", "sans", "serif"]);
});

test("every legacy Latin heading key resolves to the exact head it renders today", () => {
  for (const [key, head] of Object.entries(TITLE_LATIN_FACES)) {
    // `ebgaramond` is the one divergence, and it is an ADDITION: the catalogue
    // entry carries Georgia between EB Garamond and the Chinese tail, because
    // the legacy body key `serif` aliases to the same entry and has always had
    // it there. So a Latin glyph EB Garamond lacks now falls to Georgia instead
    // of straight to the Chinese face — reachable only if a downloaded webfont
    // fails to load, and both are book serifs when it does.
    if (key === "ebgaramond") {
      assert.equal(latinFaceHead(key), `${head}, Georgia`, "ebgaramond gained more than Georgia");
      continue;
    }
    assert.equal(latinFaceHead(key), head, `${key}: ${LEGACY}`);
  }
  assert.equal(Object.keys(TITLE_LATIN_FACES).length, 7, "the legacy heading list changed size");
});

test("every legacy Latin body key resolves to the exact head it renders today", () => {
  for (const [key, head] of Object.entries(BODY_LATIN_FACES)) {
    assert.equal(latinFaceHead(key), head, `${key}: ${LEGACY}`);
  }
  assert.deepEqual(Object.keys(BODY_LATIN_FACES).sort(), ["sans", "serif"]);
});

test("the same word means two different faces in a Chinese slot and a Latin one", () => {
  // `serif` is 宋體 on the Chinese side and EB Garamond on the Latin side. One
  // merged alias table would have silently swapped one for the other on every
  // site that stores both, which is most of them.
  assert.equal(cjkFaceKey("serif"), "songti");
  assert.equal(latinFaceKey("serif"), "ebgaramond");
  assert.notEqual(cjkFaceStack("serif"), latinFaceHead("serif"));
});

test("a whole saved font_config renders byte for byte as it does today", () => {
  /* The end-to-end version of the three tests above: the four CSS variables a
     page actually gets, composed the way fontVars composes them, against the
     old composition spelled out here. The per-key tests would all pass on an
     implementation that resolved each slot correctly and then assembled them in
     the wrong order. */
  /* The tail every stack ends with, taken off the legacy 宋體 entry rather than
     retyped: it is the bare family list, WITHOUT the var() that leads that entry
     — fontVars appends the plain names as the last resort. */
  const SERIF_TAIL = CJK_FACES.serif.replace("var(--font-serif-tc), ", "");
  assert.ok(SERIF_TAIL.startsWith('"Noto Serif TC"') && SERIF_TAIL.endsWith("serif"), SERIF_TAIL);
  const legacy = (fc: Record<string, string>) => {
    const tc = CJK_FACES[fc.title_cjk];
    const bc = CJK_FACES[fc.body_cjk];
    const tl = fc.title_latin === "match" ? tc : TITLE_LATIN_FACES[fc.title_latin];
    const bl = fc.body_latin === "match" ? bc : BODY_LATIN_FACES[fc.body_latin];
    return {
      "--font-title": `${tl}, ${tc}, ${SERIF_TAIL}`,
      "--font-body": `${bl}, ${bc}, ${SERIF_TAIL}`,
    };
  };

  for (const title_cjk of ["serif", "sans", "kai"]) {
    for (const body_cjk of ["serif", "sans", "kai"]) {
      for (const title_latin of [...Object.keys(TITLE_LATIN_FACES), "match"]) {
        for (const body_latin of [...Object.keys(BODY_LATIN_FACES), "match"]) {
          const fc = { title_cjk, body_cjk, title_latin, body_latin };
          const expected = legacy(fc);
          // The one documented divergence, applied to the expectation rather
          // than skipped, so the rest of this config is still checked exactly.
          if (title_latin === "ebgaramond") {
            expected["--font-title"] = expected["--font-title"].replace(
              `${TITLE_LATIN_FACES.ebgaramond},`,
              `${TITLE_LATIN_FACES.ebgaramond}, Georgia,`,
            );
          }
          assert.deepEqual(fontVars({ font_config: fc }), expected, JSON.stringify(fc));
        }
      }
    }
  }
});

test("a site with no font_config at all is still on its preset", () => {
  // The migration path everything above rests on: fontVars must not start
  // treating an absent config as an empty one.
  assert.deepEqual(fontVars({ font_preset: "modern" }), fontVars({ font_preset: "modern" }));
  assert.match(fontVars({ font_preset: "kai" })["--font-title"], /LXGW WenKai TC/);
  assert.deepEqual(fontVars({}), {});
  assert.deepEqual(fontVars(undefined), {});
});

test("a Latin face never brings its own Chinese fallback ahead of the chosen one", () => {
  /* 黑體 headings with a Cormorant Latin face. Cormorant's own stack ends in the
     Chinese SERIF tail; composed whole it would sit before 黑體 and every
     Chinese heading on the site would come out in Noto Serif instead. */
  const out = fontVars({ font_config: { title_cjk: "heiti", title_latin: "cormorant", body_cjk: "heiti", body_latin: "sans" } });
  const title = out["--font-title"];
  assert.ok(title.indexOf("Noto Sans TC") < title.indexOf("Noto Serif TC"), title);
  assert.ok(title.startsWith(`var(--font-display), "Cormorant Garamond", var(--font-sans-tc)`), title);
});

/* ── 2. the allow-list ── */

const HOSTILE = [
  "constructor", "toString", "hasOwnProperty", "__proto__", "valueOf",
  "Comic Sans", "serif;color:red", "songti;background:url(x)", "", "   ",
  null, undefined, 0, 42, true, [], {}, ["songti"], () => {},
];

test("a key the catalogue does not carry resolves to nothing, in every slot", () => {
  for (const bad of HOSTILE) {
    // ["songti"] stringifies to "songti" and is meant to resolve — matching is
    // a lookup, so what comes back is the table's own string either way.
    if (Array.isArray(bad) && bad.length === 1) continue;
    assert.equal(safeFace(bad), "", `safeFace(${String(bad)})`);
    assert.equal(cjkFaceStack(bad), "", `cjkFaceStack(${String(bad)})`);
    assert.equal(latinFaceHead(bad), "", `latinFaceHead(${String(bad)})`);
    assert.equal(cjkFaceKey(bad), "", `cjkFaceKey(${String(bad)})`);
    assert.equal(latinFaceKey(bad), "", `latinFaceKey(${String(bad)})`);
  }
});

test("neither of the two lookups may walk onto Object.prototype", () => {
  /* Two lookups now stand between a stored word and a font-family: the alias
     table, then the catalogue. Both are plain objects, so `aliases["constructor"]`
     and `BY_KEY["toString"]` each resolve to a function, and a function
     stringified into an inline font-family is admin input reaching a style
     attribute unchecked.
     The catalogue lookup is the one that has to hold — with hasOwn there, an
     alias table that resolved `constructor` to a function still ends at "",
     because a function is not a key of the catalogue either. The hasOwn on the
     alias table is belt-and-braces for the day someone swaps that second `?` for
     an `in`, which walks the prototype and is the mutation this is written
     against. */
  for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty", "isPrototypeOf"]) {
    assert.equal(cjkFaceStack(key), "", key);
    assert.equal(latinFaceHead(key), "", key);
  }
});

test("nothing a stored key resolves to could close the declaration it sits in", () => {
  for (const f of TYPE_FACES) {
    assert.ok(!/[;{}<>\\]/.test(f.stack), `${f.key} carries "${f.stack}"`);
    // url() in a font-family is not a thing, but neither is it worth finding out.
    assert.doesNotMatch(f.stack, /url\s*\(/i, f.key);
  }
});

/* ── 3. the catalogue itself ── */

test("the catalogue is long enough to be what the client asked for", () => {
  assert.ok(TYPE_FACES.length >= 30, `only ${TYPE_FACES.length} faces (客戶: 要 30+ 選項)`);
  const cjk = TYPE_FACES.filter((f) => f.group === "cjk");
  // 中英都要 — a list of forty Latin faces and three Chinese ones is not it.
  assert.ok(cjk.length >= 8, `only ${cjk.length} Chinese faces (客戶: 中英都要)`);
  assert.ok(TYPE_FACES.length - cjk.length >= 20, "the Latin half shrank");
});

test("no two faces share a key", () => {
  const keys = TYPE_FACES.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length, `duplicate: ${keys.filter((k, i) => keys.indexOf(k) !== i)}`);
});

test("every stack ends in a Chinese fallback", () => {
  /* A Latin face has no Chinese glyphs; without the tail the browser picks a
     system font at random for them. `mono` was the one that did not — it ended
     in the generic `monospace`, which matches every glyph and so swallowed the
     fallback that should have followed it. */
  for (const f of TYPE_FACES) {
    assert.match(f.stack, /"Noto (Serif|Sans) TC"/, `${f.key} does not fall back to a downloaded CJK face`);
    assert.ok(
      f.stack.endsWith(", serif") || f.stack.endsWith(", sans-serif"),
      `${f.key} ends "${f.stack.slice(-40)}" rather than in the Chinese stack`,
    );
  }
});

test("the downloaded faces are still only the ones the layout loads", () => {
  /* The reason the list can be this long: everything past the first group is
     already on the reader's machine. A Traditional-Chinese webfont is several
     megabytes, so a new 中文 entry pointing at a var() nobody loads — or at a
     family that would have to be fetched — is the mistake this catches. */
  const loaded = new Set([
    "--font-serif-tc", "--font-sans-tc", "--font-display", "--font-playfair",
    "--font-fraunces", "--font-marcellus", "--font-ebgaramond", "--font-pinyon",
  ]);
  for (const f of TYPE_FACES) {
    for (const [, name] of f.stack.matchAll(/var\((--[a-z-]+)\)/g)) {
      assert.ok(loaded.has(name), `${f.key} points at ${name}, which app/layout.tsx does not load`);
    }
  }
  const layout = readCode("app/layout.tsx");
  for (const name of loaded) {
    assert.ok(layout.includes(`"${name}"`), `app/layout.tsx no longer loads ${name}`);
  }
  // The one webfont not loaded through next/font. Named, so that adding a
  // second <link> to Google Fonts is a deliberate act rather than a diff nobody
  // reads — every one of them is bytes on every page load.
  const links = [...layout.matchAll(/fonts\.googleapis\.com\/css2\?family=([^"&]+)/g)].map((m) => m[1]);
  assert.deepEqual(links, ["LXGW+WenKai+TC:wght@300;400"], "a Google Fonts family was added or removed");
});

/* ── 4. 不要加補充說明 ── */

test("no face label carries a parenthetical gloss", () => {
  // 宋體（思源宋體）, Cormorant（襯線）, Verdana（易讀）… (客戶: 不要加補充說明).
  for (const f of TYPE_FACES) {
    for (const [which, label] of [["zh", f.zh], ["en", f.en]] as const) {
      assert.doesNotMatch(label, /[（(]/, `${f.key}.${which} is 「${label}」`);
      assert.doesNotMatch(label, /[）)]/, `${f.key}.${which} is 「${label}」`);
    }
  }
});

test("a label never says the same name twice", () => {
  // zh and en are the same word for every Latin face, so a menu that joined
  // them unconditionally would print "Georgia Georgia".
  for (const f of TYPE_FACES) {
    for (const zh of [true, false]) {
      const label = faceLabel(f, zh);
      assert.ok(label.trim().length > 0, `${f.key} has an empty label`);
      const halves = label.split(" · ");
      assert.equal(new Set(halves).size, halves.length, `${f.key} reads 「${label}」`);
    }
  }
  assert.equal(faceLabel({ zh: "Georgia", en: "Georgia" }, true), "Georgia");
  assert.equal(faceLabel({ zh: "宋體", en: "Noto Serif TC" }, true), "宋體 · Noto Serif TC");
  assert.equal(faceLabel({ zh: "宋體", en: "Noto Serif TC" }, false), "Noto Serif TC");
});

/* ── 5. a block or banner role can be set to a real face ── */

test("a role can be set to a typeface, not only to one of three role names", () => {
  // The defect in one line: 眉眼／標題／內文／按鈕 each had a 字體 dropdown whose
  // three choices were 標題／內文／介面.
  for (const f of TYPE_FACES) {
    assert.equal(
      roleTypeVars({ _type: { title: { font: f.key } } })["--r-title-font"],
      f.stack,
      f.key,
    );
  }
});

test("the three site faces still work, and still point at the variable", () => {
  // They are what every live banner has stored. Removing them would have
  // restyled production silently, and resolving them to a family rather than to
  // the variable would stop a block following the site's own fonts.
  for (const [key, expected] of [
    ["title", "var(--font-title)"],
    ["body", "var(--font-body)"],
    ["ui", "var(--font-ui)"],
  ] as const) {
    assert.equal(roleTypeVars({ _type: { title: { font: key } } })["--r-title-font"], expected, key);
  }
});

test("no face is named title, body or ui", () => {
  // A face called `body` would shadow "follow the site's body face" — the two
  // tables are consulted in order and the winner would be silent.
  for (const f of TYPE_FACES) {
    assert.ok(["title", "body", "ui"].indexOf(f.key) < 0, `${f.key} collides with a follow-the-site value`);
  }
});

test("a role font outside both tables still emits nothing", () => {
  for (const bad of ["Comic Sans", "constructor", "toString", "songti;color:red", "TITLE", "ui "]) {
    assert.deepEqual(roleTypeVars({ _type: { title: { font: bad } } }), {}, bad);
  }
});

/* ── 6. the editor's allow-list and the catalogue cannot drift apart ── */

const FORMS = "app/admin/modules/blockForms.tsx";

test("the editor accepts exactly the follows plus every catalogue face", () => {
  /* ROLE_FONTS is spelled out in blockForms rather than imported, because
     tests/roleTypeControls.test.mts compiles that region on its own and an
     import would not resolve there. This is the price of that: a face added to
     the catalogue and forgotten in the list would be offered by the menu, saved
     by no one, and dropped by normaliseRole without a word. */
  const follows = evaluateExpression(initialiserText(FORMS, "ROLE_FONT_FOLLOWS"))({}) as string[];
  const fonts = evaluateExpression(initialiserText(FORMS, "ROLE_FONTS"))({}) as string[];
  assert.deepEqual(follows, ["title", "body", "ui"]);
  assert.deepEqual(fonts, [...follows, ...TYPE_FACES.map((f) => f.key)]);
});

/* ── 7. the menus read the catalogue, and reach the page ── */

const SITE_EDITOR = "app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx";
const TYPE_SCALE = "app/admin/(dashboard)/sites/[id]/TypeScaleField.tsx";
const PICKER = "app/admin/modules/FontFacePicker.tsx";

test("the four site font menus are the shared picker, and still post their names", () => {
  const pickers = jsxTags(SITE_EDITOR).filter((t) => t.tag === "FontFacePicker");
  assert.equal(pickers.length, 4, `expected the four site font menus, found ${pickers.length}`);
  assert.deepEqual(
    pickers.map((p) => p.attrs.get("name")),
    ["font_title_cjk", "font_title_latin", "font_body_cjk", "font_body_latin"],
    "a menu lost its name and would post nothing",
  );
  // Each is named, and by a real <label htmlFor> the picker owns — so none of
  // them may be wrapped in a second <label>, which would claim the control.
  for (const p of pickers) {
    assert.ok(p.attrs.has("label"), `${p.attrs.get("name")} has no label`);
    assert.ok(p.attrs.has("value") && p.attrs.has("onChange"), `${p.attrs.get("name")} is not wired`);
  }
  /* Every <label> opened before the picker must already be closed. JSX labels
     balance, so an unclosed one is the picker sitting inside it — the defect
     tests/typeScaleFieldLabels.test.mts records: a <label> names its first
     labellable descendant and forwards every click in it to that control, so a
     wrapper would claim the select and steal clicks meant for the group. */
  const src = readCode(SITE_EDITOR);
  for (const p of pickers) {
    const at = src.indexOf(p.text);
    assert.ok(at > 0, `could not locate ${p.attrs.get("name")} in the source`);
    const before = src.slice(0, at);
    const opened = (before.match(/<label\b/g) ?? []).length;
    const closed = (before.match(/<\/label>/g) ?? []).length;
    assert.equal(opened, closed, `${p.attrs.get("name")} sits inside a <label>`);
  }
});

test("the picker lists the catalogue in groups, drawn in their own faces", () => {
  const src = readCode(PICKER);
  assert.match(src, /TYPE_FACE_GROUP_ORDER\.map/, "the picker no longer groups the catalogue");
  assert.match(src, /<optgroup/, "the picker lost its optgroups — 40 flat options is a scroll");
  const option = jsxTags(PICKER).find((t) => t.tag === "option" && t.attrs.get("value") === "f.key");
  assert.ok(option, "the picker no longer renders a catalogue option");
  assert.equal(option!.attrs.get("style"), "{ fontFamily: f.stack }", "options are no longer drawn in their own face");
  // A native select, deliberately: this panel is used on an iPad and a
  // hand-rolled listbox is a focus trap and a hover affordance waiting to happen.
  assert.match(src, /<select\b/, "the picker stopped being a native select");
});

test("the 字級 matrix reads the same catalogue, grouped the same way", () => {
  const src = readCode(TYPE_SCALE);
  assert.match(src, /TYPE_FACE_GROUP_ORDER\.map/, "the type-scale font menu is flat again");
  const option = jsxTags(TYPE_SCALE).find((t) => t.tag === "option" && t.attrs.get("value") === "f.key");
  assert.ok(option, "the type-scale menu no longer lists TYPE_FACES");
  assert.equal(option!.attrs.get("style"), "{ fontFamily: f.stack }");
});

test("a face chosen in the site menu reaches the page as a font-family", () => {
  /* Saved-but-never-read is the recurring shape of this bug. Pick a face that
     did not exist in the old menus at all and follow it to the variable the
     stylesheet spends. */
  const out = fontVars({ font_config: { title_cjk: "dfkai", title_latin: "rockwell", body_cjk: "pingfang", body_latin: "match" } });
  assert.match(out["--font-title"], /^Rockwell, .*"DFKai-SB"/);
  assert.match(out["--font-body"], /^"PingFang TC"/);
  for (const v of Object.values(out)) assert.ok(!/[;{}<>\\]/.test(v), v);
});

/* ── 8. the form opens on the face the site is actually using ── */

test("a saved legacy config opens the menus on the face it renders", () => {
  /* A <select> whose value matches no option shows its FIRST option instead —
     so a site storing `serif` would have opened on 宋體 only by luck, and on
     whatever heads the list otherwise. The next save would then post that. */
  const opened = canonicalFontConfig({ title_cjk: "serif", title_latin: "playfair", body_cjk: "sans", body_latin: "serif" });
  assert.deepEqual(opened, {
    title_cjk: "songti", title_latin: "playfair", body_cjk: "heiti", body_latin: "ebgaramond",
  });
  for (const key of Object.values(opened)) {
    assert.ok(TYPE_FACES.some((f) => f.key === key), `${key} is not an option in the menu`);
  }
});

test("re-saving a legacy config changes the words but not the page", () => {
  // The whole point of the alias layer: the form rewrites `serif` to `songti`
  // on the next save, and the site must look exactly the same afterwards.
  for (const fc of [
    { title_cjk: "serif", title_latin: "cormorant", body_cjk: "serif", body_latin: "serif" },
    { title_cjk: "sans", title_latin: "sans", body_cjk: "sans", body_latin: "sans" },
    { title_cjk: "kai", title_latin: "match", body_cjk: "kai", body_latin: "match" },
  ]) {
    assert.deepEqual(
      fontVars({ font_config: canonicalFontConfig(fc) }),
      fontVars({ font_config: fc }),
      JSON.stringify(fc),
    );
  }
});

test("match survives canonicalisation — it is an instruction, not a face", () => {
  const out = canonicalFontConfig({ title_cjk: "kai", title_latin: "match", body_cjk: "kai", body_latin: "match" });
  assert.equal(out.title_latin, "match");
  assert.equal(out.body_latin, "match");
});

test("a config full of junk still opens on real faces", () => {
  const out = canonicalFontConfig({ title_cjk: "constructor", title_latin: "", body_cjk: undefined, body_latin: "Comic Sans" });
  for (const key of Object.values(out)) {
    assert.ok(TYPE_FACES.some((f) => f.key === key), `${key} is not a face`);
  }
  assert.deepEqual(canonicalFontConfig(undefined), {
    title_cjk: "songti", title_latin: "cormorant", body_cjk: "songti", body_latin: "ebgaramond",
  });
});

/* ── 9. what the save action writes ── */

test("the save action stores a catalogue key or match, never the raw field", () => {
  const src = readCode("app/admin/modules/siteActions.ts");
  const block = /font_config:\s*\{([\s\S]*?)\}/.exec(src)?.[1];
  assert.ok(block, "font_config is no longer written by the site form");
  for (const field of ["font_title_cjk", "font_title_latin", "font_body_cjk", "font_body_latin"]) {
    assert.match(
      block!,
      new RegExp(`parseFaceKey\\(formData\\.get\\("${field}"\\)`),
      `${field} is stored without being checked against the catalogue`,
    );
  }
  assert.doesNotMatch(block!, /String\(formData\.get/, "a slot is still stored verbatim");
});
