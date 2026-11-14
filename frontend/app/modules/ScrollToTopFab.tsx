"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { overlapsInteractiveTarget } from "./interactiveTargetGeometry";

export default function ScrollToTopFab() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [obstructed, setObstructed] = useState(false);

  useEffect(() => {
    setMounted(true);
    function onScroll() {
      setVisible(window.scrollY > 300);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!visible) {
      setObstructed(false);
      return;
    }

    let frame = 0;
    const updateObstruction = () => {
      frame = 0;
      const button = buttonRef.current;
      if (!button) return;
      const controlRect = button.getBoundingClientRect();
      const targets = document.querySelectorAll<HTMLElement>(
        'a[href], button:not(.scroll-to-top-fab), input:not([type="hidden"]), select, textarea, [role="button"], [aria-modal="true"], dialog[open]',
      );
      const next = Array.from(targets).some((target) => {
        if (target === button || button.contains(target) || target.closest("[aria-hidden='true'], [inert]")) return false;
        if (target.matches(":disabled") || target.getAttribute("aria-disabled") === "true") return false;
        const style = getComputedStyle(target);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = target.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && overlapsInteractiveTarget(controlRect, rect);
      });
      setObstructed((current) => current === next ? current : next);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateObstruction);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-hidden", "aria-modal", "class", "inert", "open", "style"],
      childList: true,
      subtree: true,
    });
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(document.documentElement);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [visible]);

  if (!mounted || !visible) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      className="scroll-to-top-fab"
      aria-label="Back to top"
      aria-hidden={obstructed || undefined}
      tabIndex={obstructed ? -1 : 0}
      style={obstructed ? { visibility: "hidden", pointerEvents: "none" } : undefined}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp size={20} />
    </button>
  );
}
