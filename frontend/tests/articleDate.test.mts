import assert from "node:assert/strict";
import test from "node:test";
import { formatArticleDate } from "../app/modules/content/articleNav.ts";

/* The article stamp is the Taipei calendar day. It used the server's own zone,
   which in the container is UTC, so anything published before 08:00 Taipei
   time was dated the day before. */
test("an article published just after midnight in Taipei carries that day", () => {
  assert.equal(formatArticleDate("2026-11-12T17:30:00Z"), "2026.11.13"); // 01:30 Taipei
  assert.equal(formatArticleDate("2026-11-13T15:59:00Z"), "2026.11.13"); // 23:59 Taipei
  assert.equal(formatArticleDate("2026-11-13T16:00:00Z"), "2026.11.14"); // 00:00 Taipei
});

test("no date, or a broken one, prints nothing", () => {
  assert.equal(formatArticleDate(null), "");
  assert.equal(formatArticleDate("not a date"), "");
});
