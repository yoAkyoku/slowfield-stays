import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
import { cmsEntrySeo } from "../app/modules/seo.ts";
import { bannerIssues, countCmsIssueStats, pageIssues } from "../app/admin/(dashboard)/cms/cmsConsoleData.ts";
import { stayIssueKeys } from "../app/admin/(dashboard)/stays/staysConsoleData.ts";
import type { AdminPage } from "../app/admin/modules/adminApi.ts";
import type { AdminStayRecord } from "../app/admin/(dashboard)/stays/staysConsoleData.ts";

/**
 * 待完善項目 lists what the public site is missing, not what an editor has left
 * un-overridden.
 *
 * It used to read the `seo_title` / `seo_description` columns straight and
 * report every page that had not filled them: ISSUES (24) over 24 published
 * pages, 缺少 SEO 標題 24 and 缺少 SEO 描述 24, with 缺少圖片 and 缺少內容 both
 * at 0 beneath them. Every one of the 24 was false — /journal/luozhuang-sakura-trail
 * and /journal/yilan-two-days-unhurried serve correct titles and descriptions
 * today with both columns empty — so the panel was 100% noise, and it was also
 * telling the client to write two dozen meta descriptions the site does not
 * need. A real 缺少內容 appearing in that list would never have been seen.
 *
 * Those columns are overrides. The two content routes fall back to the page's
 * own title, then its summary, then an excerpt of its body; the two stay routes
 * do the same over name / summary / story. The first tests below assert those
 * chains against the routes themselves, because the whole fix rests on them —
 * if a route ever stops falling back, the console's rule is wrong again and
 * should fail here rather than quietly under-report.
 *
 * What remains an issue is the case where the chain runs out. That one is not
 * hypothetical: `excerpt` reads `body`, the prose column, and NOT `body_blocks`,
 * so a page built entirely from blocks with no summary genuinely has no
 * description of its own and inherits the site-wide default — the duplicate
 * description warning `excerpt`'s own comment was written about.
 */

/* ── The premise: the routes really do fall back ─────────────────────────── */

/** Source with comments blanked and whitespace flattened, so an assertion about
 *  a metadata chain does not also assert how the call happens to be wrapped. */
function flat(path: string): string {
  return readCode(path).replace(/\s+/g, " ");
}

/* The CMS detail routes (/page/x, /privacy/x, /{category}/x) all take their
   metadata from entryMetadata, so the chain is pinned once, where it lives. */
const CONTENT_ROUTES = ["app/modules/content/entryRoute.tsx"];

