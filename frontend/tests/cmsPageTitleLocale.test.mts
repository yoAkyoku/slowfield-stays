import assert from "node:assert/strict";
import test from "node:test";
import { compileDeclarations, declarationText, jsxTags } from "./sourceEval";
import { readCode, readStyles } from "./readCode";
import { trs } from "../app/modules/tr.ts";

/**
 * A title typed in the CMS page editor is the title the page is saved under —
 * whichever language tab was open when it was typed.
 *
 * The editor has a 中文 / English toggle. The visible box is bound to
 * `i18nFields[editLocale]`, but the hidden `title` input — the page's canonical
 * column, and the one field the API requires — was read from
 * `i18nFields[defaultLocale]`, which is the SITE's language and not the tab's.
 * On a zh site the two are different slots the moment the English tab is open,
 * and everything typed there went to `translations.en` while `title` stayed
 * empty. Measured on a new page:
 *
 *   translations = {"zh":{},"en":{"title":"ZZTEST 測試文章 請刪除"}}
 *   title        = ""
 *
 * The second half of the defect is what that looked like. `guardSubmit` sees
 * the empty canonical title and cancels the submit, and cancelling was the
 * whole of it: no message, and nothing for the browser to mark either, because
 * the field it would mark is a hidden input. So the page could not be created
 * from the English tab at all, and pressing 儲存 read as the button being dead.
 *
 * The rule the fix uses is not new here — `trs()` resolves an empty base column
 * by borrowing the other locale rather than showing nothing. This is the same
 * rule applied on the way in, so a page typed in one language is stored under
 * that language's title. A canonical slot that is filled still wins, which is
 * what keeps an English translation from overwriting a Chinese title.
 */

const FORM = "app/admin/(dashboard)/cms/PageFormEditor.tsx";

type Fields = Record<string, Record<string, string>>;

/** The editor's own `primaryTitle`, run against a given pair of locale slots. */
function primaryTitle(i18nFields: Fields, defaultLocale: "zh" | "en"): string {
  const built = compileDeclarations(
    FORM,
    ["otherLocale", "canonicalTitle", "primaryTitle"],
    ["i18nFields", "defaultLocale"],
  )({ i18nFields, defaultLocale });
  return built.primaryTitle as unknown as string;
}

/* ── What lands in the column ──────────────────────────────────────────── */

test("a title typed in the English tab of a zh site reaches the column", () => {
  // The measured create: English tab open, zh slot never touched.
  const fields: Fields = { zh: {}, en: { title: "ZZTEST 測試文章 請刪除" } };
  assert.equal(
    primaryTitle(fields, "zh"),
    "ZZTEST 測試文章 請刪除",
    "the required column is still empty, so the create is rejected before it is sent",
  );
});

test("a title typed in the Chinese tab of an en site reaches the column", () => {
  // The same defect the other way round: default_locale is not always zh.
  const fields: Fields = { zh: { title: "慢域住宿體驗" }, en: {} };
  assert.equal(primaryTitle(fields, "en"), "慢域住宿體驗");
});

test("a filled canonical slot wins — a translation never overwrites it", () => {
  // The edit case. Typing English beside an existing Chinese title writes a
  // translation; the page keeps its own title, which is the point of the tabs.
  const fields: Fields = {
    zh: { title: "ZZTEST 測試文章 請刪除" },
    en: { title: "ZZTEST edited, please delete" },
  };
  assert.equal(primaryTitle(fields, "zh"), "ZZTEST 測試文章 請刪除");
});

test("a canonical slot holding only spaces counts as empty", () => {
  // `guardSubmit` rejects a whitespace title, so a column that kept one would
  // be an unsaveable form with a value in it.
  const fields: Fields = { zh: { title: "   " }, en: { title: "Quiet Weekends" } };
  assert.equal(primaryTitle(fields, "zh"), "Quiet Weekends");
});

test("with both languages blank the column stays blank", () => {
  assert.equal(primaryTitle({ zh: {}, en: {} }, "zh"), "");
  assert.equal(primaryTitle({ zh: { title: "" }, en: { title: "  " } }, "zh"), "  ");
});

test("the borrowed title reads correctly in both languages once saved", () => {
  // The write-side rule only holds up because `trs` reads the same way: the
  // row created from the English tab has no zh translation at all.
  const fields: Fields = { zh: {}, en: { title: "Quiet Weekends" } };
  const saved = { title: primaryTitle(fields, "zh"), translations: fields };
  assert.equal(trs(saved, "title", "en"), "Quiet Weekends");
  assert.equal(trs(saved, "title", "zh"), "Quiet Weekends", "the CMS list would show a nameless row");
});

/* ── What the form actually submits ────────────────────────────────────── */

const TAGS = jsxTags(FORM);

test("the hidden title field carries the resolved title, not the canonical slot", () => {
  const hidden = TAGS.filter((t) => t.tag === "input" && t.attrs.get("name") === "title");
  assert.equal(hidden.length, 1, "the CMS page form must emit exactly one title field");
  assert.equal(
    hidden[0].attrs.get("value"),
    "primaryTitle",
    "the hidden title is read straight off a locale slot again — the fallback above never reaches the request",
  );
});

test("both page actions still read the title from that field", () => {
  // If either stopped, everything above would be true of a value nobody sends.
  // Per action, not over the file: cmsActions carries the banner pair too, and
  // a sweep of the whole text stays green on their copies of the same line
  // while the page ones say something else entirely.
  const actions = declarationText("app/admin/modules/cmsActions.ts", ["createPageAction", "updatePageAction"]);
  assert.equal(actions.size, 2, "one of the page actions is gone or renamed");
  for (const [name, src] of actions) {
    assert.match(
      src,
      /title: String\(formData\.get\("title"\) \?\? ""\)/,
      `${name} no longer sends the form's title field`,
    );
  }
});

