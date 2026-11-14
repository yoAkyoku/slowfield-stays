import type { CSSProperties } from "react";
import { safeLineHeight, safeTypeLength } from "../../blockStyle";
import type { Locale } from "../../i18n";
import { cfgT , eyebrowT} from "../../tr";
import { safeHtml, sanitizeRichHtml } from "../../safeHtml";
import { safeCssColor } from "../../fontPresets";
import FeatureIcon from "./FeatureIcon";

// Body authored in the WYSIWYG editor contains real HTML tags; plain-text bodies
// (legacy / pasted) contain none and go through the line-based auto-list parser.
const HTML_RE = /<\/?(p|div|span|br|b|strong|i|em|u|s|ul|ol|li|h[1-6]|blockquote|a|img)\b/i;

const ORDERED_RE = /^\s*\d+[.)]\s+/;
const UNORDERED_RE = /^\s*[-*•·●▪◦‧]\s+/;

type Block =
  | { kind: "html"; text: string }
  | { kind: "list"; tag: "ol" | "ul"; items: string[] }
  | { kind: "para"; text: string };

/**
 * Parse a body into blocks line by line, so bullet/number lines become lists
 * whether they're separated by single or double newlines, and consecutive text
 * lines become a paragraph. A blank line ends the current group.
 */
