import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("住宿基本資料 puts county before district and keeps their stored meanings", () => {
  const source = readCode("app/admin/(dashboard)/stays/StayEditor.tsx");
  const section = source.slice(source.indexOf("住宿基本資料"), source.indexOf("內容文案"));
  const county = section.indexOf('getField("region")');
  const district = section.indexOf('getField("destination")');
  assert.ok(county >= 0, "county no longer writes region");
  assert.ok(district >= 0, "district no longer writes destination");
  assert.ok(county < district, "county must be shown before district");
  assert.match(section, /縣市/);
  assert.match(section, /鄉鎮／區域/);
});

