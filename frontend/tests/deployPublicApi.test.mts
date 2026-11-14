import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("release build freezes the same-origin public API and clears font fixtures", () => {
  const script = readFileSync(new URL("../../scripts/build-deploy-tarball.sh", import.meta.url), "utf8");
  assert.match(script, /NEXT_PUBLIC_API_URL=\/api\/v1 NEXT_PUBLIC_APP_ENV=production npm run build/);
  assert.match(script, /unset NEXT_FONT_GOOGLE_MOCKED_RESPONSES/);
  assert.match(script, /STORAGE_PROXY_ORIGIN= NEXT_PUBLIC_API_URL/);
});
