import type { Locale } from "../../i18n";
import { cfgT } from "../../tr";
import { isSafeUrl, sanitizeEmbedHtml } from "../../safeHtml";

type OembedData = {
  html?: string;
  title?: string;
  thumbnail_url?: string;
  provider_name?: string;
};

/** Trusted domains for oEmbed iframes */
const TRUSTED_IFRAME_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "player.vimeo.com",
  "www.instagram.com",
  "instagram.com",
  "www.tiktok.com",
  "www.facebook.com",
  "platform.twitter.com",
  "open.spotify.com",
];

/** Provider HTML is third-party input, so it goes through the strict
 *  allow-list sanitiser rather than a strip-what-looks-bad pass. */
function sanitizeOembedHtml(html: string): string {
  return sanitizeEmbedHtml(html, TRUSTED_IFRAME_HOSTS);
}

/**
 * Facebook video, as an iframe we build ourselves.
 *
 * Facebook's oEmbed hands back its SDK — a `<script src="connect.facebook.net">`
 * plus a blockquote for the SDK to replace. The sanitiser drops scripts, so the
 * embed fell through to a bare link. Loading that SDK would also run Meta's
 * JavaScript on every page carrying a video and let it track the visitor, which
 * is not a trade worth making for one embed.
 *
 * The plugin endpoint renders the same player from an iframe on
 * www.facebook.com — already a trusted host, no third-party script.
 */
function facebookVideoEmbed(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host !== "facebook.com" && host !== "fb.watch") return null;
  if (!/\/(videos|reel|watch)\b/.test(url) && host !== "fb.watch") return null;
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
}

/** Aspect ratios offered in the block form, as CSS `aspect-ratio` values. */
const RATIOS: Record<string, string> = {
  "16:9": "16 / 9",
  "4:3": "4 / 3",
  "1:1": "1 / 1",
  "4:5": "4 / 5",
  "9:16": "9 / 16",
};

/**
 * The ratio the provider declared for itself, from the width/height attributes
 * on the iframe it handed back — or null when it declared none.
 *
 * This is what the 影片比例 「自動」 option resolves to. It used to emit
 * `aspect-ratio: auto`, which cannot work for ANY provider: an iframe's
 * width/height attributes are presentational hints for the `width`/`height`
 * PROPERTIES — unlike <img>, they give the element no intrinsic aspect ratio —
 * and the stylesheet's own `height: auto` outranks them, so the box fell to the
 * replaced-element default of 150px. Measured on the block preview route:
 * a Facebook video 460×818 → 460×150, and a YouTube embed 800×450 → 800×150.
 * A cross-origin iframe never reports its content height to the page, so
 * "however tall the content is" is not available to be honoured; the size the
 * provider states is the closest thing there is, and it is what the option
 * says now.
 *
 * Parsed out of already-sanitised markup and matched as digits only, then
 * rejected outside a plausible band, because the result lands in an inline
 * style on a public page.
 */
function providerRatio(html: string): string | null {
  const tag = html.match(/<iframe\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const width = Number(tag.match(/\swidth="(\d+(?:\.\d+)?)"/i)?.[1]);
  const height = Number(tag.match(/\sheight="(\d+(?:\.\d+)?)"/i)?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const ratio = width / height;
  // A 20:1 strip or a 1:20 column is a provider that mis-stated its size, not a
  // shape anyone embedded on purpose.
  if (ratio < 0.2 || ratio > 5) return null;
  return `${width} / ${height}`;
}

/**
 * Size overrides, as CSS custom properties.
 *
 * Width is clamped rather than trusted: it lands in an inline style on a public
 * page, so a hand-edited block config shouldn't be able to put arbitrary text
 * there, and a 20000px embed is a layout bug rather than an editorial choice.
 *
 * `html` is the sanitised provider markup, when there is any — it is what the
 * 「自動」 ratio is read from. The Facebook branch builds its own iframe and has
 * none, so it passes nothing and 「自動」 leaves the ratio alone: the block's
 * existing default applies (9/16 inside .property-oembed-content--fb, 16/9
 * elsewhere) rather than the setting collapsing the player.
 */
function embedSizeStyle(
  config: Record<string, unknown>,
  html?: string,
): Record<string, string> | undefined {
  const style: Record<string, string> = {};

  const raw = Number(config.embed_width);
  if (Number.isFinite(raw) && raw > 0) {
    style["--embed-max"] = `${Math.round(Math.min(Math.max(raw, 240), 1600))}px`;
  }

  const ratio = RATIOS[String(config.embed_ratio ?? "")];
  if (ratio) style["--embed-ratio"] = ratio;
  else if (config.embed_ratio === "auto") {
    const own = html ? providerRatio(html) : null;
    if (own) style["--embed-ratio"] = own;
  }

  return Object.keys(style).length ? style : undefined;
}

async function fetchOembed(url: string): Promise<OembedData | null> {
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * The embed itself, without the section frame or the caption.
 *
 * Split out so a block that puts a video BESIDE copy can reuse the whole safe
 * pipeline — URL allow-list, the Facebook-without-their-SDK path, the oEmbed
 * fetch, the strict sanitiser and the size resolution — rather than growing a
 * second, thinner embed path. A second path is exactly how the FAQ, 入住須知
 * and 表格 blocks drifted into behaving differently on different pages, and
 * here the drift would be in what markup a third party is allowed to inject.
 *
 * Returns null when the URL is missing or not on the allow-list, so a caller
 * can decide whether to draw its own layout at all.
 */
export async function OembedMedia({
  url,
  config,
  title,
}: {
  url: string;
  config: Record<string, unknown>;
  title?: string;
}) {
  if (!isSafeUrl(url)) return null;

  const fbSrc = facebookVideoEmbed(url);
  if (fbSrc) {
    return (
      <div className="property-oembed-content property-oembed-content--fb" style={embedSizeStyle(config)}>
        <iframe
          src={fbSrc}
          title={title || "Facebook video"}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  const data = await fetchOembed(url);
  // Sanitised once: the markup is what goes on the page AND what 「自動」 reads
  // the provider's own proportions out of.
  const embedHtml = data?.html ? sanitizeOembedHtml(data.html) : "";

  if (data?.html) {
    return (
      <div
        className="property-oembed-content"
        style={embedSizeStyle(config, embedHtml)}
        dangerouslySetInnerHTML={{ __html: embedHtml }}
      />
    );
  }
  if (data?.thumbnail_url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="property-oembed-fallback">
        <img src={data.thumbnail_url} alt={data.title ?? ""} loading="lazy" />
        {data.title && <span>{data.title}</span>}
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="property-oembed-link">
      {url}
    </a>
  );
}

export default async function BlockOembed({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const url = String(config.url ?? "");
  const caption = cfgT(config, "caption", locale);

  // The embed markup is sanitised, but the fallback link was not: when a
  // provider returns no HTML we render config.url straight into an href, so a
  // javascript: or data: URL in the block config would become a live link.
  if (!isSafeUrl(url)) return null;

  return (
    <section className="property-oembed section">
      <OembedMedia url={url} config={config} title={caption} />
      {caption && <p className="property-oembed-caption">{caption}</p>}
    </section>
  );
}
