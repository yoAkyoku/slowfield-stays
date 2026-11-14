import assert from "node:assert/strict";
import test from "node:test";
import { readStyles } from "./readCode.mts";

/**
 * A threaded rule is only as good as the rules that come after it.
 *
 * `roleTypographyReaches` checks that the rule styling a role's element reads
 * that role's variable. It cannot see the other half of the problem: a SECOND
 * rule, more specific or simply later in the file, that sets the same property
 * with a hardcoded value. The control then saves, the variable is emitted, the
 * element's own rule reads it — and nothing on the page moves, because the
 * hardcoded rule wins the cascade.
 *
 * Four live examples, all found by measuring in a browser rather than reading:
 *   - `.property-block-styled.is-font-size p { font-size: inherit }` at (0,2,1)
 *     beat every paragraph's own (0,1,0) rule, so 內文字級 did nothing on any
 *     block that also had a block-level 字體大小.
 *   - `.contact-page .block-newsletter-copy h2` hardcoded a page-specific size
 *     at (0,3,1) and 標題字級 died on that one block on that one page.
 *   - `.content-index-journal .content-card:nth-child(5n + 1) h2` hardcoded 400
 *     at (0,3,1), so 標題字重 moved every journal card except the featured one.
 *   - the third of three `.content-index-dining .content-card-meta` rules set
 *     the colour with no variable, and being last it was the one that decided.
 *
 * This walks the whole stylesheet and looks for the shape: for every rule that
 * reads `--r-<role>-<prop>`, any other rule setting the same property with no
 * role variable, whose selector is an extension of the same element, and which
 * outranks it on specificity or source order.
 */

const CSS = readStyles("app/globals.css");

const PROPS = ["font-size", "font-weight", "font-family", "color", "text-align"] as const;

type Rule = { selector: string; body: string; order: number };

/** Every top-level style rule, in source order, with @media blocks flattened. */
function parseRules(css: string): Rule[] {
  const out: Rule[] = [];
  let order = 0;
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const head = m[1].trim();
    // An @media / @supports head has no declarations of its own; the rules
    // inside it are matched by the same regex on the next iterations.
    if (head.startsWith("@")) continue;
    for (const sel of head.split(",")) {
      const s = sel.trim().replace(/\s+/g, " ");
      if (!s) continue;
      out.push({ selector: s, body: m[2], order });
    }
    order += 1;
  }
  return out;
}

/** (ids, classes+attrs+pseudo-classes, elements) — enough to compare two rules. */
function specificity(sel: string): [number, number, number] {
  const s = sel.replace(/::[\w-]+/g, " ");
  const ids = (s.match(/#[-\w]+/g) || []).length;
  const classes =
    (s.match(/\.[-\w]+/g) || []).length +
    (s.match(/\[[^\]]*\]/g) || []).length +
    (s.match(/:(?!:)[-\w]+/g) || []).length;
  const els = (s.replace(/[.#:[][^\s>+~]*/g, " ").match(/\b[a-z][a-z0-9]*\b/g) || []).length;
  return [ids, classes, els];
}

function beats(a: Rule, b: Rule): boolean {
  const sa = specificity(a.selector);
  const sb = specificity(b.selector);
  for (let i = 0; i < 3; i++) {
    if (sa[i] !== sb[i]) return sa[i] > sb[i];
  }
  return a.order > b.order;
}

/** The last compound of a selector — the element the rule actually styles. */
function subject(sel: string): string {
  const parts = sel.split(/\s+|(?=[>+~])/).filter((p) => p && !/^[>+~]$/.test(p));
  return parts[parts.length - 1] ?? "";
}

/**
 * Does `candidate` style the same element as `target`, only from further away?
 * `.contact-page .block-newsletter-copy h2` extends `.block-newsletter-copy h2`;
 * `.property-block-styled.is-font-size p` extends `p`. Requires an identical
 * subject so `.foo p` and `.foo h2` are never compared.
 */
function extendsSelector(candidate: string, target: string): boolean {
  if (subject(candidate) !== subject(target)) return false;
  const want = target.split(/\s+/).filter(Boolean);
  const have = candidate.split(/\s+/).filter(Boolean);
  let i = 0;
  for (const part of have) {
    if (i < want.length && part === want[i]) i++;
  }
  return i === want.length;
}

const RULES = parseRules(CSS);

/**
 * Known-good pairs: the later rule hardcodes the property on purpose and the
 * role must NOT reach it. Each needs a reason, not just a silencing.
 */
const ALLOWED: Array<[string, string, string]> = [
  // [threaded selector, hardcoding selector, why]
  [
    ".property-block-styled.is-font-size p",
    ".property-block-styled.is-font-size",
    "different subjects: the wrapper carries the block-level figure the paragraphs inherit",
  ],
  [
    ".property-partner-more",
    ".property-partner-card.is-open .property-partner-more",
    "an open/closed state colour; a state that did not override the resting colour would not be a state",
  ],
  [
    ".content-detail-body p",
    ".content-detail-body blockquote p",
    "a pull quote is its own display scale on purpose — 內文 resizing the quotes with the prose is the bug, not the fix",
  ],
];

/**
 * `:hover` and friends are supposed to win: a hover colour that the resting
 * colour could override would not be a hover state. Only interaction states,
 * not `.is-open`-style classes, which are ordinary selectors and are listed
 * above one at a time.
 */
const STATE = /:(hover|focus|focus-visible|focus-within|active|visited|disabled|checked)\b/;

for (const prop of PROPS) {
  const threaded = RULES.filter((r) => new RegExp(`(^|;)\\s*${prop}\\s*:[^;]*var\\(--r-`).test(r.body));
  test(`no rule outranks the ${prop} control`, () => {
    const clashes: string[] = [];
    for (const t of threaded) {
      for (const c of RULES) {
        if (c === t) continue;
        const decl = new RegExp(`(^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(c.body);
        if (!decl) continue;
        if (decl[2].includes("var(--r-")) continue;
        if (STATE.test(c.selector) && !STATE.test(t.selector)) continue;
        if (!extendsSelector(c.selector, t.selector)) continue;
        if (!beats(c, t)) continue;
        if (ALLOWED.some(([a, b]) => a === t.selector && b === c.selector)) continue;
        clashes.push(
          `${prop}: \`${c.selector}\` (${specificity(c.selector).join(",")}) sets \`${decl[2].trim()}\` ` +
            `and outranks \`${t.selector}\` (${specificity(t.selector).join(",")}), which reads the role ` +
            `variable — the control saves and the page does not change`,
        );
      }
    }
    assert.deepEqual(clashes, [], `\n  ${clashes.join("\n  ")}\n`);
  });
}

test("the map block aligns with text-align, not align-items", () => {
  /* align-items does not accept `left` or `right`, and the role's values are
     exactly those: 靠右 made the declaration invalid at computed-value time,
     which drops it to `normal` and renders as 靠左. Measured — the text sat at
     x=86 for both. With text-align the three values land at 86 / 355 / 623. */
  const open = CSS.indexOf(".property-map-meta {");
  assert.notEqual(open, -1, ".property-map-meta is gone — re-anchor this test");
  const body = CSS.slice(open, CSS.indexOf("}", open));
  assert.doesNotMatch(
    body,
    /align-items:\s*var\(--r-/,
    "a role alignment value is being fed to align-items, which cannot take left/right",
  );
  assert.match(body, /text-align:\s*var\(--r-body-align/, "the role alignment no longer reaches the map meta");
});
