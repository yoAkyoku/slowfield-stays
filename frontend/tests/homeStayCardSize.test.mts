import assert from "node:assert/strict";
import test from "node:test";
import { readStyles } from "./readCode";

/**
 * Two stays on the homepage are not two half-page cards.
 *
 * 客戶: 母站首頁的住宿卡片太大.
 *
 * Measured at 1440px before the fix, against the /stays index the client has
 * already accepted — the same StayCard component in both:
 *
 *     homepage   card 574.8 × 628.5   photo 574.8 × 431.1   row 1189.6 wide
 *     /stays     card 400.3 × 521.2   photo 400.3 × 300.2
 *
 * Nothing sized the card. `.home-collection--grid.is-n2` hands two entries the
 * whole three-column row — it exists so a short row does not leave a hole
 * (客戶: 感覺沒質感) — and the card fills whatever it is given. So the row is
 * what is capped, and centred, which is what `.is-n1` above it already does at
 * this same 860px.
 *
 * After: card 410 × 504.9, photo 410 × 307.5 — the /stays size. The cap only
 * bites past a ~1120px window; at 1024px the row was already 773.6px and did
 * not move.
 *
 * The same rule had the opposite symptom on a phone, which is why the one-
 * column step is pinned here too. `.home-collection--grid` is one class and
 * `.is-n2` is two, so the 560px step never reached a two-entry row: measured at
 * 375px the cards were 147.6px wide with a 147.6 × 110.7 photo, two thumbnails
 * side by side. After: one column, 315.2 × 428.8.
 *
 * Assertions are positional — the LAST declaration on the selector. There are
 * later unconditional `.grid` and `.home-collection--grid` rules in this file
 * and the first match is not the one the browser obeys.
 */

const CSS = readStyles("app/globals.css");

type Rule = { at: number; selectors: string[]; body: string; atRule: string | null };

/**
 * Every innermost rule in the file, in source order, with the at-rule it sits
 * inside. See newsletterBlockFold.test.mts for why the nesting is read from the
 * text BETWEEN matches rather than from the selector text.
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

/** Every declaration of `prop` on rules that list `sel` as a WHOLE selector. */
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

/** The stay row: two entries, and stay cards rather than CMS content cards. */
const ROW = ".home-collection--grid.is-n2:has(.stay-card)";

test("the two-up stay row is capped and centred", () => {
  const cap = winner(ROW, "max-width");
  assert.ok(cap, `${ROW} sets no max-width — two stays take the whole three-column row again`);
  assert.match(cap!.value, /^\d+px$/, `the cap reads "${cap!.value}"`);
  assert.equal(
    winner(ROW, "margin-inline")?.value,
    "auto",
    "the capped row is not centred, so it hangs off the left of the section",
  );
});

test("the cap puts the card on the size /stays already uses", () => {
  /* The number that matters is not the cap, it is what the cap leaves a card:
     (860 - 40) / 2 = 410, against the 400.3px /stays card the client accepted.
     Asserting the cap alone would pass just as happily if the gap moved. */
  const cap = Number(/^(\d+)px$/.exec(winner(ROW, "max-width")!.value)![1]);
  const gapDecl = winner(".home-collection--grid", "column-gap");
  assert.ok(gapDecl, "the collection grid declares no column-gap; the card width is unknowable here");
  const gap = Number(/^(\d+)px$/.exec(gapDecl!.value)![1]);
  const card = (cap - gap) / 2;
  assert.ok(
    card >= 380 && card <= 440,
    `the cap leaves a ${card}px card. /stays — the size the client accepted — measures 400.3px; `
      + "before the fix the homepage card was 574.8px",
  );
});

test("both short-row layouts stay on one measure", () => {
  /* .is-n1 lays a single entry sideways inside 860px. Two numbers for the same
     decision is how one of them drifts back up while nobody is looking. */
  const single = winner(".home-collection.is-n1 .home-collection-card", "max-width");
  assert.equal(
    winner(ROW, "max-width")?.value,
    single?.value,
    `the two-up row is capped at ${winner(ROW, "max-width")?.value} and the one-up card at `
      + `${single?.value} — the short rows no longer share a measure`,
  );
});

