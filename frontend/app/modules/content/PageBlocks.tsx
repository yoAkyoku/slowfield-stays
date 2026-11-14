import { lineUrl, mapsUrl } from "../socialLinks";
import type { CSSProperties } from "react";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { cssUrl } from "../safeCss";
import BlockWrapper from "../BlockWrapper";
import { renderWithPairs } from "../blockPairs";
import { googleMapEmbedSrc, mapSrcForLocale } from "../safeHtml";
import type { Locale } from "../i18n";
import BlockFlow from "../home/blocks/BlockFlow";
import BlockStays from "../home/blocks/BlockStays";
import BlockGallery from "../home/blocks/BlockGallery";
import BlockPathways from "../home/blocks/BlockPathways";
import BlockEditorial from "../home/blocks/BlockEditorial";
import BlockAbout from "../home/blocks/BlockAbout";
import BlockFeatureList from "../property/blocks/BlockFeatureList";
import BlockImageGallery from "../property/blocks/BlockImageGallery";
import BlockRichText from "../property/blocks/BlockRichText";
import BlockOembed from "../property/blocks/BlockOembed";
import BlockVideoText from "../property/blocks/BlockVideoText";
import BlockFeatureHero from "../property/blocks/BlockFeatureHero";
import BlockAlternating from "../property/blocks/BlockAlternating";
import ContactFormBlock from "./ContactFormBlock";
import BlockNewsletter from "../home/blocks/BlockNewsletter";
import BlockSearchBar from "../home/blocks/BlockSearchBar";
import ContactOffices from "./ContactOffices";
import BlockContactInfo from "../property/blocks/BlockContactInfo";
import BlockHeroBanner from "../property/blocks/BlockHeroBanner";
import BlockRooms from "../property/blocks/BlockRooms";
import BlockMap from "../property/blocks/BlockMap";
import BlockAttractions from "../property/blocks/BlockAttractions";
import BlockPartners from "../property/blocks/BlockPartners";
import BlockFeatureBadges from "../property/blocks/BlockFeatureBadges";
import BlockFaqAccordion from "../property/blocks/BlockFaqAccordion";
import BlockHouseRules from "../property/blocks/BlockHouseRules";
import BlockTable from "../property/blocks/BlockTable";
import { cfgT, eyebrowT } from "../tr";
import { reportUnknownBlock } from "../unknownBlock";

