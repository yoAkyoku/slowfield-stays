import assert from "node:assert/strict";
import test from "node:test";
import { getPropertySite } from "../app/modules/api.ts";

/**
 * The dev mock stands in for a *missing* backend, not for a backend that said no.
 *
 * `getPropertySite` fell back to `devMockPropertySite` on any non-OK response,
 * 404 included — so every slug that was not a villa resolved to a fabricated one.
 * A draft parent stay, or a plain typo, rendered as a live child site full of
 * demo copy at /stays/{slug}, while the API had correctly answered "no such
 * site". Local verification could not tell a working page from an invented one.
 *
 * middleware.ts carries the same guard for the same reason; it is deliberately
 * kept free of app/ imports, so the check is stated there too.
 */

const realFetch = globalThis.fetch;
const realEnv = process.env.NODE_ENV;

function withDevEnv(fetchImpl: typeof globalThis.fetch, run: () => Promise<void>) {
  Object.assign(process.env, { NODE_ENV: "development" });
  globalThis.fetch = fetchImpl;
  return run().finally(() => {
    globalThis.fetch = realFetch;
    Object.assign(process.env, { NODE_ENV: realEnv });
  });
}

test("a 404 is an answer: no site, and no invented one", async () => {
  await withDevEnv(
    async () => new Response("null", { status: 404 }),
    async () => {
      assert.equal(await getPropertySite("not-a-villa"), null);
    },
  );
});

test("an unreachable backend still gets the dev mock", async () => {
  await withDevEnv(
    async () => { throw new TypeError("fetch failed"); },
    async () => {
      const site = await getPropertySite("shamanya");
      assert.equal(site?.slug, "shamanya", "the mock is what lets the UI be built with no API running");
    },
  );
});

test("a real villa is returned as the backend describes it", async () => {
  await withDevEnv(
    async () => new Response(
      JSON.stringify({ id: 4, slug: "yashirocho", name: "Yashirocho", parent_site_id: 1, status: "active" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
    async () => {
      const site = await getPropertySite("yashirocho");
      assert.equal(site?.id, 4);
      assert.equal(site?.name, "Yashirocho");
    },
  );
});
