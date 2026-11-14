import assert from "node:assert/strict";
import test from "node:test";
import { formatDate, formatDateTime, formatTime, siteDateKey, siteTimeOfDay, SITE_TIME_ZONE } from "../app/modules/datetime.ts";

test("offsetless API UTC timestamps keep the same instant in every viewer zone", () => {
  const original = process.env.TZ;
  try {
    for (const zone of ["UTC", "Asia/Taipei", "America/Los_Angeles"]) {
      process.env.TZ = zone;
      assert.equal(siteTimeOfDay("2026-11-20T01:00:00"), "09:00");
      assert.equal(siteDateKey("2026-11-20T20:00:00"), "2026-11-21");
      assert.equal(formatDateTime("2026-11-20T01:00:00"), formatDateTime("2026-11-20T01:00:00Z"));
      assert.equal(siteTimeOfDay("2026-11-20T09:00:00+08:00"), "09:00");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

/**
 * Admin timestamps are shown in Taipei time, whatever the server is set to.
 *
 * The API returns UTC instants, so the stored value was always right. The
 * display was not: every screen formatted with `Intl.DateTimeFormat(undefined, …)`
 * and no `timeZone`, which uses the *runtime's* zone. These render on the
 * server, the container sets no `TZ`, so Node used UTC — a booking submitted at
 * 21:46 Taipei was shown to staff as "01:46 PM" the same day. Eight hours off,
 * on the field they use to judge how long someone has been waiting.
 *
 * These tests deliberately assert a real clock conversion rather than merely
 * that a `timeZone` option is passed, so they fail if the zone is ever changed
 * or dropped.
 */

/** 2026-08-22T13:46:00Z is 2026-08-22 21:46 in Taipei (UTC+8, no DST). */
const UTC_INSTANT = "2026-08-22T13:46:00+00:00";

test("a UTC instant is displayed as Taipei wall-clock time", () => {
  const shown = formatDateTime(UTC_INSTANT, "zh");
  assert.match(shown, /21:46/, `expected 21:46 Taipei, got "${shown}"`);
  assert.doesNotMatch(shown, /13:46/, "13:46 means it is still rendering in UTC");
});

test("the conversion can roll the date over, not just the clock", () => {
  // 2026-08-22T20:00Z is 2026-08-23 04:00 in Taipei — the next day.
  const shown = formatDateTime("2026-08-22T20:00:00+00:00", "zh");
  assert.match(shown, /23/, `expected the 23rd in Taipei, got "${shown}"`);
  assert.match(shown, /04:00/, `expected 04:00, got "${shown}"`);
});

test("date-only formatting uses the same zone", () => {
  // Still the 23rd in Taipei even though it is the 22nd in UTC.
  assert.match(formatDate("2026-08-22T20:00:00+00:00", "zh"), /23/);
});

test("clock-only formatting uses the same zone", () => {
  assert.match(formatTime(UTC_INSTANT, "zh"), /21:46/);
});

test("times are 24-hour, so 13:00 is never ambiguous with 01:00", () => {
  const shown = formatDateTime("2026-08-22T05:00:00+00:00", "zh");
  assert.match(shown, /13:00/);
  assert.doesNotMatch(shown, /PM|下午/);
});

test("the locale is explicit, never the runtime's", () => {
  // Same instant, two locales, both still Taipei time.
  assert.match(formatDateTime(UTC_INSTANT, "en"), /21:46/);
  assert.match(formatDateTime(UTC_INSTANT, "zh"), /21:46/);
});

test("date-time separator is stable across ICU runtimes", () => {
  const shown = formatDateTime(UTC_INSTANT, "zh");
  assert.match(shown, /2026\/08\/22 21:46/);
  assert.doesNotMatch(shown, /[\u00a0\u2009\u202f]/);
});

test("a missing or unparseable value degrades instead of throwing", () => {
  assert.equal(formatDateTime(undefined), "-");
  assert.equal(formatDateTime(""), "-");
  // Unparseable input falls back to the leading date-like portion, which is
  // what a truncated or malformed timestamp from the API would look like.
  assert.equal(formatDateTime("2026-13-45T99:99:99Z"), "2026-13-45");
});

test("the zone is the business's, stated once", () => {
  assert.equal(SITE_TIME_ZONE, "Asia/Taipei");
});
