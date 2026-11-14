import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { readStyles, readCode } from "./readCode";
import { join } from "node:path";

/** Every file under a directory, recursively. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * A block heading must be authored in a control that can hold a line break.
 *
 * "所有內容塊的標題等都可以換行" was first treated as a styling problem and fixed
 * with `white-space: pre-line` on the render side. It stayed broken, because
 * the editor side offered `<input type="text">` — an input cannot contain a
 * newline at all, and Enter inside one submits the form. The break was not
 * being swallowed by CSS; it could never be typed.
 *
 * Both halves are needed, so both are asserted here: the fields are textareas,
 * and the rendered heading preserves the newline.
 */

const FORMS = "app/admin/modules/blockForms.tsx";
const HEADING_KEYS = ["title", "heading", "subtitle", "headline", "eyebrow"];

test("no heading field is a single-line input", () => {
  const src = readFileSync(FORMS, "utf8");
  const offenders: string[] = [];

  src.split("\n").forEach((line, i) => {
    if (!line.includes('<input type="text"')) return;
    for (const key of HEADING_KEYS) {
      if (line.includes(`getVal(c, "${key}"`)) {
        offenders.push(`${FORMS}:${i + 1} — ${key}`);
      }
    }
  });

  assert.deepEqual(
    offenders,
    [],
    `these heading fields cannot hold a newline:\n${offenders.join("\n")}`
  );
});

test("every heading field is wired to HeadingInput", () => {
  const src = readFileSync(FORMS, "utf8");
  // Guards the conversion itself: if HeadingInput were dropped in favour of a
  // plain textarea the count would still be non-zero, but the import would go,
  // so check the component is genuinely in use.
  assert.ok(
    src.includes('import { Field, FieldLabel, HeadingInput, getVal, setVal }'),
    "HeadingInput is no longer imported by the block forms"
  );
  const used = src.split("<HeadingInput").length - 1;
  assert.ok(used >= 30, `expected the heading fields to use HeadingInput, found ${used}`);
});

test("HeadingInput is a textarea, not an input", () => {
  const src = readCode("app/admin/modules/blockFields.tsx");
  const start = src.indexOf("export function HeadingInput");
  assert.ok(start > -1, "HeadingInput is missing");
  const body = src.slice(start);
  assert.ok(body.includes("<textarea"), "HeadingInput must render a textarea");
});

test("rendered block headings preserve a typed newline", () => {
  const css = readStyles("app/globals.css");
  // The render half. Scoped to the block containers rather than a bare `h2`,
  // and previously a hand-maintained list of selectors that kept missing
  // headings — assert the general rule is present, not the old list.
  /* The anchor is a section comment, so it is located in the RAW file — `css`
     has had its comments blanked so that a declaration cannot be satisfied by
     one. readStyles replaces each comment character with a space, so the two
     strings share every offset. */
  /* The shared pre-line rule itself, not the section comment introducing it.
     The comment anchor meant a reworded comment failed this test and blamed
     the rule for being gone. */
  const at = css.indexOf(":is(.section, .page-block, .home-block, .property-block-contained,");
  assert.ok(at > -1, "the shared pre-line container list is gone");
  const rule = css.slice(at);
  assert.ok(rule.length > 0, "the block-heading line-break rule is gone");
  const decl = rule.slice(0, rule.indexOf("}") + 1);
  assert.ok(
    decl.includes("white-space: pre-line"),
    "block headings no longer preserve newlines"
  );
  // `.property-block` used to be in this list and in the rule. It is not a
  // class anything emits — the wrapper writes `property-block-contained` /
  // `-full-bleed` — so both the rule and this assertion were agreeing about a
  // container that never existed while the villa hero really was uncovered.
  for (const container of [".section", ".page-block", ".home-block", ".property-block-contained"]) {
    assert.ok(decl.includes(container), `${container} headings are not covered`);
  }
});

