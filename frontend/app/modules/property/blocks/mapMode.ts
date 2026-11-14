/** The map block's rendering modes, and how a stored config resolves to one.
 *
 *  Separate from the component so it is testable without a DOM, and so the
 *  public renderer and the admin form cannot disagree about what a config means.
 *  They did: an "illustrated" mode was removed, and a block still carrying it
 *  was neither "embed" nor a pin mode — it fell through with percent-positioned
 *  markers that the lat/lng parser then dropped, so the block returned null and
 *  vanished from the page, while the admin's <select> matched no option and
 *  silently displayed the first one instead. */
export const MAP_MODES = ["stays", "pins", "embed"] as const;
export type MapMode = (typeof MAP_MODES)[number];

const KNOWN = new Set<string>(MAP_MODES);

/**
 * @param markerCount usable lat/lng markers the config carries — not the raw
 *   array length, since a retired mode's markers may not be geographic at all.
 */
export function resolveMapMode(raw: unknown, markerCount: number): MapMode {
  if (typeof raw === "string" && KNOWN.has(raw)) return raw as MapMode;
  // Unset or retired: fall back to what the block actually holds, so it
  // degrades to a working map rather than to nothing. Same rule the admin form
  // uses for a block that has never had a mode chosen.
  return markerCount > 0 ? "pins" : "embed";
}
