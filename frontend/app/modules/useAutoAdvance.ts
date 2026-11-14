"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Advance a carousel on a timer, and get out of the way the moment someone is
 * actually using it.
 *
 * Returns a ref to put on the carousel's container. Everything that suspends
 * the timer is a form of "this one is not idle":
 *
 *   · pointer over it, or focus inside it — the visitor is reading or aiming
 *     at a control, and moving the slide under them is the classic carousel
 *     annoyance
 *   · a touch in progress — the same, for a finger
 *   · scrolled out of view — a page carries several of these and the ones
 *     nobody can see should not be doing work or racing ahead of the visible one
 *   · the tab is hidden — timers keep firing in a background tab, so a rail
 *     left alone for a minute would otherwise jump many cards at once on return
 *   · prefers-reduced-motion — for a reader who has asked the OS for less
 *     movement, the honest answer is no movement, not slower movement
 *
 * `advance` is read through a ref so a caller can pass an inline closure over
 * fresh state without restarting the interval on every render.
 */
export default function useAutoAdvance(
  advance: () => void,
  { count, delay = 3000, enabled = true }: { count: number; delay?: number; enabled?: boolean },
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /* Reasons to be stopped, not a single boolean: hover and off-screen can
     overlap, and clearing one must not restart the timer while the other
     still holds. */
  const holds = useRef<Set<string>>(new Set());

  const stop = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (timerRef.current != null || holds.current.size > 0) return;
    timerRef.current = setInterval(() => advanceRef.current(), delay);
  }, [delay]);

  const hold = useCallback((reason: string, on: boolean) => {
    if (on) {
      holds.current.add(reason);
      stop();
    } else {
      holds.current.delete(reason);
      start();
    }
  }, [start, stop]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled || count < 2) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const enter = () => hold("pointer", true);
    const leave = () => hold("pointer", false);
    const focusIn = () => hold("focus", true);
    const focusOut = () => hold("focus", false);
    const touchStart = () => hold("touch", true);
    const touchEnd = () => hold("touch", false);
    const visibility = () => hold("hidden", document.hidden);

    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    el.addEventListener("focusin", focusIn);
    el.addEventListener("focusout", focusOut);
    el.addEventListener("touchstart", touchStart, { passive: true });
    el.addEventListener("touchend", touchEnd, { passive: true });
    el.addEventListener("touchcancel", touchEnd, { passive: true });
    document.addEventListener("visibilitychange", visibility);

    /* Starts held: a carousel below the fold should not be advancing before
       anyone has reached it. The observer releases the hold on first sight.
       Captured here so the cleanup clears the same Set this effect filled,
       not whatever the ref points at by then. */
    const activeHolds = holds.current;
    activeHolds.add("offscreen");
    const io = new IntersectionObserver(
      ([entry]) => hold("offscreen", !entry.isIntersecting),
      { threshold: 0.25 },
    );
    io.observe(el);

    return () => {
      stop();
      activeHolds.clear();
      io.disconnect();
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
      el.removeEventListener("focusin", focusIn);
      el.removeEventListener("focusout", focusOut);
      el.removeEventListener("touchstart", touchStart);
      el.removeEventListener("touchend", touchEnd);
      el.removeEventListener("touchcancel", touchEnd);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [count, delay, enabled, hold, start, stop]);

  return containerRef;
}
