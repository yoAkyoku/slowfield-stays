import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode.mts";

test("failed login preserves the submitted email without persisting a password", () => {
  const form = readCode("app/admin/login/LoginForm.tsx");
  assert.match(form, /const submittedEmail = String\(formData.get\("email"\) \?\? ""\)/);
  assert.match(form, /setEmail\(submittedEmail\)/);
  assert.match(form, /aria-label=\{labels.loginEmail\}/);
  assert.match(form, /autoComplete="current-password"/);
  assert.doesNotMatch(form, /\[password, setPassword\]/);
});
test("audit chart toggles expose their selected state and separate groups", () => {
  const charts = readCode("app/admin/(dashboard)/login-audits/LoginCharts.tsx");
  assert.match(charts, /aria-pressed=\{trendRange === "month"\}/);
  assert.match(charts, /aria-pressed=\{trendRange === "year"\}/);
  assert.match(charts, /aria-pressed=\{ipRange === key\}/);
  assert.equal((charts.match(/role="group"/g) ?? []).length, 2);
});
