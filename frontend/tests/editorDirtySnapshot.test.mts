import assert from "node:assert/strict";
import test from "node:test";
import { callArguments, compileDeclarations, evaluateExpression, initialiserText, jsxTags } from "./sourceEval";

/**
 * "Is there unsaved work here?", as each block editor answers it.
 *
 * The unsaved-work guard is only as good as this comparison. Two ways for it to
 * be wrong, and they fail in opposite directions:
 *
 *  - a field left OUT of the snapshot is work the tab closes on without a word;
 *  - a snapshot that is never equal to itself warns on every exit, including
 *    the ones with nothing to lose, which is how a prompt becomes something
 *    people dismiss before reading — and then the real one is gone too.
 *
 * The second is not hypothetical: the villa page editor's server component
 * minted `Math.random()` ids for blocks saved without one, so the props it
 * handed the editor differed on every fetch and the baseline could never match.
 *
 * The snapshot builders are lifted out of the shipping source and run, so a
 * changed field order or a dropped field is caught by the values, not by the
 * text.
 */

const PROPERTY = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx";
const PROPERTY_PAGE = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/page.tsx";
const HOMEPAGE = "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx";
const CMS = "app/admin/(dashboard)/cms/PageBlockEditor.tsx";

/* ── the villa page editor ── */

const pageSnapshot = compileDeclarations(PROPERTY, ["pageSnapshot"])({})
  .pageSnapshot as (v: Record<string, unknown>) => string;

const SAVED_PAGE = {
  blocks: [{ id: "b1", type: "contact_info", enabled: true, config: { heading: { zh: "聯絡" } } }],
  seo: { title: { zh: "聯絡我們" } },
  subTabs: [{ label: { zh: "全部" }, tag: { zh: "all" } }],
  showCmsList: true,
  showSearch: false,
  showTags: true,
  pageName: { zh: "聯絡我們", en: "Contact" },
  navLinkMode: "page",
  navAnchor: "",
  heroImage: "/storage/media/hero.jpg",
  heroTitle: { zh: "聯絡" },
  heroSubtitle: { zh: "" },
  heroTitleColor: "#ffffff",
  heroSubtitleColor: "#ffffff",
  heroHeight: "",
  heroAlign: "",
};

test("an untouched villa page compares equal to what the server sent", () => {
  assert.equal(pageSnapshot(SAVED_PAGE), pageSnapshot({ ...SAVED_PAGE }));
});

test("the field order at the call site cannot change the answer", () => {
  /* The baseline and the current state are built at two separate call sites.
     Were the snapshot a `JSON.stringify` of whatever object it was handed, the
     two would only agree while both literals happened to list their keys in the
     same order — and the day someone tidied one of them, every villa page would
     start claiming unsaved work. */
  const reversed = Object.fromEntries(Object.entries(SAVED_PAGE).reverse());
  assert.equal(pageSnapshot(SAVED_PAGE), pageSnapshot(reversed));
});

test("a change to any one of the page's fields is noticed", () => {
  const changes: Record<string, unknown> = {
    blocks: [],
    seo: {},
    subTabs: [],
    showCmsList: false,
    showSearch: true,
    showTags: false,
    pageName: { zh: "改名了" },
    navLinkMode: "anchor",
    navAnchor: "#stays",
    heroImage: "",
    heroTitle: { zh: "新標題" },
    heroSubtitle: { zh: "新副標" },
    heroTitleColor: "#000000",
    heroSubtitleColor: "#000000",
    heroHeight: "70vh",
    heroAlign: "center",
  };
  const base = pageSnapshot(SAVED_PAGE);
  for (const [field, value] of Object.entries(changes)) {
    assert.notEqual(
      pageSnapshot({ ...SAVED_PAGE, [field]: value }),
      base,
      `editing ${field} leaves the editor looking clean, so the tab closes on it`,
    );
  }
  assert.equal(Object.keys(changes).length, Object.keys(SAVED_PAGE).length, "a field was added without a case here");
});

/** Split an argument list or object body at its own commas, ignoring commas
 *  nested inside calls, objects and arrays. */
