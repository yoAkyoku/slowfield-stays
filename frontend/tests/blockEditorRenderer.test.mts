import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode } from "./readCode";
import { BLOCK_LABELS } from "../app/admin/modules/blockCatalogue.ts";
import { drawnTypes } from "./blockTypes.mts";

/**
 * The site-network page editor draws every page it edits with one renderer —
 * but the front end does not.
 *
 * The sidebar's 首頁編輯 routes into this editor for whichever site is selected
 * (see sidebarNav.ts), so it is what edits the group site's homepage too. That
 * page is rendered by HomepageBlocks (app/(site)/page.tsx); every other page the
 * editor reaches — villa homepages included — goes through PropertyPageRenderer.
 *
 * With the renderer hardcoded to "property", the group homepage's search bar
 * previewed as an empty frame while the live page rendered it, and the block
 * palette had no way to add one back once removed. Nothing in TypeScript
 * connects an editor's preview to the renderer that will really draw the page,
 * so the wiring is pinned here.
 */

const EDITOR = readFileSync(
  "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx",
  "utf8",
);
const HOME_RENDERER = readCode("app/modules/home/HomepageBlocks.tsx");
const PROP_RENDERER = readCode("app/modules/property/PropertyPageRenderer.tsx");

/* The types a renderer draws: its own table plus the shared one (see blockTypes.mts). */
const HOME_FILE = "app/modules/home/HomepageBlocks.tsx";
const PROP_FILE = "app/modules/property/PropertyPageRenderer.tsx";
const PAGE_FILE = "app/modules/content/PageBlocks.tsx";
function caseTypes(source: string): Set<string> {
  const file = source === HOME_RENDERER ? HOME_FILE : source === PROP_RENDERER ? PROP_FILE : PAGE_FILE;
  return drawnTypes(file);
}

test("the preview renderer is chosen, not hardcoded", () => {
  assert.doesNotMatch(
    EDITOR,
    /<BlockLivePreview[^>]*renderer="(property|homepage)"/,
    "a fixed renderer previews the group homepage with the wrong components",
  );
  assert.match(EDITOR, /renderer=\{previewRenderer\}/);
});

test("the group homepage is the case that gets the homepage renderer", () => {
  assert.match(
    EDITOR,
    /pageKey === "homepage" && site\.parent_site_id == null/,
    "a villa homepage is still a property page — only the group site's is not",
  );
});

test("every type the palette offers is one the chosen renderer can draw", () => {
  const propTypes = caseTypes(PROP_RENDERER);
  const homeOnly = [...caseTypes(HOME_RENDERER)].filter((type) => !propTypes.has(type));

  assert.ok(homeOnly.length > 0, "expected the two renderers to differ");

  /* Both anchors had rotted, so the loop below ran zero times and the whole
     test rested on `homeOnly.length > 0`:
     · `  ${type}:` looked for the palette inside the editor file; the catalogue
       moved to modules/blockCatalogue, so `offered` was always empty.
     · the declaration is `new Set<string>([])` and the pattern did not allow
       the type argument, so `gate` was always "".
     Both are now asserted to have found something, which is what makes a rotted
     anchor fail instead of quietly asserting nothing. */
  const gate = EDITOR.match(/GROUP_HOMEPAGE_ONLY = new Set(?:<[^>]*>)?\(\[([^\]]*)\]\)/)?.[1];
  assert.ok(gate !== undefined, "GROUP_HOMEPAGE_ONLY is not declared the way this test reads it");
  /* The palette itself, so an empty result means "nothing to gate" rather than
     "the anchor rotted". Both anchors are checked, not the outcome: an empty
     `offered` is the correct answer today — every type the palette offers can be
     drawn by the property renderer — and the test must stay meaningful the day
     that stops being true. */
  assert.ok(Object.keys(BLOCK_LABELS).length > 10, "the palette catalogue did not parse");
  const offered = homeOnly.filter((type) => type in BLOCK_LABELS);

  for (const type of offered) {
    assert.ok(
      gate.includes(`"${type}"`),
      `${type} is offered by this editor but PropertyPageRenderer cannot draw it — ` +
        "it has to be listed in GROUP_HOMEPAGE_ONLY so villa pages do not get it",
    );
  }
});

/**
 * Every block the site-page palette offers must be drawable by the renderer
 * that will actually draw it.
 *
 * A group site's content pages (/contact, every category page) render through
 * PageBlocks, not PropertyPageRenderer — but the editor previews them with the
 * property renderer. So `rooms`, `map`, `attractions` and `partners` previewed
 * correctly, saved without error, and rendered nothing at all on the live page.
 * The palette-vs-renderer gap is invisible to TypeScript, so it is pinned here.
 */
const PAGE_RENDERER = readCode("app/modules/content/PageBlocks.tsx");

function paletteTypes(source: string): Set<string> {
  /* The catalogue moved out of the editor into modules/blockCatalogue, where
     both editors now read it from — there used to be two copies and they had
     drifted into different names for the same block. */
  source = readCode("app/admin/modules/blockCatalogue.ts");
  const start = source.indexOf("export const BLOCK_LABELS");
  const end = source.indexOf("};", start);
  return new Set(
    [...source.slice(start, end).matchAll(/^\s{2}([a-z_]+):\s*\[/gm)].map((m) => m[1]),
  );
}

test("every palette block can be drawn by PageBlocks", () => {
  const palette = paletteTypes(EDITOR);
  assert.ok(palette.size > 10, `palette looks unparsed (${palette.size} entries)`);

  // The one deliberate exclusion: the stay-search bar belongs to the group
  // homepage, and the editor filters it out via GROUP_HOMEPAGE_ONLY.
  const groupHomepageOnly = new Set(["search"]);
  const drawable = caseTypes(PAGE_RENDERER);

  const undrawable = [...palette].filter(
    (type) => !groupHomepageOnly.has(type) && !drawable.has(type),
  );
  assert.deepEqual(
    undrawable,
    [],
    `offered by the page editor but PageBlocks has no case: ${undrawable.join(", ")}`,
  );
});

test("the villa homepage palette does not offer the search bar", () => {
  /* The reason changed, the rule did not.
     Originally: PropertyPageRenderer had no `search` case, so offering it let a
     villa admin save a block that rendered nothing.
     Now: the renderer draws it (精品Villa carries it as a block), but a villa
     micro-site still has no stay catalogue of its own to search — the bar would
     render against the parent's list on a page about one villa. So the palette
     still withholds it here, and the assertion that the renderer cannot draw it
     has been dropped rather than kept as a false premise. */
  const homeEditor = readFileSync(
    "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx",
    "utf8",
  );
  assert.ok(
    homeEditor.includes('renderer === "homepage" || type !== "search"'),
    "the villa homepage palette offers a search bar with no catalogue behind it",
  );
});
