import Link from "next/link";
import type { Locale } from "../../i18n";
import { cfgT , eyebrowT} from "../../tr";
import { isSafeUrl } from "../../safeHtml";
import FeatureIcon from "../../property/blocks/FeatureIcon";
import AboutImageCarousel from "./AboutImageCarousel";
import { normaliseAboutImages } from "./aboutImages";

type AboutImageConfig = string | { url: string; alt?: string | Record<string, string> };

export type BlockAboutConfig = {
  image?: string;
  image2?: string;
  images?: AboutImageConfig[];
  image_position?: "left" | "right";
  eyebrow?: string | Record<string, string>;
  title?: string | Record<string, string>;
  body?: string | Record<string, string>;
  caption?: string | Record<string, string>;
  cta_label?: string | Record<string, string>;
  cta_href?: string;
  items?: Array<Record<string, unknown>>;
};

export default function BlockAbout({ locale, config }: { locale: Locale; config?: BlockAboutConfig }) {
  const zh = locale === "zh";
  const c = (config ?? {}) as Record<string, unknown>;
  const images = normaliseAboutImages(c).map((item) => ({
    url: item.url,
    alt: cfgT(item, "alt", locale),
  }));
  const image = images[0]?.url ?? "";
  const imageLeft = c.image_position === "left";
  const eyebrow = eyebrowT(c, locale, zh ? "關於慢域" : "About Select");
  const title = cfgT(c, "title", locale, zh ? "我們選宿，不只是選房。" : "We select stays, not just rooms.");
  const body = cfgT(
    c,
    "body",
    locale,
    zh
      ? "每間住宿都經過細緻篩選，呈現建築個性、隱私空間與服務清晰度的真實樣貌。"
      : "Each stay is vetted for architectural character, private atmosphere, and the service clarity that lets you travel without second-guessing.",
  );
  const lines = body.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const caption = cfgT(c, "caption", locale, "");
  const ctaLabel = cfgT(c, "cta_label", locale, zh ? "了解慢域體驗" : "Read the experience");
  const rawCtaHref = String(c.cta_href ?? "/experience");
  // An href off the allow-list falls back to the default; an empty one is the
  // author asking for no button at all, so it stays empty.
  const ctaHref = !rawCtaHref || isSafeUrl(rawCtaHref) ? rawCtaHref : "/experience";

  const rawItems = Array.isArray(c.items) ? c.items : [];
  const items = rawItems
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

  const classes = [
    "block-about",
    image ? "block-about--has-image" : "",
    image && imageLeft ? "block-about--image-left" : "",
    items.length > 0 ? "block-about--has-features" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      <div className="block-about-copy">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        <div className="block-about-body">
          {lines.length > 1
            ? lines.map((line, i) => <p key={i}>{line}</p>)
            : <p>{body}</p>}
        </div>
        {caption && <p className="block-about-caption">{caption}</p>}
        {items.length > 0 && (
          <div className="block-about-features">
            {items.map((item, i) => (
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
        {ctaHref && ctaLabel && (
          <Link href={ctaHref} className="block-about-cta">
            {ctaLabel}
          </Link>
        )}
      </div>
      {image && (
        <div className="block-about-media">
          <AboutImageCarousel images={images} title={title} locale={locale} />
        </div>
      )}
    </section>
  );
}
