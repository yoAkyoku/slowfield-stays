"use client";

import { useState } from "react";

/**
 * The row list behind the search option and guest range editors: rows seeded
 * from the site's saved list or, when it has none, from the built-in defaults.
 *
 * Seeding the built-ins is a display convenience, not a decision to adopt
 * them. The site form posts every tab at once (the panels are hidden, not
 * unmounted), so without `touched` an admin who saves an unrelated tab would
 * freeze a copy of today's defaults into the site and stop tracking future
 * changes to the bundled list. The caller posts an empty list until then.
 */
export function useSeededRows<T extends object>(seed: () => T[]) {
  const [rows, setRows] = useState<T[]>(seed);
  const [touched, setTouched] = useState(false);
  const edit = (next: T[]) => { setTouched(true); setRows(next); };

  const update = (i: number, patch: Partial<T>) =>
    edit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    edit(next);
  };

  const remove = (i: number) => edit(rows.filter((_, j) => j !== i));

  return { rows, touched, edit, update, move, remove };
}
