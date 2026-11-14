"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolvePreviewRenderer, type PreviewRenderer } from "../../modules/previewRenderer";

export type DraftPreviewBlock = {
  id: string;
  type: string;
  enabled?: boolean;
  config: Record<string, unknown>;
};

/**
 * Longest block config carried in the preview URL, in JSON characters before
 * base64. Same number BlockLivePreview uses, so a block that thumbnails fine
 * cannot fail here: a measured 19-block villa homepage tops out at a 4.5KB
 * faq_accordion, which encodes to ~6KB of URL and is served without complaint,
 * while the whole page together is 16KB and would not be.
 */
const MAX_CONFIG_CHARS = 6000;

/** Height a frame is given before its document reports its own. Roughly one
 *  band of a homepage, so a long page does not start as a pile of slivers that
 *  then jump. */
const INITIAL_FRAME_HEIGHT = 420;

function encodeConfig(config: Record<string, unknown>): { cfg: string; dropped: boolean } {
  try {
    const json = JSON.stringify(config ?? {});
    if (json.length > MAX_CONFIG_CHARS) return { cfg: "", dropped: true };
    return { cfg: encodeURIComponent(btoa(unescape(encodeURIComponent(json)))), dropped: false };
  } catch {
    return { cfg: "", dropped: true };
  }
}

/**
 * One block, rendered full width by the real front-end components and grown to
 * the height its own document reports.
 *
 * The frame is same-origin (both are this admin), so the height can be read
 * directly rather than needing the preview route to post it out — which matters
 * because the route is shared with the row thumbnails and should not grow an
 * editor-specific message protocol.
 */
function DraftBlockFrame({
  block,
  siteSlug,
  renderer,
  label,
  zh,
}: {
  block: DraftPreviewBlock;
  siteSlug?: string;
  renderer: PreviewRenderer;
  label: string;
  zh: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(INITIAL_FRAME_HEIGHT);

  const { src, dropped } = useMemo(() => {
    const { cfg, dropped: over } = encodeConfig(block.config);
    const site = siteSlug ? `&site=${encodeURIComponent(siteSlug)}` : "";
    // Normalised here as well as in the route: the route is the security
    // boundary, and passing it a name this side already knows is invalid only
    // puts a junk value in the URL bar.
    const view = `&renderer=${resolvePreviewRenderer(renderer)}`;
    return {
      src: `/admin/preview/block?type=${encodeURIComponent(block.type)}${site}${view}${cfg ? `&cfg=${cfg}` : ""}`,
      dropped: over,
    };
  }, [block.config, block.type, siteSlug, renderer]);

  // Content height is not known until the document lays out, and changes again
  // when its images arrive, so the frame follows the document rather than being
  // measured once on load.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let observer: ResizeObserver | null = null;
    const measure = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      const next = Math.max(doc.body.scrollHeight, doc.documentElement?.scrollHeight ?? 0);
      if (next > 0) setHeight(next);
    };
    const attach = () => {
      measure();
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      observer?.disconnect();
      observer = new ResizeObserver(measure);
      observer.observe(doc.body);
    };
    frame.addEventListener("load", attach);
    // Already loaded when this ran (React can re-run the effect after the frame
    // has settled), in which case the load event will not fire again.
    if (frame.contentDocument?.readyState === "complete") attach();
    return () => {
      frame.removeEventListener("load", attach);
      observer?.disconnect();
    };
  }, [src]);

  return (
    <div className="hpb-draft__block">
      {dropped ? (
        <p className="hpb-draft__note">
          {zh
            ? `「${label}」的內容太長，預覽以空白版塊呈現；其餘版塊仍為編輯中的內容。`
            : `"${label}" is too large to preview; it is drawn empty. Every other block shows your edits.`}
        </p>
      ) : null}
      <iframe
        ref={frameRef}
        src={src}
        title={label}
        className="hpb-draft__frame"
        style={{ height }}
        scrolling="no"
      />
    </div>
  );
}

/**
 * Full-page preview of the blocks as they stand in the editor, unsaved changes
 * included.
 *
 * The saved-page iframe it replaces showed the last save, so reordering three
 * sections and pressing 預覽 showed the old order and read as "the reorder did
 * not work". The page is assembled a block at a time through the existing
 * /admin/preview/block route (allow-listed renderer, site-scoped, config
 * validated on arrival) because a whole page of blocks does not fit in a URL:
 * that same villa homepage is 16KB of JSON, four times a cookie and past what a
 * URL carries, while each block on its own fits comfortably.
 *
 * The seam this buys at the cost of one document per block: blocks that pair
 * side by side on the real page are stacked here, because each frame lays out
 * alone. The overlay says so rather than pretending otherwise.
 */
export default function DraftPagePreview({
  blocks,
  siteSlug,
  renderer,
  zh,
  labelFor,
}: {
  blocks: DraftPreviewBlock[];
  siteSlug?: string;
  renderer: PreviewRenderer;
  zh: boolean;
  labelFor: (type: string) => string;
}) {
  // Hidden blocks are dropped, as the published page does: a preview that shows
  // what will not be published is worse than no preview.
  const visible = blocks.filter((b) => b.enabled !== false);

  if (visible.length === 0) {
    return (
      <p className="hpb-draft__note">
        {zh ? "目前沒有顯示中的版塊可預覽。" : "No visible blocks to preview yet."}
      </p>
    );
  }

  return (
    <div className="hpb-draft">
      {visible.map((block) => (
        <DraftBlockFrame
          key={block.id}
          block={block}
          siteSlug={siteSlug}
          renderer={renderer}
          label={labelFor(block.type)}
          zh={zh}
        />
      ))}
    </div>
  );
}
