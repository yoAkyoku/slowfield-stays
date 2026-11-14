import assert from "node:assert/strict";
import test from "node:test";
import { buildLocationGroups } from "../app/modules/stayLocations.ts";

/**
 * One county, one chip — however many ways it is spelled in the database.
 *
 * `region` and `destination` are free text typed per stay, and the catalogue
 * has stays filed under both "Yilan" and "宜蘭". The options were keyed on that
 * raw value while their labels went through `trs`, so the dropdown offered two
 * chips that both read 宜蘭. Picking either returned half the county and said
 * nothing about the other half:
 *
 *     GET /stays              -> 2
 *     GET /stays?region=Yilan -> 1
 *     GET /stays?region=宜蘭   -> 1
 *
 * Grouping by the label and submitting every raw value behind it is only half
 * the fix; the API has to match any one of them. That half is
 * `backend/app/modules/stays/routes.py::list_stays`, covered by
 * `backend/tests/test_region_multi_match.py`.
 */

const STAYS = [
  { region: "Yilan", destination: "Dongshan, Yilan", translations: { zh: { region: "宜蘭", destination: "宜蘭冬山" } } },
  { region: "宜蘭", destination: "宜蘭三星", translations: { en: { region: "Yilan", destination: "Sanxing, Yilan" } } },
  { region: "Taipei", destination: "Taipei", translations: { zh: { region: "台北", destination: "台北" } } },
] as never;

test("two spellings of one county are one option", () => {
  for (const locale of ["zh", "en"] as const) {
    const groups = buildLocationGroups(STAYS, locale);
    assert.equal(groups.length, 2, `${locale}: expected 台北 and 宜蘭, got ${groups.map((g) => g.label).join(", ")}`);
    const labels = groups.map((g) => g.label);
    assert.equal(new Set(labels).size, labels.length, `${locale}: two options read the same: ${labels.join(", ")}`);
  }
});

test("the merged option submits every spelling behind it", () => {
  const yilan = buildLocationGroups(STAYS, "zh").find((g) => g.label === "宜蘭");
  assert.ok(yilan, "the 宜蘭 option is gone");
  const submitted = yilan.county.split(",");
  assert.deepEqual(new Set(submitted), new Set(["Yilan", "宜蘭"]), `submits ${yilan.county}`);
});

test("a county with one spelling still submits a bare value", () => {
  // Old links and bookmarks carry a single value; nothing may start sending a
  // list where a list is not needed.
  const taipei = buildLocationGroups(STAYS, "zh").find((g) => g.label === "台北");
  assert.ok(taipei);
  assert.equal(taipei.county, "Taipei");
  assert.ok(!taipei.county.includes(","));
});

test("districts from both spellings appear under the one county", () => {
  // They used to be split across the two chips, so a district was reachable
  // only if you happened to pick the right one of two identical-looking options.
  const yilan = buildLocationGroups(STAYS, "zh").find((g) => g.label === "宜蘭");
  assert.deepEqual(yilan!.districts.map((d) => d.label).sort(), ["三星", "冬山"]);
  const en = buildLocationGroups(STAYS, "en").find((g) => g.label === "Yilan");
  assert.deepEqual(en!.districts.map((d) => d.label).sort(), ["Dongshan", "Sanxing"]);
});

test("a stay with no region is skipped rather than becoming a blank option", () => {
  const groups = buildLocationGroups([{ region: "", destination: "Nowhere" }] as never, "zh");
  assert.equal(groups.length, 0);
});