/* ── The refusal says something ────────────────────────────────────────── */

/** The editor's own `guardSubmit`, with React's hook stubbed out. */
function guard(title: string) {
  const seen: { flagged?: boolean; focused?: boolean; selector?: string } = {};
  const built = compileDeclarations(
    FORM,
    ["guardSubmit"],
    ["useCallback", "primaryTitle", "setTitleMissing"],
  )({
    useCallback: (fn: unknown) => fn,
    primaryTitle: title,
    setTitleMissing: (v: boolean) => { seen.flagged = v; },
  });
  const form = {
    querySelector: (selector: string) => {
      seen.selector = selector;
      return { focus: () => { seen.focused = true; } };
    },
  };
  const allowed = (built.guardSubmit as unknown as (f: unknown) => boolean)(form);
  return { allowed, ...seen };
}

test("a page titled only in the other language now submits", () => {
  // Same input as the first test, one step further on: this is the submit that
  // used to be cancelled with nothing on screen to say so.
  const title = primaryTitle({ zh: {}, en: { title: "ZZTEST 測試文章 請刪除" } }, "zh");
  assert.equal(guard(title).allowed, true, "the form still refuses a page that has a title");
});

test("a page with no title anywhere is refused, and says so", () => {
  const result = guard("");
  assert.equal(result.allowed, false, "an untitled page would save as a nameless row");
  assert.equal(
    result.flagged,
    true,
    "the submit is cancelled without raising the message — a silent no-op, which is the reported defect",
  );
  assert.equal(result.focused, true, "the field the message is attached to is not focused");
});

test("a whitespace title is refused the same way", () => {
  const result = guard("   ");
  assert.equal(result.allowed, false);
  assert.equal(result.flagged, true);
});

test("a successful submit takes the message back down", () => {
  assert.equal(guard("Quiet Weekends").flagged, false, "the message would outlive the problem");
});

test("the guard focuses the title box and nothing else", () => {
  const selector = guard("").selector ?? "";
  const marked = TAGS.filter((t) => t.attrs.get("aria-required") === "true");
  assert.equal(marked.length, 1, "another field claims aria-required, so the focus lands on the wrong box");
  assert.ok(
    /aria-required="true"/.test(selector) && selector.startsWith("input"),
    `the guard looks for ${selector}, which is not how the title box is marked`,
  );
});

test("the message is rendered, addressed to the field, and announced", () => {
  const error = TAGS.find((t) => t.attrs.get("className") === "cms-field-error");
  assert.ok(error, "nothing renders the missing-title message; a cancelled submit is silent again");
  assert.equal(error.attrs.get("role"), "alert", "the message is not announced to a screen reader");

  const box = TAGS.find((t) => (t.tag === "input" || t.tag === "Input") && t.attrs.get("aria-required") === "true");
  assert.ok(box, "the title box lost its aria-required marking");
  const errorId = error.attrs.get("id") ?? "";
  assert.ok(errorId, "the message carries no id, so nothing can point at it");
  assert.ok(
    (box.attrs.get("aria-describedby") ?? "").includes(errorId),
    "the message is on screen but not tied to the field it is about",
  );
  assert.equal(box.attrs.get("aria-invalid"), "showTitleMissing", "the refused field is not marked invalid");
});

test("the message is written in both admin languages", () => {
  const error = TAGS.find((t) => t.attrs.get("className") === "cms-field-error");
  assert.ok(error);
  assert.match(error.fullText, /editLocale === "zh"/, "the message does not follow the language toggle");
  assert.match(error.fullText, /[一-鿿]/, "no Chinese wording for a mostly-Chinese admin team");
  assert.match(error.fullText, /[A-Za-z]{4,}/, "no English wording");
});

/* ── Which language the box is holding ─────────────────────────────────── */

test("the title box shows only its own language, never the other one's text", () => {
  const box = TAGS.find((t) => (t.tag === "input" || t.tag === "Input") && t.attrs.get("aria-required") === "true");
  assert.ok(box);
  assert.equal(
    box.attrs.get("value"),
    'getField("title")',
    "the box falls back into its value — the Chinese title would read as a filled-in English one",
  );
});

test("the canonical title shows through as a placeholder on the other tab", () => {
  const box = TAGS.find((t) => (t.tag === "input" || t.tag === "Input") && t.attrs.get("aria-required") === "true");
  assert.ok(box);
  const placeholder = box.attrs.get("placeholder") ?? "";
  assert.match(
    placeholder,
    /editLocale === defaultLocale/,
    "the placeholder is the same on both tabs, so an empty English box says nothing about what the page is called",
  );
  assert.match(placeholder, /canonicalTitle/, "the canonical title is not offered as the placeholder");
});

test("the other-language tab says what a save there does", () => {
  const hint = TAGS.find((t) => t.attrs.get("className") === "cms-locale-hint");
  assert.ok(hint, "the translation tab no longer explains itself");
  assert.match(
    hint.fullText,
    /editLocale === "zh"/,
    "the hint does not follow the language toggle",
  );
  assert.match(
    readCode(FORM),
    /editLocale !== defaultLocale && \(/,
    "the hint shows on the site's own language tab too, where it is untrue",
  );
});

test("both of the classes this adds are styled", () => {
  // Unstyled, the refusal is default-coloured small text under the field —
  // present in the DOM and not read as an error by anyone looking at it.
  const css = readStyles("app/globals.css");
  for (const cls of ["cms-field-error", "cms-locale-hint"]) {
    assert.match(css, new RegExp(`\\.${cls}\\s*\\{`), `.${cls} is rendered but has no rule`);
  }
});
