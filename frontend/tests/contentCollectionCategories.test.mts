import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { declarationText } from "./sourceEval.mts";
import { readCode } from "./readCode.mts";
import {
  ROOT_PAGE_DEFAULTS,
  contentTypeCatalogue,
  contentTypeEntries,
  pageLabel,
  pageSort,
} from "../app/modules/contentTypes.ts";
import { tagKey } from "../app/modules/tr.ts";
import { siteContentTypesFromConfig } from "../app/admin/modules/siteContentTypes.ts";

/**
 * 內容集合 (the Content Collection block), and the two things the client said
 * about its categories:
 *
 *   「多分類順序是按照選擇的來源順序，還有為何有些分類標籤只有英文?」
 *
 * Both come from the same place: nothing in the block read the category list the
 * client actually maintains. 頁面管理 is where a category is named and dragged
 * into an order, and it stores both on `settings.pages[key]` — `label: {zh, en}`
 * and `sort_order`. The header, the footer and the CMS category dropdown all
 * read it. The collection block read neither.
 *
 * For the name it read a hand-written table in i18n.ts instead. Measured on the
 * live parent site's homepage before the fix, the chip row under 最新消息 read:
 *
 *   zh: 全部 / curation / 餐飲服務 / 慢域消息
 *   en: All  / curation / Dining Services / News
 *
 * — 慢域選品 is not in that table, so its chip printed the bare content-type key
 * on a Chinese page, and 最新消息 (renamed by the client in 頁面管理) still
 * printed the bundled 慢域消息, so the admin and the page called the same
 * category two different things. This is a code path, not missing data: every
 * label the client has filled in is Chinese, 慢域選品 included.
 *
 * For the order it read nothing at all — the chips were built from whichever
 * entry the newest-first merge reached first, so the order was really "which
 * category owns the newest post" and moved on its own as things were published.
 * In the admin's 資料來源 picker the categories came out in raw database key
 * order: 慢域選品 sat 13th there and 4th in 頁面管理.
 */

/** The live parent site's page config, trimmed to what decides names and order.
 *  Copied from https://www.slowfield.example/api/v1/site/resolve — including
 *  its duplicate sort_orders and its four categories with no label filled in,
 *  because those are the cases that bite. */
const LIVE_PAGES: Record<string, Record<string, unknown>> = {
  brand:      { sort_order: 1, label: { zh: "品牌故事", en: "Brand Story" } },
  stays:      { sort_order: 2, label: { zh: "精品Villa", en: "Villas" } },
  dining:     { sort_order: 4, label: { zh: "餐飲服務", en: "Dining" } },
  activity:   { sort_order: 1, label: { zh: "精選活動", en: "ACTIVITIES" } },
  journal:    { sort_order: 6, label: { zh: "旅遊專欄", en: "Journal" } },
  news:       { sort_order: 5, label: { zh: "最新消息", en: "News" } },
  service:    { sort_order: 5, label: { zh: "服務項目", en: "SERVICES" } },
  experience: { sort_order: 7, label: { zh: "慢域體驗", en: "EXPERIENCE" } },
  career:     { sort_order: 11, label: {} },
  franchise:  { sort_order: 12, label: {} },
  pr:         { sort_order: 10 },
  media:      { sort_order: 8 },
  contact:    { sort_order: 7, label: { zh: "聯絡我們", en: "Contact" } },
  curation:   { sort_order: 3, label: { zh: "慢域選品", en: "Curation" } },
};

const LIVE_SITE = { settings: { pages: LIVE_PAGES } };

/* ── The name ─────────────────────────────────────────────────────────── */

test("a category the client named is called that, in both languages", () => {
  const zh = contentTypeCatalogue(LIVE_SITE, "zh");
  const en = contentTypeCatalogue(LIVE_SITE, "en");
  // The reported chip. i18n.ts has no entry for it at all, which is how the raw
  // key reached a Chinese page.
  assert.equal(zh.get("curation")?.label, "慢域選品");
  assert.equal(en.get("curation")?.label, "Curation");
  // Renamed in 頁面管理; i18n.ts still says 慢域消息 / "News".
  assert.equal(zh.get("news")?.label, "最新消息");
  // Renamed in English only; i18n.ts says "Dining Services".
  assert.equal(en.get("dining")?.label, "Dining");
});

