"use client";

import { useState } from "react";
import useAutoAdvance from "../../useAutoAdvance";
import type { Locale } from "../../i18n";
import { cfgT, eyebrowT, pickT } from "../../tr";
import { Lightbox, type LightboxImage } from "../LightboxGallery";
import SectionHeading from "../../SectionHeading";

type BiText = string | Record<string, string> | undefined;
type Spec = { label?: BiText; value?: BiText };
type RoomItem = {
  number?: BiText;
  name?: BiText;
  images?: unknown[];
  specs?: Spec[];
};

const bi = (v: BiText, locale: string): string => pickT(v, locale === "en" ? "en" : "zh");

function toImages(raw: unknown): LightboxImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      if (typeof it === "string") return { url: it };
      if (it && typeof it === "object" && "url" in it) return { url: String((it as Record<string, unknown>).url ?? "") };
      return null;
    })
    .filter((x): x is LightboxImage => !!x && x.url !== "");
}

/** One villa / room: a photo carousel (with 放大實景 zoom) beside its spec panel. */
function RoomCard({ item, locale, index }: { item: RoomItem; locale: string; index: number }) {
  const images = toImages(item.images);
  const [cur, setCur] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const name = bi(item.name, locale);
  const specs = (item.specs ?? []).filter((s) => bi(s.label, locale) || bi(s.value, locale));
  // Client: label villas 棟別 (A棟 / B棟…), not 01 / 02. An explicit item.number
  // (string or bilingual {zh,en}) still wins so the admin can set any label.
  const letter = String.fromCharCode(65 + index); // A, B, C…
  const num = bi(item.number, locale) || (locale === "zh" ? `${letter}棟` : `Villa ${letter}`);
  const go = (d: number) => images.length && setCur((cur + d + images.length) % images.length);
  const autoRef = useAutoAdvance(
    () => setCur((p) => (p + 1) % images.length),
    { count: images.length, enabled: zoom === null },
  );

  // Alternate the photo side: image left for even index (0,2,…), right for odd.
  /* Every room keeps the picture on the same side. Alternating by index read
     well one card at a time and badly as a list: scanning down the page the
     images zig-zagged left-right and each heading landed somewhere new, so
     nothing lined up (客戶: 房型之間的圖片不能這樣，從上往下看不好看). */
  const reversed = false;

  return (
    <article className={`property-room-card${reversed ? " property-room-card--reversed" : ""}`}>
      {/* Only when there is something to put in it. The container carries a
         `::before { padding-top: 66% }` for its aspect ratio, a 14px radius and
         a drop shadow, so a room with no photos yet drew a 516×341 empty panel
         on desktop — every new room added in the admin grew one until someone
         uploaded a picture (客戶: 這個房型是可以增加很多房型). Below 900px the
         ::before is display:none so it collapsed, which is why it only showed
         on a desktop screen. */}
      {images.length > 0 && (
      <div className="property-room-media" ref={autoRef}>
        {images.length > 0 && (
          <button
            type="button"
            className="property-room-photo"
            aria-label={locale === "zh" ? "放大實景" : "Enlarge photo"}
            onClick={() => setZoom(cur)}
          >
            <img src={images[cur].url} alt={`${name} ${cur + 1}`} />
            <span className="property-room-zoom-hint">
              <span aria-hidden="true">⤢</span>
              {locale === "zh" ? "放大實景" : "Enlarge"}
            </span>
          </button>
        )}
        {images.length > 1 && (
          <>
            <button type="button" className="property-room-arrow property-room-arrow--prev" aria-label={locale === "zh" ? "上一張" : "Previous"} onClick={() => go(-1)}>‹</button>
            <button type="button" className="property-room-arrow property-room-arrow--next" aria-label={locale === "zh" ? "下一張" : "Next"} onClick={() => go(1)}>›</button>
            <div className="property-room-dots">
              {images.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  className={`property-room-dot${i === cur ? " is-active" : ""}`}
                  /* A bare ordinal read as "1, button" with nothing to say what
                     it selects, and which photo was showing was carried by
                     colour alone. */
                  aria-label={locale === "zh" ? `第 ${i + 1} 張` : `Photo ${i + 1}`}
                  aria-current={i === cur}
                  onClick={() => setCur(i)}
                />
              ))}
            </div>
            {/* Changing slide swaps the src on one <img>, which announces
                nothing — so pressing 下一張 appeared to do nothing at all. */}
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {locale === "zh" ? `第 ${cur + 1} 張，共 ${images.length} 張` : `Photo ${cur + 1} of ${images.length}`}
            </span>
          </>
        )}
      </div>
      )}
      <div className="property-room-info">
        <div className="property-room-heading">
          <span className="property-room-number">{num}</span>
          {name && <h3>{name}</h3>}
        </div>
        {specs.length > 0 && (
          <dl className="property-room-specs">
            {specs.map((s, i) => (
              <div className="property-room-spec" key={i}>
                <dt>{bi(s.label, locale)}</dt>
                <dd>{bi(s.value, locale)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {zoom !== null && (
        <Lightbox images={images} index={zoom} onClose={() => setZoom(null)} onIndex={setZoom} />
      )}
    </article>
  );
}

export default function BlockRooms({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const items = (Array.isArray(config.items) ? config.items : []) as RoomItem[];
  const eyebrow = eyebrowT(config, locale);
  const title = cfgT(config, "title", locale);
  if (!items.length) return null;

  return (
    <section className="property-rooms section">
      {(eyebrow || title) && (
        <div className="section-header">
          <div>
            <SectionHeading eyebrow={eyebrow} title={title} />
          </div>
        </div>
      )}
      <div className="property-rooms-list">
        {items.map((item, i) => (
          <RoomCard key={i} item={item} locale={locale} index={i} />
        ))}
      </div>
    </section>
  );
}
