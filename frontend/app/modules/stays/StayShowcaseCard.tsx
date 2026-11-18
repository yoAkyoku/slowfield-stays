"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import useCardGallery from "../useCardGallery";
import { galleryLabels } from "../galleryLabels";
import type { Locale } from "../i18n";

export type ShowcaseStay = {
  slug: string;
  number: string;       // "01", "02" …
  name: string;
  region?: string;
  summary?: string;
  tags: string[];       // localized short amenity labels
  images: string[];     // hero first, then gallery
  propertyHref: string; // 民宿官網
  bookHref: string;     // 立即訂房
};

/**
 * Premium featured-villa card: image carousel (arrows + dots when >1 image),
 * leading number, name / region / summary / tag chips, and two CTAs
 * (民宿官網 → property page, 立即訂房 → inquiry). Hover-lifts; reveals on scroll
 * via the .home-reveal observer.
 */
export default function StayShowcaseCard({
  stay,
  introLabel,
  bookLabel,
  locale,
}: {
  stay: ShowcaseStay;
  introLabel: string;
  bookLabel: string;
  locale: Locale;
}) {
  const zh = locale === "zh";
  const labels = galleryLabels(zh);
  /* The same strip as StayCard: swipe on a phone, and a photo that does not
     load is dropped rather than left as a blank frame. */
  const photos = useMemo(() => stay.images.map((src) => ({ src })), [stay.images]);
  const { gallery, activeIndex: i, onStep, onSelect, autoRef, swipeHandlers, markFailed } = useCardGallery(photos);
  const many = gallery.length > 1;

  return (
    <article className="home-showcase-card home-reveal">
      <div className="home-showcase-media" ref={autoRef} {...swipeHandlers}>
        {gallery.length > 0 ? (
          <Link href={stay.propertyHref} className="home-showcase-stage" aria-label={stay.name}>
            {gallery.map(({ src }, idx) => (
              /* An <img>, not a background, so a photo that fails to load says
                 so and can be taken out of the strip. */
              <img
                key={src}
                src={src}
                alt=""
                loading={idx === 0 ? "eager" : "lazy"}
                className={`home-showcase-slide${idx === i ? " is-active" : ""}`}
                aria-hidden={idx !== i}
                onError={(event) => markFailed(src, event.currentTarget)}
              />
            ))}
          </Link>
        ) : (
          <Link href={stay.propertyHref} className="home-showcase-stage is-empty" aria-label={stay.name} />
        )}
        {many && (
          <>
            <button type="button" className="home-showcase-nav home-showcase-nav--prev" aria-label={labels.previous} onClick={(event) => onStep(event, -1)}><ChevronLeft size={18} /></button>
            <button type="button" className="home-showcase-nav home-showcase-nav--next" aria-label={labels.next} onClick={(event) => onStep(event, 1)}><ChevronRight size={18} /></button>
            {/* group + aria-current, not tablist/aria-selected: these pick a photo
                in place, there is no tabpanel, and aria-selected is not supported
                on a button at all — so which dot was current reached a screen
                reader as nothing. */}
            <div className="home-showcase-dots" role="group" aria-label={labels.group}>
              {gallery.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`home-showcase-dot${idx === i ? " is-active" : ""}`}
                  aria-label={labels.photo(idx + 1)}
                  aria-current={idx === i}
                  onClick={(event) => onSelect(event, idx)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="home-showcase-body">
        <Link href={stay.propertyHref} className="home-showcase-name-link">
          <h3 className="home-showcase-name">{stay.name}</h3>
        </Link>
        {stay.region && <span className="home-showcase-loc">{stay.region}</span>}
        {stay.summary && <p className="home-showcase-summary">{stay.summary}</p>}
        {stay.tags.length > 0 && (
          <ul className="home-showcase-tags">
            {stay.tags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
        )}
        <div className="home-showcase-actions">
          <Link href={stay.propertyHref} className="home-showcase-btn home-showcase-btn--ghost">
            {introLabel}
          </Link>
          {/^https?:\/\//.test(stay.bookHref) ? (
            <a href={stay.bookHref} target="_blank" rel="noopener noreferrer" className="home-showcase-btn home-showcase-btn--solid">
              {bookLabel} <ArrowRight size={15} />
            </a>
          ) : (
            <Link href={stay.bookHref} className="home-showcase-btn home-showcase-btn--solid">
              {bookLabel} <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