test("no category resolves to its bare key", () => {
  for (const locale of ["zh", "en"]) {
    for (const entry of contentTypeEntries(LIVE_SITE, locale)) {
      assert.notEqual(
        entry.label,
        entry.key,
        `${entry.key} has no name in ${locale} and would print as its key`,
      );
    }
  }
});

test("a category with no label filled in still reads in Chinese", () => {
  /* pr and media carry no `label` at all on the live site; career and franchise
     carry an empty object. All four fall back to the bundled name — so this is
     not the defect the client reported, and naming them would be inventing
     Chinese the client never typed. */
  const zh = contentTypeCatalogue(LIVE_SITE, "zh");
  for (const [key, expected] of [
    ["pr", "PR 聯絡"],
    ["media", "媒體報導"],
    ["career", "人才招募"],
    ["franchise", "民宿加盟"],
  ]) {
    assert.equal(zh.get(key)?.label, expected);
  }
});

test("a rename in one language does not leak into the other", () => {
  /* 頁面管理 saves an object as soon as either field is touched. Borrowing the
     other language before the bundled name would put Chinese on the English
     page for every category renamed in Chinese only. */
  const cfg = { zh: "最新活動" };
  assert.equal(pageLabel("news", cfg, "zh"), "最新活動");
  assert.equal(pageLabel("news", cfg, "en"), ROOT_PAGE_DEFAULTS.news[1]);
});

test("a custom category with no bundled name borrows the other language last", () => {
  assert.equal(pageLabel("supper-club", { en: "Supper Club" }, "zh"), "Supper Club");
  assert.equal(pageLabel("supper-club", undefined, "zh"), "supper-club");
});

test("one label typed for both languages is not overridden by the bundled pair", () => {
  assert.equal(pageLabel("news", "最新活動", "en"), "最新活動");
});

test("a page that redirects its content type is reachable by both names", () => {
  // A villa's 「articles」 page backs the 「journal」 content type: the block
  // stores the content type, the page editor stores the key.
  const site = { settings: { pages: { articles: { label: { zh: "旅誌", en: "Articles" }, content_type: "journal", sort_order: 7 } } } };
  const zh = contentTypeCatalogue(site, "zh");
  assert.equal(zh.get("journal")?.label, "旅誌");
  assert.equal(zh.get("articles")?.label, "旅誌");
});

/* ── The order ────────────────────────────────────────────────────────── */

test("categories come out in 頁面管理's order", () => {
  const order = contentTypeEntries(LIVE_SITE, "zh").map((e) => e.key);
  // sort_order first; the live site hands out duplicates (activity/brand both 1,
  // news/service both 5, contact/experience both 7), so the key breaks the tie
  // and the answer is the same on every render.
  assert.deepEqual(order, [
    "activity", "brand", "stays", "curation", "dining", "news", "service",
    "journal", "contact", "experience", "media", "pr", "career", "franchise",
  ]);
});

test("a page with no sort_order of its own takes its bundled position", () => {
  assert.equal(pageSort("curation", { sort_order: 3 }), 3);
  assert.equal(pageSort("curation", undefined), 2); // its index in ROOT_PAGES
  assert.equal(pageSort("supper-club", undefined), 99); // unplaced: last
});

test("a deleted category is not offered as a source", () => {
  const site = { settings: { pages: { ...LIVE_PAGES, curation: { ...LIVE_PAGES.curation, deleted: true } } } };
  assert.ok(!contentTypeEntries(site, "zh").some((e) => e.key === "curation"));
  // …and the homepage is a page, not a category.
  assert.ok(!contentTypeEntries({ settings: { pages: { homepage: {} } } }, "zh").length);
});

