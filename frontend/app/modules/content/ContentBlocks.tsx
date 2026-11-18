import type { CmsContentBlock } from "../api";
import { isSafeUrl as isSafeLinkTarget, sanitizeInlineHtml } from "../safeHtml";
import { pickT } from "../tr";
import type { Locale } from "../i18n";
import type { ReactNode } from "react";
import BlockPartners from "../property/blocks/BlockPartners";
import BlockRichText from "../property/blocks/BlockRichText";
import { platformForUrl, youtubeEmbedUrl } from "../media";
import { reportUnknownBlock } from "../unknownBlock";

/* ── Sanitizer ── */



function hasHtml(text: string | undefined): boolean {
  return !!text && /<[a-z][\s\S]*>/i.test(text);
}

/* ── Helpers ── */

function alignClass(align?: string): string {
  if (!align || align === "left") return "";
  return ` content-align-${align}`;
}

/* ── Block Components ── */

function VideoBlock({ block, locale }: { block: Extract<CmsContentBlock, { type: "video_embed" }>; locale: Locale }) {
  const url = block.url ?? "";
  const title = pickT(block.title, locale);
  const caption = pickT(block.caption, locale);

  const isSafeUrl = isSafeLinkTarget(url);

  /* Cover image mode */
  if (block.cover) {
    return (
      <figure className="content-video-embed">
        <a href={isSafeUrl ? url : "#"} target="_blank" rel="noreferrer" className="content-video-cover-link">
          <img src={block.cover} alt={title || "Video"} loading="lazy" />
          <span className="content-video-play-icon">&#9654;</span>
        </a>
        {caption ? <figcaption>{caption}</figcaption> : null}
      </figure>
    );
  }

  const platform = platformForUrl(url);
  const youtubeUrl = platform === "youtube" ? youtubeEmbedUrl(url) : "";

  return (
    <figure className={`content-video-embed content-video-${platform}`}>
      {youtubeUrl ? (
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          src={youtubeUrl}
          title={title || "Embedded video"}
        />
      ) : (
        <a href={isSafeUrl ? url : "#"} rel="noreferrer" target="_blank">
          <span>{platform === "unknown" ? "Video" : platform}</span>
          <strong>{title || url}</strong>
        </a>
      )}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/* ── Main Renderer ── */

/** Draws an oembed block. Supplied by ContentBlockRenderer on the published
 *  page; the admin preview has none, because BlockOembed is an async server
 *  component and cannot render inside the client-side editor. */
export type OembedRenderer = (config: Record<string, unknown>, key: string, locale: Locale) => ReactNode;

/**
 * Article body blocks, as the published page draws them.
 *
 * Shared by the public renderer and the article editor's live preview. The
 * preview used to carry its own ~190-line copy of every branch here, because
 * this module imported the server-only oembed component; that one dependency
 * is a parameter now, and the preview and the page are the same code.
 */
export default function ContentBlocks({
  blocks,
  depth = 0,
  locale = "zh",
  oembed,
}: {
  blocks: CmsContentBlock[];
  depth?: number;
  locale?: Locale;
  oembed?: OembedRenderer;
}) {
  /* CMS block JSON is hand-editable and arrives from the database, so "this is
     an array" is an assumption, not a guarantee. It held everywhere except one
     recursive call, and the cost of it being wrong was a 500 on a page visitors
     read — not a missing block. Rendering nothing is the same failure mode the
     rest of this file already chooses for content it cannot draw. */
  if (!Array.isArray(blocks)) return null;

  return (
    <>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        /* Rich text (property/homepage-format block: { type, enabled, config{eyebrow,heading,body} }).
           Some content pages store this format; render it with the shared BlockRichText
           so the content shows instead of vanishing. */
        const raw = block as unknown as { type?: string; enabled?: boolean; config?: Record<string, unknown> };
        // Hidden in the admin's block list. Checked once here for every type
        // rather than per branch below, so a new block type cannot ship without
        // honouring the toggle.
        if (raw.enabled === false) return null;
        if (raw.type === "rich_text") {
          return <BlockRichText key={key} locale={locale} config={raw.config ?? {}} />;
        }
        // Same reason as rich_text above: an article body can hold a block
        // saved in the property/homepage format. A 合作品牌 list belongs on a
        // dining article as much as on a villa page, and without this branch it
        // was stored, shown in the editor, and dropped on the way to the page.
        if (raw.type === "partners") {
          return <BlockPartners key={key} locale={locale} config={raw.config ?? {}} />;
        }
        // Same reason again: the article editor names an oembed block in its
        // list (so nobody deletes it to find out what it is) but has no form for
        // it, and this renderer dropped it, so a stored, named block reached the
        // page as nothing. Rendering it is the lesser evil against refusing it:
        // BlockOembed already sanitises provider HTML and rejects unsafe URLs.
        if (raw.type === "oembed") {
          return oembed ? oembed(raw.config ?? {}, key, locale) : null;
        }

        /* Heading */
        if (block.type === "heading") {
          const cls = alignClass(block.align) || undefined;
          const text = pickT(block.text, locale);
          if (hasHtml(text)) {
            return block.level === "h3"
              ? <h3 key={key} className={cls} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(text) }} />
              : <h2 key={key} className={cls} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(text) }} />;
          }
          return block.level === "h3"
            ? <h3 key={key} className={cls}>{text}</h3>
            : <h2 key={key} className={cls}>{text}</h2>;
        }

        /* Paragraph */
        if (block.type === "paragraph") {
          const text = pickT(block.text, locale);
          if (!text) return null;
          const acls = alignClass(block.align);
          const fs = block.fontSize;
          // backward compat: old string values → CSS class; new number → inline style
          const scls = typeof fs === "string" && fs !== "base" ? ` content-text-${fs}` : "";
          const sizeStyle: React.CSSProperties | undefined = typeof fs === "number" && fs !== 16 ? { fontSize: `${fs}px` } : undefined;
          const cls = (acls + scls).trim() || undefined;
          if (hasHtml(text)) {
            const hasBlockEl = /<blockquote/i.test(text);
            if (hasBlockEl) {
              return <div key={key} className={`content-paragraph${cls ? ` ${cls}` : ""}`} style={sizeStyle} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(text) }} />;
            }
            return <p key={key} className={cls} style={sizeStyle} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(text) }} />;
          }
          return <p key={key} className={cls} style={sizeStyle}>{text}</p>;
        }

        /* Image */
        /* The type check and the content check are separate, and the content
           check returns rather than falling through. Written as one condition,
           an `image` block whose url had not been chosen yet dropped past every
           branch below to reportUnknownBlock and logged "has no renderer for
           block type \"image\"" — which is the one thing that message exists to
           rule out (see unknownBlock.ts: it is there to tell "nobody
           implemented this" apart from "the config is empty"). Four types did
           this; the page looked the same either way and the log said the
           opposite of the truth. */
        if (block.type === "image") {
          if (!block.url) return null;
          const sizeCls = block.size ? ` is-${block.size}` : "";
          const caption = pickT(block.caption, locale);
          const alt = pickT(block.alt, locale) || caption || "";
          return (
            <figure className={`content-image-block${sizeCls}`} key={key}>
              <img src={block.url} alt={alt} loading="lazy" />
              {caption ? <figcaption>{caption}</figcaption> : null}
            </figure>
          );
        }

        /* Image Grid */
        if (block.type === "image_grid") {
          // An empty grid is a grid with nothing in it yet, not a type nobody
          // wired up — see the image branch above.
          if (!block.images?.length) return null;
          const cols = block.columns ?? 2;
          const gap = block.gap ?? "normal";
          /* Rows are added before their picture is chosen, and an empty url
             drew a blank cell in the grid's 16:10 frame. The single-image
             branch above has always checked `block.url`; this one only checked
             that the array was non-empty. Filtered rather than skipped so a
             grid whose rows are all still empty renders nothing at all. */
          const images = block.images.filter((img) => img.url);
          if (!images.length) return null;
          return (
            <div className={`content-image-grid cols-${cols} gap-${gap}`} key={key}>
              {images.map((img, i) => {
                const caption = pickT(img.caption, locale);
                const alt = pickT(img.alt, locale) || caption || "";
                return (
                  <figure key={i} className="content-image-block">
                    <img src={img.url} alt={alt} loading="lazy" />
                    {caption ? <figcaption>{caption}</figcaption> : null}
                  </figure>
                );
              })}
            </div>
          );
        }

        /* Columns — prevent deep nesting */
        if (block.type === "columns") {
          // Refusing to nest further is a deliberate limit, not a missing
          // renderer — see the image branch above.
          if (depth >= 1) return null;
          /* New format: items array */
          if (block.items?.length) {
            // flex is untyped CMS JSON landing in an inline style, where a ";"
            // in the value would append further declarations to the element.
            const gridCols = block.items
              .map((c) => {
                const n = Number(c.flex);
                return `${Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 1}fr`;
              })
              .join(" ");
            return (
              <div className="content-columns" style={{ gridTemplateColumns: gridCols }} key={key}>
                {block.items.map((col, i) => (
                  <div key={i} className="content-columns-col">
                    {/* `?? []` like the legacy branch below. A column saved
                        without a blocks array — an empty column, or JSON edited
                        by hand — handed undefined to the recursive call and
                        threw inside .map(), which 500s the whole public page. */}
                    <ContentBlocks oembed={oembed} blocks={col.blocks ?? []} depth={depth + 1} locale={locale} />
                  </div>
                ))}
              </div>
            );
          }
          /* Legacy format: left/right/ratio */
          const r = block.ratio ?? "50-50";
          return (
            <div className={`content-columns ratio-${r}`} key={key}>
              <div className="content-columns-left">
                <ContentBlocks oembed={oembed} blocks={block.left ?? []} depth={depth + 1} locale={locale} />
              </div>
              <div className="content-columns-right">
                <ContentBlocks oembed={oembed} blocks={block.right ?? []} depth={depth + 1} locale={locale} />
              </div>
            </div>
          );
        }

        /* Video Embed */
        if (block.type === "video_embed") {
          // A video block waiting for its URL — see the image branch above.
          if (!block.url) return null;
          return <VideoBlock block={block} locale={locale} key={key} />;
        }

        /* Quote */
        if (block.type === "quote") {
          const text = pickT(block.text, locale);
          const source = pickT(block.source, locale);
          if (!text) return null;
          if (hasHtml(text)) {
            return (
              <blockquote key={key}>
                <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(text) }} />
                {source ? <cite>{source}</cite> : null}
              </blockquote>
            );
          }
          return (
            <blockquote key={key}>
              <p>{text}</p>
              {source ? <cite>{source}</cite> : null}
            </blockquote>
          );
        }

        /* CTA */
        if (block.type === "cta" && block.href && isSafeLinkTarget(block.href)) {
          const styleCls = block.style && block.style !== "primary" ? ` is-${block.style}` : "";
          const label = pickT(block.label, locale);
          return (
            <a className={`content-detail-cta content-block-cta${styleCls}`} href={block.href} key={key}>
              {label || block.href}
            </a>
          );
        }

        /* Spacer */
        if (block.type === "spacer") return <div className={`content-spacer is-${block.size ?? "medium"}`} key={key} />;

        return reportUnknownBlock("ContentBlockRenderer", block.type);
      })}
    </>
  );
}
