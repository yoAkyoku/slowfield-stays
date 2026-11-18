import { plainText } from "./safeHtml";
/**
 * FAQPage structured data.
 *
 * Its own module, with no imports, because the FAQ accordion that produces it
 * is a client component: importing this from `seo.ts` pulled `i18n.ts` — and
 * therefore `next/headers` — into the client bundle, which fails the build for
 * every route in that module graph. `tsc` does not model the server/client
 * boundary, so it passed cleanly while every page 500'd.
 *
 * This is the one schema type on the site that reliably earns a rich result:
 * the questions can appear directly under the search listing. A villa's 入住須知
 * page is exactly that content and it was shipping as ordinary prose.
 *
 * Answers are stripped of markup — the schema wants text, and the block stores
 * editor HTML.
 */
export function faqJsonLd(
  items: Array<{ question: string; answer: string }>,
): Record<string, unknown> | null {
  const clean = items
    .map((i) => ({
      question: String(i.question ?? "").trim(),
      answer: plainText(i.answer),
    }))
    .filter((i) => i.question && i.answer);
  if (!clean.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: clean.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}
