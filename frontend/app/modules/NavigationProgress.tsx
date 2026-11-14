"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const trickleRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const stop = useCallback(() => {
    if (trickleRef.current) clearInterval(trickleRef.current);
    trickleRef.current = undefined;
    setProgress(100);
    timerRef.current = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 300);
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (trickleRef.current) clearInterval(trickleRef.current);
    setActive(true);
    setProgress(15);
    trickleRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        return p + (90 - p) * 0.08;
      });
    }, 200);
  }, []);

  useEffect(() => {
    stop();
  }, [pathname, searchParams, stop]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return;
      if (anchor.target === "_blank") return;
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      start();
    }

    function onSubmit() {
      start();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [start]);

  if (!active) return null;

  return (
    <div
      className="nav-progress-bar"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      style={{ transform: `scaleX(${progress / 100})` }}
    />
  );
}
