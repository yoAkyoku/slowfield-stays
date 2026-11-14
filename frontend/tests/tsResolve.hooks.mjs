/** See tsResolve.mjs. Runs on the loader thread, so it must be its own file. */

/* Request-scoped Next APIs have no meaning outside a request. Modules that read
   the visitor's locale reach for these, and importing the real ones off a
   server pulls in the whole Next runtime — so they resolve to a stub that
   answers empty. See tests/stubs/nextHeaders.mjs. */
const STUBS = new Map([["next/headers", "./stubs/nextHeaders.mjs"]]);

export async function resolve(specifier, context, nextResolve) {
  const stub = STUBS.get(specifier);
  if (stub) return nextResolve(new URL(stub, import.meta.url).href, context);
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    // Only a relative specifier with no extension is worth a second guess; a
    // genuinely missing module must still fail loudly rather than be papered
    // over by an unrelated file that happens to share its name.
    if (err?.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw err;
    for (const ext of [".ts", ".tsx", ".mts"]) {
      try {
        return await nextResolve(`${specifier}${ext}`, context);
      } catch { /* try the next extension */ }
    }
    throw err;
  }
}
