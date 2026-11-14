import assert from "node:assert/strict";
import test from "node:test";
import { buildLocationGroups, stayLocationLabel } from "../app/modules/stayLocations.ts";

/**
 * The county/district dropdowns submit one thing and display another. Getting
 * that backwards is invisible in Chinese (the two strings are identical) and
 * breaks either the search or the English page, so both halves are asserted
 * separately on every case.
 */

const stays = [
  {
    region: "宜蘭縣",
    destination: "宜蘭縣冬山鄉",
    translations: {
      zh: { region: "宜蘭縣", destination: "宜蘭縣冬山鄉" },
      en: { region: "Yilan", destination: "Dongshan, Yilan" },
    },
  },
  {
    region: "宜蘭縣",
    destination: "宜蘭縣礁溪鄉",
    translations: {
      zh: { region: "宜蘭縣", destination: "宜蘭縣礁溪鄉" },
      en: { region: "Yilan", destination: "Jiaoxi, Yilan" },
    },
  },
];

test("display order is county then township or district", () => {
  assert.equal(stayLocationLabel(stays[0], "zh"), "宜蘭縣 / 冬山鄉");
  assert.equal(stayLocationLabel(stays[0], "en"), "Yilan / Dongshan");
  assert.equal(stayLocationLabel({ region: "宜蘭", destination: "冬山" }, "zh"), "宜蘭 / 冬山");
});

test("Chinese shows the filed values", () => {
  const [yilan] = buildLocationGroups(stays, "zh");
  assert.equal(yilan.county, "宜蘭縣");
  assert.equal(yilan.label, "宜蘭縣");
  assert.deepEqual(yilan.districts.map((d) => d.label).sort(), ["冬山鄉", "礁溪鄉"]);
});

test("English shows English and still submits the Chinese", () => {
  const [yilan] = buildLocationGroups(stays, "en");
  assert.equal(yilan.label, "Yilan");
  // The value is what the API matches on and must not be translated. The
  // district value keeps the county stripped because the endpoint matches
  // `destination` as a substring, so 冬山鄉 finds 宜蘭縣冬山鄉.
  assert.equal(yilan.county, "宜蘭縣");
  assert.deepEqual(
    yilan.districts.map((d) => [d.value, d.label]).sort(),
    [["冬山鄉", "Dongshan"], ["礁溪鄉", "Jiaoxi"]],
  );
  for (const d of yilan.districts) {
    assert.match(d.value, /[一-鿿]/, `${d.value} should stay Chinese`);
  }
});

test("the county is stripped from either end", () => {
  // Chinese puts the county first, English puts it last.
  const [group] = buildLocationGroups(
    [{ region: "台東縣", destination: "台東縣成功鎮", translations: { en: { region: "Taitung", destination: "Chenggong, Taitung" } } }],
    "en",
  );
  assert.equal(group.districts[0].label, "Chenggong");
});

test("a destination that does not name its county is left whole", () => {
  const [group] = buildLocationGroups([{ region: "宜蘭縣", destination: "頭城" }], "zh");
  assert.equal(group.districts[0].label, "頭城");
});

test("a stay with no region is skipped rather than making a blank option", () => {
  assert.deepEqual(buildLocationGroups([{ region: "", destination: "somewhere" }], "en"), []);
  assert.deepEqual(buildLocationGroups([{ destination: "somewhere" }], "en"), []);
});

test("one stay's translation fills in for another that lacks it", () => {
  const [group] = buildLocationGroups(
    [
      { region: "宜蘭縣", destination: "宜蘭縣冬山鄉" },
      { region: "宜蘭縣", destination: "宜蘭縣礁溪鄉", translations: { en: { region: "Yilan" } } },
    ],
    "en",
  );
  assert.equal(group.label, "Yilan");
});
