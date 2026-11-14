import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readCode } from "./readCode";

/**
 * The 顯示搜尋框 switch must describe the state the site is actually in.
 *
 * Three places read `show_search`, and they disagreed: the admin switch used
 * `!== false` while the pages used `=== true`. For any page that had never
 * been saved — which is every page, since the flag was added after the last
 * save — the switch sat ON while the search box was hidden. Turning it "on"
 * therefore did nothing, because it already looked on; the only way to get a
 * search box was to toggle it off, save, and toggle it back.
 *
 * A control that misreports the current state is worse than a missing one, so
 * all three read the flag the same way: absent means off.
 */

const READERS = [
  "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx",
  "app/modules/content/CategoryPage.tsx",
  "app/property/[slug]/[...pageSlug]/page.tsx",
];

for (const file of READERS) {
  const src = readFileSync(file, "utf8");

  test(`${file} treats an unset show_search as off`, () => {
    // Property reads only. Prose in a comment can name the flag too, and a
    // "starts with *" filter misses a comment's continuation lines.
    const uses = src.split(String.fromCharCode(10)).filter((l) => l.includes(".show_search"));
    assert.ok(uses.length > 0, "no show_search read found — renamed?");
    for (const line of uses) {
      if (line.includes('name="_show_search"')) continue; // the hidden form field
      assert.ok(
        line.includes("=== true"),
        `${file} reads show_search as "${line.trim()}" — use === true so absent means off`,
      );
      assert.ok(
        !line.includes("!== false"),
        `${file} still defaults show_search on`,
      );
    }
  });
}

test("the switch still persists the value it shows", () => {
  const editor = readFileSync(READERS[0], "utf8");
  const action = readCode("app/admin/modules/propertyPagesActions.ts");
  assert.match(editor, /name="_show_search"/);
  assert.match(action, /_show_search/);
  assert.match(action, /show_search: showSearch/);
});
