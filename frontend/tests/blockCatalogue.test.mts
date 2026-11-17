import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readEditorSurface } from "./readCode";
import { BLOCK_LABELS, BLOCK_HINTS, INSPECTOR_GROUPS } from "../app/admin/modules/blockCatalogue.ts";

/**
 * One name per block, one name per settings group, in both editors.
 *
 * There were two copies of the label table — one in HomepageBlockEditor, one in
 * PropertyBlockEditor — and they had drifted: the same block was 「精選內容」on
 * the homepage and 「精選住宿」on a villa page, 「路徑卡片」in one and
 * 「探索路徑」in the other, 「步驟流程」and 「預約流程」. The collapsible groups
 * had drifted the same way (「區塊並列」against 「並排配對」). An editor moving
 * between the two pages had no way to tell the same thing was the same thing.
 */

const HOME = "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx";
const PAGE = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx";
const EDITORS = [HOME, PAGE];

test("neither editor keeps its own copy of the names", () => {
  for (const file of EDITORS) {
    const src = readCode(file);
    assert.ok(
      !/^(export )?const BLOCK_LABELS/m.test(src),
      `${file} declares BLOCK_LABELS again — the two copies drifted last time`,
    );
    assert.ok(
      !/^(export )?const BLOCK_HINTS/m.test(src),
      `${file} declares BLOCK_HINTS again`,
    );
    assert.match(
      src,
      /from "[^"]*blockCatalogue"/,
      `${file} no longer reads the shared catalogue`,
    );
  }
});

test("every block the palette offers has a name and a hint", () => {
  /* BLOCK_TYPES is `Object.keys(BLOCK_LABELS)` in both editors, so a block with
     a label but no hint renders a name over an empty line. */
  const missing = Object.keys(BLOCK_LABELS).filter((k) => !BLOCK_HINTS[k]);
  assert.deepEqual(missing, [], `these blocks have no hint: ${missing.join(", ")}`);

  const orphanHints = Object.keys(BLOCK_HINTS).filter((k) => !BLOCK_LABELS[k]);
  assert.deepEqual(orphanHints, [], `these hints describe a block the palette does not offer: ${orphanHints.join(", ")}`);

  for (const [key, pair] of Object.entries(BLOCK_LABELS)) {
    assert.equal(pair.length, 2, `${key} is missing one of its two languages`);
    assert.ok(pair[0].trim() && pair[1].trim(), `${key} has an empty label`);
  }
  for (const [key, pair] of Object.entries(BLOCK_HINTS)) {
    assert.ok(pair[0].trim() && pair[1].trim(), `${key} has an empty hint`);
  }
});

test("no two blocks answer to the same name", () => {
  // Two blocks called the same thing in the palette is the drift this file
  // exists to stop, arriving from the other direction.
  for (const lang of [0, 1] as const) {
    const seen = new Map<string, string>();
    for (const [key, pair] of Object.entries(BLOCK_LABELS)) {
      const name = pair[lang];
      const first = seen.get(name);
      assert.ok(!first, `${key} and ${first} are both called "${name}"`);
      seen.set(name, key);
    }
  }
});

test("the settings groups are named from the shared list, not written out", () => {
  /* The pairing group was 「區塊並列」in one editor and 「並排配對」in the other.
     Reading the title from a key rather than typing it means that cannot recur. */
  for (const file of EDITORS) {
    const src = readEditorSurface(file);
    const literals = [...src.matchAll(/FoldSection title=\{zh \? "([^"]+)"/g)].map((m) => m[1]);
    /* Page- and site-level folds (SEO, media library, page hero, nav link) are
       not per-block settings and keep their own titles — only the block
       inspector's groups are shared. */
    const blockLevel = literals.filter((t) =>
      /文字|留白|背景|滿版|並|標記|間距|版寬|錨點/.test(t));
    assert.deepEqual(
      blockLevel,
      [],
      `${file} writes these block-group titles out by hand: ${blockLevel.join(", ")}`,
    );
    for (const key of ["text", "spacing", "surface", "pair", "anchor"]) {
      assert.ok(
        src.includes(`groupTitle("${key}", zh)`),
        `${file} no longer shows the ${key} group`,
      );
    }
  }
});

test("the full-bleed switch sits with the background it affects", () => {
  /* It had a collapsible section of its own holding one switch, so an editor
     could pick a background colour and never see the control that decides
     whether it spans the window. */
  for (const file of EDITORS) {
    const src = readEditorSurface(file);
    assert.ok(
      !src.includes('FoldSection title={zh ? "滿版'),
      `${file} gave the full-bleed switch its own fold again`,
    );
    const surfaceAt = src.indexOf('FoldSection title={groupTitle("surface", zh)}');
    const bleedAt = src.indexOf("full_bleed: val || undefined");
    const nextFold = src.indexOf("<FoldSection", surfaceAt + 10);
    assert.ok(surfaceAt > -1 && bleedAt > -1, `${file} lost one of the two controls`);
    assert.ok(
      bleedAt > surfaceAt && bleedAt < nextFold,
      `${file} moved the full-bleed switch out of the background group`,
    );
  }
});

test("a name says what the block is, not what it was first used for", () => {
  /* The specific ones that sent editors rebuilding a block out of 文字區塊
     because they could not guess what it was filed under. Named here so a tidy-up
     cannot quietly put the old content-specific names back. */
  for (const [key, wasCalled] of [
    ["house_rules", "入住須知"],
    ["attractions", "周邊景點"],
    ["flow", "預約流程"],
    ["stays", "精選住宿"],
    ["feature_badges", "設施與服務"],
    ["partners", "合作品牌"],
    ["about", "品牌介紹"],
  ] as Array<[string, string]>) {
    assert.notEqual(
      BLOCK_LABELS[key][0],
      wasCalled,
      `${key} is back to "${wasCalled}", which names one use of it rather than what it is`,
    );
    assert.ok(
      BLOCK_HINTS[key][0].includes(wasCalled),
      `${key}'s hint no longer mentions 「${wasCalled}」 — someone looking for the old name cannot find it`,
    );
  }
});

test("each group has both languages", () => {
  for (const [key, pair] of Object.entries(INSPECTOR_GROUPS)) {
    assert.ok(pair[0].trim() && pair[1].trim(), `group ${key} has an empty title`);
  }
});

test("the two editors offer the same inspector controls", () => {
  /* blockStyle reads _fontSize and _lineHeight and all three renderers apply
     them, but only the site-page editor offered the fields — a homepage block
     had no way to set a size the page was perfectly willing to honour. The two
     panels edit the same keys on the same blocks, so a control present in one
     and missing in the other is a gap, not a design. */
  for (const key of ["_fontSize", "_lineHeight", "_textAlign", "_padY", "_bgColor", "full_bleed"]) {
    for (const file of EDITORS) {
      assert.ok(
        readEditorSurface(file).includes(`${key}:`),
        `${file} has no control for ${key}, which the other editor offers and every renderer reads`,
      );
    }
  }
});
