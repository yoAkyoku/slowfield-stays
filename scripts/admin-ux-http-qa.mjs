// Route rendering checks against the isolated SQLite loopback API only.
import assert from "node:assert/strict";
const login = await fetch("http://127.0.0.1:8313/api/v1/auth/login", {method:"POST", headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"manager@example.com",password:"local-qa"})});
const {access_token} = await login.json();
for (const [path, expected] of [
  ["/admin", "What would you like to update?"],
  ["/admin/cms?tab=pages", "Card:"],
  ["/admin/cms/tags", "View placements"],
  ["/admin/cms/pages/1/edit", "Article placement preview"],
  ["/admin/sites/1/pages/homepage", "Search section purposes"],
]) {
  const response=await fetch(`http://127.0.0.1:3313${path}`, {headers:{Cookie:`admin-token=${access_token}; admin-site=slowfield; locale=en`},signal:AbortSignal.timeout(600000)});
  const html=await response.text();
  assert.equal(response.status,200,`${path} returned ${response.status}`);
  assert.ok(html.includes(expected),`${path}: missing ${expected}`);
  process.stdout.write(`PASS ${path}\n`);
}
