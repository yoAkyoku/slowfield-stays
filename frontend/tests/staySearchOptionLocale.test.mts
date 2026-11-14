import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("stay editor keeps both labels so its language toggle can switch chips", () => {
  const form = readCode("app/admin/(dashboard)/stays/StayForm.tsx");
  const editor = readCode("app/admin/(dashboard)/stays/StayEditor.tsx");

  assert.match(form, /serviceOptions\("zh"/);
  assert.match(form, /serviceOptions\("en"/);
  assert.match(form, /experienceOptions\("zh"/);
  assert.match(form, /experienceOptions\("en"/);
  assert.match(editor, /labels\?\.\[editLocale\]/);
});

test("villa types are optional custom tag filters, not a built-in vocabulary", () => {
  const options = readCode("app/modules/searchOptions.ts");
  const editor = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");

  assert.match(options, /export function typeOptions/);
  assert.match(options, /configured\(settings\?\.search_types, locale\)/);
  assert.match(editor, /name="search_types"/);
  assert.match(editor, /zhPlaceholder="泳池villa"/);
  assert.match(editor, /enPlaceholder="Pool villa"/);
  assert.match(editor, /Villa Types is an optional custom third search field/);
});
