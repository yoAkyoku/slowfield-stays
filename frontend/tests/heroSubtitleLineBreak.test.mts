import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";

/**
 * A line break typed into 頁面編輯's Hero 副標題 has to survive two hops:
 * the field must be able to hold a newline at all, and the page must render it.
 * Either one alone does nothing — an <input> cannot contain a newline (Enter
 * submits the form), and pre-line has nothing to break on if the field stripped
 * it (客戶: hero 的 subtitle 需要能換行).
 */

/* Comments stripped: the note beside this very field spells out "<input>" as
   prose, and a check for a leftover <input> matched that instead of markup. */
const EDITOR = readFileSync(
  "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx",
  "utf8",
).replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const CSS = readStyles("app/globals.css");

test("the subtitle field can hold a newline", () => {
  const field = EDITOR.match(/Hero 副標題[\s\S]{0,700}?<\/Field>/);
  assert.ok(field, "the Hero 副標題 field is gone");
  assert.match(field![0], /<HeadingInput/, "still a single-line <input>, which cannot contain a newline");
  assert.doesNotMatch(field![0], /<input\b/, "an <input> is still rendered for the subtitle");
});

test("the page renders the newline", () => {
  const rule = CSS.match(/\.page-hero h1,\s*\n\.page-hero p \{([^}]*)\}/);
  assert.ok(rule, "no pre-line rule for the page hero");
  assert.match(rule![1], /white-space:\s*pre-line/);
});

test("it is plain text, not markup", () => {
  // pre-line keeps the copy a string; rendering <br> would mean accepting HTML
  // from an admin field.
  assert.doesNotMatch(
    readCode("app/modules/content/PageHero.tsx"),
    /dangerouslySetInnerHTML/,
    "the hero renders raw HTML — a line break must not cost that",
  );
});

test("the banner subtitle can hold a newline and renders it", () => {
  /* The banner title has been a textarea with pre-line all along; its subtitle
     was an <input> with no pre-line, so the two halves of the same banner
     behaved differently (客戶: banner 的副標也要能換行). */
  /* The hand-rolled JSX-comment strip that used to be here is readCode's job
     now. It blanks rather than deletes, so the label and the field stayed the
     same distance apart instead of closing up — the 400-character window was
     sized against the shortened text and no longer reached the closing tag.
     The match is lazy, so a wider window still stops at this field's own
     </label>. */
  const editor = readCode("app/admin/(dashboard)/cms/BannerFormEditor.tsx");
  // Wrapped by the admin kit's <Field> now, which renders the <label>.
  const field = editor.match(/adminSubtitle[\s\S]{0,900}?<\/(?:label|Field)>/);
  assert.ok(field, "the banner subtitle field is gone");
  assert.match(field![0], /<HeadingInput/, "still an <input>, which cannot contain a newline");

  const css = readStyles("app/globals.css");
  const rule = css.match(/\.hero p \{([^}]*)\}/);
  assert.ok(rule, ".hero p rule is gone");
  assert.match(rule![1], /white-space:\s*pre-line/, "the banner subtitle collapses the newline");
});
