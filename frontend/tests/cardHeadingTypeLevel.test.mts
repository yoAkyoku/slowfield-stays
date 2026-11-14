import assert from "node:assert/strict";
import test from "node:test";
import { readStyles } from "./readCode";

/**
 * A card heading answers to ONE type level, and it is H3.
 *
 * `.stay-card-body h3` was bound to three at once. Its own rule said H4 for
 * size, weight, family and line-height; a second rule 17,000 lines later
 * re-declared the weight as H4/500 under a comment claiming "the card heading
 * answers to H4 (its line-height already does)"; the generic `.section h3`
 * group near the end of the file re-declared all four as H3; and a later group
 * re-declared line-height as H4 again. A third comment, on `.section > h2`,
 * asserted that IT was the rule that always wins.
 *
 * None of the three descriptions matched the page. Measured in Chrome against
 * the running site, before any of this was touched:
 *
 *   group homepage 1158px  .stay-card-body h3            16px / 400 / 20.8px
 *                          .home-collection-card-body strong
 *                                              18.5216px / 500 / 24.0781px
 *   group homepage  375px  .stay-card-body h3      20.2608px / 400 / 26.339px
 *                          …-card-body strong            18px / 500 / 23.4px
 *   /stays 1158px & 375px  .stay-card-body h3            22px / 400 / 28.6px
 *
 * — i.e. size, weight and family from --type-h3-*, line-height from
 * --type-h4-line. `.home-collection-card-body strong` had the same split in a
 * worse form: its line-height followed H4 while NO level moved its size at all.
 *
 * H3 is the level that survives, because it is the one already winning wherever
 * a generic rule reaches these cards. Standardising on H4 instead would let the
 * card's own clamp win the homepage and take its title from 16px to ~26px — the
 * size the client had already had taken out (see homeStayCardSize.test.mts).
 * Every figure above is unchanged by the fix; only the variable names moved.
 *
 * Assertions here are POSITIONAL and whole-selector, for the reasons
 * roleTypeCascade.test.mts and stayCardSize.test.mts both document: this file
 * is 36,000 lines with a long tail of later overrides, `.stay-card-body h3` is
 * declared in six places, and a substring match on a comma-separated selector
 * list picks up rules that merely contain the string.
 */

const CSS = readStyles("app/globals.css");

type Rule = { at: number; selectors: string[]; body: string; atRule: string | null };

/** Every innermost rule in the file, in source order, with the at-rule it sits
 *  inside. The nesting is read from the text BETWEEN matches — see
 *  newsletterBlockFold.test.mts for why the selector text cannot carry it. */
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

/**
 * The two card headings this file is about, as selector TAILS.
 *
 * A tail rather than a whole selector because the variants are what get
 * forgotten: `.stays-grid .stay-card-body h3` and
 * `.home-collection--compact .home-collection-card-body strong` each carry more
 * classes than the rule holding the variable, so they outrank it and an
 * unthreaded one turns the site setting off for that page alone.
 *
 * `(^|\s)` so a hypothetical `.x-stay-card-body h3` is not swept in, and `$` so
 * `.stay-card-body h3 span` is not either.
 */
const HEADINGS: Array<[string, RegExp]> = [
  [".stay-card-body h3", /(^|\s)\.stay-card-body h3$/],
  [".home-collection-card-body strong", /(^|\s)\.home-collection-card-body strong$/],
];

/** Every rule that styles one of the card headings, in source order. */
function rulesFor(tail: RegExp): Rule[] {
  return RULES.filter((r) => r.selectors.some((s) => tail.test(s)));
}

/** Declarations of `prop` in a rule body, as `{ prop, value }`. */
function declarationsIn(body: string, prop: string): string[] {
  const out: string[] = [];
  for (const declaration of body.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon === -1) continue;
    if (declaration.slice(0, colon).trim() !== prop) continue;
    out.push(declaration.slice(colon + 1).replace(/\s+/g, " ").trim());
  }
  return out;
}

