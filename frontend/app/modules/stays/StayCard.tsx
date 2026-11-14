"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import useAutoAdvance from "../useAutoAdvance";
import { swipeDirection, swipePoint, type SwipePoint } from "../swipe";
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
  /**
   * Photos whose URL exists and does not resolve.
   *
   * `gallery` below already drops a stay with no photos onto the drawn
   * placeholder, but "has a URL" and "has a photo" are not the same thing: on
   * the homepage four `/storage/media/*.jpg` covers 404 and the card rendered
   * four 575×431 blank frames — a broken <img> with `fill` has no intrinsic
   * size, so it collapses to a transparent rectangle inside the media box and
   * leaves exactly the empty panel the placeholder exists to prevent. Nothing
   * distinguished it from a card that was still loading.
   *
   * A failed src is taken out of the gallery, so the count that drives the
   * arrows, the dots and the autoplay is the count of photos that can actually
   * be shown; when every one of them fails the gallery empties and the same
   * `.card-cover-empty` a photo-less stay gets is drawn instead.
   *
   * next/image is what makes this work for an image that failed BEFORE React
   * hydrated — the error event is long gone by then, and passing `onError`
   * makes Next re-assign `img.src` on mount so it fires again. That is why the
   * handler is on <Image> rather than a plain <img>.
   */
  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);
  const stayName = trs(stay, "name", locale);
  const staySummary = trs(stay, "summary", locale);
  const destinationLine = stayLocationLabel(stay, locale);
  const gallery = useMemo(() => {
    const images = stay.images?.map((image) => ({ src: image.image_url, alt: image.alt_text || stayName })) ?? [];
    if (!images.length || images[0]?.src !== stay.hero_image_url) {
      images.unshift({ src: stay.hero_image_url, alt: stayName });
    }
    return images
      .filter((image, index, array) => image.src && array.findIndex((item) => item.src === image.src) === index)
      .filter((image) => !failedSrcs.includes(image.src));
  }, [stay.hero_image_url, stay.images, stayName, failedSrcs]);
  /* What the reader picked, and what is actually on screen.
   *
   * They used to be one number, and can no longer be: the gallery shrinks when
   * a photo turns out to be missing, and a card showing its third photo when
   * the first two 404 would index past the end of the shortened list and show
   * none of them. The selection is kept as given — the arrows count from it —
   * and `activeIndex` is that selection folded back into the photos that exist,
   * which is what the markup below (and the live region, and the dots) means
   * when it says which image is showing. */
  const [selectedIndex, setActiveIndex] = useState(0);
  const activeIndex = gallery.length ? selectedIndex % gallery.length : 0;

  /**
   * Did the reader ask for this photo, or did the timer bring it?
   *
   * The live region below used to be written on every change, and the change
   * that happens most is the 3-second autoplay tick — with three of these cards
   * on the homepage that is an interruption every second, about something the
   * screen-reader user never asked for and cannot see. A live region is for
   * reporting the result of an action; only the two handlers that ARE an action
   * arm it, and the timer disarms it, so the region goes quiet between clicks
   * instead of narrating a slideshow.
   *
   * Read during render on purpose: it is set immediately before the state
   * update that causes that render, so the flag and the index it describes are
   * always committed together.
   */
  const userDrivenRef = useRef(false);

  /* One step through the gallery, however it was asked for. The arrows and the
     swipe are the same action to everything downstream — both are a reader
     choosing a photo, so both arm the live region. */
  function step(direction: number) {
    userDrivenRef.current = true;
    setActiveIndex((current) => (current + direction + gallery.length) % gallery.length);
  }

  function move(event: React.MouseEvent<HTMLButtonElement>, direction: number) {
    event.preventDefault();
    event.stopPropagation();
    step(direction);
  }

  /* Swipe. The arrows are the only manual control on a phone, and they sit under
     the overlay link at the corners of the photo — 客戶: 手機版沒有滑動功能.
     useAutoAdvance already holds its timer for the length of a touch and starts
     a fresh interval on touchend, so the swiped-to photo gets a full turn
     without anything extra here. */
  const touchRef = useRef<SwipePoint | null>(null);
  /* `.stay-card-media-link` covers the whole photo so that tapping it opens the
      stay. A swipe ends with a synthesised click, which that link would follow —
      so a drag across the picture would navigate instead of changing the photo.
      Cleared on the next touchstart, so a genuine tap after a swipe still
      opens the stay. */
  const swipedRef = useRef(false);

  const autoRef = useAutoAdvance(
    () => {
      userDrivenRef.current = false;
      setActiveIndex((current) => (current + 1) % gallery.length);
    },
    { count: gallery.length },
  );

  function selectImage(event: React.MouseEvent<HTMLButtonElement>, index: number) {
    event.preventDefault();
    event.stopPropagation();
    userDrivenRef.current = true;
    setActiveIndex(index);
  }

  // Child-matched stays redirect to the child site at /stays/{slug}; route their
  // cards to /stays/detail/{slug} so the full parent detail page shows instead.
  const stayHref = detailHref ?? `/stays/${stay.slug}`;

  return (
    <article className="stay-card">
      <div
        className="stay-card-media"
        ref={autoRef}
        onTouchStart={(event) => {
          swipedRef.current = false;
          touchRef.current = gallery.length > 1 ? swipePoint(event.touches[0]) : null;
        }}
        onTouchEnd={(event) => {
          if (!touchRef.current) return;
          const direction = swipeDirection(touchRef.current, swipePoint(event.changedTouches[0]));
          touchRef.current = null;
          if (!direction) return;
          swipedRef.current = true;
          step(direction);
        }}
        /* Capture, so the click is stopped before the overlay link acts on it. */
        onClickCapture={(event) => {
          if (!swipedRef.current) return;
          event.preventDefault();
          event.stopPropagation();
        }}
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
            onError={(event) => {
              /* A load that was cancelled rather than refused. The event is the
                 same one; what differs is that the element is on its way out of
                 the document, so there is no photo here to have failed. Taking
                 the src out of the gallery on that would hide a working photo
                 for the rest of the session. */
              if (!event.currentTarget.isConnected) return;
              setFailedSrcs((current) => (current.includes(image.src) ? current : [...current, image.src]));
            }}
            className={`stay-card-image${index === activeIndex ? " is-active" : ""}`}
          />
        ))}
        {gallery.length > 1 ? (
          <>
            <div className="stay-card-gallery-controls">
              <button type="button" aria-label="Previous image" onClick={(event) => move(event, -1)}>
                <ChevronLeft size={18} />
              </button>
              <button type="button" aria-label="Next image" onClick={(event) => move(event, 1)}>
                <ChevronRight size={18} />
              </button>
            </div>
            {/* role="group", because an aria-label on a plain <div> names
                nothing — the div has no role for the name to attach to, so the
                label was dropped and the dots arrived as a bare row of buttons.
                Same pairing as StayShowcaseCard's dots. */}
            <div className="stay-card-gallery-dots" role="group" aria-label="Stay image gallery">
              {gallery.map((image, index) => (
                <button
                  key={`${image.src}-dot-${index}`}
                  type="button"
                  aria-label={`Image ${index + 1}`}
                  /* Which photo is showing. aria-selected is not supported on a
                     button and there is no tablist here, so aria-current is the
                     one that actually reaches a screen reader. */
                  aria-current={index === activeIndex}
                  className={index === activeIndex ? "is-active" : ""}
                  onClick={(event) => selectImage(event, index)}
                />
              ))}
            </div>
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {userDrivenRef.current ? `Image ${activeIndex + 1} of ${gallery.length}` : ""}
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
