import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("慢域體驗 has its own managed site setting", () => {
  const options = readCode("app/modules/searchOptions.ts");
  assert.match(options, /experienceOptions/);
  assert.match(options, /search_experiences/);

  const action = readCode("app/admin/modules/siteActions.ts");
  assert.match(action, /search_experiences:\s*parseLabelledList/);

  const editor = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
  assert.match(editor, /慢域體驗/);
  assert.match(editor, /name="search_experiences"/);
});

test("each stay can be assigned managed experiences", () => {
  const form = readCode("app/admin/(dashboard)/stays/StayForm.tsx");
  assert.match(form, /experienceOptions=/);

  const editor = readCode("app/admin/(dashboard)/stays/StayEditor.tsx");
  assert.match(editor, /name="experiences"/);
  assert.match(editor, /toggleExperience/);

  const action = readCode("app/admin/modules/stayActions.ts");
  assert.match(action, /experiences:\s*lines\(formData\.get\("experiences"\)\)/);
});

test("the public search submits and restores 慢域體驗 after facilities", () => {
  const bar = readCode("app/modules/StaySearchBar.tsx");
  assert.match(bar, /experienceOptions\?: SearchOpt\[\]/);
  assert.match(bar, /name="experience"/);
  assert.match(bar, /慢域體驗/);
  assert.ok(
    bar.indexOf('name="amenity"') < bar.indexOf('name="experience"'),
    "experience must follow facilities",
  );

  const page = readCode("app/(site)/stays/page.tsx");
  assert.match(page, /experience\?: string \| string\[\]/);
  assert.match(page, /params\.append\("experience"/);
  assert.match(page, /experiences: experienceList/);
});

