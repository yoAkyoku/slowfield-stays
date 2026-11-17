import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";

/**
 * A source file with its comments blanked out.
 *
 * Dozens of assertions in this suite are of the form
 * `assert.ok(src.includes("safeLineHeight(config._lineHeight)"))` — "this call
 * is still here". Read raw, they pass just as happily when the call has been
 * commented out, which is exactly how a guard gets disabled: someone comments
 * it while debugging and the suite stays green. The `safeLineHeight` one is a
 * sanitiser on a value that lands in a style attribute, so a green test over a
 * commented-out call is a live XSS hole reported as covered.
 *
 * Comments become runs of spaces rather than being deleted, so every offset,
 * line number and `indexOf` distance in the caller still refers to the real
 * file.
 *
 * The scan is TypeScript's own, not a hand-rolled one. The hand-rolled version
 * tracked strings and template literals but had no state for a REGEX LITERAL,
 * so a quote inside one — `/[<>"']/`, `/href="([^"]+)"/` — opened a string that
 * ran to the next matching quote, often hundreds of lines away, and every
 * comment in between survived untouched. Six files leaked that way, including
 * both block editors from the middle to the end, which is where most of the
 * "this control is still wired" assertions look. A helper written to close the
 * commented-out-code hole was leaving it open in the files that matter most.
 * JSX text (`<p>don't</p>`) derailed it the same way; the scanner handles that
 * too, given the right language variant.
 */

/**
 * Comment ranges, from the compiler's PARSER.
 *
 * The scanner alone is not enough: `scan()` returns a slash token for `/` and
 * only produces a regex literal if the caller asks it to re-scan, which needs
 * the grammatical context only the parser has. Scanning a file raw therefore
 * derails on exactly the input the hand-rolled version derailed on.
 *
 * BOTH directions are asked for at every leaf, and the pair is what makes the
 * walk complete. `getLeadingCommentRanges` does NOT report every comment before
 * a token: inside TypeScript's `iterateCommentRanges`, a leading scan starts
 * with `collecting = false` and only turns it on after a LINE FEED. A comment
 * sharing a line with the token before it is therefore invisible to it, and is
 * reported by `getTrailingCommentRanges` on that earlier token instead.
 *
 * The shape that made this matter is JSX: a child comment in braces parses as
 * a JsxExpression holding no expression, so the comment sits between `{` and
 * `}` on a single line and neither brace's LEADING trivia contains it. 420
 * comments across 76 files came back intact — 56 in blockForms.tsx and 56 in
 * SitePageEditor.tsx alone,
 * which are precisely the files where "is this control still wired" and "does
 * this label still say X" are asserted. A helper written to stop a commented-out
 * guard reading as live was at its weakest in the files with the most guards.
 *
 * It was never only a JSX problem — an ordinary block comment sitting between
 * two statements on one line was missed for the same reason, and a plain .ts
 * file (propertyPagesActions.ts) was among the worst offenders. JSX simply
 * makes the one-line form the norm.
 */
function commentRanges(path: string, text: string): Array<[number, number]> {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, /* setParentNodes */ true);
  const out: Array<[number, number]> = [];
  const seen = new Set<number>();
  const take = (ranges: readonly ts.CommentRange[] | undefined): void => {
    for (const r of ranges ?? []) {
      /* Keyed on `pos`: the two scans overlap, and a comment reached from both
         sides must be blanked once rather than added twice. */
      if (seen.has(r.pos)) continue;
      seen.add(r.pos);
      out.push([r.pos, r.end]);
    }
  };
  const visit = (node: ts.Node): void => {
    const kids = node.getChildren(file);
    if (kids.length === 0) {
      take(ts.getLeadingCommentRanges(text, node.getFullStart()));
      /* The other half. A trailing scan stops at the first line feed and a
         leading scan only starts after one, so between them every comment
         belongs to exactly one side and nothing falls through the middle.
         Reading raw text here is safe because the positions come from the
         parser: `/*` inside a string, a regex or JSX TEXT is part of that
         token, never something a scan starting at the token's END can reach. */
      take(ts.getTrailingCommentRanges(text, node.getEnd()));
      return;
    }
    for (const kid of kids) visit(kid);
  };
  visit(file);
  return out;
}

/**
 * Read a source file with its line endings normalised to "\n".
 *
 * This repository is checked out with core.autocrlf=true, so on Windows every
 * tracked file arrives CRLF while git itself stores and diffs LF. Assertions
 * here are written against the source as it appears in a diff — several match
 * multi-line literals like `sel-a,\nsel-b {` — so reading the raw bytes made
 * those tests pass or fail on the checkout style rather than on the code. One
 * did go red after a tool rewrote a file with CRLF, which is a defect report
 * about nothing.
 *
 * Normalising on the way in also keeps every offset in one coordinate system:
 * the comment ranges come from the TypeScript parser, which is handed this same
 * normalised text.
 */
