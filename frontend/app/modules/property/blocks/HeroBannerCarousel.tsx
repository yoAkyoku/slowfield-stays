"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Banner } from "../../api";
import type { Locale } from "../../i18n";
import { safeCssColor } from "../../fontPresets";
import { cssUrl } from "../../safeCss";
import { isVideoUrl, preloadImageUrl, videoPosterUrl } from "../../media";

function trsLocal(banner: Banner, key: "title" | "subtitle", locale: Locale): string {
  const t = banner.translations?.[locale]?.[key];
  if (typeof t === "string" && t.trim()) return t;
  // Top-level title/subtitle are the default-locale source on the Banner row.
  const fallback = (banner as Banner & Record<string, unknown>)[key];
  return typeof fallback === "string" ? fallback : "";
}

const HEIGHT_MAP: Record<string, string> = {
  small: "320px",
  medium: "clamp(320px, 55vh, 600px)",
  large: "clamp(400px, 75vh, 850px)",
  full: "100vh",
};

export default function HeroBannerCarousel({
  banners,
  locale,
  height,
  titleColor,
  subtitleColor,
  intervalMs = 6500,
}: {
  banners: Banner[];
  locale: Locale;
  height?: string;
  titleColor?: string;
  subtitleColor?: string;
  intervalMs?: number;
}) {
  // Caller (BlockHeroBanner) already filtered out image-less banners.
  const slides = banners;
  const [active, setActive] = useState(0);
  const previousActiveRef = useRef<number | null>(null);

  const goTo = useCallback((nextIndex: number) => {
    if (slides.length < 1) return;
    setActive((current) => {
      previousActiveRef.current = current;
      return (nextIndex + slides.length) % slides.length;
    });
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    if (isVideoUrl(slides[active]?.image_url)) return;
    const t = window.setTimeout(() => goTo(active + 1), intervalMs);
    return () => window.clearTimeout(t);
  }, [active, goTo, slides, intervalMs]);

  /* Keep the first screen light: hidden carousel slides used to attach all of
     their background URLs immediately. Warm only the next still or video
     poster after the active slide has had a chance to paint. */
  useEffect(() => {
    if (slides.length < 2) return;
    const next = slides[(active + 1) % slides.length];
    const nextUrl = next
      ? (isVideoUrl(next.image_url) ? videoPosterUrl(next.image_url) : next.image_url)
      : "";
    if (!nextUrl) return;
    const timer = window.setTimeout(() => preloadImageUrl(nextUrl), 800);
    return () => window.clearTimeout(timer);
  }, [active, slides]);

  if (slides.length === 0) return null;

  /* One allow-list for both uses. The value is interpolated into a class name
     below, and an unchecked string with a space in it attaches arbitrary
     classes out of a 36,000-line stylesheet to the hero. The page-hero path
     allow-lists hero_height at the save for exactly this reason; the block path
     did not, at either end. */
  const heightKey = height && Object.prototype.hasOwnProperty.call(HEIGHT_MAP, height) ? height : "";
  const minHeight = heightKey ? HEIGHT_MAP[heightKey] : undefined;
  const sectionStyle: CSSProperties = {};
  if (minHeight) sectionStyle.minHeight = minHeight;
  const safeTitleColor = safeCssColor(titleColor);
  const safeSubtitleColor = safeCssColor(subtitleColor);

  return (
    <section className={`property-hero-banner property-hero-banner--carousel${heightKey ? ` property-hero-banner--h-${heightKey}` : ""}`} style={Object.keys(sectionStyle).length ? sectionStyle : undefined}>
      {slides.map((b, i) => (
        <div
          key={b.id}
          className={`property-hero-banner-slide${i === active ? " is-active" : ""}`}
          style={(i === active || i === previousActiveRef.current) && !isVideoUrl(b.image_url)
            ? { backgroundImage: cssUrl(b.image_url) }
            : undefined}
          aria-hidden={i === active ? undefined : true}
        >
          {isVideoUrl(b.image_url) && i === active && (
            <video
              src={b.image_url}
              autoPlay
              muted
              loop={slides.length <= 1}
              playsInline
              preload="auto"
              onEnded={() => slides.length > 1 && goTo(active + 1)}
              onError={() => slides.length > 1 && goTo(active + 1)}
            />
          )}
        </div>
      ))}
      <div className="property-hero-banner-content">
        {slides.map((b, i) => {
          const title = trsLocal(b, "title", locale);
          const subtitle = trsLocal(b, "subtitle", locale);
          return (
            <div
              key={b.id}
              className={`property-hero-banner-copy${i === active ? " is-active" : ""}`}
              // Every slide repeats the same title, so without this a screen
              // reader announced the page heading once per slide.
              aria-hidden={i === active ? undefined : true}
            >
              {/* Only the first slide's title is the page heading; the rest are
                  the same words again, styled identically via the class. */}
              {title && (i === 0 ? (
                <h1 className="property-hero-banner-title" style={safeTitleColor ? { color: safeTitleColor } : undefined}>{title}</h1>
              ) : (
                <p className="property-hero-banner-title" style={safeTitleColor ? { color: safeTitleColor } : undefined}>{title}</p>
              ))}
              {subtitle && <p className="property-hero-banner-subtitle" style={safeSubtitleColor ? { color: safeSubtitleColor } : undefined}>{subtitle}</p>}
            </div>
          );
        })}
      </div>
      {slides.length > 1 && (
        <div className="property-hero-banner-dots" role="tablist">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`slide ${i + 1}`}
              className={i === active ? "is-active" : ""}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
