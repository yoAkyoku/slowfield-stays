/**
 * Which front-end renderer draws a block's thumbnail in the admin.
 *
 * A thumbnail must come from the renderer that will draw the block on the real
 * page. Villa pages render through PropertyPageRenderer, which handles rooms,
 * faq_accordion, table, contact_info, contact_form, feature_badges and
 * house_rules; drawing those through HomepageBlocks left the editor's row blank
 * while the published page showed them fine.
 */
export const PREVIEW_RENDERERS = ["homepage", "property"] as const;

export type PreviewRenderer = (typeof PREVIEW_RENDERERS)[number];

/**
 * The preview route renders arbitrary block config carried in a URL, so the
 * renderer name is checked against the allow-list rather than trusted. Anything
 * unrecognised (or absent) falls back to the homepage renderer, which is what
 * every existing caller already got.
 */
export function resolvePreviewRenderer(raw: unknown): PreviewRenderer {
  return typeof raw === "string" && (PREVIEW_RENDERERS as readonly string[]).includes(raw)
    ? (raw as PreviewRenderer)
    : "homepage";
}
