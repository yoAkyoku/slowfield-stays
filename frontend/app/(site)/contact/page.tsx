import PageBlocks, { type PageBlock } from "../../modules/content/PageBlocks";
import PageHero, { hasPageHero } from "../../modules/content/PageHero";
import BlockNewsletter from "../../modules/home/blocks/BlockNewsletter";
import { getCurrentSite } from "../../modules/api";
import { getLocale, t } from "../../modules/i18n";
import JsonLd from "../../modules/JsonLd";
import { cssUrl } from "../../modules/safeCss";
import { buildMetadata, pageSettingsSeo, siteUrl } from "../../modules/seo";
import { resolveSiteName } from "../../modules/property/types";

export async function generateMetadata() {
  const locale = await getLocale();
  const copy = t(locale);
  const site = await getCurrentSite();
  // 聯繫我們 is a page in the admin's page manager; its SEO fields were being
  // filled in and ignored here in favour of the bundled copy.
  const override = pageSettingsSeo(site, "contact", locale);
  return buildMetadata({
    title: override.title || copy.contact.title,
    description: override.description || copy.contact.intro,
    /* Same fallback the listing pages got: the page's own hero, so a link
       shared to LINE has a preview instead of nothing. This route was missed
       when the others were fixed. */
    image: override.image || (site.settings?.hero_contact as string | undefined),
    noIndex: override.noIndex,
    canonical: override.canonical,
    path: "/contact",
    site
  });
}

export default async function ContactPage(
  props: { searchParams: Promise<{ stay?: string; subject?: string }> }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const site = await getCurrentSite();
  const heroImage = (site.settings?.hero_contact as string | undefined) || "";
  // Page management has always let staff put blocks on this page — a 交通聯繫
  // block carries the head office address, phone, email, LINE, map and
  // directions — but this route never rendered them, so the page could only
  // ever show a form. (客戶：聯絡我們要有慢域的交通聯絡資訊.)
  const contactPage = ((site.settings?.pages ?? {}) as Record<string, Record<string, unknown>>).contact ?? {};
  const contactBlocks = (Array.isArray(contactPage.blocks) ? contactPage.blocks : []) as PageBlock[];
  const zh = locale === "zh";
  const showConfiguredHero = hasPageHero(contactPage, locale) || Boolean(heroImage);
  /* The subscribe band and the enquiry form exist as blocks (newsletter,
     contact_form), so a page that places them itself must not also get the
     built-in pair underneath — that is the same form twice, posting to the
     same inbox. Each is suppressed on its own: composing only the form from
     blocks still leaves the subscribe band below it. */
  const placedTypes = new Set(
    contactBlocks.filter((b) => b.enabled !== false).map((b) => b.type)
  );
  const showBuiltInSubscribe = !placedTypes.has("newsletter");
  /* The built-in enquiry form is gone (客戶: 不需要讀 source 的表單了，可以移除).
     It was the only thing that read ?source=, and it carried a narrower set of
     fields than the 聯絡表單 block — no LINE id, no dates, no party size — so a
     page ended up with one of two different forms depending on whether anyone
     had placed the block. The block is the form now, everywhere. */

  return (
    <main className="contact-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: copy.contact.title,
          url: siteUrl("/contact", site),
          email: site.contact_config?.email || undefined,
          // The one page a search engine looks at for a phone number.
          telephone: (typeof site.settings?.contact_phone === "string"
            ? site.settings.contact_phone.trim()
            : "") || undefined
        }}
      />
      {/* The hero is the page editor's, not this file's: 標題／副標／背景圖／
          高度／對齊 are the same fields every other managed page already has
          (PageHero), so 聯絡我們 stops being the one page whose hero could only
          be changed by a deploy. Rendered only once a hero has actually been
          configured - otherwise the 聯絡資訊 block below still carries the
          visible title and printing it here too would show it twice. */}
      {showConfiguredHero ? (
        <PageHero
          config={contactPage}
          locale={locale}
          className="contact-hero"
          fallbackImage={heroImage}
          fallbackTitle={copy.contact.title}
          fallbackSubtitle={copy.contact.intro}
        />
      ) : (
        <section
          className={`page-hero contact-hero${heroImage ? " has-hero-image" : ""}`}
          style={cssUrl(heroImage) ? { backgroundImage: cssUrl(heroImage) } : undefined}
        >
          <h1 className="sr-only">{copy.contact.title}</h1>
        </section>
      )}
      {/* No separate channels strip: the 聯絡資訊 block below is the one row
          (客戶: 聯絡資訊要做成 1 行), and a band of LINE/MAIL above it repeated
          the same addresses twice. LINE still appears with the newsletter,
          where it belongs as the other standing channel. */}
      {contactBlocks.length > 0 && <PageBlocks blocks={contactBlocks} locale={locale} siteLine={site.contact_config?.line} siteSlug={site.slug} />}
      {/* 兩個區塊 — 左：長期資訊訂閱／右：單次詢問表單 (客戶會議三.2). They are
          deliberately two forms with two buttons: one is "I need an answer now",
          the other is "mail me from here on", and the meeting was explicit that
          they must not collapse into a single consent. */}
      {showBuiltInSubscribe && (
      <section className="contact-split">
        {showBuiltInSubscribe && (
        /* The same component the 電子報訂閱 block renders. There is no separate
           built-in subscribe panel any more: the two were byte-for-byte the
           same request to the same endpoint, and keeping both meant every
           change to the band had to be made — and styled — twice. Placing the
           block on the page replaces this with the editor's own copy. */
        <BlockNewsletter
          locale={locale}
          siteSlug={site.slug}
          config={{
            /* The reference copy for this page. These are only defaults: adding
               a 電子報訂閱 block in the page editor replaces every one of them,
               which is the point of it being a block. Explicitly empty eyebrow
               because eyebrowT treats a cleared value as cleared and an absent
               one as "use the block default". */
            eyebrow: "",
            /* 電子報, not 旅宿資訊 — the heading has to name the thing being
               subscribed to in the word a reader already knows (客戶: 直接明確
               改成「電子報」). "Subscribe to Slowfield Stays" had the same
               problem in English: it named the brand, not the mailing list. */
            title: zh
              ? "訂閱慢域電子報"
              : `Subscribe to the ${resolveSiteName(site, locale)} newsletter`,
            body: zh
              ? "獲得最新住宿優惠、旅遊靈感與專屬推薦。"
              : "Seasonal stays, offers and quiet travel ideas, sent now and then.",
            submit_label: zh ? "訂閱電子報" : "Subscribe",
            show_icon: true,
          }}
        />
        )}
      </section>
      )}
    </main>
  );
}
