import assert from "node:assert/strict";
import test from "node:test";
import { readStyles, readCode } from "./readCode.mts";

/**
 * 文字對齊 reaches the centred rich-text variant.
 *
 * `.property-rich-text.is-centered .property-rich-text-body p` wrote
 * `text-align: center` straight onto the paragraph. The block's own 文字對齊
 * setting puts `text-align` on the WRAPPER, and a declaration on the element
 * beats a value inherited into it — so choosing 靠左 saved `left` and rendered
 * centred (客戶: 內文置中對齊…要改成靠左).
 *
 * `.is-text-align` is added by `blockWrapperAttrs` whenever the setting is used,
 * so the variant can keep centring by default and step aside when it is not.
 * The marker sits on the WRAPPER, which is why the escape hatch is a descendant
 * selector rather than `:not()` on `.property-rich-text` — that element never
 * carries the class, so such a rule would always match and change nothing.
 */

const CSS = readStyles("app/globals.css");

type Decl = { at: number; value: string };
function declarations(selector: string, property: string): Decl[] {
  const out: Decl[] = [];
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = RULE.exec(CSS); m; m = RULE.exec(CSS)) {
    if (!m[1].split(",").map((s) => s.replace(/\s+/g, " ").trim()).includes(selector)) continue;
    for (const d of m[2].split(";")) {
      const c = d.indexOf(":");
      if (c === -1 || d.slice(0, c).trim() !== property) continue;
      out.push({ at: m.index, value: d.slice(c + 1).replace(/\s+/g, " ").trim() });
    }
  }
  return out;
}

const BASE = ".property-rich-text.is-centered .property-rich-text-body p";
const ESCAPE = ".is-text-align .property-rich-text.is-centered .property-rich-text-body p";

test("the centred variant still centres by default", () => {
  /* The DEFAULT, not the literal. This asserted `=== "center"` and so failed
     the day the value was correctly wrapped as `var(--r-body-align, center)` —
     a pin on the spelling rather than on the behaviour. Unset, both forms
     centre; that is what must not regress. */
  const d = declarations(BASE, "text-align").at(-1);
  assert.ok(d, "the centred variant no longer centres its body at all");
  assert.ok(
    d!.value === "center" || /var\(--r-body-align,\s*center\)/.test(d!.value),
    `centred variant falls back to "${d!.value}" instead of center`,
  );
});

test("a block that sets its own alignment overrides it", () => {
  const d = declarations(ESCAPE, "text-align").at(-1);
  assert.ok(d, "the escape hatch is gone; 文字對齊 is silently ignored in this variant again");
  assert.ok(
    d!.value === "inherit" || /var\(--r-body-align,\s*inherit\)/.test(d!.value),
    `the paragraph resolves to "${d!.value}" instead of the wrapper's alignment`,
  );
});

test("the per-role 內文對齊 outranks the block-level default", () => {
  /* Both rules above used to hardcode their value, so the ROLE setting could
     never win on a centred block — measured live on /brand: setting
     --r-body-align moved nothing, on every block. The panel promises the role
     overrides the block ("上方的『對齊方式』仍是整個版塊的預設值"), so both have
     to read it. */
  for (const [sel, fallback] of [[BASE, "center"], [ESCAPE, "inherit"]] as Array<[string, string]>) {
    const d = declarations(sel, "text-align").at(-1);
    assert.ok(
      d && d.value.includes("var(--r-body-align"),
      `${sel} hardcodes ${d ? d.value : "nothing"}; 內文對齊 cannot reach it`,
    );
    assert.ok(d!.value.includes(fallback), `${sel} lost its ${fallback} default`);
  }
});

test("the escape hatch comes after the rule it overrides", () => {
  /* Equal specificity would be decided by source order, and this one is more
     specific — but if it ever moves above, it stops winning and the failure is
     silent. */
  const base = declarations(BASE, "text-align").at(-1)!;
  const esc = declarations(ESCAPE, "text-align").at(-1)!;
  assert.ok(esc.at > base.at, "the override sits before the rule it is meant to beat");
});

test("the marker really is put on the wrapper", () => {
  /* The whole mechanism rests on this. If blockWrapperAttrs stops adding the
     class, the selector above matches nothing and the setting goes quiet again
     — with no CSS change to point at. */
  const src = readCode("app/modules/blockStyle.ts");
  assert.match(src, /style\.textAlign \? "is-text-align" : ""/,
    "blockWrapperAttrs no longer marks blocks that set an alignment");
});

test("the escape hatch is a descendant selector, not :not() on the section", () => {
  /* The mistake this replaced: `.property-rich-text.is-centered:not(.is-text-align)`
     tests the SECTION, which never carries the marker, so it always matched and
     changed nothing. */
  assert.doesNotMatch(
    CSS,
    /\.property-rich-text\.is-centered:not\(\.is-text-align\)/,
    "the marker is being tested on the element that never carries it",
  );
});

/* ── The chain, not just the last link ──────────────────────────────────────
   Measured on the live site after the paragraph rule shipped: the wrapper
   carried inline `text-align: left` and the paragraph still computed `center`.
   `inherit` resolves against the nearest ancestor that DECLARES a value, and
   that was the variant's own `center` on the section — one element below the
   wrapper. The paragraph rule alone therefore handed control to a second fixed
   value instead of to the setting. */

test("the section inherits too, so the chain reaches the wrapper", () => {
  const d = declarations(".is-text-align .property-rich-text.is-centered", "text-align").at(-1);
  assert.ok(d, "the section still declares its own centring, so `inherit` on the paragraph stops there");
  assert.equal(d!.value, "inherit");
});

test("no element between the paragraph and the wrapper pins an alignment", () => {
  /* Any declaration on an in-between element re-breaks the chain the same way
     the section did, and the symptom is identical: saved left, rendered
     centred. Enumerated rather than eyeballed. */
  for (const between of [".property-rich-text-body", ".property-rich-text.is-centered .property-rich-text-body"]) {
    assert.equal(
      declarations(between, "text-align").length,
      0,
      `${between} declares an alignment; it swallows the wrapper's value before the paragraph sees it`,
    );
  }
});

test("an unaligned block is untouched", () => {
  // Both escape hatches hang off `.is-text-align`; without it the variant must
  // still centre, or every page that never set an alignment is redrawn.
  const base = declarations(".property-rich-text.is-centered", "text-align").at(-1);
  assert.ok(base && base.value === "center", "the centred variant no longer centres by default");
});
