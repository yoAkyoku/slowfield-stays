import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";
const src = readCode("app/admin/login/LoginForm.tsx");
test("recovery success stores a message key and renders current labels", () => {
  assert.match(src, /setNotice\("resetSent"\)/);
  assert.match(src, /notice === "resetSent" \? labels.loginResetSent/);
  assert.doesNotMatch(src, /setNotice\(labels\./);
});
test("login and recovery failures render current language labels", () => {
  assert.match(src, /setError\("loginFailed"\)/);
  assert.match(src, /setError\("loginResetFailed"\)/);
  assert.match(src, /\{labels\[error\]\}/);
  assert.doesNotMatch(src, /setError\(labels\./);
});
test("success and failure messages expose live status semantics", () => {
  // The admin kit's <Callout live="…"> renders role="status" / role="alert".
  assert.match(src, /(role|live)="status"[^>]*>\{noticeText\}/);
  assert.match(src, /(role|live)="alert"[^>]*>\{labels\[error\]\}/);
  assert.match(readCode("app/admin/ui/Display.tsx"), /const role = live === false \? undefined : live \?\?/, "Callout no longer turns `live` into a role");
});