function topLevelParts(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c === "(" || c === "{" || c === "[") depth += 1;
    else if (c === ")" || c === "}" || c === "]") depth -= 1;
    else if (c === "," && depth === 0) { parts.push(body.slice(start, i)); start = i + 1; }
  }
  parts.push(body.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** The `{ key: value }` an editor hands its snapshot builder, as a map. */
function snapshotFields(path: string, constName: string): Map<string, string> {
  const call = initialiserText(path, constName);
  const body = call.slice(call.indexOf("{") + 1, call.lastIndexOf("}"));
  const fields = new Map<string, string>();
  for (const part of topLevelParts(body)) {
    const colon = part.indexOf(":");
    // Shorthand (`blocks`) means key and value are the same identifier.
    if (colon === -1) fields.set(part, part);
    else fields.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
  }
  return fields;
}

/**
 * The two sides of the comparison must line up field for field.
 *
 * The baseline is built from the props and the current value from state, at two
 * separate call sites, and nothing but this makes them describe the same thing.
 * Two ways to get it wrong, both of which leave the editor compiling and the
 * tests otherwise green: a field on one side and not the other (which pins the
 * editor permanently dirty, and a guard that always fires is a guard nobody
 * reads), or a placeholder on the current side (which makes that field's work
 * invisible, and the tab closes on it in silence).
 */
function assertSidesLineUp(path: string) {
  const current = snapshotFields(path, "currentSnapshot");
  const saved = snapshotFields(path, "savedSnapshot");
  assert.deepEqual(
    [...current.keys()].sort(),
    [...saved.keys()].sort(),
    `${path}: the current state and the saved baseline are not describing the same fields`,
  );
  for (const [field, value] of current) {
    assert.match(
      value,
      /^[A-Za-z_$][A-Za-z0-9_$]*$/,
      `${path}: "${field}" is compared as ${value} rather than as the state the editor holds`,
    );
  }
}

/** Identifiers in an expression, minus the plumbing every expression contains. */
const NOISE = new Set(["JSON", "stringify", "String", "Object", "values", "some", "filter", "trim", "map", "join"]);
function identifiers(expression: string): string[] {
  return [...new Set([...expression.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)].map((m) => m[0]))]
    .filter((name) => !NOISE.has(name));
}

/**
 * Every value the form submits from editor state must reach the snapshot.
 *
 * This is the check that catches the dangerous direction: a new hidden input
 * added for a new control, and a dirty comparison that still does not know
 * about it, so the tab closes on that control's work in silence.
 */
function assertSnapshotCoversForm(path: string, notEditorState: string[]) {
  // Whatever the guard is handed on the left of the comparison — follow it back
  // to the expression that builds it, rather than assuming a name.
  const guarded = callArguments(path, "useUnsavedGuard")[0][0];
  const currentName = guarded.split("!==")[0].trim();
  const snapshotCall = initialiserText(path, currentName);
  const hidden = jsxTags(path).filter((t) => t.tag === "input" && t.attrs.get("type") === "hidden");
  assert.ok(hidden.length > 3, `${path}: the hidden state inputs were not found`);
  for (const input of hidden) {
    const name = input.attrs.get("name") ?? "";
    if (notEditorState.includes(name)) continue;
    const value = input.attrs.get("value") ?? "";
    const mentioned = identifiers(value).some((id) => new RegExp(`\\b${id}\\b`).test(snapshotCall));
    assert.ok(mentioned, `${path}: "${name}" is submitted but not part of the dirty comparison (${value})`);
  }
}

test("everything the villa page submits is part of its dirty comparison", () => {
  // `_site_id`, `_site_json` and `_page_key` are the page's identity, not its
  // content: no control on screen can change them.
  assertSnapshotCoversForm(PROPERTY, ["_site_id", "_site_json", "_page_key"]);
  assertSidesLineUp(PROPERTY);
});

test("a block saved without an id gets the same id on every fetch", () => {
  /* The fallback used to be `Math.random()`, minted afresh on every render of
     this server component. The editor's baseline is rebuilt from these props,
     so the ids — and therefore the snapshot — changed under it on every
     re-fetch and the page claimed unsaved work it did not have, permanently. */
  const build = evaluateExpression(initialiserText(PROPERTY_PAGE, "initialBlocks"), ["rawBlocks"]);
  const raw = [
    { type: "hero_banner", enabled: true, config: {} },
    { id: "kept", type: "rooms", enabled: true, config: {} },
    { type: "faq_accordion", enabled: true, config: {} },
  ];
  const first = build({ rawBlocks: raw }) as Array<{ id: string }>;
  const second = build({ rawBlocks: raw }) as Array<{ id: string }>;
  assert.deepEqual(first, second, "two fetches of the same page produce different block ids");
  assert.equal(first[1].id, "kept", "a block's own id is no longer preserved");
  assert.equal(new Set(first.map((b) => b.id)).size, raw.length, "two blocks were given the same id");

  /* The fallback is persisted: the editor submits JSON.stringify(blocks) with
     ids included, so `block-0` comes back as a real id next time. A block
     arriving without one — an import, an older row — can then be handed an id
     that is already in use, and every operation here addresses a block by id:
     the React key, select, move, toggle and remove would all act on whichever
     of the two came first. */
  const collided = build({
    rawBlocks: [
      { id: "block-1", type: "hero_banner", enabled: true, config: {} },
      { type: "rooms", enabled: true, config: {} },
    ],
  }) as Array<{ id: string }>;
  assert.equal(collided[0].id, "block-1", "a saved id was not preserved");
  assert.equal(
    new Set(collided.map((b) => b.id)).size,
    2,
    `a minted id collided with one already saved on the page: ${collided.map((b) => b.id).join(", ")}`,
  );
});

