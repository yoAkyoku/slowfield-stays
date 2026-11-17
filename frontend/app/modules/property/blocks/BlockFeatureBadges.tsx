import type { Locale } from "../../i18n";
import { cfgT , eyebrowT} from "../../tr";
import SectionHeading from "../../SectionHeading";

/* Thin-line icons drawn on a 24×24 grid, stroke = currentColor so they
   inherit the brand palette instead of reading as emoji clip-art. */
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICON_PATHS: Record<string, React.ReactNode> = {
  pool: (
    <>
      <path d="M3 17c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" />
      <path d="M3 21c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" />
      <path d="M8 14V5a2 2 0 0 1 4 0" />
      <path d="M14 14V5a2 2 0 0 1 4 0" />
      <path d="M8 8h6" />
      <path d="M8 11.5h6" />
    </>
  ),
  pet: (
    <>
      <circle cx="6" cy="8.5" r="1.6" />
      <circle cx="10.2" cy="5.8" r="1.6" />
      <circle cx="13.8" cy="5.8" r="1.6" />
      <circle cx="18" cy="8.5" r="1.6" />
      <path d="M12 11c-2.6 0-5.4 2.5-5.4 4.9 0 1.5 1.1 2.4 2.4 2.4 1.1 0 1.9-.6 3-.6s1.9.6 3 .6c1.3 0 2.4-.9 2.4-2.4C17.4 13.5 14.6 11 12 11Z" />
    </>
  ),
  family: (
    <>
      <circle cx="9" cy="7" r="2.5" />
      <path d="M4.5 19v-2a4.5 4.5 0 0 1 9 0v2" />
      <circle cx="16.5" cy="9" r="2" />
      <path d="M15 19v-1.5a3.5 3.5 0 0 1 5-3.2" />
    </>
  ),
  elderly: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 7.5v6.5l3 5" />
      <path d="M12 10.5 8.5 12v4" />
      <path d="M15.5 9.5h-3.5" />
    </>
  ),
  elevator: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M12 3v18" />
      <path d="m8 9 1.5-2L11 9" />
      <path d="m13.5 15 1.5 2 1.5-2" />
    </>
  ),
  parking: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3" />
    </>
  ),
  wifi: (
    <>
      <path d="M4 9.5a12 12 0 0 1 16 0" />
      <path d="M7 13a8 8 0 0 1 10 0" />
      <path d="M10 16.2a4 4 0 0 1 4 0" />
      <circle cx="12" cy="19" r="0.8" />
    </>
  ),
  bbq: (
    <>
      <path d="M5 10h14a7 7 0 0 1-14 0Z" />
      <path d="m9 17-1.5 4" />
      <path d="m15 17 1.5 4" />
      <path d="M9 3.5c0 .8.8 1 .8 1.8S9 6.4 9 7" />
      <path d="M12.5 3.5c0 .8.8 1 .8 1.8s-.8 1.1-.8 1.7" />
    </>
  ),
  ktv: (
    <>
      <rect x="9.5" y="2.5" width="5" height="9" rx="2.5" />
      <path d="M6 10a6 6 0 0 0 12 0" />
      <path d="M12 16v5" />
      <path d="M9 21h6" />
    </>
  ),
  chef: (
    <>
      <path d="M7.5 13.5c-2 0-3.5-1.6-3.5-3.5a3.5 3.5 0 0 1 3.6-3.5 4.6 4.6 0 0 1 8.8 0A3.5 3.5 0 0 1 20 10c0 1.9-1.5 3.5-3.5 3.5" />
      <path d="M7.5 13.5V19a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5v-5.5" />
      <path d="M7.5 17h9" />
    </>
  ),
  spa: (
    <>
      <path d="M12 20c-4.5-1.5-7.5-4.7-7.5-9 2.6 0 4.9.9 6.4 2.5" />
      <path d="M12 20c4.5-1.5 7.5-4.7 7.5-9-2.6 0-4.9.9-6.4 2.5" />
      <path d="M12 13.5C10.8 9.9 11.2 6.5 12 4c.8 2.5 1.2 5.9 0 9.5Z" />
    </>
  ),
  gym: (
    <>
      <path d="M7 8v8" />
      <path d="M17 8v8" />
      <path d="M4.5 10v4" />
      <path d="M19.5 10v4" />
      <path d="M7 12h10" />
    </>
  ),
  garden: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-4 2.5-7 6.5-7 0 4-2.5 7-6.5 7Z" />
      <path d="M12 11C12 7.7 9.9 5 6.5 5c0 3.3 2.1 6 5.5 6Z" />
      <path d="M8 21h8" />
    </>
  ),
  view: (
    <>
      <path d="m3 18 5.5-8 4 5.5L15 12l6 6" />
      <circle cx="17" cy="6.5" r="1.8" />
    </>
  ),
  mahjong: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="15.5" cy="15.5" r="1.2" />
    </>
  ),
  hotspring: (
    <>
      <path d="M5 19c0-3 2-5.5 4-7" />
      <path d="M19 19c0-3-2-5.5-4-7" />
      <path d="M3 19h18" />
      <path d="M8 4c0 1.2 1 1.5 1 2.5S8 8.2 8 9" />
      <path d="M12 3c0 1.2 1 1.5 1 2.5S12 7.2 12 8" />
      <path d="M16 4c0 1.2 1 1.5 1 2.5S16 8.2 16 9" />
    </>
  ),
  kidpool: (
    <>
      <path d="M3 17c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" />
      <path d="M3 21c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" />
      <circle cx="9" cy="8" r="3" />
      <circle cx="15" cy="10" r="2" />
    </>
  ),
  projector: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 10h2" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 18v3" />
    </>
  ),
  boardgame: (
    <>
      <circle cx="9" cy="6" r="2.5" />
      <path d="M4.5 18v-1.5a4.5 4.5 0 0 1 9 0V18" />
      <circle cx="16" cy="8" r="2" />
      <path d="M15 18v-1a3.5 3.5 0 0 1 5-3.2" />
    </>
  ),
  gaming: (
    <>
      <path d="M6 11h4" />
      <path d="M8 9v4" />
      <circle cx="15" cy="10" r=".7" />
      <circle cx="17" cy="12" r=".7" />
      <path d="M2 13a2 2 0 0 0 2 2h2.4L8 20h2l1.2-5h1.6l1.2 5h2l1.6-5H20a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4Z" />
    </>
  ),
  ih: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  dishwasher: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M4 8h16" />
      <circle cx="8" cy="5.5" r="0.7" />
      <circle cx="12" cy="14" r="3" />
    </>
  ),
  oven: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M4 10h16" />
      <circle cx="8" cy="6.5" r="0.8" />
      <circle cx="12" cy="6.5" r="0.8" />
      <rect x="7" y="13" width="10" height="5" rx="1" />
    </>
  ),
  microwave: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <rect x="5" y="7" width="10" height="10" rx="1" />
      <circle cx="18" cy="10" r="0.7" />
      <circle cx="18" cy="14" r="0.7" />
    </>
  ),
  fridge: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M6 10h12" />
      <path d="M10 6v3" />
      <path d="M10 13v2" />
    </>
  ),
  coffee: (
    <>
      <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <path d="M6 2v3" />
      <path d="M10 2v3" />
      <path d="M14 2v3" />
    </>
  ),
  minibar: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="1.5" />
      <path d="M5 12h14" />
      <path d="M9 8v2" />
      <path d="M9 15v2" />
    </>
  ),
  water: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M10 10h4" />
      <path d="M12 8v4" />
      <path d="M6 15h12" />
    </>
  ),
  utensils: (
    <>
      <path d="M3 3v9a3 3 0 0 0 6 0V3" />
      <path d="M6 3v18" />
      <path d="M18 3a5 5 0 0 1 0 10V3Z" />
      <path d="M18 13v8" />
    </>
  ),
  outdoor_dining: (
    <>
      <path d="M4 12h16" />
      <path d="m6 12-2 8" />
      <path d="m18 12 2 8" />
      <path d="M12 4v8" />
      <path d="M8 4h8" />
    </>
  ),
  crib: (
    <>
      <rect x="3" y="8" width="18" height="10" rx="1.5" />
      <path d="M6 8V6a2 2 0 0 1 4 0v2" />
      <path d="M3 13h18" />
    </>
  ),
  bathtub: (
    <>
      <path d="M4 12h16a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2a1 1 0 0 1 1-1Z" />
      <path d="M6 12V5a2 2 0 0 1 4 0v1" />
    </>
  ),
  sterilizer: (
    <>
      <rect x="5" y="6" width="14" height="14" rx="2" />
      <path d="M5 12h14" />
      <path d="M9 3v3" />
      <path d="M15 3v3" />
      <circle cx="12" cy="15.5" r="1.5" />
    </>
  ),
  toiletries: (
    <>
      <rect x="7" y="6" width="4" height="14" rx="1" />
      <rect x="13" y="3" width="4" height="17" rx="1" />
      <path d="M7 10h4" />
      <path d="M13 7h4" />
    </>
  ),
  hairdryer: (
    <>
      <path d="M4 14c0-2.2 1.8-4 4-4h2v8H8a4 4 0 0 1-4-4Z" />
      <path d="M10 10h6a4 4 0 0 0 0-8h-6Z" />
      <path d="M10 18v3" />
    </>
  ),
  firstaid: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M12 10v4" />
      <path d="M10 12h4" />
      <path d="M7 6V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2" />
    </>
  ),
  extinguisher: (
    <>
      <rect x="8" y="6" width="8" height="15" rx="2" />
      <path d="M12 3v3" />
      <path d="M10 3h4" />
      <path d="M15 9h2l1 3" />
    </>
  ),
};

