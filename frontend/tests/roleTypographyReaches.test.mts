import assert from "node:assert/strict";
import test from "node:test";
import { cssRules, readStyles, splitSelectorList } from "./readCode.mts";

/**
 * The per-role typography panel is only real if the stylesheet reads it.
 *
 * `roleTypeVars()` emits `--r-<role>-<prop>` on the block wrapper; a control
 * that no rule reads saves and changes nothing. An audit of all 23 block types
 * found 33 such gaps — 內文字體 and 內文字重 were missing on almost every block,
 * 內文對齊 could never win on a centred block, and the item titles on cards were
 * unwired entirely. None of it was detectable: every control looked wired
 * because SOME rule somewhere read SOME variable.
 *
 * This is the check that was missing. Each entry names an element an editor
 * actually types into and the role it belongs to; the rule that styles it must
 * read that role's variable for every property it declares.
 */

const CSS = readStyles("app/globals.css");

const PROPS: Record<string, string> = {
  font: "font-family",
  size: "font-size",
  weight: "font-weight",
  color: "color",
  align: "text-align",
};

/**
 * Declaration blocks of every rule whose selector list contains `selector`.
 *
 * Through the shared parser, which unwraps `@media`. Splitting on "}" and
 * taking the text before the first "{" — which is what this did — cannot see a
 * rule inside a breakpoint at all: the first "{" belongs to the media query, so
 * the selector reads as `@media (max-width: …)`. 531 rules in this stylesheet
 * live inside one, and a rule MOVED into a breakpoint read here as a rule
 * deleted. It also tore `:is(.a, .b)` in half on the comma.
 */
function rulesFor(selector: string): string[] {
  const want = selector.split(/\s+/).filter(Boolean).join(" ");
  return cssRules(CSS)
    .filter((r) => splitSelectorList(r.selector).includes(want))
    .map((r) => r.body);
}

/**
 * Elements an editor writes into, and the role they answer to.
 *
 * Card and item titles are on the 標題 role and card copy on 內文 by the
 * client's own call (客戶: 都算). The map block's single link is on 按鈕 rather
 * than 內文: it is the only clickable thing there, so filing it under 內文 would
 * leave the 按鈕 row with nothing to act on. FAQ questions and pricing cells are
 * 內文 — a question looks like a heading but tying it to the block's own h2
 * would make the two impossible to set independently.
 */
const WIRED: Array<[string, string]> = [
  // body copy
  [".property-pricing-intro", "body"],
  [".property-pricing-notes p", "body"],
  [".property-pricing-table td", "body"],
  [".stay-card-body p", "body"],
  [".home-collection-card-body p", "body"],
  [".home-journal-text p", "body"],
  [".home-pathways-intro p", "body"],
  [".home-booking-flow-copy p", "body"],
  [".property-house-rules-content p", "body"],
  [".property-attraction-body p", "body"],
  [".property-attractions-caption", "body"],
  [".property-partner-body p", "body"],
  [".block-about-feature-info p", "body"],
  [".feature-hero-item p", "body"],
  [".block-newsletter-copy p", "body"],
  [".page-block-contact-form-subtitle", "body"],
  [".property-image-gallery-caption", "body"],
  [".property-oembed-caption", "body"],
  [".property-contact-directions p", "body"],
  [".stay-faq-question", "body"],
  // card / item titles
  [".home-journal-text strong", "title"],
  [".home-pathway-card strong", "title"],
  [".block-about-feature-info h3", "title"],
  [".property-house-rules-content strong", "title"],
  [".property-attraction-body strong", "title"],
  [".property-partner-name", "title"],
];

for (const [selector, role] of WIRED) {
  test(`${selector} answers to the ${role} role`, () => {
    const rules = rulesFor(selector);
    assert.ok(rules.length > 0, `no rule found for ${selector} — re-anchor this entry`);
    const declared = rules.join(";");
    const missing: string[] = [];
    for (const [key, prop] of Object.entries(PROPS)) {
      /* ALL FIVE, not "whichever the rule happens to declare". The first
         version of this excused an undeclared property as "it inherits" —
         which is precisely the defect being guarded against: 內文字體 and
         內文字重 were missing site-wide because the rules never declared them
         at all, so there was nothing for the variable to override. A mutation
         that simply deleted a threaded declaration survived that version. */
      void prop;
      if (!declared.includes(`var(--r-${role}-${key}`)) missing.push(PROPS[key]);
    }
    assert.deepEqual(
      missing,
      [],
      `${selector} hardcodes ${missing.join(", ")} — the ${role} panel saves and the page does not change`,
    );
  });
}

test("the shared item-heading scale does not swallow the 標題 role", () => {
  /* The H4 group sits later than each block's own threaded rule and used to
     declare `var(--type-h4-size, …)` with no role layer, so it won on source
     order and 字體／字級／字重 moved nothing on item headings. Measured with a
     probe before the fix: colour and alignment responded, the other three did
     not. */
  const rules = rulesFor(".block-about-feature-info h3");
  assert.ok(rules.length > 0, "the item heading has no rule at all — re-anchor this test");
  assert.ok(
    rules.some((r) => r.includes("--type-h4-")),
    "the site H4 scale no longer reaches item headings — re-anchor this test",
  );
  /* Every rule that declares one of the three, not one nominated rule. The
     earlier version picked `the rule containing --type-h4-size` and asserted all
     three inside it, which pinned the SHAPE: splitting the size out into its own
     rule — which is what let each card keep its own figure instead of the
     group's `inherit` — failed a test whose subject had not changed. What must
     hold is that nothing declares these behind the role's back. */
  for (const [key, prop] of [["size", "font-size"], ["weight", "font-weight"], ["font", "font-family"]] as const) {
    const declaring = rules.filter((r) => new RegExp(`(^|;)\\s*${prop}\\s*:`).test(r));
    assert.ok(declaring.length > 0, `nothing declares ${prop} on the item heading`);
    for (const rule of declaring) {
      assert.match(
        new RegExp(`${prop}\\s*:\\s*([^;]+)`).exec(rule)![1],
        new RegExp(`var\\(--r-title-${key}`),
        `a rule hardcodes ${prop} on the item heading, ahead of 標題${key}`,
      );
    }
  }
});

test("行距 reaches the containers the body copy inherits from", () => {
  /* The paragraphs were given `line-height: inherit`, but their CONTAINER kept
     a hard 1.9 from the shared body group — so the paragraph inherited 1.9 from
     its parent rather than the block's value. Measured live on /brand: wrapper
     set to 3.2, paragraph still rendered 30.4px. */
  const rules = rulesFor(".property-block-styled.is-line-height .property-rich-text-body");
  assert.ok(rules.length > 0, "the body CONTAINER is not in the is-line-height list");
  assert.ok(rules.some((r) => /line-height:\s*inherit/.test(r)));
});
