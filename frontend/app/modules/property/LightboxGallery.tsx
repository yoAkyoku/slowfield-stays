"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ScrollRail from "../content/ScrollRail";
import { useOverlay } from "../useOverlay";

export type LightboxImage = { url: string; caption?: string };

/**
 * Full-screen image viewer with prev/next, keyboard nav, and a click-to-zoom
 * (放大細節) toggle that scales the photo 2× and lets the guest drag to pan.
 * Reused by the property image gallery and the rooms / facilities photo wall.
 */
export function Lightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ sx: number; sy: number; bx: number; by: number; moved: boolean } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const count = images.length;

  // Localised accessible name for the dialog. The lightbox has no locale prop
  // (its callers don't pass one), so read the language the document is in.
  const zh =
    typeof document !== "undefined" &&
    document.documentElement.lang.toLowerCase().startsWith("zh");
  const dialogLabel = zh ? "圖片檢視" : "Image viewer";

  // Make the rest of the page inert so the screen reader can't reach the
  // gallery behind the overlay. The dialog is portalled to <body>, so every
  // other body child is a background sibling to silence.
  //
  // Moving focus in and holding Tab inside used to live here too, as a second
  // copy of what useOverlay already does. The copy ran first, which broke the
  // one thing it did not implement: by the time the hook looked for the
  // element to give focus back to, this effect had already moved focus to the
  // close button, so on Escape the hook restored to a button that no longer
  // existed and a guest who opened a photo from the keyboard was dropped at
  // the top of the page. The trap is the hook's now — see the useOverlay call
  // below, which is why this effect runs before it and no longer touches focus.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const backgroundSiblings = Array.from(document.body.children).filter(
      (el) => el !== dialog && !el.contains(dialog),
    ) as HTMLElement[];
    const restore = backgroundSiblings.map((el) => ({
      el,
      inert: el.hasAttribute("inert"),
      ariaHidden: el.getAttribute("aria-hidden"),
    }));
    backgroundSiblings.forEach((el) => {
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    });

    return () => {
      restore.forEach(({ el, inert, ariaHidden }) => {
        if (!inert) el.removeAttribute("inert");
        if (ariaHidden === null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", ariaHidden);
      });
    };
  }, []);

  const resetZoom = useCallback(() => { setZoomed(false); setPan({ x: 0, y: 0 }); }, []);
  const go = useCallback(
    (delta: number) => {
      resetZoom();
      onIndex((index + delta + count) % count);
    },
    [index, count, onIndex, resetZoom],
  );

  // Pointer drag-to-pan while zoomed (mouse + touch). A press that doesn't move
  // is treated as a click → toggle zoom; a press that moves pans the photo.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!zoomed) { drag.current = { sx: e.clientX, sy: e.clientY, bx: 0, by: 0, moved: false }; return; }
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, bx: pan.x, by: pan.y, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !zoomed) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    setPan({ x: d.bx + dx, y: d.by + dy });
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    // No movement → it was a click: toggle zoom (and recentre when zooming out).
    if (!d || !d.moved) {
      setZoomed((z) => { if (z) setPan({ x: 0, y: 0 }); return !z; });
    }
  };

  // Escape, the scroll lock, the Tab trap and the return of focus to the
  // thumbnail that opened this all come from the shared overlay hook; this one
  // had the only save-and-restore lock in the codebase, and now everything does.
  // Arrow keys stay local below — they are this dialog's own, not an overlay's.
  useOverlay(true, onClose, { trapFocus: dialogRef });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go]);

  const current = images[index];
  if (!current) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={dialogLabel}
      tabIndex={-1}
      onClick={onClose}
    >
      <button className="lightbox-close" aria-label={zh ? "關閉" : "Close"} onClick={onClose}>
        &times;
      </button>
      {count > 1 && (
        <button
          className="lightbox-nav lightbox-nav--prev"
          aria-label={zh ? "上一張" : "Previous"}
          onClick={(e) => { e.stopPropagation(); go(-1); }}
        >
          ‹
        </button>
      )}
      <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
        <img
          className={`lightbox-img${zoomed ? " is-zoomed" : ""}${dragging ? " is-dragging" : ""}`}
          src={current.url}
          alt={current.caption || `Image ${index + 1}`}
          style={zoomed ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(2)` } : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          draggable={false}
        />
        {current.caption && <figcaption className="lightbox-caption">{current.caption}</figcaption>}
        {count > 1 && <div className="lightbox-counter">{index + 1} / {count}</div>}
      </figure>
      {count > 1 && (
        <button
          className="lightbox-nav lightbox-nav--next"
          aria-label={zh ? "下一張" : "Next"}
          onClick={(e) => { e.stopPropagation(); go(1); }}
        >
          ›
        </button>
      )}
    </div>,
    document.body,
  );
}

/**
 * Clickable image grid (same markup/classes as the server gallery) that opens
 * the Lightbox on click so guests can inspect details. Layout is driven by the
 * caller via the className passed through.
 */
export default function LightboxGallery({
  images,
  gridClassName,
  gridStyle,
  title,
  collage = false,
  carousel = false,
  columns,
}: {
  images: LightboxImage[];
  gridClassName: string;
  gridStyle?: React.CSSProperties;
  title?: string;
  /** 欄數 — in carousel mode this sets how many cards fit across, which the
   *  rail otherwise ignored entirely (its card width was fixed in CSS). */
  columns?: number;
  /** 拼貼 — a composed centre+corners collage that spreads apart on desktop and
      tablet and overlaps on phones. Auto-adjusts by count via the
      `--n{count}` classes. All images render. */
  collage?: boolean;
  /** 輪播 — one scrolling row with prev/next arrows, same rail used by the
      news and stays blocks, rather than a grid that wraps. */
  carousel?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const collageRef = useRef<HTMLDivElement>(null);
  const tiles = images;

  useEffect(() => {
    if (!collage) return;
    const el = collageRef.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>(".property-collage-item");
    if (!items.length) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const progress = (vh - rect.top) / (vh + rect.height);
        const offset = (progress - 0.5) * 2;
        items.forEach((item) => {
          item.style.setProperty("--scroll-offset", String(offset));
        });
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [collage]);

  const n = Math.min(images.length, 6);
  const wrapperClass = collage
    ? `property-scatter property-scatter--n${n} property-collage property-collage--n${n}`
    : gridClassName;

  const tileNodes = tiles.map((img, i) => (
    <figure className={`property-image-gallery-item is-zoomable${collage ? " property-collage-item property-scatter-item" : ""}`} key={i}>
      <button
        type="button"
        className="property-image-gallery-zoom"
        aria-label={img.caption || (title ? `${title} ${i + 1}` : `View image ${i + 1}`)}
        onClick={() => setOpen(i)}
      >
        <img src={img.url} alt={img.caption || (title ? `${title} ${i + 1}` : `Image ${i + 1}`)} loading="lazy" />
        <span className="property-image-gallery-zoom-hint" aria-hidden="true">⤢</span>
      </button>
      {img.caption && <figcaption>{img.caption}</figcaption>}
    </figure>
  ));

  return (
    <>
      {carousel && tiles.length === 1 ? (
        // A single image has nothing to scroll to — a rail with one narrow
        // card and dead arrows looks broken. Show it large instead, still
        // click-to-zoom via the same lightbox.
        <figure className="property-image-gallery-item property-image-gallery-single is-zoomable">
          <button
            type="button"
            className="property-image-gallery-zoom"
            aria-label={tiles[0].caption || (title ? `${title} 1` : "View image 1")}
            onClick={() => setOpen(0)}
          >
            <img src={tiles[0].url} alt={tiles[0].caption || (title ? `${title} 1` : "Image 1")} loading="lazy" />
            <span className="property-image-gallery-zoom-hint" aria-hidden="true">⤢</span>
          </button>
          {tiles[0].caption && <figcaption>{tiles[0].caption}</figcaption>}
        </figure>
      ) : carousel ? (
        <ScrollRail
          className={`property-image-gallery-grid is-rail${columns ? " has-cols" : ""}`}
          ariaLabel={title || "Image gallery"}
          style={columns ? ({ "--rail-cols": columns } as React.CSSProperties) : undefined}
        >
          {tileNodes}
        </ScrollRail>
      ) : (
        <div
          ref={collage ? collageRef : undefined}
          className={wrapperClass}
          style={collage ? undefined : gridStyle}
        >
          {tileNodes}
        </div>
      )}
      {open !== null && (
        <Lightbox images={images} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
      )}
    </>
  );
}