test("every CMS detail route takes its metadata from entryMetadata", () => {
  for (const route of [
    "app/(site)/[category]/[identifier]/page.tsx",
    "app/(site)/page/[identifier]/page.tsx",
    "app/(site)/privacy/[identifier]/page.tsx",
  ]) {
    assert.match(flat(route), /return entryMetadata\(/, `${route} builds its own metadata again`);
  }
});

for (const route of CONTENT_ROUTES) {
  test(`${route}: the meta title falls back to the page's own title`, () => {
    assert.match(flat(route), /title: seo\.title \|\| seoTextForLocale\(trs\(page, "title", locale\), locale\)/);
  });

  test(`${route}: the meta description falls back to the summary, then the body`, () => {
    assert.match(
      flat(route),
      /description: seo\.description \|\| seoTextForLocale\(trs\(page, "summary", locale\), locale\) \|\| seoTextForLocale\(excerpt\(trs\(page, "body", locale\)\), locale\)/,
    );
  });
}

const STAY_ROUTES = [
  "app/(site)/stays/[slug]/page.tsx",
  "app/(site)/stays/detail/[slug]/page.tsx",
];

for (const route of STAY_ROUTES) {
  test(`${route}: the meta title falls back to the stay's own name`, () => {
    assert.match(flat(route), /title: seoTextForLocale\(stay\.seo\?\.title, locale\) \|\| localizedName/);
  });

  test(`${route}: the meta description falls back to the summary, then the story`, () => {
    assert.match(
      flat(route),
      /description: seoTextForLocale\(stay\.seo\?\.description, locale\) \|\| localizedSummary \|\| localizedStory/,
    );
  });
}

test("an entry with no SEO overrides hands the routes empty strings, so `||` moves on", () => {
  // The link between the two: if cmsEntrySeo ever returned undefined or a
  // placeholder instead, the `||` chains above would still read as fallbacks
  // and would no longer be any.
  assert.deepEqual(cmsEntrySeo({}, "zh"), { title: "", description: "", image: "", canonical: "" });
});

/* ── Pages ───────────────────────────────────────────────────────────────── */

function page(over: Partial<AdminPage> = {}): AdminPage {
  return { id: 1, title: "羅莊櫻花步道", slug: "luozhuang-sakura-trail", status: "published", ...over };
}

test("a page that overrides nothing but describes itself is not an issue", () => {
  // The live case, both flagged pages: a title, a summary, body copy, a cover,
  // and neither SEO column filled.
  const issues = pageIssues(
    page({
      summary: "沿著羅東的河岸走一段櫻花步道。",
      body: "粉色在頭頂連成長廊。",
      cover_image_url: "/uploads/sakura.jpg",
    }),
  );
  assert.deepEqual(issues, []);
});

test("an empty seo_title on a page that has a title is not an issue", () => {
  const issues = pageIssues(page({ seo: { title: "", description: "" }, summary: "摘要", body: "內文", cover_image_url: "/c.jpg" }));
  assert.deepEqual(issues, []);
});

test("a page with no description anywhere is still reported", () => {
  // Blocks, so 缺少內容 does not fire — but `excerpt` reads `body`, not blocks,
  // so this page's description really does fall through to the site default.
  const issues = pageIssues(
    page({ summary: "", body: "", body_blocks: [{ type: "paragraph", text: "hi" }], cover_image_url: "/c.jpg" }),
  );
  assert.deepEqual(issues, ["missing_description"]);
});

test("a summary in the other language counts, because the routes borrow it", () => {
  const issues = pageIssues(
    page({ summary: "", body: "", body_blocks: [{ type: "paragraph", text: "hi" }], cover_image_url: "/c.jpg", translations: { en: { summary: "A walk along the river." } } }),
  );
  assert.deepEqual(issues, []);
});

test("a per-locale SEO description counts, since that is where the editor writes one", () => {
  // cmsEntrySeo reads translations[locale].seo_description before the flat
  // column, so reading only `seo.description` here called a page with an
  // English meta description "missing".
  const issues = pageIssues(
    page({ summary: "", body: "", body_blocks: [{ type: "paragraph", text: "hi" }], cover_image_url: "/c.jpg", translations: { en: { seo_description: "A quiet trail." } } }),
  );
  assert.deepEqual(issues, []);
});

test("the flat seo column still counts, for entries saved before the bilingual editor", () => {
  const issues = pageIssues(
    page({ summary: "", body: "", body_blocks: [{ type: "paragraph", text: "hi" }], cover_image_url: "/c.jpg", seo: { description: "舊描述" } }),
  );
  assert.deepEqual(issues, []);
});

test("a page with no title in any language is reported", () => {
  const issues = pageIssues(page({ title: "  ", summary: "摘要", body: "內文", cover_image_url: "/c.jpg" }));
  assert.deepEqual(issues, ["missing_title"]);
});

test("the two checks that were already honest are untouched", () => {
  assert.deepEqual(
    pageIssues(page({ summary: "摘要", body: "", body_blocks: [], cover_image_url: "" })),
    ["missing_body", "missing_cover"],
  );
  assert.deepEqual(bannerIssues({ image_url: "" } as never), ["missing_image"]);
  assert.deepEqual(bannerIssues({ image_url: "/b.jpg" } as never), []);
});

/* ── Stays ───────────────────────────────────────────────────────────────── */

function stay(over: Partial<AdminStayRecord> = {}): Partial<AdminStayRecord> {
  return { id: 1, name: "禾境", hero_image_url: "/h.jpg", room_types: [{ name: "A" }] as never, ...over };
}

test("a stay that overrides nothing but has a name and a summary is not an issue", () => {
  assert.deepEqual(stayIssueKeys(stay({ summary: "宜蘭冬山的泳池民宿。" })), []);
});

test("a stay with only a story still has a description to serve", () => {
  // 缺少摘要 is a separate, real check — the card blurb is empty. What must NOT
  // fire is 缺少描述, because the route excerpts the story.
  assert.deepEqual(stayIssueKeys(stay({ summary: "", story: "從山邊開車十分鐘。" })), ["missing_summary"]);
});

test("a stay with nothing to describe itself with is reported", () => {
  assert.deepEqual(stayIssueKeys(stay({ summary: "", story: "" })), ["missing_summary", "missing_description"]);
});

test("a stay's summary in the other language counts", () => {
  assert.deepEqual(
    stayIssueKeys(stay({ summary: "", story: "", translations: { en: { summary: "A pool villa in Dongshan." } } })),
    ["missing_summary"],
  );
});

test("an empty seo.title on a stay that has a name is not an issue", () => {
  assert.deepEqual(stayIssueKeys(stay({ summary: "摘要", seo: {} as never })), []);
  assert.deepEqual(stayIssueKeys(stay({ summary: "摘要", name: "", translations: {} })), ["missing_title"]);
});

/* ── The panel's labels keep up with the keys ────────────────────────────── */

test("every issue a page or banner can carry has a label in the CMS console", () => {
  const keys = [...pageIssues(page({ title: "" })), ...bannerIssues({ image_url: "" } as never)];
  assert.equal(keys.length, 5, `expected all five issue kinds from an empty record, got ${keys.join(", ")}`);
  const console = readCode("app/admin/(dashboard)/cms/page.tsx");
  for (const key of keys) {
    // Twice: the badge label and the stat tile, in each of the two languages.
    const uses = console.split(`${key}:`).length - 1;
    assert.ok(uses >= 4, `${key} appears ${uses} times in the CMS console copy — expected a label and a stat per language`);
  }
});

test("nothing in the admin still calls a blank SEO column missing", () => {
  // A half-finished rename leaves a label nobody can reach, and TypeScript does
  // not object to an extra property on an inferred copy object.
  for (const file of [
    "app/admin/(dashboard)/cms/page.tsx",
    "app/admin/(dashboard)/stays/page.tsx",
    "app/admin/(dashboard)/cms/cmsConsoleData.ts",
    "app/admin/(dashboard)/stays/staysConsoleData.ts",
  ]) {
    assert.ok(!readCode(file).includes("missing_seo_"), `${file} still carries a missing_seo_* key`);
  }
});

test("image issue count includes article covers and banner images", () => {
  assert.deepEqual(
    countCmsIssueStats(
      [["missing_cover"], ["missing_cover", "missing_body"], ["missing_title"]],
      [["missing_image"], []]
    ),
    {
      missing_image: 3,
      missing_body: 1,
      missing_title: 1,
      missing_description: 0
    }
  );
});