test("the cap is scoped to stay cards, not to every short collection", () => {
  /* `is-n2` is shared: BlockStays draws either stay cards or CMS content cards
     from the same grid class, and only the stay cards were reported. A cap on
     the bare selector would silently resize the content rows too. */
  assert.equal(
    winner(".home-collection--grid.is-n2", "max-width"),
    null,
    "the cap has moved onto the unscoped is-n2 rule and now shrinks the CMS content rows as well",
  );
  assert.ok(ROW.includes(":has(.stay-card)"), "the scoping selector no longer names the stay card");
});

test("the phone step reaches a two-entry stay row", () => {
  /* The bug's other half. This assertion is about SPECIFICITY, not about the
     query existing: `.home-collection--grid` at 560px was already there and did
     nothing, because `.is-n2` outranks it and keeps two columns down to 375px. */
  const phone = declarations(ROW, "grid-template-columns").filter((d) => d.atRule);
  assert.ok(
    phone.some((d) => /max-width:\s*560px/.test(String(d.atRule)) && /minmax\(0, 1fr\)/.test(d.value)),
    "no 560px one-column step reaches the two-entry stay row — at 375px it draws two "
      + "147.6px cards with 147.6 × 110.7 photos",
  );

  /* And the reason it is needed, asserted rather than described: the general
     rule in that query carries fewer classes than the count class it has to
     beat. If someone ever raises the general rule's specificity instead, this
     goes red and the scoped rule can be dropped on purpose rather than by
     accident. */
  const classes = (sel: string) => (sel.match(/\.[A-Za-z0-9_-]+/g) ?? []).length;
  const general = RULES.find(
    (r) => /max-width:\s*560px/.test(String(r.atRule))
      && r.selectors.includes(".home-collection--grid"),
  );
  assert.ok(general, "the general 560px one-column step is gone");
  assert.ok(
    classes(".home-collection--grid") < classes(".home-collection--grid.is-n2"),
    "the general step now outranks the count class, so the scoped rule is dead weight",
  );
});

test("nothing later takes the cap or the phone step back", () => {
  /* globals.css has a long tail. A later `.home-collection` rule setting
     max-width or columns on this same row would win on source order, and the
     row it breaks is one nobody looks at while editing the tail. */
  const capAt = winner(ROW, "max-width")!.at;
  const stragglers = RULES.filter((r) => r.at > capAt)
    .filter((r) => r.selectors.some((s) => /^\.home-collection--grid(\.|:|$)/.test(s)))
    .filter((r) => /(^|[\s;])(max-width|grid-template-columns):/.test(r.body))
    /* The scoped 560px step is the one later rule that is meant to be there. */
    .filter((r) => !r.selectors.includes(ROW))
    .map((r) => `${r.selectors.join(", ")}${r.atRule ? ` inside ${r.atRule}` : ""} at ${r.at}`);
  assert.deepEqual(stragglers, [], `later rules outrank the cap: ${stragglers.join(" | ")}`);
});

test("the /stays index the client accepted is left alone", () => {
  /* The complaint was about the homepage instance only. A cap that leaked onto
     .stays-grid would re-open 客戶: 母站住宿頁的卡片太大 from the other side —
     see stayCardSize.test.mts, which owns that page. */
  assert.equal(
    winner(".stays-grid", "max-width"),
    null,
    "the stays index grid has picked up a max-width; its 400.3px card was already accepted",
  );
  const leaked = RULES.filter((r) => r.selectors.includes(ROW))
    .filter((r) => r.selectors.some((s) => s.includes("stays-grid")));
  assert.deepEqual(leaked.map((r) => r.selectors.join(", ")), [], "the homepage cap names .stays-grid");
});
