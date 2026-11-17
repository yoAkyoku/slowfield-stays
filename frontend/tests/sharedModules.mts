/**
 * Real implementations for the stub-based component tests.
 *
 * Several tests compile one component at a time and hand it a stub for every
 * import, so the test fails loudly when a component grows a dependency nobody
 * thought about. That is the point for components and anything with side
 * effects. It is noise for small pure helpers that many components share
 * (an API base URL, a section heading, a price formatter): each new shared
 * helper would otherwise need a hand-written stub in every one of those tests,
 * which is the pressure that made copies of those helpers attractive in the
 * first place.
 *
 * So the stub resolvers fall back to this table: a module listed here is
 * handed over as itself. Only list modules that are pure, or whose only
 * dependencies are listed here too.
 *
 *   · SHARED: plain .ts modules, imported for real.
 *   · SHARED_COMPONENTS: small presentational .tsx components. The test runner
 *     cannot load JSX itself, so these go through the calling test's own
 *     compile(), and render with the same stub JSX runtime as the component
 *     under test.
 */
import path from "node:path";
import * as apiBase from "../app/modules/apiBase.ts";

const SHARED: Record<string, unknown> = {
  "app/modules/apiBase": apiBase,
};

const SHARED_COMPONENTS: Record<string, string> = {
  "app/modules/SectionHeading": "app/modules/SectionHeading.tsx",
  /* The renderers' shared block table. Its imports are the block components a
     test has already stubbed for the renderer; remap() re-keys those stubs to
     the table's own relative paths. */
  "app/modules/blockRegistry": "app/modules/blockRegistry.tsx",
};

type Imports = Record<string, unknown>;
const dir = (p: string) => path.posix.dirname(p.split(path.sep).join("/"));

/** The real module for `id` imported from `file`, if it is a shared helper. */
export function sharedModule(
  file: string,
  id: string,
  compile?: (path: string, remap: (imports: Imports) => Imports) => unknown,
): unknown {
  if (!id.startsWith(".")) return undefined;
  const resolved = path.posix
    .normalize(path.posix.join(path.posix.dirname(file.split(path.sep).join("/")), id))
    .replace(/\.(ts|tsx)$/, "");
  if (resolved in SHARED) return SHARED[resolved];
  if (compile && resolved in SHARED_COMPONENTS) {
    const target = SHARED_COMPONENTS[resolved];
    /* The caller's stubs, keyed as the shared module would import them. */
    const remap = (imports: Imports): Imports => {
      const out: Imports = {};
      for (const [key, value] of Object.entries(imports)) {
        if (!key.startsWith(".")) { out[key] = value; continue; }
        const abs = path.posix.normalize(path.posix.join(dir(file), key));
        let rel = path.posix.relative(dir(target), abs);
        if (!rel.startsWith(".")) rel = "./" + rel;
        out[rel] = value;
      }
      return out;
    };
    return compile(target, remap);
  }
  return undefined;
}
