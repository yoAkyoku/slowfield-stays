/**
 * Real implementations for the stub-based component tests.
 *
 * Several tests compile one component at a time and hand it a stub for every
 * import, so the test fails loudly when a component grows a dependency nobody
 * thought about. That is the point for components and anything with side
 * effects. It is noise for small pure helpers that many components share
 * (an API base URL, a section header, a price formatter): each new shared
 * helper would otherwise need a hand-written stub in every one of those tests,
 * which is the pressure that made copies of those helpers attractive in the
 * first place.
 *
 * So the stub resolvers fall back to this table: a module listed here is
 * handed over as itself. Only list modules that are pure, or whose only
 * dependencies are listed here too.
 */
import path from "node:path";
import * as apiBase from "../app/modules/apiBase.ts";

const SHARED: Record<string, unknown> = {
  "app/modules/apiBase": apiBase,
};

/** The real module for `id` imported from `file`, if it is a shared helper. */
export function sharedModule(file: string, id: string): unknown {
  if (!id.startsWith(".")) return undefined;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file.split(path.sep).join("/")), id));
  return SHARED[resolved.replace(/\.(ts|tsx)$/, "")];
}
