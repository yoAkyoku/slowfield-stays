import type { Locale } from "../../i18n";
import { safeLinkHref } from "../../safeHtml";
import { cfgT , eyebrowT} from "../../tr";

/**
 * Nearby attractions ("周邊景點 / 漫遊宜蘭"). Admin-managed list of places near the
 * property — image + name + area/distance + short note. Renders nothing until
 * items are added, so it's safe to ship empty on production.
 */

type Attraction = { name: string; meta: string; desc: string; image: string; link: string };

export default function BlockAttractions({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const eyebrow = eyebrowT(config, locale);
  const heading = cfgT(config, "heading", locale);
  const caption = cfgT(config, "caption", locale);
  const rawItems = Array.isArray(config.items) ? config.items : [];

  const items: Attraction[] = rawItems
    .map((raw) => {
      const it = (raw ?? {}) as Record<string, unknown>;
      return {
        name: cfgT(it, "name", locale),
        meta: cfgT(it, "meta", locale),
        desc: cfgT(it, "desc", locale),
        image: typeof it.image === "string" ? it.image : "",
        /* The 連結（選填）field is a plain text box, and http(s)-only threw away
           every site-relative target in silence: a card pointed at
           /stays/hejing or at #rooms rendered as an unclickable <div> with
           nothing in the admin to say why. A nearby attraction that is another
           of our own villas is the ordinary case, not an edge one.

           safeLinkHref is the shared allow-list for exactly this — a link
           target an editor typed into a settings field — so javascript:, data:
           and the "/\evil.example" shape that reads as internal and is not are
           still refused here, by the same rule as everywhere else. */
        link: safeLinkHref(it.link),
      };
    })
    .filter((it) => it.name);

  if (!items.length) return null;

  return (
    <section className="property-attractions section">
      {(eyebrow || heading || caption) && (
        <div className="property-attractions-head">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          {heading && <h2>{heading}</h2>}
          {caption && <p className="property-attractions-caption">{caption}</p>}
        </div>
      )}
      <div className="property-attractions-grid">
        {items.map((it, i) => {
          const Card = it.link ? "a" : "div";
          /* A new tab is for leaving the site. A path on this site opening in
             one strands the reader with a dead back button, and target/rel on
             an internal link is noise. Same split the rich-text sanitiser
             makes. */
          const offsite = /^https?:\/\//i.test(it.link);
          return (
            <Card
              key={i}
              className="property-attraction-card"
              {...(it.link
                ? { href: it.link, ...(offsite ? { target: "_blank", rel: "noopener noreferrer" } : {}) }
                : {})}
            >
              <div className="property-attraction-img">
                {it.image && <img src={it.image} alt={it.name} loading="lazy" />}
              </div>
              <div className="property-attraction-body">
                <h2 className="property-attraction-num">{String(i + 1).padStart(2, "0")}</h2>
                {/* Name leads, the area/distance follows it (client: 名稱和
                    地區／距離調換位置) — the place is the thing being named,
                    and how far it is qualifies it. */}
                <strong>{it.name}</strong>
                {it.meta && <span className="property-attraction-meta">{it.meta}</span>}
                {it.desc && <p>{it.desc}</p>}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