test("a category deleted in 頁面管理 keeps the name the client gave it", () => {
  /* Deleting the page does not delete its entries and does not edit the blocks
     that name it as a source. 禾境's homepage still draws 媒體報導 from a
     page tombstoned in 頁面管理 — so the chip appears either way, and the only
     question is whether it is called 「In the Press」 or falls back to the
     bundled table's 「Media Coverage」. */
  const villa = {
    settings: {
      pages: {
        news: { label: { zh: "最新消息", en: "News" }, content_type: "news", sort_order: 0 },
        media: { label: { zh: "媒體報導", en: "In the Press" }, content_type: "media", sort_order: 6, deleted: true },
      },
    },
  };
  assert.equal(contentTypeCatalogue(villa, "en").get("media")?.label, "In the Press");
  // …and it is still not something the editor can newly pick.
  assert.deepEqual(contentTypeEntries(villa, "zh").map((e) => e.key), ["news"]);
});

test("a tombstone never names a content type a live page still backs", () => {
  const site = {
    settings: {
      pages: {
        // The tombstone sorts first, so first-wins alone would let it win.
        old: { label: { zh: "舊旅誌", en: "Old" }, content_type: "journal", sort_order: 0, deleted: true },
        journal: { label: { zh: "旅遊專欄", en: "Journal" }, sort_order: 6 },
      },
    },
  };
  assert.equal(contentTypeCatalogue(site, "zh").get("journal")?.label, "旅遊專欄");
});

test("a site with no page config at all does not throw", () => {
  for (const site of [null, undefined, {}, { settings: null }, { settings: {} }]) {
    assert.deepEqual(contentTypeEntries(site as never, "zh"), []);
  }
});

/* ── The chip row reads in that order ─────────────────────────────────── */

/** `chipsFor` lifted out of the "use client" component that owns it. */
function chipsFor(): (items: Array<{ key: string; tags: string[] }>, order?: string[]) => Array<[string, string]> {
  const PATH = "app/modules/home/blocks/CardTagFilter.tsx";
  const decl = declarationText(PATH, ["chipsFor"]).get("chipsFor");
  assert.ok(decl, `${PATH}: chipsFor is gone — renamed, or commented out`);
  const src = `function __b(__ctx){ const { tagKey } = __ctx; ${decl!.replace(/^export /, "")} return chipsFor; }`;
  const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(`${js}\nreturn __b;`)()({ tagKey });
}

/** The homepage block as it is configured live: primary 最新消息, extras 餐飲服務
 *  and 慢域選品, merged newest-first — which put curation's cards first. */
const MERGED = [
  { key: "1", tags: ["慢域選品"] },
  { key: "2", tags: ["餐飲服務"] },
  { key: "3", tags: ["最新消息"] },
];

test("the chips follow the order they are given, not the cards'", () => {
  const chips = chipsFor();
  const ordered = chips(MERGED, ["最新消息", "餐飲服務", "慢域選品"].map(tagKey));
  assert.deepEqual(ordered.map(([, label]) => label), ["最新消息", "餐飲服務", "慢域選品"]);
});

test("without an order the chips still read as the cards introduce them", () => {
  // Free-text tags have no configured order; that row must not change.
  const chips = chipsFor();
  assert.deepEqual(chips(MERGED).map(([, l]) => l), ["慢域選品", "餐飲服務", "最新消息"]);
  assert.deepEqual(chips(MERGED, []).map(([, l]) => l), ["慢域選品", "餐飲服務", "最新消息"]);
});

test("a chip the order does not name keeps its place after the ones it does", () => {
  const chips = chipsFor();
  const items = [{ key: "1", tags: ["櫻花"] }, ...MERGED, { key: "5", tags: ["在地"] }];
  const ordered = chips(items, ["最新消息", "慢域選品"].map(tagKey));
  assert.deepEqual(ordered.map(([, l]) => l), ["最新消息", "慢域選品", "櫻花", "餐飲服務", "在地"]);
});

test("the row still folds spellings of one tag into a single chip", () => {
  const chips = chipsFor();
  const items = [{ key: "1", tags: ["Local"] }, { key: "2", tags: [" local "] }];
  assert.deepEqual(chips(items, ["local"]), [["local", "Local"]]);
});

/* ── The block wires them together ────────────────────────────────────── */

