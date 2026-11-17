import Link from "next/link";
import type { Locale } from "../../i18n";
import { cfgT , eyebrowT} from "../../tr";
import { isSafeUrl } from "../../safeHtml";
import SectionHeading from "../../SectionHeading";

export type Destination = {
  name: string | Record<string, string>;
  image?: string;
  description?: string | Record<string, string>;
  href?: string;
};

export type BlockDestinationsConfig = {
  eyebrow?: string | Record<string, string>;
  title?: string | Record<string, string>;
  items?: Destination[];
};

export default function BlockDestinations({ locale, config }: { locale: Locale; config?: BlockDestinationsConfig }) {
  const zh = locale === "zh";
  const c = (config ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(c.items) ? c.items : [];
  if (!rawItems.length) return null;

  const eyebrow = eyebrowT(c, locale, zh ? "熱門目的地" : "Popular destinations");
  const title = cfgT(c, "title", locale, zh ? "選一個地方，慢慢待著。" : "Choose a place. Stay a while.");

  return (
    <section className="section">
      <div className="section-header">
        <div>
          <SectionHeading eyebrow={eyebrow} title={title} />
        </div>
      </div>
      <div className="destinations-grid">
        {rawItems.map((raw, i) => {
          const dest = raw as Record<string, unknown>;
          const name = cfgT(dest, "name", locale);
          const description = cfgT(dest, "description", locale);
          const image = String(dest.image ?? "");
          const href = isSafeUrl(dest.href) ? String(dest.href) : "";

          const inner = (
            <>
              <div className="destination-card-img">
                {image && <img src={image} alt={name} loading="lazy" />}
              </div>
              <strong>{name}</strong>
              {description && <p>{description}</p>}
            </>
          );
          return href ? (
            <Link href={href} className="destination-card" key={i}>
              {inner}
            </Link>
          ) : (
            <div className="destination-card" key={i}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
