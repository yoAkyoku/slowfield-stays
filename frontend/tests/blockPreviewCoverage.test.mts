import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode } from "./readCode";

/**
 * Every block type the editor offers must be drawn by the renderer that will
 * actually draw it — in the preview and on the published page alike, since the
 * preview route feeds the same two renderers.
 *
 * A type in the palette with no case renders as an empty frame. That reads as
 * "the preview is broken" rather than "this block does nothing", and the
 * published page is just as blank, so nothing tells the editor either way.
 */

const EDITOR = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx";
const PROPERTY = "app/modules/property/PropertyPageRenderer.tsx";
const HOMEPAGE = "app/modules/home/HomepageBlocks.tsx";

const src = (f: string) => readFileSync(f, "utf8");
const cases = (f: string) =>
  new Set([...src(f).matchAll(/case "([a-z_]+)"/g)].map((m) => m[1]));

/** The BLOCK_LABELS map's keys — what the palette can offer. */
function paletteTypes(): string[] {
  // See blockCatalogue: one table for both editors, so the palette is parsed
  // from there rather than from whichever editor happened to hold a copy.
  const body = src("app/admin/modules/blockCatalogue.ts").split("export const BLOCK_LABELS")[1] ?? "";
  const block = body.slice(0, body.indexOf("\n};"));
  return [...new Set([...block.matchAll(/^\s{2}([a-z_]+):\s*\[/gm)].map((m) => m[1]))];
}

/** Types the editor withholds from a villa micro-site (no catalogue of its own). */
function childSiteHidden(): Set<string> {
  const line = src(EDITOR).match(/CHILD_SITE_HIDDEN = new Set\(\[([^\]]*)\]\)/);
  return new Set([...(line?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
}

/** Types the editor deliberately withholds from villa / sub pages. */
function groupHomepageOnly(): Set<string> {
  const line = src(EDITOR).match(/GROUP_HOMEPAGE_ONLY = new Set\(\[([^\]]*)\]\)/);
  return new Set([...(line?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
}

test("the palette is not empty (the parse still works)", () => {
  assert.ok(paletteTypes().length > 15, `only parsed ${paletteTypes().length} types — did BLOCK_LABELS move?`);
});

test("PropertyPageRenderer draws every type offered on a villa or sub page", () => {
  const drawn = cases(PROPERTY);
  const missing = paletteTypes()
    .filter((t) => !groupHomepageOnly().has(t))
    .filter((t) => !drawn.has(t));
  assert.deepEqual(missing, [], `previews blank on villa/sub pages: ${missing.join(", ")}`);
});

test("HomepageBlocks draws every type offered on the group homepage", () => {
  const drawn = cases(HOMEPAGE);
  const missing = paletteTypes().filter((t) => !drawn.has(t));
  assert.deepEqual(missing, [], `previews blank on the group homepage: ${missing.join(", ")}`);
});

test("a withheld type is gated, not left to render blank", () => {
  /* Whatever the palette withholds, it must withhold by an applied filter —
     not by leaving the type in the list with no renderer behind it, which
     shows an editor an empty frame and publishes an empty block.

     GROUP_HOMEPAGE_ONLY is empty now: `search` moved to CHILD_SITE_HIDDEN when
     精品Villa gained it, because the parent has a catalogue on every page and a
     villa micro-site has none anywhere. The rule below holds either way. */
  const src = readFileSync(EDITOR, "utf8");
  for (const [name, gate] of [
    ["GROUP_HOMEPAGE_ONLY", groupHomepageOnly()],
    ["CHILD_SITE_HIDDEN", childSiteHidden()],
  ] as const) {
    if (gate.size === 0) continue;
    assert.ok(
      src.includes(`!${name}.has(type)`),
      `${name} lists types but is never applied to the palette`,
    );
  }
});

test("the block card shows the preview and nothing else", () => {
  for (const f of [EDITOR, "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx"]) {
    const s = src(f);
    assert.doesNotMatch(s, /hpb-thumb__cap/, `${f} still captions the preview with the card's own title`);
    assert.doesNotMatch(s, /hpb-thumb__title/, `${f} still repeats the block title above the preview`);
    assert.match(s, /<BlockLivePreview/, `${f} lost its live preview`);
  }
});

test("the search block is available where a stay catalogue exists", () => {
  /* It was withheld from everything but the group homepage, so 精品Villa could
     not carry it and the bar had to stay hardcoded into the page
     (客戶: 我需要這個區塊在頁面編輯中添加至精品Villa). The parent site has a
     catalogue on every page; a villa micro-site has none of its own, so it is
     withheld there instead. */
  const src = readFileSync(EDITOR, "utf8");
  assert.match(src, /CHILD_SITE_HIDDEN = new Set\(\["search"\]\)/, "the search block is no longer withheld from villa sites");
  assert.match(src, /!isChildSite \|\| !CHILD_SITE_HIDDEN\.has\(type\)/, "the villa-site gate is declared but never applied");
  // And the renderer that draws sub-pages must actually know the type now.
  assert.ok(cases(PROPERTY).has("search"), "PropertyPageRenderer cannot draw a search block, so it would preview and render blank");
});

test("the stays page renders its blocks and no hardcoded search bar", () => {
  const page = readCode("app/(site)/stays/page.tsx");
  assert.match(page, /<PropertyPageRenderer/, "the stays page ignores 頁面編輯 blocks");
  assert.doesNotMatch(
    page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, ""),
    /<StaySearchBar/,
    "the hardcoded search bar is still there, so the block cannot replace or hide it",
  );
  // The filter the listing is using has to reach the block, or the bar renders
  // empty beside a filtered list and clears the filter on the next submit.
  assert.match(page, /searchInitial=\{\{/, "the active filter is not passed to the search block");
});
