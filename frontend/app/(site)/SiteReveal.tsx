"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll-reveal for the inner content pages (brand / journal / dining / activity
 * / experience / contact / stays index). Mirrors the homepage's HomeReveal so the
 * whole site shares one calm fade-and-lift motion (the "互動感" brief), but skips
 * the homepage itself (HomeReveal owns that) and never touches page heroes — those
 * sit above the fold and should appear instantly. Pure progressive enhancement:
 * the hide rule only applies once `.home-reveal-ready` is set on <html>, and the
 * whole thing is disabled under prefers-reduced-motion.
 */
/**
 * What to reveal, checked against what the site actually renders.
 *
 * Ten of the fifteen entries this list used to carry — .activity-seasonal-strip,
 * .journal-grid, .dining-highlights, .dining-stories, .dining-grid-section,
 * .brand-stories, .experience-opening, .experience-philosophy,
 * .contact-form-shell and .page-cta — named classes NO component in app/ emits,
 * on any page. They were left behind when the per-category page components were
 * replaced by the shared ContentFacets/CategoryPage pair, and a selector that
 * matches nothing fails silently: the list looked like it covered the whole
 * site while /contact got zero targets and every content index got exactly one.
 *
 * Each entry below is a class some component renders. The three that were
 * measured empty on the live pages are kept on purpose — ContentFacets renders
 * them for its "featured" and "magazine" layouts, which no page is set to right
 * now but the editor can choose at any time.
 */
const SELECTORS = [
  // Content indexes (/brand /curation /dining /journal /news /privacy) —
  // CategoryPage's <main class="content-index">. The hero is a section too and
  // is dropped below, so this reveals the browse section.
  ".content-index > section",
  // ContentFacets' larger layouts, inside that section.
  ".activity-featured",
  ".journal-feature",
  ".journal-magazine",
  // The stays index.
  ".stays-index-body",
  // /contact is built from admin blocks, not from a hand-written layout, so it
  // has none of the classes above — it renders BlockWrapper's own
  // property-block-contained / -full-bleed, and blockPairs' property-block-pair.
  // Scoped to .contact-page so this stays a fix for the page that measured zero
  // and does not start animating every villa page as a side effect.
  ".contact-page > .property-block-contained",
  ".contact-page > .property-block-full-bleed",
  ".contact-page > .property-block-pair",
].join(",");

export default function SiteReveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Homepage is handled by HomeReveal; bail to avoid double-observing.
    if (document.querySelector("main.site-home")) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    document.documentElement.classList.add("home-reveal-ready");

    const targets = new Set<Element>();
    document.querySelectorAll(SELECTORS).forEach((el) => {
      if (el.closest('[class*="hero"]')) return; // never hide hero content
      el.classList.add("home-reveal");
      targets.add(el);
    });
    if (!targets.size) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
