import assert from "node:assert/strict";
import test from "node:test";
import { readStyles } from "./readCode";

/**
 * The subscribe band folds on ITS OWN width, never on the window's.
 *
 * 客戶: 訂閱的版面也擠在一起(特別是輸入框).
 *
 * Measured on /contact at a 1159px viewport, before the fix:
 *
 *     .block-newsletter        405.80 wide
 *     .block-newsletter-inner  365.80   tracks "169.75px 161.275px"
 *     .block-newsletter-form   161.28   tracks "0px 163.8px"   ← track ONE is zero
 *     input                     33.60 × 45.2, its right edge 21.6px PAST the
 *                                     button's left edge
 *     button                   163.80, and at 930/1024px it ran 30.65/15.87px
 *                                     past the card's own right edge
 *
 * The two-column definitions were not wrong. The block is one half of a
 * .property-block-pair on this page, so it is ~406px wide at EVERY window size,
 * and both folds were keyed to the window: `@media (max-width: 900px)` cannot
 * fire at 1159px, so a 161px form was still asked to seat a 164px button beside
 * a `minmax(0, 1fr)` track. The track had nothing left to be, computed 0, and
 * the input's `width: 100%` resolved to its own padding and border.
 *
 * That is why every assertion here is about wrapping and never about a
 * breakpoint. Paired, split and full-width are three different block widths at
 * one window size, so any breakpoint chosen from the outside is wrong for two
 * of them — which is exactly how a 900px query came to be guarding a layout it
 * could never see. .footer-newsletter-form has always wrapped, and its input
 * measured 232px while this one measured 34.
 *
 * After, same page, same viewport: input 190.00 (242.73 at 1440, 317.93 at
 * 1024 with the button wrapped below it), a 12px gap between field and button
 * instead of a 21.6px overlap, and nothing past the card's edge at any width.
 *
 * Every assertion is positional — the LAST declaration on the selector, not any
 * declaration. globals.css is 36,000 lines with a long tail of later overrides;
 * `.contact-page .block-newsletter-form` is declared three times and the first
 * two are the broken ones, still in the file.
 */

const CSS = readStyles("app/globals.css");

type Rule = { at: number; selectors: string[]; body: string; atRule: string | null };

/**
 * Every innermost rule in the file, in source order, with the at-rule it sits
 * inside.
 *
 * The regex only ever matches an INNERMOST rule — its `[^{}]+` selector part
 * cannot cross the `{` of an enclosing `@media` — so braces inside a match
 * balance and only the text BETWEEN matches moves the nesting. That text is
 * also where an at-rule's prelude lives, which is how the condition is read
 * without a second pass. Testing the selector text for "@media" instead is the
 * mistake roleTypeCascade.test.mts documents: for a rule nested in a query that
 * text is just the selector, so the guard never fires.
 */
function allRules(css: string): Rule[] {
  const out: Rule[] = [];
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  const open: string[] = [];
  let cursor = 0;
  for (let m = RULE.exec(css); m; m = RULE.exec(css)) {
    const gap = css.slice(cursor, m.index);
    let since = 0;
    for (let i = 0; i < gap.length; i += 1) {
      if (gap[i] === "{") {
        open.push(gap.slice(since, i).replace(/\s+/g, " ").trim());
        since = i + 1;
      } else if (gap[i] === "}") {
        open.pop();
        since = i + 1;
      }
    }
    cursor = m.index + m[0].length;
    out.push({
      at: m.index,
      selectors: m[1].split(",").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean),
      body: m[2],
      atRule: open.length ? open[open.length - 1] : null,
    });
  }
  return out;
}

const RULES = allRules(CSS);

type Decl = { at: number; value: string; atRule: string | null };

/**
 * Every declaration of `prop` on rules that list `sel` as a WHOLE selector.
 *
 * Whole selector, not a substring: a substring match on a comma-separated list
 * picks up any rule that merely contains the string, so asking for
 * `.block-newsletter-form` would answer with `.contact-page
 * .block-newsletter-form button` and the file would guard nothing.
 */
function declarations(sel: string, prop: string): Decl[] {
  const out: Decl[] = [];
  for (const rule of RULES) {
    if (!rule.selectors.includes(sel)) continue;
    for (const declaration of rule.body.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon === -1) continue;
      if (declaration.slice(0, colon).trim() !== prop) continue;
      out.push({
        at: rule.at,
        value: declaration.slice(colon + 1).replace(/\s+/g, " ").trim(),
        atRule: rule.atRule,
      });
    }
  }
  return out;
}

/** The last declaration outside any at-rule — the one that applies at every width. */
function winner(sel: string, prop: string): Decl | null {
  return declarations(sel, prop).filter((d) => !d.atRule).at(-1) ?? null;
}

/** The basis of a `flex` shorthand: the length term, in px. */
function basis(shorthand: string): number | null {
  const px = /(^|\s)(\d+(?:\.\d+)?)px(\s|$)/.exec(shorthand);
  return px ? Number(px[2]) : null;
}

/** The two rows that were folding on the wrong width. */
const ROWS = [
  { sel: ".contact-page .block-newsletter-inner", label: "the copy / form row" },
  { sel: ".contact-page .block-newsletter-form", label: "the field / button row" },
];

