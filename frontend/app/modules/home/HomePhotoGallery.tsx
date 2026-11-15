"use client";

import { useEffect, useState } from "react";

/** One tile of the 相片拼貼牆. `caption` is already resolved to the reader's
 *  language by the caller — see BlockGallery. */
export type HomeGalleryImage = { url: string; caption?: string };

/** `wall` shows every photo at once as a grid of equal tiles; `carousel` shows
 *  one large photo at a time. */
export type HomeGalleryDisplay = "carousel" | "wall";

export default function HomePhotoGallery({ images, eyebrow, title, display = "carousel" }: { images: HomeGalleryImage[]; eyebrow: string; title: string; display?: HomeGalleryDisplay }) {
  const shown = images.slice(0, 8);
  const [index, setIndex] = useState(0);

  const wall = display === "wall";

  useEffect(() => {
    if (wall || shown.length <= 1) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % shown.length), 6000);
    return () => window.clearTimeout(timer);
  }, [index, shown.length, wall]);

  if (!shown.length) return null;

  if (wall) {
    return (
      <section className="section home-gallery-section">
        <div className="home-gallery-header">
          <div className="eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
        </div>
        <div className={`home-gallery-grid home-gallery-wall count-${Math.min(shown.length, 6)}`}>
          {shown.map((img, i) => (
            <figure className="home-gallery-item" key={i}>
              <img src={img.url} alt={img.caption || `${title} ${i + 1}`} loading="lazy" />
              {img.caption && <figcaption>{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </section>
    );
  }

  const currentIndex = index % shown.length;
  const go = (next: number) => setIndex((next + shown.length) % shown.length);

  return (
    <section className="section home-gallery-section">
      <div className="home-gallery-header">
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      <div
        className={`home-gallery-grid home-gallery-carousel count-${Math.min(shown.length, 6)}`}
        aria-roledescription="carousel"
        aria-label={title}
      >
        {shown.map((img, i) => (
          /* <figure>/<figcaption> is the pairing the other galleries already use
             (LightboxGallery, .page-block-gallery-grid), so 圖片說明 picks up the
             caption typography globals.css sets on `figcaption` without a class
             of its own. The caption also becomes the alt text when there is one:
             an editor-written description of the photo beats "標題 3".

             Needs two rules in globals.css that are not this file's to write:
             `.home-gallery-item` must clear the browser's default figure margin
             (1em/40px, which otherwise shrinks every tile inside its grid cell —
             .property-image-gallery-item clears it for the same reason), and the
             caption has to be placed inside the tile, whose row height is fixed
             at 240px with overflow: hidden, or it is clipped away unseen. */
          <figure
            className={`home-gallery-item${i === currentIndex ? " is-active" : ""}`}
            aria-hidden={i !== currentIndex}
            key={i}
          >
            <img src={img.url} alt={img.caption || `${title} ${i + 1}`} loading="lazy" />
            {img.caption && <figcaption>{img.caption}</figcaption>}
          </figure>
        ))}
        {shown.length > 1 && (
          <div className="home-gallery-controls">
            <button type="button" onClick={() => go(currentIndex - 1)} aria-label="Previous image">&#8592;</button>
            <span aria-live="polite">{currentIndex + 1} / {shown.length}</span>
            <button type="button" onClick={() => go(currentIndex + 1)} aria-label="Next image">&#8594;</button>
          </div>
        )}
      </div>
    </section>
  );
}