/** The drawn icons, by slug. Exported so the editor can offer exactly this set
 *  — the 38 icons here were unreachable from the admin, which had no control
 *  that could produce a slug, so every badge fell through to an emoji or the
 *  fallback diamond. A test keeps the picker and this list in step. */
export const BADGE_ICON_SLUGS: string[] = Object.keys(ICON_PATHS);

function FeatureIcon({ name }: { name: string }) {
  const paths = ICON_PATHS[name];
  if (!paths) {
    /* The 一鍵勾選 amenity list writes emoji ("🏊", "♨️", "🍳"), while ICON_PATHS
       is keyed by slug — so every one of the eighteen common amenities fell
       through to the generic diamond below and they all looked identical. No
       admin control can produce an ICON_PATHS key, so the emoji IS the icon the
       editor picked: render it rather than discarding it. The diamond stays for
       a genuinely empty value. */
    const trimmed = name.trim();
    if (trimmed && !/^[a-z0-9_-]+$/i.test(trimmed)) {
      return <span className="feature-badge-glyph" aria-hidden="true">{trimmed}</span>;
    }
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" {...STROKE} aria-hidden="true">
        <path d="M12 4.5 19.5 12 12 19.5 4.5 12Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" {...STROKE} aria-hidden="true">
      {paths}
    </svg>
  );
}

