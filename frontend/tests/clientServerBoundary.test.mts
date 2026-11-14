import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

/**
 * No "use client" file may reach a server-only module.
 *
 * `next build` is the only thing that enforces this, and it is minutes long and
 * runs at deploy time. A shared helper was moved into i18n.ts and imported from
 * 角色 — a client component — and `npx tsc --noEmit` was clean, all 1265 tests
 * passed, and the build then failed on `next/headers`, because i18n.ts reads the
 * locale from cookies. Neither the typechecker nor the test runner models the
 * boundary; both happily resolve the module.
 *
 * So the import graph is walked here instead: every "use client" file, through
 * its own relative imports, to anything that pulls in a server-only API. The
 * failure names the chain rather than just the endpoint, because the offending
 * import is usually two files away from the one that has to change.
 */

const ROOT = resolve(import.meta.dirname, "..");
const APP = join(ROOT, "app");

/** Imports that only exist on the server. */
const SERVER_ONLY = /(from|import)\s+"(next\/headers|server-only)"/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

const FILES = walk(APP);
const source = new Map<string, string>(FILES.map((f) => [f, readFileSync(f, "utf8")]));

/** A file's own relative imports, resolved to real paths. */
function importsOf(file: string): string[] {
  const src = source.get(file) ?? "";
  const out: string[] = [];
  /* `import type` is erased before the bundle exists, so it cannot drag a
     server-only module into the client. Counting it produced three false
     positives on a tree whose build is green — blockForms takes a TYPE from
     adminApi, and adminApi is where next/headers lives. */
  for (const m of src.matchAll(/import\s+(type\s+)?[^"';]*?from\s+"(\.[^"]*)"/g)) {
    if (m[1]) continue;
    const base = resolve(dirname(file), m[2]);
    for (const candidate of [base, base + ".ts", base + ".tsx", join(base, "index.ts"), join(base, "index.tsx")]) {
      if (source.has(candidate)) { out.push(candidate); break; }
    }
  }
  return out;
}

/** The first chain from `entry` to a server-only import, or null. */
function chainToServerOnly(entry: string): string[] | null {
  const seen = new Set<string>();
  const stack: Array<{ file: string; path: string[] }> = [{ file: entry, path: [entry] }];
  while (stack.length) {
    const { file, path } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    // The entry is the client component itself; a server-only import there is
    // its own error, and Next reports that one clearly.
    const text = source.get(file) ?? "";
    /* A "use server" module is a BOUNDARY, not a leak. Importing one from a
       client component is the supported way to call a server action: Next
       replaces it with a reference and never bundles its body, which is why
       next/headers inside it is fine. Walking through it reported
       error.tsx -> AdminErrorScreen -> adminSiteCookie on a green tree. */
    if (file !== entry && /^\s*['"]use server['"]/.test(text)) continue;
    if (file !== entry && SERVER_ONLY.test(text)) return path;
    for (const next of importsOf(file)) stack.push({ file: next, path: [...path, next] });
  }
  return null;
}

const CLIENT_FILES = FILES.filter((f) => /^\s*(["'])use client\1/.test(source.get(f) ?? ""));

test("there are client components to check", () => {
  // Guards the guard: a broken detector would pass every assertion below by
  // having nothing to assert about.
  assert.ok(CLIENT_FILES.length > 10, `only found ${CLIENT_FILES.length} "use client" files — the detector is wrong`);
});

test("the detector recognises a server-only import", () => {
  // Verified against a known positive rather than trusted.
  assert.match('import { cookies } from "next/headers";', SERVER_ONLY);
  assert.match('import "server-only";', SERVER_ONLY);
  assert.doesNotMatch('import { headers } from "./myHeaders";', SERVER_ONLY);
});

test("no client component pulls in a server-only module", () => {
  const offenders: string[] = [];
  for (const file of CLIENT_FILES) {
    const chain = chainToServerOnly(file);
    if (chain) offenders.push(chain.map((f) => f.slice(ROOT.length + 1).split(String.fromCharCode(92)).join("/")).join(" -> "));
  }
  assert.deepEqual(
    offenders,
    [],
    "these client components reach a server-only module — `next build` will fail:\n    " + offenders.join("\n    "),
  );
});
