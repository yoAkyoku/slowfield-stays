"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolvePreviewRenderer, type PreviewRenderer } from "../../modules/previewRenderer";

/** Width the block is laid out at inside the frame, then scaled down to fit.
 *  A block reflowed into a 200px-wide thumbnail would show its mobile layout,
 *  which is not what the editor is arranging. */
const STAGE_WIDTH = 1280;

/**
 * A block's own thumbnail, rendered by the real front-end components in an
 * iframe and scaled to fit.
 *
 * These were hand-drawn skeletons — grey bars in roughly the right places — so
 * the list told you a block's type and nothing about its content. Editors had
 * to save and open the site to see what they had.
 *
 * The frame only mounts once it is scrolled near, and its config is debounced,
 * so a long page of blocks does not open a page-load per row while typing.
 */
export default function BlockLivePreview({
  type,
  config,
  siteSlug,
  renderer = "homepage",
  height = 132,
}: {
  type: string;
  config: Record<string, unknown>;
  /** Which site's content to draw with — a villa block previewed against the
      group site's stays and banners would show the wrong place entirely. */
  siteSlug?: string;
  /** Which renderer will draw this block on the real page. Villa page blocks go
      through PropertyPageRenderer, and the types only it knows (rooms,
      house_rules, contact_form and friends) previewed as an empty frame while
      the published page rendered them. */
  renderer?: PreviewRenderer;
  height?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const [debounced, setDebounced] = useState(config);

  // Only build a frame for rows the editor has actually scrolled to.
  useEffect(() => {
    const el = holder.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Typing in a text field changes the config on every keystroke; reloading the
  // frame that often would make the editor unusable.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(config), 600);
    return () => window.clearTimeout(id);
  }, [config]);

  const src = useMemo(() => {
    if (!visible) return "";
    let cfg = "";
    try {
      const json = JSON.stringify(debounced ?? {});
      // A config too long for a URL previews without it rather than producing a
      // request the server will reject.
      cfg = json.length > 6000 ? "" : encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
    } catch {
      cfg = "";
    }
    const site = siteSlug ? `&site=${encodeURIComponent(siteSlug)}` : "";
    // Normalised on the way out as well as on the way in, so a caller passing an
    // unknown name gets the same fallback the route would apply rather than a
    // stray value in the URL.
    const view = `&renderer=${resolvePreviewRenderer(renderer)}`;
    return `/admin/preview/block?type=${encodeURIComponent(type)}${site}${view}${cfg ? `&cfg=${cfg}` : ""}`;
  }, [visible, type, debounced, siteSlug, renderer]);

  const scale = width ? width / STAGE_WIDTH : 0;

  return (
    <div
      ref={holder}
      className="hpb-live"
      style={{ height, overflow: "hidden", position: "relative", background: "var(--paper, #f7f5ef)" }}
    >
      {src ? (
        <iframe
          src={src}
          title={`${type} preview`}
          loading="lazy"
          tabIndex={-1}
          scrolling="no"
          style={{
            width: STAGE_WIDTH,
            height: scale ? height / scale : height,
            border: 0,
            transform: `scale(${scale || 0.15})`,
            transformOrigin: "top left",
            pointerEvents: "none",
            display: "block",
          }}
        />
      ) : null}
    </div>
  );
}
