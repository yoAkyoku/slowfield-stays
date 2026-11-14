import assert from "node:assert/strict";
import test from "node:test";
import { callArguments, compileDeclarations } from "./sourceEval";
import { pageLabel } from "../app/modules/contentTypes.ts";

/**
 * Switching the site editor's language must not revert the page list.
 *
 * The page-management tab derives its rows from `site.settings` in an effect,
 * and `editLocale` was one of that effect's dependencies. But `site` is a
 * server prop that is NOT refreshed by anything the tab does: reordering a page
 * writes `sort_order` to the server through `autoSavePages` and updates only
 * the local list, and the Nav / Footer ticks and the rename modal work the same
 * way. So one click on 中文 / English re-derived the whole array from the stale
 * settings and put the screen back: the drag reorder undone on screen, the new
 * order already in the database, the two disagreeing, and nothing saying so.
 * The next full save then wrote the reverted order back over the real one.
 *
 * NOTE ON HOW THIS WAS VERIFIED: not by doing it. Reproducing it in the browser
 * means dragging a row, which auto-saves to the server, and this machine's
 * .env.local points at the production database. So the effect is split by
 * reasoning and the two halves are pinned here — the language half is run
 * against a list that has been reordered, renamed and re-ticked exactly as the
 * bug requires, and the derivation half is checked for the dependency that
 * caused it.
 */

const SITE = "app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx";

/* pageDisplayName delegates to the shared resolver, which is an import and so
   cannot resolve inside a declaration compiled on its own. The REAL one is
   handed in — a stand-in here would make every expectation below a
   statement about the stub instead of about the screen. */
const built = compileDeclarations(
  SITE,
  ["pageDisplayName", "relabelPages"],
  ["pageLabel"],
)({ pageLabel });
const pageDisplayName = built.pageDisplayName as (key: string, label: unknown, locale: string) => string;
const relabelPages = built.relabelPages as <T>(pages: T[], locale: string) => T[];

type Row = {
  id: string;
  name: string;
  labelSource?: unknown;
  type: string;
  showInNav: boolean;
  showInFooter: boolean;
};

const row = (type: string, label: unknown, locale = "zh", extra: Partial<Row> = {}): Row => ({
  id: `settings-${type}`,
  name: pageDisplayName(type, label, locale),
  labelSource: label,
  type,
  showInNav: true,
  showInFooter: true,
  ...extra,
});

/* ── the name, per language ── */

test("a bilingual label follows the language", () => {
  const label = { zh: "聯絡我們", en: "Contact" };
  assert.equal(pageDisplayName("contact", label, "zh"), "聯絡我們");
  assert.equal(pageDisplayName("contact", label, "en"), "Contact");
});

test("a label the admin chose once is shown in both languages", () => {
  // A page label is allowed to be a plain string; the nav renderers accept it.
  assert.equal(pageDisplayName("career", "Careers", "zh"), "Careers");
  assert.equal(pageDisplayName("career", "Careers", "en"), "Careers");
});

test("an untranslated page falls back rather than going blank", () => {
  /* Still the same concern — a row must never be blank — but the fallback now
     reaches for the bundled name of the content type instead of settling for
     the raw key or for a label in the other language. Both of the old
     expectations were symptoms rather than requirements:

       * `{ en: "PR" }` on a Chinese screen printed "PR". An English name on a
         Chinese page is the thing the client reported, not an acceptable
         fallback (客戶: 為何有些分類標籤只有英文).
       * `{}` printed "franchise". 人才招募 and 民宿加盟 are stored as exactly
         that empty object on the live parent site, which is why those two rows
         showed their content-type keys in 頁面管理 while every other row showed
         a name. */
  assert.equal(pageDisplayName("pr", { en: "PR" }, "zh"), "PR 聯絡");
  assert.equal(pageDisplayName("pr", { en: "PR" }, "en"), "PR", "the client's own English was discarded");
  assert.equal(pageDisplayName("franchise", {}, "en"), "Franchise");
  assert.equal(pageDisplayName("franchise", {}, "zh"), "民宿加盟");
  assert.equal(pageDisplayName("franchise", undefined, "en"), "Franchise");
});

test("a page with no bundled name of its own still shows something", () => {
  /* The guarantee the test above is really about. A content type the bundled
     list has never heard of — anything the client adds — has no default to fall
     back to, so the key remains the last resort rather than a blank cell. */
  assert.equal(pageDisplayName("wedding", {}, "zh"), "wedding");
  assert.equal(pageDisplayName("wedding", undefined, "zh"), "wedding");
  assert.equal(pageDisplayName("wedding", { en: "Weddings" }, "zh"), "Weddings",
    "with no Chinese default to prefer, the name the client typed is better than the key");
});

