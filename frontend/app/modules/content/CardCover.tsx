"use client";

import { useCallback, useState, type ReactNode } from "react";

/**
 * The image area of a content card.
 *
 * An entry with no cover used to render no image at all, so one text-only card
 * sat in a row of photographed ones and the grid lost its rhythm — and, since
 * the frame was missing rather than empty, the card was shorter than its
 * neighbours too.
 *
 * The placeholder is deliberately quiet: it stands in for a photograph, so it
 * should read as "no picture yet" rather than compete with the real ones. It is
 * drawn in CSS, which means it can never 404 and needs no upload before a new
 * entry looks finished.
 *
 * It also stands in for a cover that HAS a URL and does not resolve, which is
 * the case this component used to miss: `src` being a non-empty string was
 * taken as proof there was a picture, so a deleted or renamed upload rendered a
 * broken <img> — a blank frame, indistinguishable from one still loading, and
 * not the placeholder that exists for exactly this hole. Media outlives the
 * entries that point at it; a 404 here is an ordinary state, not an exception.
 */
export default function CardCover({
  src,
  alt,
  className,
  children,
}: {
  src?: string | null;
  alt: string;
  className: string;
  /** Laid over the picture, e.g. a category label. */
  children?: ReactNode;
}) {
  /* Which src failed, not a bare "it failed": the flag has to be about a
     particular URL, or a card handed a new cover would stay on the placeholder
     because its previous one was broken. */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const broken = Boolean(src) && failedSrc === src;

  /* An <img> rendered on the server can fail before React hydrates, and the
     error event is gone by the time a handler is attached — `onError` alone
     catches only the images that fail after hydration, which on a fast local
     backend is none of them. next/image works around this by re-assigning
     `img.src` on mount; a plain <img> can just be asked, because a decoded
     image is `complete` with a non-zero `naturalWidth` and a broken one is
     `complete` with zero.

     A ref callback rather than an effect: it runs with the element in hand, and
     re-runs when React swaps the node (a different `src` remounts it). */
  const check = useCallback((img: HTMLImageElement | null) => {
    if (src && img?.complete && img.naturalWidth === 0) setFailedSrc(src);
  }, [src]);

  return (
    <div className={className}>
      {src && !broken ? (
        <img
          key={src}
          src={src}
          alt={alt}
          loading="lazy"
          ref={check}
          /* Not every error event is a missing file: a load cancelled because
             the element left the document (a filter switching category, a
             route change) fires the same event, and treating that as a 404
             would swap a working photo for the placeholder. A cancelled load
             leaves the node detached; a refused one does not. */
          onError={(event) => { if (event.currentTarget.isConnected) setFailedSrc(src); }}
        />
      ) : (
        <span className="card-cover-empty" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}
