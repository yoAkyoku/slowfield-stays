"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { safeHtml, sanitizeRichHtml } from "./safeHtml";

/* Answers authored in the WYSIWYG editor arrive as HTML with inline styles;
   older ones are plain text. safeHtml would strip the styling, so HTML goes
   through sanitizeRichHtml and only plain text keeps the newline conversion. */
const HTML_RE = /<\/?(p|div|span|br|b|strong|i|em|u|s|ul|ol|li|h[1-6]|blockquote|a)\b/i;

export type FaqEntry = { question: string; answer: string };

/**
 * The FAQ list: one open answer at a time, numbered questions, answers that
 * may be editor HTML.
 *
 * The FAQ block and the stay detail page each had their own copy. The stay
 * page's printed rich answers as raw text in a <p> and had no numbering; both
 * render through this now. Entries without both a question and an answer are
 * dropped by the caller, which knows how its data is shaped.
 */
export default function FaqAccordion({ items, heading }: { items: FaqEntry[]; heading?: ReactNode }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="stay-faq-accordion">
      {heading}
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
              <ChevronDown className="stay-faq-chevron" size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            {/* `inert` as well as aria-hidden: answers may contain links, and a
                closed one is only taken out of the tab order by a visibility
                rule that waits for the collapse to finish. inert closes both
                gaps here. */}
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
  );
}
