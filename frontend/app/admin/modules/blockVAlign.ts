/* Extracted from blockForms.tsx, which is a .tsx compiled with `jsx: preserve`
   — importing it from a test throws `React is not defined`, so every existing
   test asserts on its SOURCE TEXT instead of calling anything. A pure predicate
   does not need that handicap: on its own here it can be executed, and this one
   decides whether a control is offered at all, which is worth testing for real
   rather than by pattern-matching its body. blockForms re-exports it, so both
   editors keep importing it from where they always did. */

/**
 * Whether this block, as configured, actually puts a picture beside its copy —
 * which is the only thing the vertical alignment control has to align against.
 *
 * This was a flat set of three block types, and two of the three could not use
 * the setting:
 *
 *   · rich_text — BlockRichText draws .property-rich-split (the one layout that
 *     reads --block-text-valign) only when config.image is set, and the form
 *     had no image field at all, so the control could never do anything. The
 *     field exists now, so the block qualifies once a picture is chosen.
 *   · editorial — the same split, but only on one of its three placements. Its
 *     default puts the picture ABOVE the copy, where there is no second column
 *     to align against and --block-text-valign is read by nothing; the control
 *     has to follow the placement, not merely the presence of an image, or it
 *     is back to being a setting that saves and changes nothing.
 *
 * 關於 has its own two-column layout and always qualifies.
 */
export function showsVAlign(type: string, config: Record<string, unknown>): boolean {
  /* 關於 only has a second column once it has a picture: `.block-about` is a
     single 1fr column and only `.block-about--has-image` adds the second, which
     BlockAbout writes when config.image is set. Returning true unconditionally
     put the control on a one-column block, where justify-content distributes
     nothing — the same silent no-op this whole function exists to prevent. */
  if (type === "about") return Boolean(config.image);
  /* The inverse, found in the same audit: both of these render
     .property-rich-split, which IS the rule that reads --block-text-valign, and
     neither was offered the control. 圖文交錯 always draws the split; 影片＋文字
     only on an explicit side, matching its renderer. */
  if (type === "alternating") {
    /* Gated on a picture, like every other branch. BlockAlternating keeps a
       text-only row — it drops one only when it has nothing at all — but that
       row renders no `.property-rich-split-media`, so the grid is one column
       and there is nothing for the alignment to distribute against. The control
       was offered against a second column that is never drawn, which is the
       no-op this function exists to prevent. */
    const rows = Array.isArray(config.items) ? config.items : [];
    return rows.some((row) => typeof (row as Record<string, unknown>)?.image === "string"
      && (row as Record<string, unknown>).image !== "");
  }
  if (type === "video_text") {
    const side = config.video_position;
    return Boolean(config.url) && (side === "left" || side === "right");
  }
  if (type === "editorial") {
    const side = config.image_position;
    return Boolean(config.image) && (side === "left" || side === "right");
  }
  if (type === "rich_text") return Boolean(config.image);
  return false;
}
