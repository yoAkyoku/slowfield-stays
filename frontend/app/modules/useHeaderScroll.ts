"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * What a site header needs to know about the page under it.
 *
 * The brand header and the villa header each carried a copy of both effects,
 * and the copies drifted (one read `autoHide` once at mount and ignored later
 * changes). One hook now.
 *
 *   · `scrolled`: past the first 60px, so the bar turns solid.
 *   · `hidden`: with `autoHide` on, the bar slides away on scroll down and comes
 *     back on scroll up; small deltas are ignored so trackpad jitter does not
 *     flicker it, and near the top it always shows. Off, it never hides — a nav
 *     that is reachable at any scroll position is what the client asked for.
 *   · `heightVar`: the header's real height is published as this CSS variable,
 *     so a hero can sit exactly under it however tall the logo makes the bar.
 */
export default function useHeaderScroll(
  headerRef: RefObject<HTMLElement | null>,
  { autoHide = false, heightVar }: { autoHide?: boolean; heightVar: string },
) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 60);
      if (autoHide) {
        if (y > lastY + 4 && y > 120) setHidden(true);
        else if (y < lastY - 4 || y < 120) setHidden(false);
      } else {
        setHidden(false);
      }
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [autoHide]);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty(heightVar, `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [headerRef, heightVar]);

  return { scrolled, hidden };
}
