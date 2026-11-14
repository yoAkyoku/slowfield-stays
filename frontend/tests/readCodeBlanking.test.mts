import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCode } from "./readCode.mts";

/**
 * The blanking helper, tested on itself.
 *
 * `readCode` exists so that `assert.ok(src.includes("safeLineHeight(...)"))`
 * cannot be satisfied by a commented-out call, and
 * `assert.ok(!src.includes("VALIGN_BLOCKS"))` cannot be satisfied by a note
 * mentioning the name. Roughly a hundred test files lean on that.
 *
 * It had a hole exactly where those assertions live. `getLeadingCommentRanges`
 * only reports a comment once a LINE FEED has been seen, so a comment sharing a
 * line with the token before it was invisible to it — and a JSX child comment
 * is always that shape, because it parses as a JsxExpression with no expression
 * and lives between `{` and `}`. 420 comments across 76 files came back intact,
 * 56 of them in blockForms.tsx.
 *
 * The fixture is written to a temp file rather than kept in the repo: the thing
 * under test takes a PATH and reads from disk, and a .tsx fixture full of
 * deliberately odd source would otherwise be compiled and linted with the suite.
 */

/* Built rather than written as an escape: this file is generated through a
   shell heredoc, which halves a doubled backslash and turns a lone one into
   whatever it precedes. */
const NL = String.fromCharCode(10);

const DIR = mkdtempSync(join(tmpdir(), "readcode-"));

function blank(name: string, source: string): { src: string; out: string } {
  const path = join(DIR, name);
  writeFileSync(path, source, "utf8");
  return { src: source, out: readCode(path) };
}

/** Every comment in the fixture, and nothing that merely looks like one. */
const FIXTURE = [
  "const own = 1;",
  "/* a comment on its own line */",
  "const inline = 2; /* sharing a line with the statement before it */",
  "// a line comment",
  "export const el = (",
  "  <div>",
  "    {/* a jsx child comment */}",
  "    <p>hello</p>",
  "    {/* a jsx child comment",
  "        continued onto a second line */}",
  "  </div>",
  ");",
].join(NL);

test("a jsx child comment is blanked", () => {
  const { out } = blank("jsx.tsx", FIXTURE);
  assert.ok(!out.includes("a jsx child comment"), "the single-line JSX comment survived");
  assert.ok(!out.includes("continued onto a second line"), "the multi-line JSX comment survived");
});

test("a comment sharing a line with the code before it is blanked", () => {
  /* The same defect without any JSX: this is what proves the fix is about the
     leading/trailing split rather than about JsxExpression specifically. */
  const { out } = blank("inline.tsx", FIXTURE);
  assert.ok(!out.includes("sharing a line with the statement"), "the inline block comment survived");
});

test("the comments that already worked still work", () => {
  const { out } = blank("own.tsx", FIXTURE);
  assert.ok(!out.includes("a comment on its own line"));
  assert.ok(!out.includes("a line comment"));
});

test("the code around the comments is untouched", () => {
  const { out } = blank("code.tsx", FIXTURE);
  for (const kept of ["const own = 1;", "const inline = 2;", "export const el = (", "<p>hello</p>"]) {
    assert.ok(out.includes(kept), `${kept} was blanked along with the comments`);
  }
});

test("every offset in the file still means what it did", () => {
  /* The whole suite indexes into this output — `indexOf(a) < indexOf(b)`
     ordering assertions, `slice()` around a match, line numbers in failure
     messages. Blanking has to be length-preserving, character for character. */
  const { src, out } = blank("offsets.tsx", FIXTURE);
  assert.equal(out.length, src.length, "the output is a different length; every offset has shifted");
  assert.equal(out.split(NL).length, src.split(NL).length, "line count changed");
  for (let i = 0; i < src.length; i += 1) {
    if (src[i] === NL) assert.equal(out[i], NL, `newline at ${i} was overwritten`);
  }
  // A blanked region is spaces, not deletions or some placeholder.
  const at = src.indexOf("a jsx child comment");
  assert.equal(out.slice(at, at + 19), " ".repeat(19));
});

test("a comment's own line breaks are kept, so line numbers hold", () => {
  const { src, out } = blank("lines.tsx", FIXTURE);
  const lineOf = (text: string, needle: string) => text.slice(0, text.indexOf(needle)).split(NL).length;
  assert.equal(lineOf(out, "</div>"), lineOf(src, "</div>"),
    "a multi-line comment collapsed, so everything after it reports the wrong line");
});

test("something that only looks like a comment is left alone", () => {
  /* The reason this goes through the parser rather than a regex. Each of these
     contains the characters of a comment inside a token that is not one, and a
     scan that blanked them would corrupt the source it is meant to preserve —
     the previous hand-rolled version did exactly that on a regex literal. */
  const source = [
    "const re = /[<>\"']/;",
    "const alsoRe = /href=\"([^\"]+)\"/;",
    "const str = \"a /* not a comment */ b\";",
    "const tpl = `a /* also not */ b`;",
    "export const jsxText = <p>a /* text, not a comment */ b</p>;",
  ].join(NL);
  const { out } = blank("lookalikes.tsx", source);
  assert.ok(out.includes("/* not a comment */"), "a block comment inside a STRING was blanked");
  assert.ok(out.includes("/* also not */"), "a block comment inside a TEMPLATE was blanked");
  assert.ok(out.includes("/* text, not a comment */"), "a block comment inside JSX TEXT was blanked");
  assert.ok(out.includes("href="), "the regex literal was eaten");
});

test("a real comment after a lookalike is still found", () => {
  /* The failure mode of the old hand-rolled scanner: a quote inside a regex
     opened a string that ran for hundreds of lines, and every comment in
     between survived. If that ever comes back, this is where it shows. */
  const source = [
    "const re = /[<>\"']/;",
    "const a = 1; /* after a regex holding a quote */",
    "export const el = <div>{/* and a jsx one */}</div>;",
  ].join(NL);
  const { out } = blank("after-lookalike.tsx", source);
  assert.ok(!out.includes("after a regex holding a quote"), "the scan derailed on the regex literal");
  assert.ok(!out.includes("and a jsx one"), "the JSX comment after a regex survived");
});