/* ── the homepage editor ── */

const homepageBuilt = compileDeclarations(HOMEPAGE, ["seedBlocks", "homepageSnapshot"])({});
const seedBlocks = homepageBuilt.seedBlocks as (b: unknown[]) => Array<{ id: string; type: string }>;
const homepageSnapshot = homepageBuilt.homepageSnapshot as (v: Record<string, unknown>) => string;

test("the hero and search bar the front page always draws are seeded once", () => {
  const seeded = seedBlocks([{ id: "s1", type: "stays", enabled: true, config: {} }]);
  assert.deepEqual(seeded.map((b) => b.type), ["hero_banner", "search", "stays"]);
  // Idempotent: seeding what is already seeded must not add a second pair.
  assert.deepEqual(seedBlocks(seeded).map((b) => b.type), ["hero_banner", "search", "stays"]);
});

test("a hero an admin dragged down is not hauled back to the top", () => {
  const dragged = [
    { id: "s1", type: "stays", enabled: true, config: {} },
    { id: "h", type: "hero_banner", enabled: true, config: {} },
  ];
  // Only the search bar is missing, and it belongs after the hero wherever the
  // hero is — not at index 0, which would reorder a saved homepage on open.
  assert.deepEqual(seedBlocks(dragged).map((b) => b.type), ["stays", "hero_banner", "search"]);
});

test("an untouched homepage compares equal to what the server sent", () => {
  /* The seeded blocks are part of "the saved homepage" as far as this editor is
     concerned. A baseline built from the raw props instead would differ from
     the state by exactly those two blocks, and every homepage would warn about
     unsaved work from the first render. */
  const saved = [{ id: "s1", type: "stays", enabled: true, config: {} }];
  const seo = { title: { zh: "首頁" } };
  const nameTranslations = { zh: "慢域旅遊", en: "Slowfield Stays" };
  assert.equal(
    homepageSnapshot({ blocks: seedBlocks(saved), seo, nameTranslations }),
    homepageSnapshot({ blocks: seedBlocks(saved), seo, nameTranslations }),
  );
  assert.notEqual(
    homepageSnapshot({ blocks: seedBlocks(saved), seo, nameTranslations }),
    homepageSnapshot({ blocks: seedBlocks(saved), seo: {}, nameTranslations }),
  );
  assert.notEqual(
    homepageSnapshot({ blocks: seedBlocks(saved), seo, nameTranslations }),
    homepageSnapshot({ blocks: seedBlocks(saved), seo, nameTranslations: { zh: "改名" } }),
  );
});

test("everything the homepage submits is part of its dirty comparison", () => {
  assertSnapshotCoversForm(HOMEPAGE, ["_site_id", "_site_json"]);
  assertSidesLineUp(HOMEPAGE);
});

/* ── the article editor ── */

test("an untouched article compares equal however its ids were minted", () => {
  /* `stripIds` takes every id off on the way out, so blocks read back from a
     saved page have none and `normalizeBlocks` mints a fresh one for each. The
     baseline has to be compared with the ids off, or the comparison is between
     two runs of `blockId()` and never matches. */
  const built = compileDeclarations(
    CMS,
    ["blockId", "migrateColumns", "withIds", "normalizeBlocks", "stripIds"],
  )({});
  const normalizeBlocks = built.normalizeBlocks as (b: unknown[] | undefined, body?: string) => unknown[];
  const stripIds = built.stripIds as (b: unknown) => unknown;
  const saved = [
    { type: "heading", level: "h2", text: { zh: "標題" } },
    { type: "partners", config: { layout: "cards", items: [{ name: { zh: "品牌" } }] } },
    { type: "columns", items: [{ blocks: [{ type: "paragraph", text: { zh: "左" } }], flex: 5 }] },
  ];
  const serialize = () => JSON.stringify(normalizeBlocks(saved, undefined).map(stripIds));
  assert.equal(serialize(), serialize(), "the article baseline changes on every render");

  const edited = [...saved, { type: "spacer", size: "medium" }];
  assert.notEqual(
    JSON.stringify(normalizeBlocks(edited, undefined).map(stripIds)),
    serialize(),
    "an added block leaves the article looking clean",
  );
});

test("the article's dirty comparison is the string the form submits", () => {
  /* Two serialisations of the same blocks would be two chances to disagree.
     The one in the hidden input is the definition of what a save sends, so the
     guard compares against that rather than against a second stringify. */
  const current = callArguments(CMS, "useUnsavedGuard")[0][0];
  const bodyBlocks = jsxTags(CMS).find((t) => t.attrs.get("name") === "body_blocks");
  assert.ok(bodyBlocks, "the body_blocks input is gone");
  const submitted = (bodyBlocks!.attrs.get("value") ?? "").trim();
  assert.match(current, new RegExp(`\\b${submitted}\\b`), `the guard compares ${current}, the form submits ${submitted}`);
});
