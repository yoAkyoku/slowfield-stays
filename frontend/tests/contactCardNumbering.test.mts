import assert from "node:assert/strict";
import test from "node:test";
import { compileDeclarations } from "./sourceEval.mts";
import { readCode } from "./readCode.mts";

/**
 * 交通與聯繫 numbers the cards that are there.
 *
 * All three are conditional — 聯絡我們 needs a phone, a LINE or an email; 地址
 * and 如何抵達 are each their own field — but 01 / 02 / 03 were written into the
 * markup. A block with only an address rendered a single card labelled "02", and
 * one with no phone opened the list at "02". A numbered sequence starting in the
 * middle reads as a card having gone missing, which is the opposite of what it
 * means.
 */

const FILE = "app/modules/property/blocks/BlockContactInfo.tsx";

/** The real `cardNum`, lifted out and run against each combination. */
function numbering(present: boolean[]): string[] {
  const { cardNum } = compileDeclarations(FILE, ["cardNum"], ["present"])({ present }) as {
    cardNum: (i: number) => string;
  };
  return present.map((shown, i) => (shown ? cardNum(i) : "")).filter(Boolean);
}

test("all three cards number 01 02 03", () => {
  assert.deepEqual(numbering([true, true, true]), ["01", "02", "03"]);
});

test("a lone address card is 01, not 02", () => {
  // The reported case.
  assert.deepEqual(numbering([false, true, false]), ["01"]);
});

test("a missing first card does not leave a gap", () => {
  assert.deepEqual(numbering([false, true, true]), ["01", "02"]);
  assert.deepEqual(numbering([false, false, true]), ["01"]);
});

test("a missing middle card does not leave a gap", () => {
  /* The one a role-based scheme gets wrong in the other direction: 聯絡我們 and
     如何抵達 with no address used to render 01 and 03. */
  assert.deepEqual(numbering([true, false, true]), ["01", "02"]);
});

test("every combination is a gapless run from 01", () => {
  // Exhaustive: eight combinations, and the invariant holds for all of them.
  for (let mask = 0; mask < 8; mask += 1) {
    const present = [Boolean(mask & 1), Boolean(mask & 2), Boolean(mask & 4)];
    const got = numbering(present);
    const want = present.filter(Boolean).map((_, i) => String(i + 1).padStart(2, "0"));
    assert.deepEqual(got, want, `combination ${JSON.stringify(present)} numbered ${JSON.stringify(got)}`);
  }
});

test("no card carries a hardcoded number any more", () => {
  const src = readCode(FILE);
  assert.doesNotMatch(src, /property-contact-card-num">0\d</,
    "a literal card number is back, so an omitted card leaves a hole in the sequence");
  assert.match(src, /property-contact-card-num">\{cardNum\(\d\)\}</);
});

test("the number is not derived from a counter mutated while rendering", () => {
  /* A `++n` inside the JSX would give the right answer only while the branches
     evaluate in source order, and would silently renumber if one moved. */
  const decl = readCode(FILE).slice(readCode(FILE).indexOf("const cardNum"));
  assert.doesNotMatch(decl.slice(0, 200), /\+\+|--/, "cardNum mutates a counter instead of counting the flags");
});
