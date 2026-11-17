import type { Stay } from "../api";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { getLocale, t } from "../i18n";
import { trs, bilingual, bilingualOr, shortAmenity, type ShortAmenityRule } from "../tr";
import { googleMapEmbedSrc } from "../safeHtml";
import JsonLd from "../JsonLd";
import { seoTextForLocale, siteUrl } from "../seo";
import StayHeroCarousel from "./StayHeroCarousel";
import StayRoomTabs from "./StayRoomTabs";
import StayAmenityGrid from "./StayAmenityGrid";
import StayFaqAccordion from "./StayFaqAccordion";
import StayRelatedContent from "./StayRelatedContent";
import MapEmbed from "../MapEmbed";
import { getCurrentSite, getPagesByIds, getPropertySites } from "../api";
import { stayLocationLabel } from "../stayLocations";
import { formatPrice } from "../apiBase";

/**
 * The stay detail page, everything below fetching the stay itself.
 *
 * Split out so the admin preview can draw an unpublished stay with these exact
 * components. It used to hand-rebuild a rough approximation — a hero, a title,
 * one paragraph — which meant the preview could not show rooms, amenities, FAQs,
 * the gallery or the map, and drifted further from the real page with every
 * change to it. There is only one stay page now; the preview is that page.
 */
export default async function StayDetailView({ stay }: { stay: Stay }) {
  const locale = await getLocale();
  const copy = t(locale);
  const stayName = trs(stay, "name", locale);
  const staySummary = trs(stay, "summary", locale);
  const stayDestination = trs(stay, "destination", locale);
  const stayRegion = trs(stay, "region", locale);
  const stayLocation = stayLocationLabel(stay, locale);
  const stayStory = trs(stay, "story", locale);
  const roomTypes = stay.room_types.filter((room) =>
    Boolean(room.name?.trim() || room.description?.trim() || room.price > 0 || room.capacity > 0)
  );
  const amenities = stay.amenities.filter((amenity) => Boolean(amenity?.trim()));

  // Fetch related content pages + check for child site
  const [relatedPages, propertySites, site] = await Promise.all([
    stay.related_content_ids?.length ? getPagesByIds(stay.related_content_ids) : Promise.resolve([]),
    getPropertySites(),
    // For 設施簡稱: StayAmenityGrid takes the rules and nothing passed them, so
    // the shortening an editor configured worked on the search bar's chips and
    // not on this page's amenity grid — the same setting, live in one place and
    // inert in the other.
    getCurrentSite(),
  ]);
  // Check if a child site exists matching this stay's slug (convention: child site slug = stay slug)
  const childSite = propertySites.find((s) => s.slug === stay.slug);

  return (
    <main className="stay-detail-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "LodgingBusiness",
          name: seoTextForLocale(stayName, locale, locale === "zh" ? stayName : "Stay"),
          description: seoTextForLocale(staySummary, locale) || undefined,
          image: siteUrl(stay.hero_image_url, site),
          url: siteUrl(`/stays/${stay.slug}`, site),
          address: {
            "@type": "PostalAddress",
            addressLocality: stayDestination,
            addressRegion: stayRegion
          },
          amenityFeature: stay.amenities.map((amenity) => ({
            "@type": "LocationFeatureSpecification",
            name: amenity,
            value: true
          })),
          priceRange: formatPrice(stay.base_price, { from: true })
        }}
      />
      <section className="stay-detail-hero">
        <div className="stay-detail-copy">
          <div className="eyebrow">
            {stayLocation}
          </div>
          <h1>{stayName}</h1>
          <p>{staySummary}</p>
          <div className="tags">
            {stay.tags.map((tag) => (
              <Link className="tag tag-link" href={`/stays?tag=${encodeURIComponent(tag)}`} key={tag}>
                {shortAmenity(tag, locale)}
              </Link>
            ))}
          </div>
          {childSite && (
            <Link
              href={`/property/${childSite.slug}`}
              className="stay-child-site-link"
            >
              <ExternalLink size={14} />
              {locale === "zh" ? "前往民宿官網" : "Visit property website"}
            </Link>
          )}
        </div>
        <div className="stay-detail-media">
          <StayHeroCarousel images={stay.images} heroUrl={stay.hero_image_url} name={stayName} />
        </div>
      </section>

      <section className="stay-detail-section">
        <div className="stay-decision-strip" aria-label={copy.stays.quickFacts}>
          <div>
            <span>{copy.stays.priceLabel}</span>
            <strong>{formatPrice(stay.base_price, { from: true })}</strong>
          </div>
          <div>
            <span>{copy.stays.capacityLabel}</span>
            <strong>
              {copy.stays.upTo} {stay.max_guests} {copy.stays.guestsUnit}
            </strong>
          </div>
          <div>
            <span>{copy.stays.roomLabel}</span>
              <strong>{roomTypes.length || "—"}</strong>
          </div>
          <div>
            <span>{copy.stays.location}</span>
            <strong>{stayLocation}</strong>
          </div>
        </div>

        <div className="stay-detail-panels">
          {/* ── Left column: rooms, amenities, FAQ, rules, story ── */}
          <div className="stay-detail-panels-main">
            {roomTypes.length > 0 && (
              <div className="stay-info-panel">
                <h2>{copy.stays.rooms}</h2>
                <StayRoomTabs rooms={roomTypes} guestsUnit={copy.stays.guestsUnit} locale={locale} />
                <p className="stay-pricing-note">{copy.stays.pricingNote}</p>
              </div>
            )}
            {amenities.length > 0 && (
              <div className="stay-info-panel">
                <h2>{copy.stays.amenities}</h2>
                <StayAmenityGrid
                  amenities={amenities}
                  locale={locale}
                  shortLabels={site.settings?.amenity_short as ShortAmenityRule[] | undefined}
                />
              </div>
            )}
            {stay.faq.length ? (
              <div className="stay-info-panel">
                <StayFaqAccordion items={stay.faq} title={copy.stays.bookingFaq} locale={locale} />
              </div>
            ) : null}
            {stay.house_rules.length ? (
              <div className="stay-info-panel">
                <h2>{copy.stays.notes}</h2>
                <div className="tags">
                  {stay.house_rules.map((rule) => (
                    <span className="tag" key={rule}>
                      {bilingual(rule, locale)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {stayStory.trim() && (
              <div className="stay-info-panel stay-story-panel">
                <h2>{copy.stays.story}</h2>
                <p>{stayStory}</p>
              </div>
            )}
          </div>

          {/* ── Right column: location, map, social ── */}
          <div className="stay-detail-panels-side">
            <div className="stay-info-panel">
              <h2>{copy.stays.location}</h2>
              <p className="meta">{bilingual(stay.location_config?.address || stayDestination, locale)}</p>
              {(() => {
                // Geocode the Chinese half — TW addresses resolve best in zh.
                const rawAddress = stay.location_config?.address || `${stayDestination} ${stayRegion}`;
                const mapAddress = bilingual(rawAddress, "zh");
                const encodedAddress = encodeURIComponent(mapAddress);
                const mapUrlStr = String(stay.location_config?.map_url ?? "");
                const isSafeMapUrl = /^https?:\/\//.test(mapUrlStr);

                // Priority 1: Admin-pasted <iframe> embed with valid src (NOT pb-only URLs)
                if (stay.location_config?.map_embed) {
                  /* The shared allow-list. The check here ended at a `\b`,
                     which a hostname does not: maps.google.com@evil.example and
                     maps.google.com.evil.example both passed and were handed to
                     <iframe src>. */
                  const iframeSrc = googleMapEmbedSrc(stay.location_config.map_embed);
                  const isSafe = Boolean(iframeSrc);
                  // Reject pb-only embeds (they require API keys and fail silently)
                  const hasPbOnly = iframeSrc && /[?&]pb=/.test(iframeSrc) && !/[?&]q=/.test(iframeSrc);
                  if (isSafe && !hasPbOnly) {
                    return (
                      <div className="stay-map-embed">
                        <MapEmbed src={iframeSrc} title={stayName} locale={locale} />
                      </div>
                    );
                  }
                }

                // Priority 2: Address-based embed (most reliable, no API key needed)
                const embedSrc = `https://maps.google.com/maps?q=${encodedAddress}&z=14&output=embed`;
                const searchHref = isSafeMapUrl
                  ? mapUrlStr
                  : `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

                return (
                  <>
                    <div className="stay-map-embed">
                      <MapEmbed src={embedSrc} title={stayName} locale={locale} />
                    </div>
                    <a className="stay-map-link" href={searchHref} target="_blank" rel="noopener noreferrer">
                      {copy.stays.map}
                    </a>
                  </>
                );
              })()}
              <div className="stay-social-links">
                {Object.entries(stay.social_links || {}).map(([label, href]) => {
                  const hrefStr = String(href ?? "");
                  if (!href || !/^https?:\/\//.test(hrefStr)) return null;
                  return (
                    <a className="tag" key={label} href={hrefStr} target="_blank" rel="noopener noreferrer">
                      {label.toUpperCase()}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Booking strip (full-width, bottom) ── */}
      <section className="stay-booking-strip">
        <div className="stay-booking-strip-inner">
          <div className="stay-booking-strip-copy">
            <div className="eyebrow">{copy.stays.inquiry}</div>
            <h2>{copy.stays.sendInquiry}</h2>
            <p>{copy.stays.inquiryNote}</p>
          </div>
          <div className="stay-booking-checklist">
            <strong>{copy.stays.detailChecklistTitle}</strong>
            <ol>
              {copy.stays.detailChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
          <Link className="button stay-booking-button" href={`/contact?stay=${stay.id}`}>
            {copy.stays.sendInquiry}
          </Link>
        </div>
      </section>

      {relatedPages.length > 0 && (
        <StayRelatedContent pages={relatedPages} locale={locale} />
      )}

      <aside className="stay-mobile-inquiry-bar" aria-label={copy.stays.inquiry}>
        <div>
          <span>{copy.stays.from}</span>
          <strong>{formatPrice(stay.base_price, { from: true })}</strong>
          <small>
            {copy.stays.upTo} {stay.max_guests} {copy.stays.guestsUnit}
          </small>
        </div>
        <Link href={`/contact?stay=${stay.id}`}>{copy.stays.sendInquiry}</Link>
      </aside>
    </main>
  );
}
