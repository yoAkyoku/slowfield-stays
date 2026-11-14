import assert from "node:assert/strict";
import test from "node:test";
import { serviceOptions } from "../app/modules/searchOptions.ts";

test("an explicitly emptied facilities list stays empty", () => {
  assert.deepEqual(serviceOptions("zh", { search_facilities: [] }), []);
});

test("a site that has never configured facilities still gets the starter list", () => {
  assert.ok(serviceOptions("zh", {}).length > 0);
});

test("legacy facilities whose English label was copied from Chinese recover the bundled English label", () => {
  assert.deepEqual(
    serviceOptions("en", {
      search_facilities: [
        { value: "戲水池", label: { zh: "戲水池", en: "戲水池" } },
        { value: "KTV", label: { zh: "KTV", en: "KTV" } },
      ],
    }),
    [
      { value: "戲水池", label: "Pool" },
      { value: "KTV", label: "KTV" },
    ],
  );
});

test("a deliberately customized facility translation wins over the bundled English label", () => {
  assert.deepEqual(
    serviceOptions("en", {
      search_facilities: [{ value: "戲水池", label: { zh: "戲水池", en: "親水池" } }],
    }),
    [{ value: "戲水池", label: "親水池" }],
  );
});
