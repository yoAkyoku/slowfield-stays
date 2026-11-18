import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readCode } from "./readCode";

/**
 * One `translations` field per CMS page form.
 *
 * `cmsActions.ts` reads the page's translations with a single `formData.get`,
 * which returns the FIRST entry of that name and silently ignores the rest.
 * PageFormEditor carries a note about the bug that produced: two components
 * emitting `<input name="translations">` into one form, so whichever rendered
 * second was thrown away on save with nothing to show for it.
 *
 * Two orphaned components — cms/TranslationsEditor.tsx and
 * cms/PageLocaleFields.tsx — each rendered exactly that input and had no
 * importer anywhere in the repository. They were deleted rather than left as a
 * loaded gun for whoever wires up the next locale editor. This test is what
 * stops a second one from growing back.
 */

const ADMIN = "app/admin";

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const EMITTERS = tsxFiles(ADMIN)
  .filter((f) => /name="translations"|name=\{"translations"\}/.test(readCode(f)))
  .map((f) => f.replace(/\\/g, "/"))
  .sort();

/* One per form, and each of these three IS its form's own editor: a banner, a
   CMS page, a stay. They never appear together, so none of them can shadow
   another. Anything beyond this list is a component that would be dropped into
   an existing form — which is the shape the bug takes. */
const OWN_FORM = [
  "app/admin/(dashboard)/cms/BannerFormEditor.tsx",
  "app/admin/(dashboard)/cms/PageFormEditor.tsx",
  "app/admin/(dashboard)/stays/StayEditor.tsx",
];

test("no component emits a translations field except the three form editors", () => {
  assert.deepEqual(
    EMITTERS,
    OWN_FORM,
    'a further component emits <input name="translations">; two in one form means formData.get keeps the first and silently drops the other',
  );
});

test("the two orphans that emitted a second one are gone", () => {
  for (const gone of [
    "app/admin/(dashboard)/cms/TranslationsEditor.tsx",
    "app/admin/(dashboard)/cms/PageLocaleFields.tsx",
  ]) {
    assert.ok(
      !EMITTERS.includes(gone),
      `${gone} is back — it has no importer and exists only to be wired into a form that already has this field`,
    );
  }
});

test("the reader still takes only the first entry, which is why the rule exists", () => {
  // If cmsActions ever starts reading getAll and merging, this constraint can
  // be relaxed — but then it should be relaxed deliberately, not by drift.
  // The CMS and stay actions share parseTranslations (adminUtils).
  assert.match(readCode("app/admin/modules/cmsActions.ts"), /parseTranslations\(formData\)/, "cmsActions no longer reads translations through parseTranslations");
  const actions = readCode("app/admin/modules/adminUtils.ts");
  assert.match(
    actions,
    /formData\.get\("translations"\)/,
    "cmsActions no longer reads translations with get() — revisit the single-emitter rule above",
  );
});
