import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles } from "./readCode";

/**
 * The per-role type variables have to be threaded through the declaration that
 * actually WINS, not through any declaration that happens to mention the role.
 *
 * This was got wrong once, in the obvious way. `.eyebrow { font-size: 11px }`
 * reads like the rule that sizes an eyebrow, so the variable went there — and
 * did nothing, because 31,000 lines later the type-scale group sets
 * `font-size: var(--type-small-size, inherit)` on the same selector and wins on
 * source order. The measurement that caught it was a computed 16px against a
 * declared 11px.
 *
 * So the invariant is positional, not existential: for each role property, the
 * LAST declaration of that property on the role's selector must contain the
 * role variable. Asserting only that the variable appears somewhere passes
 * happily while the control does nothing.
 */

const RAW = readStyles("app/globals.css");

/**
 * The stylesheet with every comment replaced by the same number of spaces, so
 * offsets still line up with the real file.
 *
 * Walking back from a declaration to "the text since the last `}` or `*​/`" got
 * the `*​/` offset wrong by one, so a rule introduced by a comment had its
 * selector read as `/ .eyebrow` and matched nothing — every `.eyebrow`
 * assertion in this file was resolving to null and passing on a stale winner.
 * Blanking comments removes the need to reason about their boundaries at all.
 */
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, (c) => " ".repeat(c.length));

