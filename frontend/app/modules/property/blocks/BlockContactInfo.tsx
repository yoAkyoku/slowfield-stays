import { googleMapEmbedSrc } from "../../safeHtml";
import { lineUrl } from "../../socialLinks";
import type { Locale } from "../../i18n";
import { cfgT , eyebrowT} from "../../tr";
import MapEmbed from "../../MapEmbed";
import FeatureIcon from "./FeatureIcon";
import ContactOffices from "../../content/ContactOffices";

export default function BlockContactInfo({ locale, config, siteLine, siteSlug }: { locale: Locale; config: Record<string, unknown>; siteLine?: string; siteSlug?: string }) {
  const zh = locale === "zh";
  const title = cfgT(config, "title", locale, zh ? "交通與聯繫" : "Contact & Directions");
  const eyebrow = eyebrowT(config, locale);
  const address = cfgT(config, "address", locale);
  const phone = String(config.phone ?? "");
  const email = String(config.email ?? "");
  /* The block's own LINE wins; the site-wide one is the fallback for a block
     that leaves the field blank. That is what the admin field has always
     promised ("留空則用站群設定") and the exact reverse of what ran here: a
     villa page is always handed a siteLine, so a LINE typed into this block was
     discarded on every villa — the only surface where the field did anything
     was the group homepage, which threads no siteLine at all. A control that
     works in one place and is ignored in another is worse than one that does
     not exist. */
  const blockLine = typeof config.line === "string" ? config.line.trim() : "";
  const line = blockLine || (siteLine ?? "").trim();
  /* lineUrl returns "" for a handle it will not build a link from, precisely so
     the caller can draw nothing rather than a dead link (see socialLinks.ts).
     Both layouts below rendered `<a href={lineUrl(line)}>` gated on `line`
     alone, so a mistyped id — a space, an email address, anything outside
     [A-Za-z0-9._-] — produced `<a href="">`, which reloads the current page.
     PageBlocks' own contact renderer already gates on the built URL. */
  const lineHref = lineUrl(line);
  const mapEmbed = String(config.map_embed ?? "");
  const directions = cfgT(config, "directions", locale);

  /* The shared allow-list, not a local copy of it. The check here anchored on a
     `\b` after the host, and a hostname does not end at a word boundary:
     `https://maps.google.com@evil.example/maps` and
     `https://maps.google.com.evil.example/maps` both passed, and the value went
     straight into an <iframe src> — an arbitrary origin framed on the page.
     googleMapEmbedSrc parses the URL and compares the real hostname, and it
     already accepts a whole pasted <iframe> tag, so the src extraction goes
     with it. */
  const iframeSrc = googleMapEmbedSrc(mapEmbed);
  const mapSafe = Boolean(iframeSrc);
  const mapsLink = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "";

  /* Both of these were implemented only in the group-content renderer, so on
     a villa page or the group homepage an editor could add 通訊處 and tick the
     card toggle and neither did anything. Same keys, same defaults. */
  const offices = Array.isArray(config.offices)
    ? (config.offices as Array<Record<string, unknown>>)
    : [];
  const showPrimary = config.show_primary !== false;
  // lineHref, not line: a LINE id that will not build a link draws no row, so
  // counting it here left the 01 card open with an empty list inside it.
  const hasReach = showPrimary && (phone || lineHref || email);
  const layout = config.layout === "classic" ? "classic" : "cards";
  const mapBrandName = siteSlug
    ? siteSlug.split("-").filter(Boolean).join(" ").toUpperCase()
    : "SLOWFIELD STAYS";
  const mapBrandMeta = siteSlug === "hejing"
    ? (zh ? "冬山・宜蘭" : "DONGSHAN · YILAN")
    : (zh ? "位置導覽" : "LOCATION GUIDE");

  // ── Classic layout: info column + side map, directions below ──
  if (layout === "classic") {
    return (
      <section className="property-contact section">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        <div className="property-contact-grid">
          <div className="property-contact-info">
            {address && (
              <div className="property-contact-item">
                <FeatureIcon icon="icon:pin" />
                <div className="property-contact-item-body">
                  <strong>{zh ? "地址" : "Address"}</strong>
                  {/* The phone and email beside this were already tappable; the
                      address was not, so it had to be copied out by hand. */}
                  {mapsLink ? (
                    <a href={mapsLink} target="_blank" rel="noopener noreferrer">{address}</a>
                  ) : (
                    <p>{address}</p>
                  )}
                </div>
              </div>
            )}
            {/* 顯示上方中央聯絡資訊卡 gated only the cards layout — this branch
                returns before that check, so turning the toggle off changed
                nothing here and the phone, email and LINE stayed on the page.
                Address keeps its own row, exactly as it keeps its own card in
                the other layout. */}
            {showPrimary && phone && (
              <div className="property-contact-item">
                <FeatureIcon icon="icon:phone" />
                <div className="property-contact-item-body">
                  <strong>{zh ? "電話" : "Phone"}</strong>
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>
                </div>
              </div>
            )}
            {showPrimary && email && (
              <div className="property-contact-item">
                <FeatureIcon icon="icon:mail" />
                <div className="property-contact-item-body">
                  <strong>Email</strong>
                  <a href={`mailto:${email}`}>{email}</a>
                </div>
              </div>
            )}
            {showPrimary && lineHref && (
              <div className="property-contact-item">
                <FeatureIcon icon="icon:chat" />
                <div className="property-contact-item-body">
                  <strong>LINE</strong>
                  <a href={lineHref} target="_blank" rel="noopener noreferrer">{line}</a>
                </div>
              </div>
            )}
          </div>
          {mapSafe && (
            <div className="property-contact-map">
              <MapEmbed
                src={iframeSrc!}
                title={title}
                locale={locale}
                brandName={mapBrandName}
                brandMeta={mapBrandMeta}
                externalUrl={mapsLink}
              />
            </div>
          )}
        </div>
        <ContactOffices offices={offices} locale={locale} />
        {directions && (
          <div className="property-contact-directions">
            <h3>{zh ? "交通指引" : "Directions"}</h3>
            {directions.split("\n").map((ln, i) => (ln.trim() ? <p key={i}>{ln}</p> : null))}
          </div>
        )}
      </section>
    );
  }

  /* Numbered by what is on the page, not by which role the card plays.
     All three are conditional — 聯絡我們 needs a phone, a LINE or an email;
     地址 and 如何抵達 are each their own field — but the numbers were written
     into the markup as 01 / 02 / 03. A block with only an address rendered one
     card labelled "02", and one with no phone started the list at "02" as well:
     a numbered sequence that starts in the middle reads as a card having gone
     missing, which is the opposite of what it means.
     Counted from the flags rather than by a counter mutated inside the JSX, so
     the number does not depend on the order the branches happen to evaluate. */
  const present = [hasReach, Boolean(address), Boolean(directions)];
  const cardNum = (index: number) =>
    String(present.slice(0, index).filter(Boolean).length + 1).padStart(2, "0");

  return (
    <section className="property-contact section">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2>{title}</h2>

      <div className="property-contact-cards">
        {hasReach && (
          <div className="property-contact-card">
            <span className="property-contact-card-num">{cardNum(0)}</span>
            <strong className="property-contact-card-title">{zh ? "聯絡我們" : "Reach us"}</strong>
            <ul className="property-contact-lines">
              {phone && (
                <li>
                  <span>{zh ? "電話" : "Phone"}</span>
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>
                </li>
              )}
              {lineHref && (
                <li>
                  <span>LINE</span>
                  <a href={lineHref} target="_blank" rel="noopener noreferrer">{line}</a>
                </li>
              )}
              {email && (
                <li>
                  <span>Email</span>
                  <a href={`mailto:${email}`}>{email}</a>
                </li>
              )}
            </ul>
          </div>
        )}

        {address && (
          <div className="property-contact-card">
            <span className="property-contact-card-num">{cardNum(1)}</span>
            <strong className="property-contact-card-title">{zh ? "地址" : "Address"}</strong>
            <p>{address}</p>
            {mapsLink && (
              <a className="property-contact-maplink" href={mapsLink} target="_blank" rel="noopener noreferrer">
                {zh ? "在 Google 地圖開啟 →" : "Open in Google Maps →"}
              </a>
            )}
          </div>
        )}

        {directions && (
          <div className="property-contact-card">
            <span className="property-contact-card-num">{cardNum(2)}</span>
            <strong className="property-contact-card-title">{zh ? "如何抵達" : "How to arrive"}</strong>
            <div className="property-contact-directions-body">
              {directions.split("\n").map((ln, i) => (ln.trim() ? <p key={i}>{ln}</p> : null))}
            </div>
          </div>
        )}
      </div>

      {mapSafe && (
        <div className="property-contact-map">
          <MapEmbed
            src={iframeSrc!}
            title={title}
            locale={locale}
            brandName={mapBrandName}
            brandMeta={mapBrandMeta}
            externalUrl={mapsLink}
          />
        </div>
      )}
      <ContactOffices offices={offices} locale={locale} />
    </section>
  );
}