/** BlockStays' own `categoryLabel` and `categoryOrder`, compiled and run. */
function blockStays(catalogue: Map<string, { label: string; sort: number }>, cfg: {
  source: string; extraSources: string[]; uiContent?: Record<string, { title?: string }>;
}) {
  const PATH = "app/modules/home/blocks/BlockStays.tsx";
  const found = declarationText(PATH, ["categoryLabel", "categoryOrder"]);
  for (const name of ["categoryLabel", "categoryOrder"]) {
    assert.ok(found.get(name), `${PATH}: ${name} is gone — renamed, or commented out`);
  }
  const src = [
    "function __b(__ctx){",
    "const { catalogue, ui, source, extraSources, filterByCategory, tagKey } = __ctx;",
    found.get("categoryLabel")!,
    found.get("categoryOrder")!,
    "return { categoryLabel, categoryOrder };",
    "}",
  ].join("\n");
  const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(`${js}\nreturn __b;`)()({
    catalogue,
    ui: { content: cfg.uiContent ?? {} },
    source: cfg.source,
    extraSources: cfg.extraSources,
    filterByCategory: cfg.extraSources.length > 0,
    tagKey,
  }) as {
    categoryLabel: (type?: string | null) => string;
    categoryOrder: string[] | undefined;
  };
}

test("the block labels a category from 頁面管理, not from the bundled table", () => {
  const { categoryLabel } = blockStays(contentTypeCatalogue(LIVE_SITE, "zh"), {
    source: "news",
    extraSources: ["dining", "curation"],
    // The table that used to win. If it does again, this reads 慢域消息.
    uiContent: { news: { title: "慢域消息" }, dining: { title: "餐飲服務" } },
  });
  assert.equal(categoryLabel("news"), "最新消息");
  assert.equal(categoryLabel("curation"), "慢域選品");
});

test("a content type with no page of its own still falls back to the bundled table", () => {
  const { categoryLabel } = blockStays(contentTypeCatalogue({ settings: { pages: {} } }, "zh"), {
    source: "news",
    extraSources: ["dining"],
    uiContent: { news: { title: "慢域消息" } },
  });
  assert.equal(categoryLabel("news"), "慢域消息");
  // …and an unknown type is named by its key rather than rendering blank.
  assert.equal(categoryLabel("supper-club"), "supper-club");
  assert.equal(categoryLabel(null), "page");
});

test("the block hands the chip row 頁面管理's order", () => {
  const { categoryOrder } = blockStays(contentTypeCatalogue(LIVE_SITE, "zh"), {
    source: "news",
    extraSources: ["dining", "curation"],
  });
  // curation 3 < dining 4 < news 5 — and tagKeys, because that is what the row
  // compares on.
  assert.deepEqual(categoryOrder, ["慢域選品", "餐飲服務", "最新消息"].map(tagKey));
});

test("the order is in the keys the chip row compares on, not the labels", () => {
  /* The row ranks by tagKey. Hand it display strings and every lookup misses,
     so the order is accepted and silently does nothing — the failure mode this
     whole change exists to remove. Only visible on a label with a case to fold,
     which is why this is the English side: the client typed 「ACTIVITIES」 and
     「SERVICES」 in 頁面管理. */
  const { categoryOrder, categoryLabel } = blockStays(contentTypeCatalogue(LIVE_SITE, "en"), {
    source: "service",
    extraSources: ["activity"],
  });
  assert.deepEqual(categoryOrder, ["activities", "services"]);
  // …and end to end: the chips take it.
  const items = [
    { key: "1", tags: [categoryLabel("service")] },
    { key: "2", tags: [categoryLabel("activity")] },
  ];
  assert.deepEqual(
    chipsFor()(items, categoryOrder).map(([, l]) => l),
    ["ACTIVITIES", "SERVICES"],
  );
});

test("a single-source block asks for no order at all", () => {
  // Its chips are the entries' own free-text tags; ranking those by category
  // would be ranking them by nothing.
  const { categoryOrder } = blockStays(contentTypeCatalogue(LIVE_SITE, "zh"), {
    source: "journal",
    extraSources: [],
  });
  assert.equal(categoryOrder, undefined);
});

