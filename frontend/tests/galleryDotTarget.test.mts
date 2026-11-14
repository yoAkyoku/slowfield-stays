import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode";

/**
 * The stay card's gallery dots: big enough to hit, and named for what they are.
 *
 * Measured on the running site, an inactive dot's own box was 8x8 — while the
 * prev/next arrows beside it were 44x44 — and the active one 24x8. A
 * pseudo-element did carry a 24x24 hit region, but the ELEMENT stayed 8px, so
 * every automated tap-target check kept reporting it and nothing about the
 * button itself said it was reachable. The dot is now padded out to 24x24 and
 * the painted circle clipped back to 8px, the same way `.hero-dots` grows its
 * 3px bar.
 *
 * The visual must not move: the row is five dots 8px apart at the foot of a
 * photo, and padding 24px boxes into it would space them 24px apart unless the
 * gap is given back. That arithmetic is what this file pins, along with the two
 * things a screen reader needed: a role for the row's label to attach to, and a
 * marker saying which dot is the one showing.
 */

const CSS = readStyles("app/globals.css");
const SRC = readCode("app/modules/stays/StayCard.tsx");

/**
 * The declaration body of the rule whose selector list is exactly this.
 *
 * Matched against the WHOLE selector list, not against a line: this file
 * contains both `.stay-card-gallery-dots { ... }` and an earlier
 * `.stay-card-gallery-controls,\n.stay-card-gallery-dots { z-index: 3 }`, and a
 * line-anchored search finds the second one — which is how the spacing check
 * below first read `gap` out of a rule that declares no gap and passed while
 * the row was 24px apart.
 */
function rule(selector: string): string {
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = RULE.exec(CSS); m; m = RULE.exec(CSS)) {
    const sels = m[1].replace(/\s+/g, " ").trim();
    if (sels === selector) return m[2];
  }
  assert.fail("no rule with the selector list " + selector + " — was it renamed or merged?");
}

/** Like `rule`, but `null` when the stylesheet has no such rule at all. */
function ruleIfPresent(selector: string): string | null {
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = RULE.exec(CSS); m; m = RULE.exec(CSS)) {
    if (m[1].replace(/\s+/g, " ").trim() === selector) return m[2];
  }
  return null;
}

/** A declaration's value, or null. */
function decl(body: string, prop: string): string | null {
  let found: string | null = null;
  for (const d of body.split(";")) {
    const colon = d.indexOf(":");
    if (colon === -1) continue;
    if (d.slice(0, colon).trim() !== prop) continue;
    found = d.slice(colon + 1).trim(); // last one wins, as in the cascade
  }
  return found;
}

function px(body: string, prop: string, fallback = 0): number {
  const value = decl(body, prop);
  if (value === null) return fallback;
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
}

const DOT = ".stay-card-gallery-dots button";
const ROW = ".stay-card-gallery-dots";

test("the dot's own box takes a thumb, not just a pseudo-element", () => {
  const body = rule(DOT);
  const padding = px(body, "padding");
  const contentBox = decl(body, "box-sizing") === "content-box";

  /* Under content-box the declared width is the dot and the padding is added
     around it; under border-box the padding would come out of the 8px instead
     and the button would still measure 8. */
  const width = px(body, "width") + (contentBox ? padding * 2 : 0);
  const height = px(body, "height") + (contentBox ? padding * 2 : 0);

  assert.ok(width >= 24, "the dot button computes to " + width + "px wide, under the 24px floor (WCAG 2.5.8)");
  assert.ok(height >= 24, "the dot button computes to " + height + "px tall, under the 24px floor (WCAG 2.5.8)");

  // The active dot is a wider pill; its height comes from the same rule, so a
  // change that shrinks the shared padding has to fail here too.
  const active = rule(DOT + ".is-active");
  const activeWidth = px(active, "width") + (contentBox ? padding * 2 : 0);
  assert.ok(activeWidth >= 24, "the active dot computes to " + activeWidth + "px wide");
});

test("growing the target did not grow the dot", () => {
  const body = rule(DOT);
  assert.equal(px(body, "width"), 8, "the painted dot is no longer 8px — the design was small dots");
  assert.equal(px(body, "height"), 8, "the painted dot is no longer 8px tall");
  assert.equal(
    decl(body, "background-clip"),
    "content-box",
    "without background-clip the padding paints too and the dot becomes a 24px blob",
  );
  assert.equal(
    decl(rule(DOT + ".is-active"), "background-clip"),
    "content-box",
    "the active dot repaints its background and would lose the clip",
  );
});

test("the dots still sit 8px apart", () => {
  /* Rendered gap between two painted dots = the two paddings between them, plus
     the flex gap, plus both margins. It was 8px before the padding arrived and
     has to still be 8px, or every stay card's photo gets a wider dot row. */
  const row = rule(ROW);
  const body = rule(DOT);
  const gap = px(row, "gap");
  const padding = px(body, "padding");
  const margin = px(body, "margin", 0); // "0 -4px" parses to the first value
  const sideMargin = Number.parseFloat((decl(body, "margin") ?? "0").split(/\s+/)[1] ?? "0") || margin;

  const rendered = padding * 2 + sideMargin * 2 + gap;
  assert.equal(
    rendered,
    8,
    "the dots would render " + rendered + "px apart instead of 8px (gap " + gap +
      " + padding 2x" + padding + " + margin 2x" + sideMargin + ")",
  );
});

test("the old outset overlay cannot steal a neighbour's clicks", () => {
  /* An 8px outset from what is now a 24px button is a 40px hit region with
     centres 16px apart — the dot painted next to it would sit inside this one's
     region and, being later in the DOM, take the click.

     The rule used to be kept in place, inert, because tests/touchTargets.test.mts
     asserted its geometry as the tap target. It was not the tap target: it
     carried `pointer-events: none`, so it enlarged nothing, and the 24px box
     comes from the button's own `content-box` + 8px padding. That test now
     asserts the padding, and this rule has been removed — so its absence is the
     good outcome, not a missing check. If it ever comes back, it still has to
     be inert. */
  const before = ruleIfPresent(DOT + "::before");
  if (before === null) return;
  const inset = px(before, "inset");
  if (inset >= 0) return; // no outset, nothing to neutralise
  assert.equal(
    decl(before, "pointer-events"),
    "none",
    "the ::before overlay outsets " + inset + "px and is still clickable, which puts a dot's visible circle inside its neighbour's target",
  );
});

test("the dot row is announced as a group, and says which dot is showing", () => {
  /* An aria-label on a plain <div> names nothing — the element has no role for
     the name to attach to, so the row reached a screen reader as loose buttons.
     StayShowcaseCard already pairs role="group" with aria-current here. */
  const rowTag = /<div className="stay-card-gallery-dots"([^>]*)>/.exec(SRC);
  assert.ok(rowTag, "the dots row is not a div with that class any more");
  assert.match(rowTag[1], /aria-label=/, "the dots row lost its label");
  assert.match(
    rowTag[1],
    /role="(group|tablist|radiogroup)"/,
    "the dots row carries an aria-label with no role, so the label is dropped",
  );

  /* aria-selected is not supported on a button, so which dot is current can
     only travel as aria-current. */
  const dots = SRC.slice(SRC.indexOf('className="stay-card-gallery-dots"'));
  assert.match(
    dots.slice(0, dots.indexOf("</div>")),
    /aria-current=\{[^}]*activeIndex[^}]*\}/,
    "no dot is marked current against activeIndex",
  );
});
