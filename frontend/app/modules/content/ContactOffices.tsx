import { Building2, ChevronDown, Mail, MapPin, Phone } from "lucide-react";
import type { Locale } from "../i18n";
import { cfgT } from "../tr";
import { mapsUrl, lineUrl } from "../socialLinks";

/**
 * The 通訊處 list from a 交通聯繫 block.
 *
 * The block is drawn by two renderers — PageBlocks for group content pages,
 * BlockContactInfo for villa pages and the group homepage — and only the first
 * implemented this list. An editor could add 台北通訊處 to a villa page, save
 * without error, and the offices simply never appeared. Both use this now, so
 * the control means the same thing on every surface.
 */

function OfficeCard({
  note,
  locale,
  children,
}: {
  note: string;
  locale: string;
  children: React.ReactNode;
}) {
  if (!note) return <div className="contact-office">{children}</div>;
  return (
    <div className="contact-office has-note">
      {/* The row stays outside the <summary>. It carries tel:, mailto: and
          Maps links, and nested interactive content inside a summary is both
          invalid and actively wrong: tapping a phone number toggled the panel
          instead of dialling, and a screen reader announced the whole row as
          the toggle's label. Only the arrow is the control. */}
      <div className="contact-office-summary">{children}</div>
      <details className="contact-office-more">
        <summary className="contact-office-more-toggle">
          <ChevronDown className="contact-office-chevron" size={18} aria-hidden="true" />
          <span className="sr-only">{locale === "zh" ? "展開說明" : "Show more"}</span>
        </summary>
        <p className="contact-office-note">{note}</p>
      </details>
    </div>
  );
}

export default function ContactOffices({
  offices,
  locale,
}: {
  offices: Array<Record<string, unknown>>;
  locale: string;
}) {
  if (!offices.length) return null;
  return (
    <div className="contact-offices">
        {offices.map((o, i) => {
          const oName = cfgT(o, "name", locale as Locale);
          const oPhone = typeof o.phone === "string" ? o.phone : "";
          const oEmail = typeof o.email === "string" ? o.email : "";
          const oLine = typeof o.line === "string" ? o.line.trim() : "";
          const oAddress = cfgT(o, "address", locale as Locale);
          const oNote = cfgT(o, "note", locale as Locale);
          if (!oName && !oPhone && !oEmail && !oAddress) return null;
          /* One row per 通訊處, with each value under its own label.
             These used to be <details>: the row showed only the branch name
             and the address, phone and email were folded away behind it, so
             the page a visitor opens to find a phone number showed no phone
             numbers until they clicked. Every field is on the row now, which
             also means there is nothing left to reveal - so there is no
             disclosure control rather than one that opens onto nothing. */
          return (
            <OfficeCard key={i} note={oNote} locale={locale}>
              <div className="contact-office-head">
                <Building2 className="contact-office-icon" size={38} strokeWidth={1} aria-hidden="true" />
                <span className="contact-office-name">
                  {oName || (locale === "zh" ? "通訊處" : "Office")}
                </span>
              </div>
              <dl className="contact-office-fields">
                {oAddress && (
                  <div className="contact-office-field">
                    <dt>{locale === "zh" ? "地址" : "Address"}</dt>
                    <dd>
                      {mapsUrl(oAddress) ? (
                        <a href={mapsUrl(oAddress)} target="_blank" rel="noopener noreferrer">{oAddress}</a>
                      ) : (
                        oAddress
                      )}
                    </dd>
                  </div>
                )}
                {oPhone && (
                  <div className="contact-office-field">
                    <dt>{locale === "zh" ? "電話" : "Phone"}</dt>
                    <dd><a href={`tel:${oPhone.replace(/[^\d+]/g, "")}`}>{oPhone}</a></dd>
                  </div>
                )}
                {oEmail && (
                  <div className="contact-office-field">
                    <dt>{locale === "zh" ? "Email 或其他聯絡資訊" : "Email"}</dt>
                    <dd><a href={`mailto:${oEmail}`}>{oEmail}</a></dd>
                  </div>
                )}
                {/* Per office, so a recruitment branch can carry its own account
                    (客戶: 我們最近在徵才，就會放徵才中心的 LINE). lineUrl builds
                    the deep link from an @handle or passes a full URL through, so
                    a phone opens the app and a desktop opens the account page —
                    no QR image needed, same as the IG/FB icons above. */}
                {/* Gated on the built URL, not on the raw value: lineUrl
                    returns "" for a handle it will not link (see
                    socialLinks.ts), and this rendered it anyway — so an office
                    whose LINE was typed with a space or as an email address got
                    `<a href="">`, which reloads the page the reader is on. Same
                    shape PageBlocks' contact renderer already uses. */}
                {oLine && lineUrl(oLine) && (
                  <div className="contact-office-field">
                    <dt>LINE</dt>
                    <dd>
                      <a href={lineUrl(oLine)} target="_blank" rel="noopener noreferrer">{oLine}</a>
                    </dd>
                  </div>
                )}
              </dl>
            </OfficeCard>
          );
        })}
      </div>
  );
}