export type PageBlock = {
  id: string;
  type: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

/* ── Property-specific block renderers ── */

/* FAQ, 入住須知 and 表格 each used to have a second, thinner implementation
   here, and all three had drifted from the villa components far enough for an
   editor to see it. Measured on the copies that stood here:

     · An FAQ with no items rendered an empty <section> that still took its
       block padding, and an item with a question but no answer rendered an
       empty <p>. BlockFaqAccordion returns null and filters the item.
     · The FAQ answer is WYSIWYG HTML. This copy put it through safeHtml and
       into a <p>, so an answer containing a list produced `<p><ul>…</ul></p>`,
       which every browser unnests into three siblings — the list escaped the
       paragraph and the answer's own styling with it. BlockFaqAccordion routes
       rich answers through sanitizeRichHtml into a <div>.
     · No FAQPage JSON-LD, which the villa page emits, so the same questions
       were eligible for a rich result on one kind of page and not the other.
     · 入住須知 did not filter empty labels: a blank row still drew its "01" and
       an empty <strong>. (It also called cfgT twice for every detail.)
     · The table's backward-compat header for the old pricing_table format was
       名稱／價格／說明 against the villa's 房型／價格／容量／說明 — one column
       short, so the capacity of every room was silently dropped on a content
       page while the same block showed it on a villa.
     · Cells were written straight into <td>. A bilingual `{zh,en}` cell — which
       the editor can and does save — is an object, and React throws on it
       ("Objects are not valid as a React child"), taking the whole page down.
       BlockTable resolves it through cellText().

   Rich text, image gallery, rooms and 設施 already reach for the property
   component here; these three now do too, so there is one implementation of
   each and it is the one the admin preview already draws. */

function ContactInfo({ config, locale, siteLine }: { config: Record<string, unknown>; locale: string; siteLine?: string }) {
  const title = cfgT(config, "title", locale as Locale);
  // The block has offered an 眉批 field all along and this renderer dropped it,
  // so an editor could fill it in, save, and see nothing (客戶: 小標要放回來).
  // Strictly this locale, the way BlockContactInfo reads the same field — see
  // the FAQ block above for what the borrowing version did when it was cleared.
  const eyebrow = eyebrowT(config, locale as Locale);
  const address = cfgT(config, "address", locale as Locale);
  /* 交通指引 is offered on every contact block, and /contact defaults to the
     cards layout — which is this renderer. Only the classic layout and the
     villa page read it, so text typed into the field on the site's own contact
     page saved and appeared nowhere. Same markup as BlockContactInfo. */
  const directions = cfgT(config, "directions", locale as Locale);
  const phone = typeof config.phone === "string" ? config.phone : "";
  const email = typeof config.email === "string" ? config.email : "";
  /* Block first, site as the fallback — what the field's own label promises
     ("留空則用站群設定"). The order was inverted here and in the two other
     renderers, so a LINE typed into the block was accepted, saved, and then
     ignored on every page that had a site-level one. The comment that stood
     here described the inversion as the intent, which is how it survived.

     This copy is easy to miss: group content pages render their contact block
     through this local function rather than through BlockContactInfo, so
     fixing that component alone left the same field behaving differently
     depending on which kind of page it sat on. */
  const blockLine = typeof config.line === "string" ? config.line.trim() : "";
  const line = blockLine || (siteLine ?? "").trim();
  // The admin's contact block saves a Google embed <iframe> snippet under
  // map_embed (older configs used a bare map_url). Pull the src from either, but
  // only ever frame a Google Maps embed — never an arbitrary iframe source
  // (安全: 不可嵌入任意來源；此前既讀錯 key 又未驗證).
  const mapEmbed = typeof config.map_embed === "string" ? config.map_embed : "";
  const mapUrlRaw = typeof config.map_url === "string" ? config.map_url : "";
  const mapSrc = googleMapEmbedSrc(mapEmbed) || googleMapEmbedSrc(mapUrlRaw);
  // Google labels the map; hl is what makes them follow the site language.
  const mapSrcT = mapSrcForLocale(mapSrc, locale);
  // Multiple 通訊處 / offices — each a name with its own phone and address, for
  // brands that list several (台北通訊處、台南通訊處…). Kept separate from the
  // single central phone/email/LINE above.
  const offices = Array.isArray(config.offices)
    ? (config.offices as Array<Record<string, unknown>>)
    : [];
  /* The single central row of TEL / MAIL / LINE / ADDRESS. On a villa page it
     is the whole point of the block; on a contact page that also lists 通訊處
     it repeats the head office one line above the same address, so whether it
     appears is the editor's call. Defaults to shown — every block saved before
     this option existed was showing it. */
  const showPrimary = config.show_primary !== false;
  return (
    <section className="page-block page-block-contact">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      {title && <h2>{title}</h2>}
      {/* One labelled row — icon, what it is, then the value — rather than
          three bare lines of text. Without the labels a phone number and an
          address just stack up as anonymous strings, and the row is the shape
          the client asked for. */}
      {showPrimary && (
      <div className="page-block-contact-info">
        {phone && (
          <div className="contact-item">
            <Phone size={19} aria-hidden="true" />
            <span>TEL.</span>
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>
          </div>
        )}
        {email && (
          <div className="contact-item">
            <Mail size={19} aria-hidden="true" />
            <span>MAIL.</span>
            <a href={`mailto:${email}`}>{email}</a>
          </div>
        )}
        {line && lineUrl(line) && (
          <div className="contact-item">
            <MessageCircle size={19} aria-hidden="true" />
            <span>LINE.</span>
            <a href={lineUrl(line)} target="_blank" rel="noopener noreferrer">{line}</a>
          </div>
        )}
        {address && (
          <div className="contact-item">
            <MapPin size={19} aria-hidden="true" />
            <span>ADDRESS.</span>
            {/* TEL and MAIL above are tappable; the address was not, so on a
                phone it had to be copied out by hand to be useful. */}
            {mapsUrl(address) ? (
              <a href={mapsUrl(address)} target="_blank" rel="noopener noreferrer">{address}</a>
            ) : (
              <p>{address}</p>
            )}
          </div>
        )}
      </div>
      )}
      <ContactOffices offices={offices} locale={locale} />
      {directions && (
        <div className="property-contact-directions">
          <h3>{locale === "zh" ? "交通指引" : "Directions"}</h3>
          {directions.split("\n").map((ln, i) => (ln.trim() ? <p key={i}>{ln}</p> : null))}
        </div>
      )}
      {mapSrcT && (
        <div className="page-block-contact-map">
          <iframe key={mapSrcT} src={mapSrcT} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={locale === "zh" ? "地圖" : "Map"} style={{ width: "100%", height: "300px", border: 0 }} />
        </div>
      )}
    </section>
  );
}

/**
 * One 通訊處 row.
 *
 * Every field — address, phone, email — is on the row itself, so most offices
 * have nothing to expand and render as a plain card with no control. An office
 * that carries a note (service hours, how to find the entrance) becomes a
 * <details> instead, and only then is there an arrow. A disclosure that opens
 * onto nothing is worse than no disclosure, which is what the collapsed version
 * of this row was: it hid the phone number behind a click on a page whose
 * purpose is to give out phone numbers.
 */
/* A second, thinner copy of BlockFeatureBadges used to live here. It drew the
   badges and nothing else: 眉批, 標題 and the 分類 grouping were all offered by
   the same editor and all silently dropped on group content pages, and the
   editor preview — which renders through the property component — showed them
   correctly the whole time. Rich text, image gallery and rooms already reuse
   the property component here; this one now does too. */

/* ── Main Renderer ── */

/* The four 並排 keys reach this renderer through the shared pass in
   modules/blockPairs. They used to be read only by PropertyPageRenderer, so on
   a group content page 與下一個區塊並排 / 交換左右 / 上下並排 / 併入上一組 all
   saved and did nothing — while the admin preview, which draws through the
   property renderer, showed the pair correctly. */
export default function PageBlocks({ blocks, locale, siteLine, siteSlug }: { blocks: PageBlock[]; locale: Locale; siteLine?: string; siteSlug?: string }) {
  return (
    <>
      {renderWithPairs<PageBlock>({
        blocks,
        render: (block, cfg) => {
          let el: React.ReactNode;
          switch (block.type) {
            /* Shared homepage blocks */
            case "flow":
              el = <BlockFlow key={block.id} locale={locale} config={cfg} />; break;
            case "stays":
              el = <BlockStays key={block.id} locale={locale} config={cfg} />; break;
            case "gallery":
              el = <BlockGallery key={block.id} locale={locale} config={cfg} />; break;
            case "pathways":
              el = <BlockPathways key={block.id} locale={locale} config={cfg} />; break;
            case "editorial":
              el = <BlockEditorial key={block.id} locale={locale} config={cfg} />; break;
            case "about":
              el = <BlockAbout key={block.id} locale={locale} config={cfg} />; break;
            /* Property-specific blocks */
            /* Was a local HeroBanner that read `config.image`/`image_url`. The
               editor writes `images` (a carousel), plus height and the two
               colour pickers — none of which that stub read, so a hero block on
               a site page rendered with no background image and default
               everything. The shared component reads all of them. */
            case "hero_banner":
              el = <BlockHeroBanner key={block.id} locale={locale} config={cfg} />; break;
            /* Offered by the page-type palette and previewed with the property
               renderer, so these looked fine in the admin and then rendered
               nothing at all on a live site page. */
            case "rooms":
              el = <BlockRooms key={block.id} locale={locale} config={cfg} />; break;
            case "map":
              el = <BlockMap key={block.id} locale={locale} config={cfg} />; break;
            case "attractions":
              el = <BlockAttractions key={block.id} locale={locale} config={cfg} />; break;
            case "partners":
              el = <BlockPartners key={block.id} locale={locale} config={cfg} />; break;
            case "rich_text":
              // Shared with the property renderer — see BlockRichText for the
              // sanitiser (this used to be the one rich-text path on the public
              // site with no sanitiser at all) and the heading/eyebrow/split-image
              // support this local copy never had.
              el = <BlockRichText key={block.id} locale={locale} config={cfg} />; break;
            case "feature_list":
              el = <BlockFeatureList key={block.id} locale={locale as Locale} config={cfg} />; break;
            case "image_gallery":
              // Shared with the property renderer — brings the carousel/collage/
              // centered layouts (incl. the single-image carousel treatment) that
              // this local copy never had.
              el = <BlockImageGallery key={block.id} locale={locale} config={cfg} />; break;
            /* Shared with the property renderer — see the note above the
               contact block for the six ways the local copies of these three
               had drifted from it. */
            case "faq_accordion":
              el = <BlockFaqAccordion key={block.id} locale={locale} config={cfg} />; break;
            case "house_rules":
              el = <BlockHouseRules key={block.id} locale={locale} config={cfg} />; break;
            case "table":
              el = <BlockTable key={block.id} locale={locale} config={cfg} />; break;
            /* 版型 (卡片／經典) was implemented only in BlockContactInfo, so on a
               group content page the select did nothing. Rather than write the
               classic layout a second time, hand the block to the component
               that already draws it; 卡片 keeps this page's own treatment,
               which is what /contact is designed around. */
            case "contact_info":
              el = cfg.layout === "classic"
                ? <BlockContactInfo key={block.id} config={cfg} locale={locale as Locale} siteLine={siteLine} siteSlug={siteSlug} />
                : <ContactInfo key={block.id} config={cfg} locale={locale} siteLine={siteLine} />;
              break;
            case "feature_badges":
              el = <BlockFeatureBadges key={block.id} config={cfg} locale={locale as Locale} />; break;
            case "oembed":
              el = <BlockOembed key={block.id} locale={locale} config={cfg} />; break;
            case "video_text":
              el = <BlockVideoText key={block.id} locale={locale} config={cfg} />; break;
            case "feature_hero":
              el = <BlockFeatureHero key={block.id} locale={locale} config={cfg} />; break;
            case "alternating":
              el = <BlockAlternating key={block.id} locale={locale} config={cfg} />; break;
            case "contact_form":
              el = <ContactFormBlock key={block.id} config={cfg} locale={locale} siteLine={siteLine} />; break;
            /* The subscribe band. The homepage and the property renderer both
               had this block; the site-page renderer did not, so a managed page
               — 聯絡我們 above all — could not carry a subscribe form at all and
               the contact route had to hard-code one. */
            /* The palette offers 住宿搜尋列 on every group page, and this
               renderer had no case for it — so on /brand, /journal and the rest
               it fell to reportUnknownBlock and the section came out empty.
               Worse than silent: the editor previews a content page through the
               PROPERTY renderer, which does have this case, so the block looked
               right in the admin and was blank in public.
               BlockSearchBar fetches the catalogue itself and needs nothing
               from the page. */
            case "search":
              el = <BlockSearchBar key={block.id} locale={locale} config={cfg} />; break;
            case "newsletter":
              el = <BlockNewsletter key={block.id} locale={locale} config={cfg} siteSlug={siteSlug} />; break;
            default:
              el = reportUnknownBlock("PageBlocks", block.type);
          }
          return el;
        },
      })}
    </>
  );
}
