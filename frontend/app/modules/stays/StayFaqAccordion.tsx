"use client";

import { useMemo, useState } from "react";
import type { Locale } from "../i18n";
import { bilingual } from "../tr";

type FaqItem = { question?: string; answer?: string };

export default function StayFaqAccordion({
  items,
  title,
  locale = "zh"
}: {
  items: FaqItem[];
  title: string;
  locale?: Locale;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Filter out items missing question or answer
  const validItems = useMemo(
    () =>
      items
        .filter((item) => item.question && item.answer)
        .map((item) => ({
          question: bilingual(item.question || "", locale),
          answer: bilingual(item.answer || "", locale)
        })),
    [items, locale]
  );

  if (validItems.length === 0) return null;

  return (
    <div className="stay-faq-accordion">
      <h2>{title}</h2>
      {validItems.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div className={`stay-faq-item${isOpen ? " stay-faq-item--open" : ""}`} key={`${item.question}-${i}`}>
            <button
              type="button"
              className="stay-faq-question"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span>{item.question}</span>
              <svg className="stay-faq-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {/* `inert` as well as aria-hidden: the stylesheet takes the closed
                answer out of the tab order with visibility, but that step is
                delayed until the collapse finishes, and it is a rule 10,000
                lines away in a file this element does not control. inert closes
                both gaps at the source. */}
            <div className="stay-faq-answer" aria-hidden={!isOpen} inert={!isOpen}>
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