test("the catalogue is built from the site the reader is on", () => {
  /* The tests above hand `categoryLabel` a catalogue directly, so they say
     nothing about where the block gets its own. It has to be the site being
     RENDERED, and that is the half this assertion originally got wrong: it
     pinned `contentTypeCatalogue(await getCurrentSite(), locale)`, which reads
     correctly but is the GROUP site on every page. getCurrentSite() sends
     /site/resolve with no `site` parameter, so it can only ever answer with the
     group — and a villa page went on ordering and naming its categories by the
     group's 頁面管理 even after the sort itself was fixed, because the sort was
     reading the wrong site's numbers. `staySlug` was already threaded into the
     block for this kind of reason; it just was not used here. */
  const PATH = "app/modules/home/blocks/BlockStays.tsx";
  const decl = declarationText(PATH, ["catalogueSite"]).get("catalogueSite");
  assert.ok(decl, "BlockStays no longer chooses which site's page management to read");
  assert.match(decl!, /staySlug/, "the villa's own slug is ignored when choosing the catalogue");
  assert.match(
    decl!,
    /getPropertySite\(\s*staySlug\s*\)/,
    "a villa page never fetches the villa's own page config",
  );
  assert.match(decl!, /getCurrentSite\(\)/, "no fallback left for a page that is not a villa");
  assert.match(
    readCode(PATH),
    /contentTypeCatalogue\(catalogueSite, locale\)/,
    "the catalogue is not built from the site that was resolved",
  );
});

test("a villa orders its categories by its own 頁面管理, not the group's", () => {
  /* The two really do disagree, which is why reading the wrong one was
     invisible in the parent's own chips. Both figures are the live values:
     on the group dining sorts 4 and news 5, on 禾境 news sorts 0 and
     dining 3. Same block, same two sources, opposite answers. */
  const GROUP = { settings: { pages: {
    dining: { sort_order: 4, label: { zh: "餐飲服務" } },
    news: { sort_order: 5, label: { zh: "最新消息" } },
  } } };
  const VILLA = { settings: { pages: {
    news: { sort_order: 0, label: { zh: "最新消息" } },
    dining: { sort_order: 3, label: { zh: "餐飲服務" } },
  } } };
  const orderFor = (site: unknown) => blockStays(contentTypeCatalogue(site, "zh"), {
    source: "dining",
    extraSources: ["news"],
  }).categoryOrder;

  assert.deepEqual(
    orderFor(VILLA),
    [tagKey("最新消息"), tagKey("餐飲服務")],
    "the villa's chips are not in the villa's own order",
  );
  assert.deepEqual(
    orderFor(GROUP),
    [tagKey("餐飲服務"), tagKey("最新消息")],
    "the group's own chips changed",
  );
});

test("the order reaches both chip rows", () => {
  const stays = readCode("app/modules/home/blocks/BlockStays.tsx");
  const news = readCode("app/modules/home/blocks/NewsCategoryFilter.tsx");
  const uses = stays.split("order={categoryOrder}").length - 1;
  assert.equal(uses, 2, `expected 最新消息卡 and the shared card row to receive it, found ${uses}`);
  // 最新消息卡 goes through NewsCategoryFilter, which has to pass it on.
  assert.match(news, /order=\{order\}/, "NewsCategoryFilter drops the order before CardTagFilter sees it");
  /* …and the row itself has to hand it to the helper. Testing chipsFor directly
     says nothing about whether the component calls it with the order, and a
     prop that arrives and is dropped is the same page as no prop at all. */
  const row = readCode("app/modules/home/blocks/CardTagFilter.tsx");
  assert.match(
    row,
    /useMemo\(\(\) => chipsFor\(items, order\), \[items, order\]\)/,
    "CardTagFilter takes the order and never passes it to chipsFor",
  );
});

/* ── The admin picker lists them the same way ─────────────────────────── */

/** `buildContentSources` lifted out of the admin's "use client" form module. */
function buildContentSources(): (site: unknown) => Array<[string, string, string]> {
  const PATH = "app/admin/modules/blockForms.tsx";
  const decl = declarationText(PATH, ["buildContentSources"]).get("buildContentSources");
  assert.ok(decl, `${PATH}: buildContentSources is gone`);
  const src = `function __b(__ctx){ const { ROOT_PAGE_DEFAULTS, pageSort, siteContentTypesFromConfig } = __ctx; ${decl!.replace(/^export /, "")} return buildContentSources; }`;
  const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(`${js}\nreturn __b;`)()({ ROOT_PAGE_DEFAULTS, pageSort, siteContentTypesFromConfig });
}

