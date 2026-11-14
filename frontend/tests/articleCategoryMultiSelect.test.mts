import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("article editor keeps one primary category and submits additional categories", () => {
  const editor = readCode("app/admin/(dashboard)/cms/PageFormEditor.tsx");
  const actions = readCode("app/admin/modules/cmsActions.ts");
  const api = readCode("app/admin/modules/adminApi.ts");

  assert.match(editor, /主分類|Primary category/);
  assert.match(editor, /其他分類|Additional categories/);
  assert.match(editor, /name="categories"/);
  assert.match(editor, /additionalCategories\.has\(key\)/);
  assert.match(editor, /setAdditionalCategories/);
  assert.match(actions, /formData\.getAll\("categories"\)/);
  assert.match(api, /categories\?: string\[\]/);
});