type FeatureItem = {
  icon: string;
  label: string;
  category: string;
};

export default function BlockFeatureBadges({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const title = cfgT(config, "title", locale);
  const eyebrow = eyebrowT(config, locale);
  const rawItems = Array.isArray(config.items) ? config.items : [];

  const items: FeatureItem[] = rawItems.map((raw) => {
    const item = raw as Record<string, unknown>;
    return {
      icon: String(item.icon ?? ""),
      label: cfgT(item, "label", locale),
      category: cfgT(item, "category", locale),
    };
  });

  if (!items.length) return null;

  const hasCategories = items.some((it) => it.category);

  if (!hasCategories) {
    return (
      <section className="property-features section">
        {(eyebrow || title) && (
          <div className="section-header">
            <div>
              <SectionHeading eyebrow={eyebrow} title={title} />
            </div>
          </div>
        )}
        <div className="property-features-grid">
          {items.map((item, i) => (
            <div className="property-feature-badge" key={i}>
              <span className="property-feature-icon">
                <FeatureIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const uncategorized = items.filter((it) => !it.category);
  const categoryOrder: string[] = [];
  const categoryMap: Record<string, FeatureItem[]> = {};
  for (const it of items) {
    if (!it.category) continue;
    if (!categoryMap[it.category]) {
      categoryMap[it.category] = [];
      categoryOrder.push(it.category);
    }
    categoryMap[it.category].push(it);
  }

  return (
    <section className="property-features property-features--categorized section">
      {(eyebrow || title) && (
        <div className="section-header">
          <div>
            <SectionHeading eyebrow={eyebrow} title={title} />
          </div>
        </div>
      )}
      {uncategorized.length > 0 && (
        <div className="property-features-grid">
          {uncategorized.map((item, i) => (
            <div className="property-feature-badge" key={i}>
              <span className="property-feature-icon">
                <FeatureIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
      {categoryOrder.map((cat) => (
        <div className="property-features-category" key={cat}>
          <h3 className="property-features-category-title">{cat}</h3>
          <div className="property-features-category-grid">
            {categoryMap[cat].map((item, i) => (
              <div className="property-feature-category-item" key={i}>
                <span className="property-feature-icon">
                  <FeatureIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