/** The four properties a heading's type level owns, and the H3 variable each
 *  one has to resolve through. Written out rather than derived from the
 *  property name — `line-height` → `--type-h3-line` is not a rule a reader
 *  should have to reconstruct from string surgery. */
const TYPED: Array<[string, string]> = [
  ["font-size", "--type-h3-size"],
  ["font-weight", "--type-h3-weight"],
  ["line-height", "--type-h3-line"],
  ["font-family", "--type-h3-family"],
];

test("both card headings are actually found in the stylesheet", () => {
  // Guards every sweep below: a renamed class would leave them iterating over
  // nothing and passing on an empty set.
  for (const [name, tail] of HEADINGS) {
    const hits = rulesFor(tail);
    assert.ok(hits.length >= 3, `${name}: only ${hits.length} rule(s) found — the selector matcher is wrong`);
  }
  // …and the tail matcher really does reach the variants that outrank the base.
  const stays = rulesFor(HEADINGS[0][1]).flatMap((r) => r.selectors);
  assert.ok(stays.includes(".stays-grid .stay-card-body h3"), "the /stays override is no longer being checked");
  assert.ok(stays.includes(".home-collection.is-n1 .stay-card-body h3"), "the one-up override is no longer being checked");
  const coll = rulesFor(HEADINGS[1][1]).flatMap((r) => r.selectors);
  for (const variant of [
    ".home-collection--list .home-collection-card-body strong",
    ".home-collection--compact .home-collection-card-body strong",
  ]) {
    assert.ok(coll.includes(variant), `${variant} is no longer being checked`);
  }
});

test("the tail matcher does not sweep in a different element", () => {
  // The shape roleTypeCascade warns about, checked directly rather than assumed.
  const [, stayTail] = HEADINGS[0];
  assert.ok(stayTail.test(".stay-card-body h3"));
  assert.ok(stayTail.test(".stays-grid .stay-card-body h3"));
  assert.ok(!stayTail.test(".x-stay-card-body h3"), "a class merely ENDING in stay-card-body is being swept in");
  assert.ok(!stayTail.test(".stay-card-body h3 span"), "a descendant of the heading is being swept in");
  assert.ok(!stayTail.test(".stay-card-body h2"), "a different heading level is being swept in");
});

