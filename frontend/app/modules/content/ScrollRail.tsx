"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAutoAdvance from "../useAutoAdvance";
import { railGeometry } from "./railGeometry";

/**
 * Arrow controls over a side-scrolling row.
 *
 * Wraps the existing `is-rail` row rather than introducing a second carousel:
 * the scroll behaviour, snapping and card sizing already live in CSS, so this
 * only adds the buttons and the state that decides whether each is usable.
 *
 * A rail is perfectly usable without arrows — trackpad, touch, keyboard — so
 * they are an addition, not a replacement. They exist for the mouse user with
 * no horizontal wheel, who otherwise has only a thin scrollbar to aim at.
 */
export default function ScrollRail({
  className,
  ariaLabel,
  children,
  style,
}: {
  className: string;
  ariaLabel: string;
  children: React.ReactNode;
  /** Lets a caller size the cards — the gallery passes --rail-cols so its
   *  欄數 setting means something in carousel mode too. */
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const [overflows, setOverflows] = useState(false);
  // True looping: the cards are rendered three times and the scroll position is
  // kept in the middle copy, so running off either end lands on the same cards
  // again with nothing to see (客戶: 滑到最右邊時繼續滑會出現第 1 個，左邊也是).
  // Arrow-only wrapping was not what was asked for — dragging or wheel-
  // scrolling still hit a wall.
  //
  // Enabled after mount, so the server-rendered HTML carries one copy: search
  // engines and a no-JS reader see each card once, not three times.
  const [loop, setLoop] = useState(false);
  const normalising = useRef(false);
  const layoutSize = useRef("");
  const childCount = useMemo(() => Children.count(children), [children]);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return { overflows: false, step: 0, period: 0 };
    const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
    return railGeometry(Array.from(el.children).map(child => {
      const rect = child.getBoundingClientRect();
      return { left: rect.left, width: rect.width };
    }), childCount, el.clientWidth, gap);
  }, [childCount]);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 2px of slack: sub-pixel layout means scrollWidth rarely lands exactly on
    // clientWidth even when nothing is left to scroll.
    const geometry = measure();
    const size = `${el.clientWidth}:${el.firstElementChild?.getBoundingClientRect().width ?? 0}`;
    if (layoutSize.current && layoutSize.current !== size) {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      normalising.current = false;
      el.style.scrollSnapType = "";
      el.scrollLeft = loop && geometry.overflows ? geometry.period : 0;
    }
    layoutSize.current = size;
    setOverflows(geometry.overflows);
  }, [measure, loop]);

  /** Keep the scroll position inside the middle copy. */
  const normalise = useCallback(() => {
    const el = ref.current;
    if (!el || !loop || normalising.current) return;
    const setWidth = measure().period;
    if (setWidth <= 0) return;
    if (el.scrollLeft < setWidth * 0.5) {
      normalising.current = true;
      el.scrollLeft += setWidth;
      requestAnimationFrame(() => { normalising.current = false; });
    } else if (el.scrollLeft > setWidth * 1.5) {
      normalising.current = true;
      el.scrollLeft -= setWidth;
      requestAnimationFrame(() => { normalising.current = false; });
    }
  }, [loop, measure]);

  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    // Watch the cards, not just the rail. The rail's own box does not change
    // when a web font swaps in or an image settles on its intrinsic size, but
    // what it has to scroll does — so a row that only starts overflowing after
    // load would keep its arrows hidden.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    // Cards can be swapped out underneath us — the news filter replaces the list
    // without remounting the rail. A ResizeObserver only watches the nodes it
    // was given, so a filtered-down row kept its arrows enabled with nothing
    // left to scroll to, and a filtered-up one stayed without arrows.
    const mo = new MutationObserver(() => {
      ro.disconnect();
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
      sync();
    });
    mo.observe(el, { childList: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [sync]);

  // Looping needs something to loop past. A row that fits has nothing to
  // scroll, and one card repeated three times reads as three cards.
  useEffect(() => {
    setLoop(overflows && childCount > 1);
  }, [overflows, childCount]);

  // Start in the middle copy so the first drag can go either way.
  useEffect(() => {
    const el = ref.current;
    if (!el || !loop) return;
    el.scrollLeft = measure().period;
  }, [loop, measure, children]);

  // Drive the arrow scroll ourselves with rAF instead of scrollBy({behavior:
  // "smooth"}). Two native behaviours made the button unreliable:
  //   1. With scroll-snap-type: mandatory, a native smooth scroll of less than
  //      one snap-increment is swallowed — the row never moves.
  //   2. When it did move, normalise()'s instant wrap-jump landed mid-animation
  //      and cancelled the in-flight smooth scroll, so the ← button stuck at the
  //      loop seam while → (which rarely reached its seam in one step) worked.
  // Animating with instant scrollLeft writes sidesteps both: snap is switched
  // off for the motion (so each frame lands where we put it) and the wrap is
  // folded into the same animation, never as a competing jump. Snap is restored
  // at the end, which cleanly re-aligns the row to the nearest card.
  const nudge = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    // Move by whole cards rather than a fixed distance, so a click never leaves
    // a sliver of the next one showing.
    const geometry = measure();
    const step = geometry.step || el.clientWidth * 0.8;
    const setWidth = loop ? geometry.period : 0;
    const start = el.scrollLeft;
    const target = start + step * direction;
    const distance = target - start;
    const duration = 320;

    // Suppress onScroll's normalise() and hold snap off for the whole animation.
    normalising.current = true;
    el.style.scrollSnapType = "none";
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    let startTime: number | null = null;
    const tick = (now: number) => {
      if (startTime == null) startTime = now;
      const t = Math.min(1, (now - startTime) / duration);
      el.scrollLeft = start + distance * ease(t);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
        return;
      }
      el.scrollLeft = target;
      // Fold the wrap into the landing: if we ran past either seam, hop by one
      // whole copy so the next click still has room on both sides.
      if (loop && setWidth > 0) {
        if (el.scrollLeft < setWidth * 0.5) el.scrollLeft += setWidth;
        else if (el.scrollLeft > setWidth * 1.5) el.scrollLeft -= setWidth;
      }
      el.style.scrollSnapType = "";
      animRef.current = null;
      normalising.current = false;
      sync();
    };
    animRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
  }, []);

  /* Only when there is somewhere to go: a row that fits its container has
     nothing to advance to, and stepping it would just fight the snap. Reuses
     nudge() so an automatic step is the same motion as a click on the arrow —
     including the loop wrap, so it never walks into the end and stalls. */
  const autoRef = useAutoAdvance(() => nudge(1), { count: childCount, enabled: overflows });

  const onScroll = () => { sync(); normalise(); };

  return (
    <div className="scroll-rail" ref={autoRef}>
      <div ref={ref} className={className} style={style} onScroll={onScroll} tabIndex={0} role="region" aria-label={ariaLabel}>
        {/* Three copies, keyed per copy so the cards' own keys never collide.
            Fragments emit no DOM, so each card stays a direct flex child. */}
        <Fragment key="a">{children}</Fragment>
        {loop && <Fragment key="b">{children}</Fragment>}
        {loop && <Fragment key="c">{children}</Fragment>}
      </div>
      {overflows && (
        <div className="scroll-rail-controls">
          <button
            type="button"
            className="scroll-rail-btn"
            onClick={() => nudge(-1)}
            aria-label={ariaLabel + " — previous"}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="scroll-rail-btn"
            onClick={() => nudge(1)}
            aria-label={ariaLabel + " — next"}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