test("the 資料來源 picker lists categories in 頁面管理's order", () => {
  const sources = buildContentSources()({ ...LIVE_SITE, parent_site_id: null });
  const keys = sources.map(([key]) => key);
  assert.equal(keys[0], "stays", "住宿目錄 is always first");
  /* 慢域選品 came 13th out of 15 while 頁面管理 has it 4th. The two screens are
     the same list; an editor should not have to hunt. */
  /* 部落格 is a bundled category the client has never placed, so it takes its
     bundled position — the same one 頁面管理 gives it, which is the point. */
  assert.deepEqual(keys, ["stays", ...siteContentTypesFromConfig({ ...LIVE_SITE, parent_site_id: null } as never).map((item) => item.key)]);
  assert.ok(!keys.includes("blog"), "a page absent from page management must not be invented");
});

test("the picker uses the client's own names for them", () => {
  const sources = buildContentSources()({ ...LIVE_SITE, parent_site_id: null });
  const byKey = new Map(sources.map(([key, zh, en]) => [key, [zh, en]]));
  assert.deepEqual(byKey.get("news"), ["最新消息", "News"]);
  assert.deepEqual(byKey.get("curation"), ["慢域選品", "Curation"]);
});

test("the picker and the page agree on every category's name", () => {
  /* The whole point of the two changes above. These were four hand-kept copies
     of one list — settings.pages, ROOT_PAGES, siteNav.DEFAULT_LABELS and the
     i18n content table — and the admin read one while the page read another. */
  const site = { ...LIVE_SITE, parent_site_id: null };
  const picker = buildContentSources()(site);
  for (const locale of ["zh", "en"] as const) {
    const catalogue = contentTypeCatalogue(site, locale);
    const { categoryLabel } = blockStays(catalogue, { source: "news", extraSources: ["dining"] });
    for (const [key, zh, en] of picker) {
      if (key === "stays") continue; // the villa catalogue, not a CMS category
      const inPicker = locale === "zh" ? zh : en;
      if (!catalogue.has(key)) continue; // bundled-only key, no page to name it
      assert.equal(
        categoryLabel(key),
        inPicker,
        `${key} is 「${inPicker}」 in the editor and 「${categoryLabel(key)}」 on the page`,
      );
    }
  }
});

/* ── The panel's own gates ────────────────────────────────────────────── */

test("手動 with nothing picked yet keeps the controls that are still deciding the row", () => {
  /* BlockStays only takes the manual branch once something is ticked
     (`manual = pick_mode === "manual" && pickedIds.length > 0`), so between
     switching the dropdown and ticking the first entry the count and the
     category filter are still choosing what appears — and the panel had
     withdrawn both. */
  const stays = readCode("app/modules/home/blocks/BlockStays.tsx");
  assert.match(
    stays,
    /const manual = c\.pick_mode === "manual" && pickedIds\.length > 0;/,
    "the renderer's manual gate changed — re-check what the form should hide",
  );
  const form = readCode("app/admin/modules/blockForms.tsx");
  /* The condition is written once and read by name now, so the name has to be
     pinned to its meaning as well as to its use — a `stillAutomatic` redefined
     as `pick_mode !== "manual"` would satisfy every use below and reinstate the
     exact defect. */
  assert.match(
    form,
    /const stillAutomatic = String\(c\.pick_mode \?\? "auto"\) !== "manual" \|\| pickedCount === 0;/,
    "the panel's 自動 gate no longer allows 手動-with-nothing-ticked",
  );
  for (const [label, needle] of [
    ["每個來源顯示數量", /\{stillAutomatic && \(\n\s*<Field label=\{isStays/],
    ["內容過濾標籤", /\{!isStays && stillAutomatic && \(\n\s*<>\n\s*<ContentTagFilterPicker\b/],
  ] as Array<[string, RegExp]>) {
    assert.match(form, needle, `${label} is hidden by the dropdown alone again`);
  }
});
