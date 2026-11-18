import type { Locale } from "../i18n";
import { bilingual } from "../tr";
import { faqJsonLd } from "../faqSchema";
import JsonLd from "../JsonLd";
import FaqAccordion from "../FaqAccordion";

type FaqItem = { question?: string; answer?: string };

/** The 訂房須知 FAQ on a stay's detail page: the shared list, with the same
 *  FAQPage structured data the FAQ block emits. */
export default function StayFaqAccordion({
  items,
  title,
  locale = "zh"
}: {
  items: FaqItem[];
  title: string;
  locale?: Locale;
}) {
  const entries = items
    .filter((item) => item.question && item.answer)
    .map((item) => ({
      question: bilingual(item.question || "", locale),
      answer: bilingual(item.answer || "", locale)
    }));

  if (entries.length === 0) return null;

  const schema = faqJsonLd(entries);
  return (
    <>
      {schema && <JsonLd data={schema} />}
      <FaqAccordion items={entries} heading={<h2>{title}</h2>} />
    </>
  );
}