function parseBody(body: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  let listTag: "ol" | "ul" | null = null;
  let listItems: string[] = [];
  const flushPara = () => { if (para.length) { out.push({ kind: "para", text: para.join("\n") }); para = []; } };
  const flushList = () => { if (listItems.length) { out.push({ kind: "list", tag: listTag!, items: listItems }); listItems = []; listTag = null; } };
  // WYSIWYG editors emit <br> instead of "\n"; treat them as line breaks so each
  // visual line is parsed on its own (otherwise the whole body collapses into a
  // single line and only the first bullet/number marker is ever detected).
  const normalized = body.replace(/<br\s*\/?>/gi, "\n");
  for (const raw of normalized.split("\n")) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (/^<(ul|ol|h[1-6]|blockquote)\b/i.test(line)) { flushPara(); flushList(); out.push({ kind: "html", text: raw }); continue; }
    const o = ORDERED_RE.test(line);
    const u = UNORDERED_RE.test(line);
    if (o || u) {
      flushPara();
      const tag: "ol" | "ul" = o ? "ol" : "ul";
      if (listTag && listTag !== tag) flushList();
      listTag = tag;
      listItems.push(line.replace(o ? ORDERED_RE : UNORDERED_RE, ""));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out;
}

/**
 * Body supports a safe HTML subset (bold / italic / lists / sub-headings /
 * links) via safeHtml; everything else is escaped (no XSS). Block-level
 * presentation (font-size / line-height / text-align / background) is handled
 * uniformly for every block by BlockWrapper, not here.
 */
export default function BlockRichText({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const heading = cfgT(config, "heading", locale);
  const eyebrow = eyebrowT(config, locale);
  const body = cfgT(config, "body", locale);
  // Validated the same way FeatureIcon validates its per-item colour — an
  // admin-controlled string reaching a raw inline style is a CSS-injection
  // vector otherwise.
  const headingColor = safeCssColor(typeof config.heading_color === "string" ? config.heading_color : undefined);
  const bodyColor = safeCssColor(typeof config.body_color === "string" ? config.body_color : undefined);
  // Optional side image → renders the block as a left/right split (client:
  // 關於/品牌介紹 做左右區分). image_side "left" puts the photo on the left.
  const sideImage = typeof config.image === "string" ? config.image : "";
  const imageSide = config.image_side === "left" ? "left" : "right";

  if (!heading && !body) return null;

  const centered = !!eyebrow && !sideImage;
  const listStyle = typeof config._listStyle === "string" ? config._listStyle : "";
  const className = [
    "property-rich-text section",
    centered ? "is-centered" : "",
    sideImage ? `property-rich-text--split property-rich-text--img-${imageSide}` : "",
  ].filter(Boolean).join(" ");
  const bodyClass = ["property-rich-text-body", listStyle ? `property-rich-text-body--ls-${listStyle}` : ""].filter(Boolean).join(" ");

  // Block-level body line-height / letter-spacing (numeric). Applied inline so it
  // works whether or not the block sits inside a BlockWrapper (the parent homepage
  // renders BlockRichText directly, without one). Inline also beats the default
  // .property-rich-text-body p line-height by specificity.
  /* Checked, not merely type-tested. React serialises a style value verbatim on
     the server, so "1.6;background-image:url(…)" would become extra
     declarations — and the block preview route is reachable straight from a URL
     with a caller-supplied ?cfg=. blockStyle.ts already had the guards for
     exactly this; this was the one place that inlined the two without them. */
  const bodyLineHeight = safeLineHeight(config._lineHeight) || undefined;
  const bodyLetterSpacing = safeTypeLength(config._letterSpacing) || undefined;

  const headingStyle: CSSProperties | undefined = headingColor ? { color: headingColor } : undefined;
  const bodyStyle: CSSProperties | undefined =
    bodyColor || bodyLineHeight || bodyLetterSpacing
      ? {
          ...(bodyColor ? { color: bodyColor } : {}),
          ...(bodyLineHeight ? { lineHeight: bodyLineHeight } : {}),
          ...(bodyLetterSpacing ? { letterSpacing: bodyLetterSpacing } : {}),
        }
      : undefined;

  // Legacy fallback: feature highlights used to live inline on this block
  // before they became their own "feature_list" block type. Any rich_text
  // block saved before that split still has its highlights in config.items —
  // keep rendering them here (same markup as before) so that data doesn't
  // silently vanish for a site that hasn't been re-edited to use the new
  // block yet. New content should use BlockFeatureList instead.
  const rawItems = Array.isArray(config.items) ? config.items : [];
  const featureItems = rawItems
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        icon: typeof item.icon === "string" ? item.icon : "",
        iconColor: typeof item.icon_color === "string" ? item.icon_color : "",
        label: cfgT(item, "label", locale),
        detail: cfgT(item, "detail", locale),
      };
    })
    .filter((item) => item.label);

  const textContent = (
    <>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      {heading && <h2 style={headingStyle}>{heading}</h2>}
      {centered && heading && <div className="property-rich-text-divider" aria-hidden="true" />}
      {body && HTML_RE.test(body) && (
        <div className={bodyClass} style={bodyStyle} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(body) }} />
      )}
      {body && !HTML_RE.test(body) && (
        <div className={bodyClass} style={bodyStyle}>
          {parseBody(body).map((blk, i) => {
            if (blk.kind === "html") {
              return <div key={i} style={bodyStyle} dangerouslySetInnerHTML={{ __html: safeHtml(blk.text) }} />;
            }
            if (blk.kind === "list") {
              const Tag = blk.tag;
              return (
                <Tag key={i} style={bodyStyle}>
                  {blk.items.map((item, j) => (
                    <li key={j} dangerouslySetInnerHTML={{ __html: safeHtml(item) }} />
                  ))}
                </Tag>
              );
            }
            return <p key={i} style={bodyStyle} dangerouslySetInnerHTML={{ __html: safeHtml(blk.text, { convertNewlines: true }) }} />;
          })}
        </div>
      )}
      {featureItems.length > 0 && (
        <div className="block-about-features">
          {featureItems.map((item, i) => (
            <div key={i} className="block-about-feature">
              <FeatureIcon icon={item.icon} color={item.iconColor} />
              <div className="block-about-feature-info">
                <h3>{item.label}</h3>
                {item.detail && <p>{item.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (sideImage) {
    return (
      <section className={className}>
        <div className="property-rich-split">
          <div className="property-rich-split-text">{textContent}</div>
          <div className="property-rich-split-media">
            <img src={sideImage} alt={heading || ""} loading="lazy" />
          </div>
        </div>
      </section>
    );
  }

  return <section className={className}>{textContent}</section>;
}
