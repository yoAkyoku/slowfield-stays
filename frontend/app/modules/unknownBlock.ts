/**
 * A block the renderer has no case for.
 *
 * All four renderers ended in `return null`, silently. That is the failure mode
 * behind a whole class of bugs found here: an editor adds a block, fills it in,
 * saves without error, and the page shows nothing — with no console line, no
 * server log, and nothing in the admin to suggest the type was never wired up.
 * Seven homepage types and one villa type each shipped that way and were only
 * caught by someone loading the page and noticing an absence.
 *
 * Rendering an error to visitors would be worse than the blank. So this logs,
 * naming both the renderer and the type, which is enough to tell "nobody
 * implemented this" apart from "the config is empty" — the two look identical
 * on the page and have completely different fixes.
 *
 * Deduplicated per renderer+type: these run on every request for a page, and a
 * warning repeated on every render is a warning nobody reads.
 */
const reported = new Set<string>();

export function reportUnknownBlock(renderer: string, type: unknown): null {
  const name = typeof type === "string" && type ? type : "(missing type)";
  const key = `${renderer}:${name}`;
  if (!reported.has(key)) {
    reported.add(key);
    console.warn(
      `[blocks] ${renderer} has no renderer for block type "${name}" — it was saved ` +
      `but renders nothing. Either add a case for it or stop offering it in the editor.`,
    );
  }
  return null;
}
