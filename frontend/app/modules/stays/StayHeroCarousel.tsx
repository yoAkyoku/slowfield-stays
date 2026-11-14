"use client";

/** How many photos the detail-page hero rotates through. The editor says the
 *  same number, so the two cannot drift. */
export const HERO_SLIDES = 10;

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isVideoUrl } from "../media";
import { swipeDirection, swipePoint, type SwipePoint } from "../swipe";

type SlideItem = { url: string; alt: string };

export default function StayHeroCarousel({
  images,
  heroUrl,
  name
}: {
  images: { image_url: string; alt_text: string }[];
  heroUrl: string;
  name: string;
}) {
  const slides = useMemo(() => {
    const result: SlideItem[] = [];
    if (heroUrl) result.push({ url: heroUrl, alt: name });
    for (const img of images) {
      if (img.image_url && img.image_url !== heroUrl) {
        result.push({ url: img.image_url, alt: img.alt_text || name });
      }
      /* Was 5, with no cap and no hint in the editor — a stay with nine photos
         showed five and dropped the rest without a word (客戶: 它有限制說最多
         幾張，基本上好像可以放到十張左右). Ten is what the client already
         believed it was; the gallery further down the page still shows all. */
      if (result.length >= HERO_SLIDES) break;
    }
    return result;
  }, [images, heroUrl, name]);

  const len = slides.length;
  const [current, setCurrent] = useState(0);
  const touchRef = useRef<SwipePoint | null>(null);

  const go = useCallback(
    (dir: 1 | -1) => setCurrent((c) => (c + dir + len) % len),
    [len]
  );

  // Auto-advance
  useEffect(() => {
    if (len <= 1) return;
    if (isVideoUrl(slides[current]?.url)) return;
    /* 6500, with the other two hero carousels. Three different speeds on one
       site is what 速度好像不太一樣 was describing — this was the odd one. */
    const id = setTimeout(() => go(1), 6500);
    return () => clearTimeout(id);
  }, [current, len, go, slides]);

  if (slides.length === 0) return null;

  return (
    <div
      className="stay-hero-carousel"
      onTouchStart={(e) => {
        touchRef.current = swipePoint(e.touches[0]);
      }}
      onTouchEnd={(e) => {
        if (!touchRef.current) return;
        const direction = swipeDirection(touchRef.current, swipePoint(e.changedTouches[0]));
        if (direction) go(direction);
        touchRef.current = null;
      }}
    >
      {slides.map((slide, i) => (
        <div
          className={`stay-hero-slide${i === current ? " stay-hero-slide--active" : ""}`}
          key={slide.url}
          aria-hidden={i !== current}
        >
          {isVideoUrl(slide.url) && i === current ? (
            <video
              src={slide.url}
              autoPlay
              muted
              loop={slides.length <= 1}
              playsInline
              preload="auto"
              onEnded={() => len > 1 && go(1)}
              onError={() => len > 1 && go(1)}
            />
          ) : isVideoUrl(slide.url) ? (
            null
          ) : (
            <Image src={slide.url} alt={slide.alt} fill sizes="100vw" priority={i === 0} />
          )}
        </div>
      ))}
      {len > 1 && (
        <>
          <button className="stay-hero-nav stay-hero-nav--prev" onClick={() => go(-1)} aria-label="Previous">
            &#8249;
          </button>
          <button className="stay-hero-nav stay-hero-nav--next" onClick={() => go(1)} aria-label="Next">
            &#8250;
          </button>
          <div className="stay-hero-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`stay-hero-dot${i === current ? " stay-hero-dot--active" : ""}`}
                onClick={() => setCurrent(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            Slide {current + 1} of {len}
          </div>
        </>
      )}
    </div>
  );
}
