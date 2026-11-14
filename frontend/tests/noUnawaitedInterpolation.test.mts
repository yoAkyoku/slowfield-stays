import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * TypeScript cannot catch this one, and it cost us a working admin.
 *
 * The Next 15 migration turned several helpers async. In `adminApi.ts` eight
 * call sites gained an `await` and the ninth — inside a template literal — did
 * not. A Promise stringifies to "[object Promise]", so every admin request went
 * to `/api/v1/admin[object Promise]`, came back 404, and `adminFetch` maps 404
 * to its empty fallback: every list in the admin rendered empty, with no error
 * anywhere. `tsc`, ESLint and 190 tests were all green.
 *
 * A template literal accepts any type, so there is no type error to find. This
 * walks the source instead.
 */

const ROOT = "app";
const SKIP = new Set(["node_modules", ".next"]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = sourceFiles(ROOT);

/** Names declared `async` anywhere in the app. */
function asyncFunctionNames(files: string[]): Set<string> {
  const names = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/\basync\s+function\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of src.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*[:=][^=\n]*?\basync\s*\(/g)) names.add(m[1]);
  }
  return names;
}

test("the app has source files to scan", () => {
  // Guards the guard: a broken walk would make every assertion below vacuous.
  assert.ok(FILES.length > 100, `expected to find app sources, found ${FILES.length}`);
});

test("no async function is interpolated into a template literal without await", () => {
  const asyncNames = asyncFunctionNames(FILES);
  assert.ok(asyncNames.size > 20, `expected to detect async declarations, found ${asyncNames.size}`);

  const offenders: string[] = [];
  for (const file of FILES) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/\$\{\s*(?!await\b)([A-Za-z_$][\w$]*)\s*\(/g)) {
        if (asyncNames.has(m[1])) offenders.push(`${file}:${i + 1}  \${${m[1]}(…)}  ->  ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `Promise stringified into a template literal:\n${offenders.join("\n")}`);
});
