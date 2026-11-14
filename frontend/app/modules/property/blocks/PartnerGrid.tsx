"use client";

import { useState } from "react";

export type Partner = {
  name: string;
  desc: string;
  detail: string;
  logo: string;
  image: string;
  href: string;
};

/**
 * The partner list, with the detail opening in place.
 *
 * A card used to be a link straight to the partner's own site, so the only way
 * to find out who they were was to leave. Opening the detail here keeps the
 * visitor on the page and puts the outbound link at the end of the copy, where
 * it is a decision rather than the only affordance.
 *
 * A partner with nothing to expand stays a plain card (or a link, if that is
 * all it has), so the control never promises more than it holds.
 *
 * 代表照片 and 簡短說明 are rendered by the `cards` layout only, and that is the
 * design rather than an omission: a logo wall is a wall of marks. Its tiles are
 * laid out at a 150px floor (100px on a phone) around an 88px body with the
 * logo capped at 44px — a 4:3 photo and a sentence of copy do not go in there,
 * and putting them in would make the two layouts render the same thing, which
 * leaves 版面 with nothing to choose between. An editor who wants a picture and
 * a line of copy per partner already has that layout.
 *
 * The consequence to keep in mind is upstream, not here: the block form offers
 * both fields under either 版面, so on a logo wall they save and show nothing.
 * The fix belongs in the form (hide them when 版面 = Logo 牆), not in a renderer
 * that would have to break the wall to honour them.
 *
 * 詳細說明 stays available in both, because it is behind 了解更多 — a disclosure
 * the reader opens costs the wall no space until they ask for it.
 */
export default function PartnerGrid({
  items,
  layout,
  locale,
}: {
  items: Partner[];
  layout: "cards" | "logos";
  locale: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const zh = locale === "zh";

  return (
    <div className="property-partners-grid">
      {items.map((it, i) => {
        const expandable = Boolean(it.detail);
        const isOpen = open === i;

        const face = (
          <>
            {layout === "cards" && (it.image || it.logo) && (
              <div className="property-partner-img">
                <img src={it.image || it.logo} alt={it.name} loading="lazy" />
              </div>
            )}
            <div className="property-partner-body">
              {it.logo ? (
                /* The logo carries the name, so it takes the alt text and the
                   visible name is skipped — repeating it reads as a caption
                   nobody wrote. */
                <img className="property-partner-logo" src={it.logo} alt={it.name} loading="lazy" />
              ) : (
                <strong className="property-partner-name">{it.name}</strong>
              )}
              {layout === "cards" && it.desc && <p>{it.desc}</p>}
            </div>
          </>
        );

        if (!expandable) {
          if (!it.href) return <div className="property-partner-card" key={i}>{face}</div>;
          return (
            <a className="property-partner-card" href={it.href} target="_blank" rel="noopener noreferrer" key={i}>
              {face}
            </a>
          );
        }

        return (
          <div className={`property-partner-card${isOpen ? " is-open" : ""}`} key={i}>
            <button
              type="button"
              className="property-partner-trigger"
              aria-expanded={isOpen}
              aria-controls={`partner-detail-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              {face}
              <span className="property-partner-more">
                {isOpen ? (zh ? "收合" : "Close") : (zh ? "了解更多" : "Read more")}
              </span>
            </button>
            <div className="property-partner-detail" id={`partner-detail-${i}`} hidden={!isOpen}>
              <div>
                {it.detail.split(/\r?\n/).map((line, n) => (line.trim() ? <p key={n}>{line}</p> : null))}
                {it.href && (
                  <a href={it.href} target="_blank" rel="noopener noreferrer">
                    {zh ? "前往官方網站 →" : "Visit the website →"}
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