for (const { sel, label } of ROWS) {
  test(`${label} is a flex row that wraps`, () => {
    const display = winner(sel, "display");
    assert.ok(display, `no unconditional display declared for ${sel}`);
    assert.equal(
      display!.value,
      "flex",
      `the last display on ${sel} is "${display!.value}" — a grid cannot re-form its `
        + "rows, so a track with a button too wide for it computes 0 and the field "
        + "collapses to its own padding (measured: 33.6px)",
    );

    const wrap = winner(sel, "flex-wrap");
    assert.ok(
      wrap && wrap.value === "wrap",
      `${sel} does not wrap unconditionally (found ${wrap ? `"${wrap.value}"` : "nothing"}) — `
        + "without it the row is a single line again at every width",
    );
  });

  test(`${label} does not have its fold taken back at some width`, () => {
    /* A media query adds no specificity, so a later `display: grid` in one wins
       on source order alone — and it would apply on exactly the widths this fix
       is for. Nothing may re-grid these rows after the flex declaration. */
    const flexAt = winner(sel, "display")!.at;
    const later = declarations(sel, "display")
      .filter((d) => d.at > flexAt && d.value !== "flex")
      .map((d) => `"${d.value}"${d.atRule ? ` inside ${d.atRule}` : ""} at offset ${d.at}`);
    assert.deepEqual(later, [], `${sel} is re-declared away from flex: ${later.join(", ")}`);
  });

  test(`${label} wraps on its own account, not inside a query`, () => {
    /* The whole point: the block's width is not a function of the viewport, so
       a fold that only exists inside an `@media` is guarding a width it cannot
       see. The 900px query in this file is the one that missed a 406px block at
       a 1159px window. */
    const conditional = declarations(sel, "flex-wrap").filter((d) => d.atRule);
    const unconditional = declarations(sel, "flex-wrap").filter((d) => !d.atRule);
    assert.ok(
      unconditional.length > 0,
      `${sel} only declares flex-wrap inside ${conditional.map((d) => d.atRule).join(", ")}`,
    );
  });
}

test("`flex-direction: row` on the form is load-bearing, not decoration", () => {
  /* The BASE .block-newsletter-form is `display: flex; flex-direction: column`,
     and that column has been inert only because the contact rule said `grid`.
     Switching to flex without re-stating `row` hands the column back, and the
     band stacks at every width — a working-looking result that is not the one
     the reference draws. */
  const baseDirection = winner(".block-newsletter-form", "flex-direction");
  if (baseDirection?.value !== "column") return; // the trap is gone; nothing to guard
  const direction = winner(".contact-page .block-newsletter-form", "flex-direction");
  assert.equal(
    direction?.value,
    "row",
    "the base .block-newsletter-form declares `flex-direction: column`, so the contact "
      + "form must re-state `row` or the field and button stack at every width",
  );
});

test("the copy and the form cannot both fit the width this block actually has", () => {
  /* The bases are what decide the fold, so they are what the measurement pins.
     The block is 405.8px wide on /contact (inside .property-block-pair), which
     leaves 365.8px of inner width — the two bases have to add up to more than
     that, or the copy column is crushed back to the 169.75px it was. */
  const MEASURED_INNER = 366;
  const head = basis(String(winner(".contact-page .block-newsletter-head", "flex")?.value));
  const form = basis(String(winner(".contact-page .block-newsletter-form", "flex")?.value));
  assert.ok(head, "the copy column has no flex basis, so nothing decides when the row folds");
  assert.ok(form, "the form has no flex basis, so nothing decides when the row folds");
  assert.ok(
    head! + form! > MEASURED_INNER,
    `the bases add up to ${head! + form!}px, which fits inside the ${MEASURED_INNER}px this `
      + "block measures on /contact — the copy would sit in a ~170px column again",
  );
});

test("the button leaves the row before the form leaves the copy's row", () => {
  /* Two bases, two different jobs, and swapping them is the easy mistake: the
     form's basis decides when the FORM drops below the copy, the label's decides
     when the BUTTON drops below the field. If the label's were the larger, the
     button would wrap away while the form still sat in a half-width column —
     the crushed layout, with the button underneath it. */
  const form = basis(String(winner(".contact-page .block-newsletter-form", "flex")?.value));
  const label = basis(String(winner(".contact-page .block-newsletter-form label", "flex")?.value));
  assert.ok(label, "the field has no flex basis, so the button never drops below it");
  assert.ok(
    label! < form!,
    `the field's basis (${label}px) is not below the form's (${form}px)`,
  );

  /* And a floor under the field itself. The basis is the narrowest the field is
     allowed to be while it still shares a row with the button; set it low
     enough and the 34px pill is back, just with a wrap rule above it. The
     footer's field — the working reference — measures 232px. */
  assert.ok(
    label! >= 160,
    `a field kept on the button's row down to ${label}px is the collapsed input again`,
  );
});

test("the confirmation message still has a row to itself", () => {
  /* It used to get one from `grid-column: 1 / -1`, which is inert now the form
     is flex. Without a replacement, "感謝訂閱！" lands beside the button. */
  const flex = winner(".contact-page .block-newsletter-msg", "flex");
  assert.ok(
    flex && /(^|\s)100%(\s|$)/.test(flex.value),
    `the message reads flex: "${flex?.value ?? "(none)"}" — it no longer spans the row`,
  );
});
