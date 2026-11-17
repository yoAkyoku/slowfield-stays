import type { Locale } from "../../i18n";
import { cfgT , eyebrowT, trs} from "../../tr";
import { getPropertySites, getStays } from "../../api";
import LeafletMap, { type MapMarker } from "./LeafletMap";
import MapEmbed from "../../MapEmbed";
import { googleMapEmbedSrc } from "../../safeHtml";
import { resolveMapMode } from "./mapMode";
import SectionHeading from "../../SectionHeading";

/**
 * Map block. Three modes:
 *  - "pins" (default when markers exist): a free Leaflet + OpenStreetMap map with
 *    multiple admin-managed markers — one per 民宿 — no API key / Google account.
 *  - "stays": the same map, but the pins are the published villa list, read at
 *    render time so a new villa appears without anyone editing the block.
 *  - "embed": a Google Map iframe (single place, or a "My Maps" multi-pin embed).
 *    Only google.com/maps URLs are allowed (no arbitrary-iframe injection).
 */

const HEIGHT_PX: Record<string, number> = { short: 320, medium: 460, tall: 620 };

function extractMapSrc(raw: string): string | null {
  return googleMapEmbedSrc(raw) || null;
}

function parseMarkers(raw: unknown, locale: Locale): MapMarker[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const it = (item ?? {}) as Record<string, unknown>;
      const lat = typeof it.lat === "number" ? it.lat : parseFloat(String(it.lat ?? ""));
      const lng = typeof it.lng === "number" ? it.lng : parseFloat(String(it.lng ?? ""));
      return {
        name: cfgT(it, "name", locale),
        desc: cfgT(it, "desc", locale),
        image: typeof it.image === "string" ? it.image : "",
        link: typeof it.link === "string" ? it.link : "",
        lat,
        lng,
      };
    })
    .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
}

/** One pin per published villa that has coordinates. A villa without lat/lng is
 *  skipped rather than dropped at 0,0 — an unplaced pin in the Gulf of Guinea
 *  is worse than no pin. */
async function stayMarkers(locale: Locale): Promise<MapMarker[]> {
  /* A pin has to land somewhere that exists. `/stays/{slug}` is the villa's own
     site, which only answers while that site is published — a villa listed here
     before its site goes live sent every click to a 404. The catalogue cards
     already solved this by routing to the parent's detail page instead; the map
     was the one place still guessing. */
  const [stays, propertySites] = await Promise.all([getStays(), getPropertySites()]);
  const liveVillaSlugs = new Set(propertySites.map((site) => site.slug));
  return stays
    .map((stay) => {
      const loc = (stay.location_config ?? {}) as Record<string, unknown>;
      return {
        name: trs(stay, "name", locale),
        desc: trs(stay, "summary", locale),
        image: stay.hero_image_url ?? "",
        link: liveVillaSlugs.has(stay.slug) ? `/stays/${stay.slug}` : `/stays/detail/${stay.slug}`,
        lat: parseFloat(String(loc.lat ?? "")),
        lng: parseFloat(String(loc.lng ?? "")),
      };
    })
    .filter((m) => m.name && Number.isFinite(m.lat) && Number.isFinite(m.lng));
}

export default async function BlockMap({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const heading = cfgT(config, "heading", locale);
  const eyebrow = eyebrowT(config, locale);
  const caption = cfgT(config, "caption", locale);
  const heightKey = typeof config.height === "string" ? config.height : "medium";
  const heightPx = HEIGHT_PX[heightKey] || HEIGHT_PX.medium;
  /* Deliberately http(s)-only, and deliberately NOT safeLinkHref like the
     attraction cards next door. The link this fills is labelled "在 Google 地圖
     開啟 / Open in Google Maps": its destination is somebody else's map by
     definition, so a site-relative path, an anchor, a tel: or a mailto: here is
     a mistake being typed, not a shortcut being taken — and accepting one would
     produce a link whose own label lies about where it goes. Widening it for
     symmetry with the attractions field would be consistency at the cost of the
     only thing this field means. */
  const linkHref = typeof config.link === "string" && /^https?:\/\//.test(config.link) ? config.link : "";

  const src = extractMapSrc(String(config.embed ?? config.map_embed ?? ""));

  const rawMarkers = Array.isArray(config.markers) ? (config.markers as Record<string, unknown>[]) : [];
  // From the config AND what the block actually holds, so a retired mode
  // degrades to a working map instead of rendering nothing.
  const mode = resolveMapMode(config.mode, parseMarkers(rawMarkers, locale).length);

  // "stays" mode reads the villa list at render time, so opening a new villa
  // puts it on the map without anyone remembering to come back here. The
  // one-click import in the admin stays for maps that mix villas with
  // hand-placed pins; this mode is for the map that IS the villa list.
  //
  // A villa that the auto list already covers is dropped from the hand-made
  // pins, so the two do not stack on the same spot. Two ways a stored pin can
  // be the same villa: the import button stamped it with `_stay`, or someone
  // typed it in by hand and pointed it at the villa's page — measured on the
  // live site, where a hand-typed pin doubled up the moment the mode changed.
  // Anything else (a station, a trailhead) is left alone.
  const fromStays = mode === "stays" ? await stayMarkers(locale) : [];
  const stayHrefs = new Set(fromStays.map((m) => m.link));
  const handMade = parseMarkers(
    mode === "stays"
      ? rawMarkers.filter((m) => !m?._stay && !stayHrefs.has(String(m?.link ?? "")))
      : rawMarkers,
    locale,
  );
  const markers = [...fromStays, ...handMade];

  // Use the multi-pin Leaflet map when markers are provided (or mode is "pins");
  // otherwise fall back to the Google embed.
  const usePins = mode === "pins" || mode === "stays";

  if (usePins ? markers.length === 0 : !src) return null;

  return (
    <section className="property-map section">
      <SectionHeading eyebrow={eyebrow} title={heading} />
      {usePins ? (
        <div className="property-map-frame">
          <LeafletMap markers={markers} height={heightPx} locale={locale} />
        </div>
      ) : (
        <div className="property-map-frame" style={{ height: heightPx }}>
          <MapEmbed src={src!} title={heading || "Map"} locale={locale} />
        </div>
      )}
      {(caption || linkHref) && (
        <div className="property-map-meta">
          {caption && <p>{caption}</p>}
          {linkHref && (
            <a href={linkHref} target="_blank" rel="noopener noreferrer">
              {locale === "zh" ? "在 Google 地圖開啟 →" : "Open in Google Maps →"}
            </a>
          )}
        </div>
      )}
    </section>
  );
}
