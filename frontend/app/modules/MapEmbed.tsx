"use client";

import { useState } from "react";
import type { Locale } from "./i18n";
import { mapSrcForLocale } from "./safeHtml";

/**
 * Google Maps iframe wrapper. By default a transparent shield sits over the
 * iframe so scrolling the page over the map scrolls the page (instead of the
 * Google embed hijacking the wheel to zoom). Click once to activate panning/zoom.
 */
export default function MapEmbed({
  src,
  title,
  locale = "zh",
  className = "",
  brandName,
  brandMeta,
  externalUrl,
}: {
  src: string;
  title?: string;
  locale?: Locale;
  className?: string;
  brandName?: string;
  brandMeta?: string;
  externalUrl?: string;
}) {
  const [active, setActive] = useState(false);
  const isBranded = Boolean(brandName || brandMeta);
  // Google draws the labels, so the language has to be asked for on the URL.
  const localisedSrc = mapSrcForLocale(src, locale);
  return (
    <div className={`map-embed-wrap${active ? " is-active" : ""}${isBranded ? " is-branded" : ""} ${className}`.trim()}>
      <iframe
        /* Keyed on the src so a locale switch remounts the frame — Google reads
           hl at load, and a plain attribute change leaves the old language up. */
        key={localisedSrc}
        src={localisedSrc}
        title={title || "Map"}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        style={{ pointerEvents: active ? "auto" : "none" }}
      />
      {isBranded && (
        <div className="map-brand-stamp" aria-hidden="true">
          <span className="map-brand-stamp-mark">S</span>
          <span className="map-brand-stamp-copy">
            {brandName && <strong>{brandName}</strong>}
            {brandMeta && <small>{brandMeta}</small>}
          </span>
        </div>
      )}
      {externalUrl && (
        <a
          className="map-brand-link"
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {locale === "zh" ? "在 Google 地圖開啟" : "Open in Google Maps"}
          <span aria-hidden="true">↗</span>
        </a>
      )}
      {!active && (
        <button
          type="button"
          className="map-embed-shield"
          onClick={() => setActive(true)}
          aria-label={locale === "zh" ? "查看地圖位置" : "View location on the map"}
        >
          <span>{locale === "zh" ? "查看地圖位置" : "View location"}</span>
        </button>
      )}
    </div>
  );
}
