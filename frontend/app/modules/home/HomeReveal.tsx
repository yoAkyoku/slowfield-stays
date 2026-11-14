"use client";

import { useEffect } from "react";

/**
 * Scroll-reveal for the homepage: fades + lifts major sections (and any explicit
 * `.home-reveal` element) into view the first time they near the viewport. Pure
 * progressive enhancement — without JS everything is visible (the hide rule only
 * applies once `.home-reveal-ready` is set on <html>). Respects reduced-motion.
 */
const AUTO_SELECTORS = [
  ".site-home .home-stays-search-wrap",
  ".site-home .section",
  ".site-home .home-showcase-head",
  ".site-home .home-showcase-card",
  ".site-home .home-showcase-foot",
  // Cards arrive one after another inside their (already revealed) section.
  ".site-home .stay-card",
  ".site-home .home-pathway-card",
].join(",");

export default function HomeReveal() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    document.documentElement.classList.add("home-reveal-ready");

    const targets = new Set<Element>();
    document.querySelectorAll(".home-reveal").forEach((el) => targets.add(el));
    document.querySelectorAll(AUTO_SELECTORS).forEach((el) => {
      el.classList.add("home-reveal");
      targets.add(el);
    });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );

    targets.forEach((el) => {
      // Stagger only within sibling groups (cards); sections use index 0.
      const parent = el.parentElement;
      const group = ["home-showcase-card", "stay-card", "home-pathway-card"].find((c) => el.classList.contains(c));
      if (parent && group) {
        const sibs = Array.from(parent.children).filter((c) => c.classList.contains(group));
        (el as HTMLElement).style.setProperty("--reveal-i", String(sibs.indexOf(el) % 4));
      }
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return null;
}
