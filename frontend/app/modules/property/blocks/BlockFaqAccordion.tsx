import { faqJsonLd } from "../../faqSchema";
import JsonLd from "../../JsonLd";
import type { Locale } from "../../i18n";
import { cfgT, eyebrowT } from "../../tr";
import SectionHeading from "../../SectionHeading";
import FaqAccordion from "../../FaqAccordion";

export default function BlockFaqAccordion({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const eyebrow = eyebrowT(config, locale);
  const title = cfgT(config, "title", locale, locale === "zh" ? "常見問題" : "FAQ");
  const rawItems = Array.isArray(config.items) ? config.items : [];

  const items = rawItems
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        question: cfgT(item, "question", locale),
        answer: cfgT(item, "answer", locale),
      };
    })
    .filter((item) => item.question && item.answer);

  if (!items.length) return null;

  const schema = faqJsonLd(items);

  return (
    <>
      {schema && <JsonLd data={schema} />}
      <section className="property-faq section">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <FaqAccordion items={items} />
      </section>
    </>
  );
}
