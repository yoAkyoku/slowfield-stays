"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "../../i18n";
import { swipeDirection, swipePoint, type SwipePoint } from "../../swipe";

export default function AboutImageCarousel({
  images,
  title,
  locale,
}: {
  images: Array<{ url: string; alt?: string }>;
  title: string;
  locale: Locale;
}) {
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);
  const touchStart = useRef<SwipePoint | null>(null);
  const count = images.length;

  const goTo = useCallback((index: number) => {
    setCurrent((index + count) % count);
  }, [count]);

  useEffect(() => {
    setCurrent((index) => Math.min(index, Math.max(0, count - 1)));
  }, [count]);

  useEffect(() => {
    if (count <= 1 || hovered) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;
    const timer = window.setTimeout(() => setCurrent((index) => (index + 1) % count), 6500);
    return () => window.clearTimeout(timer);
  }, [count, current, hovered]);

  if (!count) return null;

  return (
    <div
      className="block-about-image block-about-carousel"
      role="region"
      aria-roledescription={locale === "zh" ? "圖片輪播" : "carousel"}
      aria-label={locale === "zh" ? `${title}圖片` : `${title} photos`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={(event) => {
        touchStart.current = swipePoint(event.touches[0]);
      }}
      onTouchEnd={(event) => {
        if (!touchStart.current) return;
        const direction = swipeDirection(touchStart.current, swipePoint(event.changedTouches[0]));
        if (direction) goTo(current + direction);
        touchStart.current = null;
      }}
    >
      {images.map((image, index) => (
        <div
          key={`${image.url}-${index}`}
          className={`block-about-carousel__slide${index === current ? " is-active" : ""}`}
          aria-hidden={index !== current}
          aria-roledescription={locale === "zh" ? "投影片" : "slide"}
          aria-label={`${index + 1} / ${count}`}
        >
          <img src={image.url} alt={image.alt || title} loading={index === 0 ? "eager" : "lazy"} />
        </div>
      ))}
    </div>
  );
}