test("a block that builds its fields through a helper is not skipped", () => {
  // 交通聯繫 renders 眉批/標題/地址 through a local bilingual() helper rather
  // than writing each <input> out, so the sweep that converted every heading
  // field to a textarea passed it by — its 標題 still could not hold a newline
  // while every other block's could.
  const src = readFileSync(FORMS, "utf8");
  const start = src.indexOf("const bilingual = (");
  assert.ok(start > -1, "the bilingual helper is gone");
  const body = src.slice(start, src.indexOf("return (", start));
  assert.ok(body.includes("<HeadingInput"), "the helper emits a single-line input again");
  assert.ok(!body.includes('<input type="text"'), "the helper still has a plain input path");
});

/**
 * The container list in the pre-line rule must name classes that are actually
 * emitted.
 *
 * The rule listed `.property-block` — a name nothing writes. BlockWrapper emits
 * `property-block-contained` or `property-block-full-bleed`, so the villa hero
 * and the newsletter sat outside the rule and swallowed a typed newline, while
 * the identical field worked on the parent homepage because that one is inside
 * `.home-block`. A selector naming a class that no component emits is dead
 * weight that reads as coverage, so the list is checked against the classes the
 * wrapper really produces.
 */
test("every container in the pre-line rule is a class something emits", () => {
  const css = readStyles("app/globals.css");
  const rule = /:is\(([^)]*)\)\s*\n?\s*:is\(h1, h2, h3, h4, \.eyebrow, \.section-header p\) \{\s*white-space: pre-line;/.exec(css);
  assert.ok(rule, "the shared pre-line rule was not found");

  const containers = rule![1].split(",").map((s) => s.trim()).filter(Boolean);
  assert.ok(containers.length >= 5, `expected several containers, got ${containers.join(", ")}`);

  /* Components only — never the stylesheet under test. globals.css was in this
     list, so any name written into the rule proved itself "emitted" just by
     being in the rule: a completely invented `.totally-invented-wrapper` passed.
     The test asserted nothing at all. */
  const sources = walk("app")
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");

  /* The two rules that share this container list are cut out before searching
     the stylesheet. Left in, a name written into the list satisfied the
     "styled elsewhere" half by appearing in the very rule under test — the same
     self-proof that the `.css` source above had, one level down. Putting the
     dead `.property-block` back kept this green until both were closed. */
  const cssElsewhere = css.replace(
    /:is\([^)]*\)\s*\n?\s*:is\(h1, h2, h3(?:, h4, \.eyebrow, \.section-header p)?\)\s*\{[^}]*\}/g,
    "",
  );

  const dead = containers.filter((sel) => {
    const name = sel.replace(/^\./, "");
    /* A class token ends at a quote, a space or a template hole — never at a
       hyphen. `\b${name}\b` matched `property-block-contained` when asked for
       `property-block`, so putting the dead class back in the rule kept this
       green: the one thing it exists to catch was the one thing it could not
       see. */
    const emitted = new RegExp(`["'\`][^"'\`]*(?<![\\w-])${name}(?![\\w-])`).test(sources);
    const styledElsewhere = new RegExp(`\\.${name}(?![\\w-])\\s*[,{>]`).test(cssElsewhere);
    return !emitted && !styledElsewhere;
  });

  assert.deepEqual(dead, [], `these containers are named in the rule but never emitted: ${dead.join(", ")}`);
});

test("the villa hero and the newsletter are covered by name", () => {
  // The two that were actually broken. Named explicitly so a future tidy-up of
  // the selector list cannot drop them again without a red test.
  const css = readStyles("app/globals.css");
  const rule = /:is\(([^)]*)\)\s*\n?\s*:is\(h1, h2, h3, h4, \.eyebrow, \.section-header p\) \{/.exec(css);
  assert.ok(rule);
  for (const needed of [".property-hero-banner", ".block-newsletter"]) {
    assert.ok(rule![1].includes(needed), `${needed} is not in the pre-line container list`);
  }
});