/** Every `prop: …;` declaration in the file, in source order, with its offset. */
function declarations(prop: string): Array<{ at: number; value: string }> {
  const re = new RegExp(`(^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, "g");
  const out: Array<{ at: number; value: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) out.push({ at: m.index, value: m[2].trim() });
  return out;
}

/**
 * Is `at` inside an at-rule's block?
 *
 * The previous version tested the selector TEXT for `@media`, which only ever
 * sees the text between the last `}` and the `{` — for a rule nested inside a
 * media query that text is just the selector, so the guard never fired and the
 * "winner" for a heading was the phone ceiling at line 32767 rather than the
 * desktop rule. Removing the role variable from the desktop rule left this file
 * green. Counting brace depth is the only way to know.
 */
function insideAtRule(at: number): boolean {
  let depth = 0;
  let atDepth = 0;
  const re = /@media|@supports|@layer|\{|\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS)) && m.index < at) {
    if (m[0] === "{") depth++;
    else if (m[0] === "}") {
      depth--;
      if (atDepth && depth < atDepth) atDepth = 0;
    } else atDepth = depth + 1;
  }
  return atDepth > 0;
}

/**
 * The last declaration of `prop` in a rule that lists `selector` as a WHOLE
 * selector, outside any at-rule.
 *
 * `selectorText.includes(selector)` was the earlier test, and a substring match
 * on a comma-separated list picks up any rule that merely contains the string:
 * asking for `.eyebrow` resolved to `.page-block-contact .eyebrow` 700 lines
 * later, so the type-scale rule this file exists to guard could have its role
 * variables stripped without a single test going red. Split on commas and
 * compare whole selectors.
 */
function lastWinningDeclaration(selector: string, prop: string): string | null {
  let winner: string | null = null;
  for (const { at, value } of declarations(prop)) {
    const open = CSS.lastIndexOf("{", at);
    if (open < 0) continue;
    const prevClose = CSS.lastIndexOf("}", open);
    const selectors = CSS.slice(prevClose + 1, open)
      .split(",")
      .map((s) => s.replace(/\s+/g, " ").trim());
    if (!selectors.includes(selector)) continue;
    if (insideAtRule(at)) continue;
    winner = value;
  }
  return winner;
}

const CASES: Array<[string, string, string, string]> = [
  // [role variable, selector, property, human label]
  ["--r-eyebrow-size", ".eyebrow", "font-size", "眉眼字級"],
  ["--r-eyebrow-weight", ".eyebrow", "font-weight", "眉眼字重"],
  ["--r-eyebrow-font", ".eyebrow", "font-family", "眉眼字體"],
  ["--r-title-size", ".section > h2", "font-size", "標題字級"],
  ["--r-title-weight", ".section > h2", "font-weight", "標題字重"],
  ["--r-title-font", ".section > h2", "font-family", "標題字體"],
  ["--r-body-size", ".block-about-body p", "font-size", "內文字級"],
  ["--r-body-weight", ".block-about-body p", "font-weight", "內文字重"],
  /* Found by sweeping every block in a live page — setting each role variable
     and checking the computed value actually moved. These nine were still
     hard-coded after the first pass, and no source-level test noticed, because
     each looked like an unrelated card rule rather than a "role". Nine of
     forty-eight combinations, all of them body text or a card heading. */
  ["--r-body-size", ".home-collection-card-body p", "font-size", "集合卡片內文"],
  /* The selector gained a class so it could win over the shared body-role group,
     whose fallback is `inherit` and was clipping the card copy. Same guarantee,
     new address — this line going red is what said the address had moved. */
  ["--r-body-size", ".home-news-card .home-news-body p", "font-size", "最新消息卡內文"],
  ["--r-body-size", ".home-journal-text p", "font-size", "編號列表內文"],
  ["--r-body-size", ".stay-card-body p", "font-size", "住宿卡片內文"],
  ["--r-body-size", ".property-map-meta", "font-size", "地圖區塊說明"],
  ["--r-body-size", ".property-hero-banner-content p", "font-size", "villa 主視覺副標"],
  ["--r-body-size", ".block-about-feature-info p", "font-size", "特色清單說明"],
  ["--r-body-size", ".page-block-contact-form-subtitle", "font-size", "聯絡表單副標"],
  ["--r-body-size", ".property-contact-directions p", "font-size", "交通說明"],
  ["--r-title-size", ".home-stays-search-head h2", "font-size", "搜尋列標題"],
];

for (const [variable, selector, prop, label] of CASES) {
  test(`${label}: the winning declaration reads ${variable}`, () => {
    const winning = lastWinningDeclaration(selector, prop);
    assert.ok(winning, `no ${prop} declaration found for ${selector}`);
    assert.ok(
      winning!.includes(variable),
      `the last ${prop} on ${selector} is "${winning}" — the role variable is set on an earlier rule that this one overrides`,
    );
  });
}

test("the site type scale stays in the chain, between the role and the default", () => {
  // Precedence is role → site setting → hard default. Dropping the middle term
  // would make a per-block override silently disable the site-wide scale.
  const h2 = lastWinningDeclaration(".section > h2", "font-size");
  assert.match(String(h2), /var\(--r-title-size,\s*var\(--type-h2-size/);
  const body = lastWinningDeclaration(".block-about-body p", "font-size");
  assert.match(String(body), /var\(--r-body-size,\s*var\(--type-body-size/);
});

test("every role variable is used with a fallback, never bare", () => {
  // `var(--r-title-size)` with no fallback resolves to nothing when unset and
  // drops the declaration — the block would lose its size entirely rather than
  // keep the one it has today.
  const bare = [...CSS.matchAll(/var\(\s*(--r-[a-z-]+)\s*\)/g)].map((m) => m[1]);
  assert.deepEqual(bare, [], `these role variables have no fallback: ${bare.join(", ")}`);
});

test("alignment is written explicitly for each role, not left to inherit alone", () => {
  // Sixteen container rules hard-write text-align, so an inherited value never
  // arrives. Each role needs its own declaration for the setting to land.
  for (const [variable, selector] of [
    ["--r-eyebrow-align", ".eyebrow"],
    ["--r-title-align", ".section h2"],
  ] as Array<[string, string]>) {
    const winning = lastWinningDeclaration(selector, "text-align");
    assert.ok(winning, `no text-align declaration for ${selector}`);
    assert.ok(winning!.includes(variable), `${selector} resolves text-align as "${winning}"`);
  }
});

/**
 * The site's own font choice has to be the last term in every family chain.
 *
 * The winning rule for a section heading resolved
 * `font-family: var(--r-title-font, var(--type-h2-family, inherit))` — the site
 * 標題字體 setting appears nowhere in it, so choosing a font in 網站設定 moved
 * nothing on any heading unless the per-level H2 font was also set. Measured on
 * the running site: setting --font-title changed the computed family from
 * "Noto Serif TC" to… "Noto Serif TC".
 *
 * Precedence is role → per-level scale → site font. `inherit` as the last term
 * skips the site setting entirely and takes whatever the parent happened to have.
 */
const FAMILY_CHAINS: Array<[string, string, string]> = [
  // [role variable, per-level variable, the site font it must end at]
  ["--r-title-font", "--type-h2-family", "--font-title"],
  ["--r-title-font", "--type-h3-family", "--font-title"],
  ["--r-body-font", "--type-body-family", "--font-body"],
  ["--r-eyebrow-font", "--type-small-family", "--font-ui"],
];

for (const [role, level, siteFont] of FAMILY_CHAINS) {
  test(`${level} falls through to ${siteFont}, not to inherit`, () => {
    /* Built by hand rather than with a RegExp, twice over:
       `([^)]+)` could not capture a value that is itself a `var(...)` and so
       stopped at its `)`, and the rewrite that fixed that put `\s` inside a
       template literal, where the backslash is dropped and the engine sees the
       letter "s". Both failed red against correct CSS. An exact substring
       carries no escaping layer and cannot match the wrong declaration. */
    /* Every such chain is checked, not the first one in the file. Many rules now
       carry this chain and correctly end at their own default — a caption keeps
       var(--font-ui), which is right for a caption — so "the first occurrence"
       picked an unrelated rule and called a correct stylesheet broken.
       What must never happen is the original defect: a chain that dead-ends at
       `inherit`, which skips the site setting and takes whatever the parent had. */
    const needle = `font-family: var(${role}, var(${level}, `;
    const tails: string[] = [];
    for (let at = CSS.indexOf(needle); at > -1; at = CSS.indexOf(needle, at + 1)) {
      /* Exactly the two closing parens belonging to the two enclosing var()s.
         `\)+$` ate the innermost value's own paren too, so `var(--font-title)))`
         came back as `var(--font-title` and matched nothing. */
      tails.push(CSS.slice(at + needle.length, CSS.indexOf(";", at)).replace(/\)\)$/, ""));
    }
    assert.ok(tails.length, `no ${role} → ${level} chain found anywhere`);
    /* `inherit` is the defect for a heading and the correct default for body
       copy, so the check is per level rather than blanket. Text inherits the
       font from `body`, which is `var(--font-body)` — so a BODY chain ending at
       inherit lands on exactly the face it should, while a TITLE or eyebrow
       chain ending there lands on the body face instead of --font-title /
       --font-ui. That is the original defect: a heading that quietly took the
       body font and looked plausible doing it. */
    if (siteFont !== "--font-body") {
      const dead = tails.filter((t) => t === "inherit");
      assert.deepEqual(
        dead,
        [],
        `${dead.length} of ${tails.length} ${level} chains end at inherit, so they take the body face rather than ${siteFont}`,
      );
    }
    assert.ok(
      tails.includes(`var(${siteFont})`),
      `no ${level} chain ends at var(${siteFont}) — the site font setting reaches nothing (ends found: ${[...new Set(tails)].join(", ")})`,
    );
  });
}

test("the hero keeps its own deliberate exception", () => {
  // H1 ends at --font-ui on purpose (客戶: hero 字體要和 navbar 與內文一樣), so a
  // sweep that "fixes" every family chain to --font-title must not touch it.
  assert.match(CSS, /var\(--r-title-font,\s*var\(--type-h1-family,\s*var\(--font-ui\)\)\)/);
});