test("no rule on a card heading names a type level other than H3", () => {
  /* The whole defect in one assertion. `--type-h4-size`, `--type-h2-line`,
     `--type-body-size` — any of them on one of these selectors means the
     element is answering to two levels again. */
  const offenders: string[] = [];
  for (const [name, tail] of HEADINGS) {
    for (const rule of rulesFor(tail)) {
      for (const m of rule.body.matchAll(/--type-([a-z0-9]+)-([a-z]+)/g)) {
        if (m[1] === "h3") continue;
        offenders.push(`${name}: ${rule.selectors.join(", ")} spends ${m[0]}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these card-heading rules answer to a second type level:\n    ${offenders.join("\n    ")}`,
  );
});

test("the level sweep can see a level when there is one", () => {
  // Guards the guard: an empty offender list is also what a broken pattern
  // produces, and this one has to distinguish h3 from h4 inside a var() chain.
  const found = [...HEADINGS].flatMap(([, tail]) =>
    rulesFor(tail).flatMap((r) => [...r.body.matchAll(/--type-([a-z0-9]+)-([a-z]+)/g)].map((m) => m[0])));
  assert.ok(found.length >= 8, `only ${found.length} type variables found on the card headings — the pattern is not matching`);
  assert.ok(found.every((v) => v.startsWith("--type-h3-")), "the sweep above and this one disagree");
  const probe = "font-size: var(--r-title-size, var(--type-h4-size, clamp(22px, 1.8vw, 28px)));";
  assert.deepEqual([...probe.matchAll(/--type-([a-z0-9]+)-([a-z]+)/g)].map((m) => m[0]), ["--type-h4-size"]);
});

/* ── The four properties, each from H3, each still on its measured value ─── */

/** The last declaration of `prop` on a card heading, outside any at-rule —
 *  what the browser obeys at full width for the LOWEST-specificity selector. */
function winner(tail: RegExp, prop: string): { rule: Rule; value: string } | null {
  let out: { rule: Rule; value: string } | null = null;
  for (const rule of rulesFor(tail)) {
    if (rule.atRule) continue;
    for (const value of declarationsIn(rule.body, prop)) out = { rule, value };
  }
  return out;
}

test("EVERY typed declaration on a card heading resolves through H3, not just the last", () => {
  /* The gap the "last declaration" tests leave, and it is not hypothetical:
     dropping the H3 chain from the BASE `.home-collection-card-body strong`
     rule — back to the bare `clamp(18px, 1.6vw, 23px)` it carried before —
     leaves those tests green, because the `--compact` variant declared later
     still names the variable and is the one they read. A rule that spends no
     level at all is exactly as unreachable from 網站設定 as one that spends the
     wrong one; it just cannot be found by looking for the wrong name. */
  const unthreaded: string[] = [];
  for (const [name, tail] of HEADINGS) {
    for (const rule of rulesFor(tail)) {
      for (const [prop, variable] of TYPED) {
        for (const value of declarationsIn(rule.body, prop)) {
          if (value.includes(variable)) continue;
          unthreaded.push(`${name}: \`${rule.selectors.join(", ")}\` sets ${prop}: ${value}`);
        }
      }
    }
  }
  assert.deepEqual(
    unthreaded,
    [],
    "these card-heading declarations answer to no type level at all, so 網站設定 → H3 cannot move them:\n    "
      + unthreaded.join("\n    "),
  );
});

for (const [name, tail] of HEADINGS) {
  test(`${name}: the last declaration of each typed property resolves through H3`, () => {
    /* Four properties, one level, and the level named in the declaration the
       browser reaches last — not in whichever rule happens to mention it first.
       All four used to name H4 here while H3 was doing the work. */
    for (const [prop, variable] of TYPED) {
      const win = winner(tail, prop);
      assert.ok(win, `no ${prop} declaration on ${name} at all`);
      assert.ok(
        win!.value.includes(variable),
        `the last ${prop} on \`${win!.rule.selectors.join(", ")}\` reads "${win!.value}" — ${variable} is not in it`,
      );
    }
  });
}

test("the hard defaults are the sizes measured in the browser", () => {
  /* The clause that matters more than the tidiness: the rendered result must not
     change. Each of these is the fallback that produced a figure in the header
     comment, so a "cleanup" that rounds one of them shows up here rather than on
     a client's homepage. */
  const cases: Array<[string, string, string]> = [
    [".stay-card-body h3", "font-size", "clamp(22px, 1.8vw, 28px)"],
    [".stays-grid .stay-card-body h3", "font-size", "clamp(22px, 1.8vw, 28px)"],
    [".stays-grid .stay-card-body h3", "font-weight", "400"],
    [".home-collection.is-n1 .stay-card-body h3", "font-size", "clamp(26px, 2.6vw, 38px)"],
    [".home-collection-card-body strong", "font-size", "clamp(18px, 1.6vw, 23px)"],
    [".home-collection-card-body strong", "font-weight", "500"],
    [".home-collection--list .home-collection-card-body strong", "font-size", "clamp(22px, 2.4vw, 34px)"],
    [".home-collection--compact .home-collection-card-body strong", "font-size", "16px"],
  ];
  for (const [selector, prop, expected] of cases) {
    const rules = RULES.filter((r) => !r.atRule && r.selectors.includes(selector));
    assert.ok(rules.length, `no top-level \`${selector}\` rule`);
    const values = rules.flatMap((r) => declarationsIn(r.body, prop));
    assert.ok(values.length, `\`${selector}\` declares no ${prop}`);
    const value = values[values.length - 1];
    assert.ok(
      value.includes(expected),
      `\`${selector}\` ${prop} is "${value}" — the measured default ${expected} is gone, so the card changes size`,
    );
  }
  // And the leading every card title shares, which `min-height: 2lh` turns into
  // the reserved two-line box.
  const lh = winner(HEADINGS[0][1], "line-height");
  assert.equal(lh?.value, "var(--type-h3-line, 1.3)", "the card leading moved; every reserved card height moves with it");
});

/* ── One line-height, declared where it can win ───────────────────────────── */

test("a card title declares its line-height exactly once", () => {
  /* Two was the bug: `var(--type-h4-line, 1.05)` on the card's own rule and
     `var(--type-h4-line, 1.3)` at the end of the file. The first was dead, and
     being dead is what let the two drift to different numbers unnoticed —
     `--card-title-line: 1.05` had been copied from it into the two-line reserve,
     where it under-reserved against a real 1.3. */
  for (const [name, tail] of HEADINGS) {
    const declared = rulesFor(tail)
      .filter((r) => !r.atRule)
      .flatMap((r) => declarationsIn(r.body, "line-height").map(() => r.selectors.join(", ")));
    assert.deepEqual(
      declared.length,
      1,
      `${name} declares line-height ${declared.length} times, on: ${declared.join(" | ")}`,
    );
  }
});

test("that one declaration is placed after the generic rule it has to beat", () => {
  /* Positional, not existential. `.section h3` also sets line-height and carries
     the same one class + one element, so the card's rule wins on source order
     alone — put it earlier (which is where the dead one was) and every homepage
     card silently takes `inherit` instead, which computes to `normal` and
     shortens the two-line reserve. */
  const generic = RULES.filter(
    (r) => !r.atRule && r.selectors.includes(".section h3") && declarationsIn(r.body, "line-height").length,
  );
  assert.ok(generic.length, "the generic `.section h3` line-height is gone — re-check what wins for a card now");
  const genericAt = generic[generic.length - 1].at;
  for (const [name, tail] of HEADINGS) {
    const card = winner(tail, "line-height");
    assert.ok(card, `${name} has no line-height`);
    assert.ok(
      card!.rule.at > genericAt,
      `${name}'s line-height is declared at ${card!.rule.at}, before \`.section h3\` at ${genericAt} — it loses the cascade`,
    );
  }
});

test("the generic rule a card heading lands in is itself H3", () => {
  /* The other half of "one level": the card's own rules can name H3 all they
     like, but on the group homepage these cards sit inside the `.section` that
     BlockStays renders, so `.section h3` is what sizes them. If it is ever
     re-pointed at another level the card silently follows it. */
  const generic = RULES.filter((r) => !r.atRule && r.selectors.includes(".section h3"));
  assert.ok(generic.length, "`.section h3` is gone");
  const body = generic[generic.length - 1].body;
  for (const [prop, variable] of TYPED) {
    const values = declarationsIn(body, prop);
    assert.ok(values.length, `\`.section h3\` no longer declares ${prop}`);
    assert.ok(
      values[values.length - 1].includes(variable),
      `\`.section h3\` ${prop} reads "${values[values.length - 1]}", not ${variable}`,
    );
  }
});

test("the two-line reserve is not given a leading of its own to drift from", () => {
  /* `min-height: 2lh` reads the element's real line-height; the calc beside it
     is the fallback for browsers without `lh`, and `--card-title-line` is what
     that fallback spends. A card that sets the variable to anything other than
     its actual leading re-opens the drift the reserve's own comment describes. */
  for (const [name, tail] of HEADINGS) {
    const set = rulesFor(tail).flatMap((r) => declarationsIn(r.body, "--card-title-line"));
    const leading = winner(tail, "line-height")!.value;
    for (const value of set) {
      assert.ok(
        leading.includes(`, ${value})`),
        `${name} reserves two lines of ${value} while its line-height resolves from "${leading}"`,
      );
    }
  }
});