function readText(path: string): string {
  if (path.replace(/\\/g, "/").endsWith("app/globals.css")) return appStylesheet();
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

/**
 * "app/globals.css" as a test means it: every rule the app can apply, in the
 * order the browser receives them.
 *
 * The back office's rules no longer live in globals.css — public visitors were
 * downloading ~460 KB of admin-only CSS on every page — so they were moved to
 * app/admin/ui/admin-legacy.css (loaded only by the admin layouts), the shared
 * UI kit lives in app/admin/ui/admin-ui.css, and a few screens add a small area
 * stylesheet next to their page. A test asking "is this control styled?" must
 * look at all of them, or a rule that moved reads as a rule deleted. The order
 * is the cascade order: globals first (root layout), then the admin legacy
 * rules and the kit (admin layout), then area sheets (imported by the pages).
 */
function appStylesheet(): string {
  const area: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".css") && !p.includes("/admin/ui/")) area.push(p);
    }
  };
  walk("app/admin");
  return ["app/globals.css", "app/admin/ui/admin-legacy.css", "app/admin/ui/admin-ui.css", ...area.sort()]
    .map((p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n"))
    .join("\n");
}

export function readCode(path: string): string {
  const src = readText(path);
  const out = src.split("");
  for (const [from, to] of commentRanges(path, src)) {
    for (let i = from; i < to; i += 1) {
      if (out[i] !== "\n") out[i] = " ";
    }
  }
  return out.join("");
}

/**
 * A stylesheet with its comments blanked out.
 *
 * Separate from `readCode` because `//` is not a comment in CSS — blanking from
 * it to the end of the line would eat everything after a `url(https://…)`.
 */
export function readStyles(path: string): string {
  return readText(path).replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
}

/**
 * Every style rule in a stylesheet, with `@media` and friends flattened away.
 *
 * Six test files reach for the same idiom — `CSS.split("}")`, take the part
 * before the first `{` as the selector — and every one of them is blind to a
 * rule inside an at-rule: the first `{` in that chunk belongs to the
 * `@media (max-width: …)`, so the selector reads as `@media …` and the rule it
 * wraps is invisible. That is not a small blind spot in this stylesheet — the
 * breakpoint rules are exactly where a heading's real figure lives, and a rule
 * MOVED into a media query reads to those tests as a rule deleted.
 *
 * Nesting depth is tracked rather than assumed, so an at-rule inside an at-rule
 * (`@supports` around a `@media`) unwraps correctly too.
 *
 * `@font-face` and `@property` have no selector, so their declarations are not
 * emitted as rules at all — which is what a caller asking "which rules style
 * this element" wants, but it does mean this is not a complete round-trip of
 * the file.
 *
 * Two things to know before trusting a count from this. A `@keyframes` step
 * (`from`, `to`, `55%`) is emitted as a rule whose "selector" is the step — 54
 * of them in this stylesheet (58 today) — because a step block is shaped exactly like a
 * rule; no caller queries those names, but a count of "all rules" includes
 * them. And the split is on braces alone, so a `}` inside a string or a url()
 * would truncate a body; there are none in this stylesheet (checked), and every
 * brace is accounted for: 5,293 rules plus 203 at-rule blocks is exactly the
 * number of `{` in the file.
 */
export function cssRules(css: string): Array<{ selector: string; body: string; atRule: string }> {
  const out: Array<{ selector: string; body: string; atRule: string }> = [];
  const stack: string[] = [];
  let i = 0;
  let head = "";
  while (i < css.length) {
    const ch = css[i];
    if (ch === "{") {
      /* Only what follows the last `;`. A STATEMENT at-rule — `@charset "…";`,
         `@import url(…);`, `@layer base, utils;` — ends in a semicolon and has
         no block, so it stayed glued to the front of the next selector: the
         head read as `@import url("a.css"); .foo`, started with "@", and the
         whole of `.foo` was swallowed as if it were an at-rule's contents. A
         `@charset` at the top of the file made this function return NOTHING,
         and the tests built on it iterate an empty list and pass. */
      const semi = head.lastIndexOf(";");
      const name = (semi === -1 ? head : head.slice(semi + 1)).trim().replace(/\s+/g, " ");
      const close = css.indexOf("}", i);
      if (name.startsWith("@") || (close !== -1 && css.slice(i + 1, close).includes("{"))) {
        // An at-rule or any other block that contains blocks: descend into it.
        stack.push(name);
      } else {
        const end = close === -1 ? css.length : close;
        out.push({ selector: name, body: css.slice(i + 1, end), atRule: stack.join(" ") });
        i = end;
      }
      head = "";
      i += 1;
      continue;
    }
    if (ch === "}") {
      stack.pop();
      head = "";
      i += 1;
      continue;
    }
    head += ch;
    i += 1;
  }
  return out;
}

/**
 * Split a selector list on commas that are NOT inside `:is(…)` / `:where(…)`.
 *
 * A plain `.split(",")` tears `:is(.section, .page-block)` in half and the
 * halves match nothing, so an assertion goes red for a reason that has nothing
 * to do with the stylesheet. That happened here once.
 */
export function splitSelectorList(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim().split(/\s+/).filter(Boolean).join(" ")).filter(Boolean);
}

/**
 * What a block editor puts on screen: its own file plus the shared panels it
 * renders. The brand homepage editor and the villa page editor used to carry
 * their own copies of the config switch and the style inspector; both now
 * render the same BlockConfigForm and BlockStyleInspector, so "does this editor
 * offer control X" is a question about the editor and those components
 * together. A shared panel only counts if the editor actually renders it.
 */
const EDITOR_PANELS: Array<[tag: string, path: string]> = [
  ["<BlockStyleInspector", "app/admin/modules/BlockStyleInspector.tsx"],
  ["<BlockConfigForm", "app/admin/modules/BlockConfigForm.tsx"],
];

export function readEditorSurface(path: string): string {
  const own = readCode(path);
  const panels = EDITOR_PANELS.filter(([tag]) => own.includes(tag)).map(([, p]) => readCode(p));
  return [own, ...panels].join("\n");
}