test("the homepage row is named, not read from a label it does not have", () => {
  // It is the site root shown as a row, not an entry in settings.pages.
  assert.equal(pageDisplayName("homepage", undefined, "zh"), "首頁");
  assert.equal(pageDisplayName("homepage", undefined, "en"), "Homepage");
  assert.equal(pageDisplayName("homepage", { zh: "舊名字" }, "zh"), "首頁", "a stale label leaked onto the root row");
});

/* ── and what switching it must leave alone ── */

test("a reorder survives the language switch", () => {
  /* The bug, as an editor met it: drag 聯絡我們 to the top, which saves; click
     English; the row is back where it was, and only the screen has changed. */
  const dragged = [
    row("contact", { zh: "聯絡我們", en: "Contact" }),
    row("brand", { zh: "品牌故事", en: "Brand Story" }),
    row("stays", { zh: "精品Villa", en: "Villas" }),
  ];
  const inEnglish = relabelPages(dragged, "en");
  assert.deepEqual(
    inEnglish.map((p) => p.type),
    ["contact", "brand", "stays"],
    "switching language put the rows back in the saved order",
  );
  assert.deepEqual(inEnglish.map((p) => p.name), ["Contact", "Brand Story", "Villas"]);
});

test("Nav and Footer ticks survive the language switch", () => {
  const ticked = [
    row("brand", { zh: "品牌故事", en: "Brand Story" }, "zh", { showInNav: false }),
    row("stays", { zh: "精品Villa", en: "Villas" }, "zh", { showInFooter: false }),
  ];
  const inEnglish = relabelPages(ticked, "en");
  assert.equal(inEnglish[0].showInNav, false, "unticking Nav was undone by the language button");
  assert.equal(inEnglish[1].showInFooter, false, "unticking Footer was undone by the language button");
});

test("a rename made in one language survives a switch to the other and back", () => {
  /* The rename modal writes the new label into the row as well as sending it,
     so the language switch re-resolves from what the editor just typed rather
     than from the label as last saved — otherwise the rename looks undone while
     the auto-save has already written it. */
  const renamed = [{ ...row("brand", { zh: "品牌故事", en: "Brand Story" }), name: "品牌起源", labelSource: { zh: "品牌起源", en: "Brand Story" } }];
  const inEnglish = relabelPages(renamed, "en");
  assert.equal(inEnglish[0].name, "Brand Story");
  assert.equal(relabelPages(inEnglish, "zh")[0].name, "品牌起源", "the rename was reverted by a round trip through English");
});

test("switching to the language already shown changes nothing at all", () => {
  const rows = [row("brand", { zh: "品牌故事", en: "Brand Story" }), row("homepage", undefined)];
  const same = relabelPages(rows, "zh");
  assert.equal(same, rows, "the array is rebuilt even when no name changed, re-rendering the whole table");
});

test("rows whose name does not change keep their identity", () => {
  const rows = [
    row("career", "Careers"),
    row("brand", { zh: "品牌故事", en: "Brand Story" }),
  ];
  const inEnglish = relabelPages(rows, "en");
  assert.equal(inEnglish[0], rows[0], "a row with one name for both languages was replaced anyway");
  assert.notEqual(inEnglish[1], rows[1]);
  assert.equal(rows[1].name, "品牌故事", "the original row was mutated in place");
});

/* ── the split itself ── */

function effectWith(needle: string): string[] {
  const found = callArguments(SITE, "useEffect").filter(([body]) => body.includes(needle));
  assert.equal(found.length, 1, `expected exactly one useEffect containing "${needle}", found ${found.length}`);
  return found[0];
}

test("the list is no longer rebuilt when the language changes", () => {
  const [, deps] = effectWith("setPages(merged)");
  assert.doesNotMatch(
    deps,
    /\beditLocale\b/,
    "the derivation effect still re-runs on a language change, so it still reverts the list to site.settings",
  );
  // And it must still re-run when the server actually sends new pages.
  assert.match(deps, /\bsite\b/, "the list no longer follows the site prop at all");
});

test("the language switch runs its own effect, and only that one", () => {
  const [body, deps] = effectWith("relabelPages");
  assert.match(deps, /\[editLocale\]/, `the relabel effect's dependencies are ${deps}`);
  assert.doesNotMatch(body, /settings|sort_order|nav_hidden/, "the language effect reads site settings again");
});

test("a rename records the label the language switch will read", () => {
  const renameCall = callArguments(SITE, "setPages").find(([arg]) => arg.includes("editingPageId"));
  assert.ok(renameCall, "the rename no longer updates the row");
  assert.match(
    renameCall![0],
    /labelSource:/,
    "the rename sets the visible name but not the label it is derived from, so switching language reverts it",
  );
});
