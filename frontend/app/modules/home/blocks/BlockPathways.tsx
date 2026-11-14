import Link from "next/link";
import type { Locale } from "../../i18n";
import { t } from "../../i18n";
import { cfgT , eyebrowT} from "../../tr";
import { isSafeUrl } from "../../safeHtml";
import { cssUrl } from "../../safeCss";

export type PathwayItem = {
  title: string | Record<string, string>;
  description?: string | Record<string, string>;
  href: string;
  image?: string;
};

export type BlockPathwaysConfig = {
  items?: PathwayItem[];
  eyebrow?: string | Record<string, string>;
  title?: string | Record<string, string>;
  intro?: string | Record<string, string>;
};

export default function BlockPathways({ locale, config }: { locale: Locale; config?: BlockPathwaysConfig }) {
  const { home: h } = t(locale);
  const c = (config ?? {}) as Record<string, unknown>;

  // If custom items provided, use them; otherwise fall back to i18n defaults
  const rawItems = Array.isArray(c.items) && c.items.length > 0 ? c.items : null;
  const items = rawItems
    ? rawItems.map((item) => {
        const it = item as Record<string, unknown>;
        const rawHref = String(it.href ?? "/");
        return {
          title: cfgT(it, "title", locale),
          description: cfgT(it, "description", locale),
          // An href off the allow-list falls back to the default; an empty one
          // stays empty, as the author left it.
          href: !rawHref || isSafeUrl(rawHref) ? rawHref : "/",
          image: String(it.image ?? ""),
        };
      })
    : h.pathways.map(([title, description, href]) => ({ title, description, href, image: "" }));

  return (
    <section className="section home-pathways-section">
      <div className="home-pathways-intro">
        {eyebrowT(c, locale, h.pathwaysEyebrow) && <div className="eyebrow">{eyebrowT(c, locale, h.pathwaysEyebrow)}</div>}
        <h2>{cfgT(c, "title", locale, h.pathwaysTitle)}</h2>
        <p>{cfgT(c, "intro", locale, h.pathwaysIntro)}</p>
      </div>
      <div className="home-pathways-grid">
        {items.map((item, index) => {
          const imgUrl = item.image ?? "";
          return (
            <Link
              className={`home-pathway-card${imgUrl ? " has-image" : ""}`}
              href={item.href}
              key={index}
              style={cssUrl(imgUrl) ? ({ "--pathway-img": cssUrl(imgUrl) } as React.CSSProperties) : undefined}
            >
              {imgUrl ? (
                <span className="pathway-thumb" aria-hidden="true" />
              ) : (
                <span>{(index + 1).toString().padStart(2, "0")}</span>
              )}
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
