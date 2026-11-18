"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import useCardGallery from "../useCardGallery";
import { galleryLabels } from "../galleryLabels";
import type { Stay } from "../api";
import type { Locale } from "../i18n";
import { shortAmenity, trs } from "../tr";
import { stayLocationLabel } from "../stayLocations";

export default function StayCard({
  stay,
  detailsLabel,
  locale = "en",
  detailHref,
  tags,
}: {
  stay: Stay;
  detailsLabel: string;
  locale?: Locale;
  detailHref?: string;
  /** Localised tags from the CMS entry. Omitted when the block has 顯示標籤 off. */
  tags?: string[];
}) {
  const stayName = trs(stay, "name", locale);
  const staySummary = trs(stay, "summary", locale);
  const destinationLine = stayLocationLabel(stay, locale);
  /* The hero first, then the gallery, each photo once. A photo whose URL does
     not resolve is dropped by useCardGallery, so a card whose covers 404 shows
     its placeholder instead of blank frames. next/image is what lets that work
     for an image that failed before React hydrated: passing onError makes Next
     re-assign img.src on mount so the error fires again. */
  const photos = useMemo(() => {
    const images = stay.images?.map((image) => ({ src: image.image_url, alt: image.alt_text || stayName })) ?? [];
    if (!images.length || images[0]?.src !== stay.hero_image_url) {
      images.unshift({ src: stay.hero_image_url, alt: stayName });
    }
    return images.filter((image, index, array) => image.src && array.findIndex((item) => item.src === image.src) === index);
  }, [stay.hero_image_url, stay.images, stayName]);
  const { gallery, activeIndex, userDriven, onStep, onSelect, autoRef, swipeHandlers, markFailed } = useCardGallery(photos);
  const labels = galleryLabels(locale === "zh");

  // Child-matched stays redirect to the child site at /stays/{slug}; route their
  // cards to /stays/detail/{slug} so the full parent detail page shows instead.
  const stayHref = detailHref ?? `/stays/${stay.slug}`;

  return (
    <article className="stay-card">
      <div
        className="stay-card-media"
        ref={autoRef}
        {...swipeHandlers}
      >
        {/* Clicking the photo navigates too, not only the white body below
            (客戶: 按下圖片就會跳轉). An overlay link sits above the images but
            below the gallery controls (higher z-index), so prev/next/dots still
            change the photo instead of following the link. Hidden from the a11y
            tree — the body link already names the destination. */}
        <Link
          className="stay-card-media-link"
          href={stayHref}
          aria-hidden="true"
          tabIndex={-1}
        />
        {/* A stay with neither a hero image nor a gallery left this frame empty:
            a beige 4:3 panel (4:5 on /stays) with nothing in it, which is what
            「它上面有放空白照片」 describes. The card itself has to stay — a stay
            with no photos yet is still a stay someone can book — so it gets the
            same drawn placeholder every other card in the site uses for a
            missing cover, rather than a blank box or no frame at all. */}
        {gallery.length === 0 && <span className="card-cover-empty" aria-hidden="true" />}
        {gallery.map((image, index) => (
          <Image
            /* Keyed on the src alone. It used to carry the index too, which was
               harmless while the list never changed and is not now: dropping a
               404 shifts every later index, so React saw new keys, unmounted
               the surviving photos and mounted fresh ones. That cancels their
               in-flight requests, and a cancelled request fires `error` on the
               <img> exactly as a missing file does — so removing one broken
               photo blacklisted the good ones behind it. The srcs are already
               deduplicated above, so they are keys on their own. */
            key={image.src}
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            loading={index === 0 ? "eager" : "lazy"}
            onError={(event) => markFailed(image.src, event.currentTarget)}
            className={`stay-card-image${index === activeIndex ? " is-active" : ""}`}
          />
        ))}
        {gallery.length > 1 ? (
          <>
            <div className="stay-card-gallery-controls">
              <button type="button" aria-label={labels.previous} onClick={(event) => onStep(event, -1)}>
                <ChevronLeft size={18} />
              </button>
              <button type="button" aria-label={labels.next} onClick={(event) => onStep(event, 1)}>
                <ChevronRight size={18} />
              </button>
            </div>
            {/* role="group", because an aria-label on a plain <div> names
                nothing — the div has no role for the name to attach to, so the
                label was dropped and the dots arrived as a bare row of buttons.
                Same pairing as StayShowcaseCard's dots. */}
            <div className="stay-card-gallery-dots" role="group" aria-label={labels.group}>
              {gallery.map((image, index) => (
                <button
                  key={`${image.src}-dot-${index}`}
                  type="button"
                  aria-label={labels.photo(index + 1)}
                  /* Which photo is showing. aria-selected is not supported on a
                     button and there is no tablist here, so aria-current is the
                     one that actually reaches a screen reader. */
                  aria-current={index === activeIndex}
                  className={index === activeIndex ? "is-active" : ""}
                  onClick={(event) => onSelect(event, index)}
                />
              ))}
            </div>
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {userDriven ? labels.status(activeIndex + 1, gallery.length) : ""}
            </div>
          </>
        ) : null}
      </div>
      <Link className="stay-card-link" href={stayHref} aria-label={`${detailsLabel}: ${stayName}`}>
        <div className="stay-card-body">
          <div className="stay-card-copy">
            {/* Above the title, where the news card already puts its category
                (client: 卡片上的 tags 顯示在上方) — a row of tags read after the
                summary as an afterthought rather than as what the card is. */}
            {tags && tags.length > 0 && (
              <div className="tags tags--lead">
                {tags.slice(0, 4).map((tag) => <span className="tag" key={tag}>{shortAmenity(tag, locale)}</span>)}
              </div>
            )}
            <h3>{stayName}</h3>
            <div className="meta">{destinationLine}</div>
            <p>{staySummary}</p>
          </div>
          <strong className="stay-card-cta">{detailsLabel}</strong>
        </div>
      </Link>
    </article>
  );
}
