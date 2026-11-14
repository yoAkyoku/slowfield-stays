"use client";

import { faqJsonLd } from "../../faqSchema";
import JsonLd from "../../JsonLd";
import { useState } from "react";
import type { Locale } from "../../i18n";
import { cfgT, eyebrowT } from "../../tr";
import { safeHtml, sanitizeRichHtml } from "../../safeHtml";

/* Answers authored in the WYSIWYG editor arrive as HTML with inline styles;
   older ones are plain text. safeHtml would strip the styling, so HTML goes
   through sanitizeRichHtml and only plain text keeps the newline conversion. */
const HTML_RE = /<\/?(p|div|span|br|b|strong|i|em|u|s|ul|ol|li|h[1-6]|blockquote|a)\b/i;

export default function BlockFaqAccordion({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2>{title}</h2>
      <div className="stay-faq-accordion">
        {items.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div className={`stay-faq-item${isOpen ? " stay-faq-item--open" : ""}`} key={i}>
              <button
                type="button"
                className="stay-faq-question"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                <span className="stay-faq-qlabel">
                  <span className="stay-faq-qnum" aria-hidden="true">Q{i + 1}</span>
                  <span className="stay-faq-qtext">{item.question}</span>
                </span>
                <svg className="stay-faq-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {/* `inert` as well as aria-hidden: these answers are editor HTML
                  and may contain links, and a closed one is only taken out of
                  the tab order by a visibility rule in globals.css that waits
                  for the collapse to finish. inert closes both gaps here. */}
              <div className="stay-faq-answer" aria-hidden={!isOpen} inert={!isOpen}>
                {HTML_RE.test(item.answer) ? (
                  /* A div, not a p: rich answers may contain block elements,
                     and a <p> inside a <p> is invalid and gets unnested. */
                  <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.answer) }} />
                ) : (
                  <p dangerouslySetInnerHTML={{ __html: safeHtml(item.answer, { convertNewlines: true }) }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
    </>
  );
}
