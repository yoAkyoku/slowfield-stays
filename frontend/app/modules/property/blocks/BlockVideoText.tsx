import Link from "next/link";
import type { Locale } from "../../i18n";
import { cfgT, eyebrowT } from "../../tr";
import { isSafeUrl } from "../../safeHtml";
import { OembedMedia } from "./BlockOembed";
import SectionHeading from "../../SectionHeading";

/**
 * 影片＋文字 (客戶, 八、內容頁版型).
 *
 * The two halves already existed and could be stacked as two blocks; what could
 * not be expressed was a video and its copy as ONE unit — side by side, sharing
 * a row, moving together when the block is reordered.
 *
 * The embed goes through OembedMedia, i.e. the same allow-list, the same
 * Facebook-without-their-SDK path and the same strict sanitiser the standalone
 * video block uses. Nothing here decides what a third party may inject.
 */
export type VideoTextConfig = {
  url?: string;
  video_position?: "top" | "left" | "right";
  eyebrow?: string | Record<string, string>;
  title?: string | Record<string, string>;
  body?: string | Record<string, string>;
  cta_label?: string | Record<string, string>;
  cta_href?: string;
};

export default async function BlockVideoText({
  locale,
  config,
}: {
  locale: Locale;
  config?: VideoTextConfig;
}) {
  const c = (config ?? {}) as Record<string, unknown>;
  const url = String(c.url ?? "");
  const eyebrow = eyebrowT(c, locale);
  const title = cfgT(c, "title", locale);
  const body = cfgT(c, "body", locale);
  const ctaLabel = cfgT(c, "cta_label", locale, "");
  const rawHref = String(c.cta_href ?? "");
  const ctaHref = rawHref && isSafeUrl(rawHref) ? rawHref : "";
  const hasCta = ctaLabel.trim().length > 0 && ctaHref.length > 0;

  /* No video and no copy is an empty section that still takes its block
     padding — the empty-frame case the gallery block was fixed for. */
  if (!url && !title && !body) return null;

  const rawSide = String(c.video_position ?? "");
  const side = rawSide === "left" || rawSide === "right" ? rawSide : null;

  const copy = (
    <>
      <SectionHeading eyebrow={eyebrow} title={title} />
      {body && (
        <div className="property-rich-text-body">
          <p>{body}</p>
        </div>
      )}
      {hasCta && (
        <Link href={ctaHref} className="block-about-cta">
          {ctaLabel}
        </Link>
      )}
    </>
  );

  // Side by side: the same grid 圖文段落 and 大圖焦點 use, so the three read as
  // one family and a row of them lines up.
  if (url && side) {
    return (
      <section className={`property-rich-text section property-rich-text--split property-rich-text--img-${side}`}>
        <div className="property-rich-split">
          <div className="property-rich-split-text">{copy}</div>
          <div className="property-rich-split-media video-text-media">
            <OembedMedia url={url} config={c} title={title} />
          </div>
        </div>
      </section>
    );
  }

  // Stacked: built on the centred shell, so it shares the page's measure and
  // does not open a seam between sections.
  return (
    <section className="property-rich-text section is-centered editorial-feature">
      {url && (
        <div className="editorial-feature-media video-text-media">
          <OembedMedia url={url} config={c} title={title} />
        </div>
      )}
      {copy}
    </section>
  );
}
