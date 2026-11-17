"use client";

import { lineUrl as buildLineUrl } from "../socialLinks";
import { isSafeUrl } from "../safeHtml";
import { stayIdFromSearch } from "../contactContext";
import { useState } from "react";
import type { Locale } from "../i18n";
import { cfgT } from "../tr";
import { PUBLIC_API_URL as API_URL } from "../apiBase";

/* ── Bilingual labels ── */
const LABELS = {
  zh: {
    name: "姓名",
    namePlaceholder: "您的姓名",
    email: "Email",
    emailPlaceholder: "name@example.com",
    phone: "電話",
    phonePlaceholder: "聯絡電話",
    line: "LINE ID",
    checkIn: "入住日期",
    checkOut: "退房日期",
    guests: "入住人數",
    message: "詢問內容",
    messagePlaceholder: "請簡述您的需求與問題",
    inquiryType: "諮詢類型",
    inquiryPlaceholder: "請選擇類型",
    subject: "主旨",
    subjectPlaceholder: "例如：包棟訂房詢問、媒體採訪邀約",
    send: "送出訊息",
    sending: "送出中…",
    sent: "感謝您的聯繫，我們會盡快回覆！",
    sendAnother: "再次填寫",
    error: "送出失敗，請稍後再試。",
    rateLimited: "送出過於頻繁，請稍後再試。您填寫的內容已保留。",
    dateError: "退房日期必須晚於入住日期，請調整後再送出。",
    sourceOptions: [
      ["住宿詢問", "booking"],
      ["企劃合作", "partnership"],
      ["媒體公關", "pr"],
      ["人才招募", "career"],
      ["民宿加盟", "franchise"],
      ["其他", "other"],
    ] as [string, string][],
  },
  en: {
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "name@example.com",
    phone: "Phone",
    phonePlaceholder: "Contact number",
    line: "LINE ID",
    checkIn: "Check-in",
    checkOut: "Check-out",
    guests: "Guests",
    message: "Message",
    messagePlaceholder: "Tell us what you need",
    inquiryType: "Inquiry type",
    inquiryPlaceholder: "Choose a type",
    subject: "Subject",
    subjectPlaceholder: "e.g. whole-villa booking, press enquiry",
    send: "Send message",
    sending: "Submitting...",
    sent: "Thank you! We'll get back to you soon.",
    sendAnother: "Submit another",
    error: "Submission failed. Please try again.",
    rateLimited: "Too many submissions. Please try again later. Your entries have been kept.",
    dateError: "Check-out must be after check-in. Please adjust the dates.",
    sourceOptions: [
      ["Stay enquiry", "booking"],
      ["Partnership", "partnership"],
      ["Media & PR", "pr"],
      ["Careers", "career"],
      ["Franchise", "franchise"],
      ["Other", "other"],
    ] as [string, string][],
  },
};

/* Read a label strictly in the language being rendered.
 *
 * cfgT borrows the other language when a field is empty — right for a
 * half-translated block, wrong for a label that has a correct default sitting
 * beside it in the code: an untranslated 送出訊息 satisfies the `||` and the
 * English default below it can never be reached, so the button is the one
 * Chinese word on an otherwise English form. The submit button was already read
 * this way, inline, and the two CTA buttons a few lines down were not — the
 * file contradicted its own comment. One reader now, used by all three.
 *
 * clearableT would not do: it borrows whenever the locale key is ABSENT, which
 * is exactly the shape a block gets when the editor fills in Chinese only.
 */
function strictLabel(config: Record<string, unknown>, key: string, lang: "zh" | "en"): string {
  const raw = config[key];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return String((raw as Record<string, unknown>)[lang] ?? "").trim();
  }
  return typeof raw === "string" ? raw.trim() : "";
}

export default function ContactFormBlock({
  config,
  locale,
  siteLine,
}: {
  config: Record<string, unknown>;
  locale: string;
  /** Central LINE id/URL from site contact settings. Used only when the block
   *  leaves its own 「LINE」 field blank — the block's value wins. */
  siteLine?: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "date-error" | "rate-limited">("idle");
  const lang = locale === "en" ? "en" : "zh";
  const L = LABELS[lang];

  const eyebrow = cfgT(config, "eyebrow", lang as Locale);
  const title = cfgT(config, "title", lang as Locale);
  const subtitle = cfgT(config, "subtitle", lang as Locale);
  const formType = typeof config.form_type === "string" ? config.form_type : "inquiry";
  /* Read strictly in this language, not through cfgT — see strictLabel above.
     Every other label on this form comes from the LABELS dictionary and was
     already bilingual, so the submit button was the one Chinese word on an
     otherwise English form — and the one string that had a right answer sitting
     next to it. */
  const submitLabel = strictLabel(config, "submit_label", lang) || L.send;
  /* Layout: the stacked default (header above the fields) and the split the
     contact page uses — what the form is on the left, the fields on the right.
     Allow-listed because it becomes a class name. */
  const layout = config.layout === "split" ? "split" : "stacked";
  /* LINE ID is a useful field on a villa enquiry and clutter on a general
     contact form, so whether it appears is the editor's call. Defaults to on:
     every block saved before this option existed was showing it. */
  const showLine = config.show_line !== false;
  /* A note under the button — "送出後由客服團隊人工處理可預訂狀態" and the like.
     It belongs after the action, not with the heading, which is why it is not
     just more subtitle text. */
  const footnote = cfgT(config, "footnote", lang as Locale);
  const isBooking = formType === "booking";
  // Optional explicit site slug — when rendered inside a child /stays/<slug>
  // page the host header points at the parent domain, so without this the
  // inquiry lands in the parent inbox. Pass `site` in config to route it.
  const siteSlug = typeof config.site === "string" ? config.site : "";

  // Inquiry types are set per block in the admin; the built-in list is only the
  // fallback for blocks that have never been configured. The old defaults asked
  // how someone was contacting us (phone / email / LINE), which the form already
  // knows — what the inbox needs is why they are writing, so it can route.
  const configuredTypes = Array.isArray(config.inquiry_types) ? config.inquiry_types : [];
  const inquiryTypes: [string, string][] = configuredTypes
    .map((raw) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      return [cfgT(item, "label", lang as Locale), String(item.value ?? "")] as [string, string];
    })
    /* The value alone. The label was required here back when the form saved a
       repeatable list of label/code pairs and a dropdown showed the labels; that
       dropdown is gone and the editor now saves `{ value }` only, so this filter
       dropped every configured row, fell through to L.sourceOptions, and took
       ITS first entry — meaning an author who picked 民宿加盟 filed the enquiry
       as 住宿詢問. A label that is displayed nowhere cannot be a condition for
       routing. */
    .filter(([, value]) => value);

  // CTA mode: show emotional copy + buttons (LINE / booking page) instead of the
  // full form, so the homepage isn't weighed down by a long form.
  const display = typeof config.display === "string" ? config.display : "form";
  const ctaHref = typeof config.cta_href === "string" && isSafeUrl(config.cta_href) ? config.cta_href : "";
  /* Block first, the site-wide LINE as the fallback — see the note in
     BlockContactInfo. The label on this field reads 留空則用站群設定, and it
     used to describe the opposite of what happened: the site value always won,
     so anything typed here was dropped. */
  const blockLine = typeof config.line === "string" ? config.line.trim() : "";
  const lineRaw = blockLine || (siteLine ?? "").trim();
  const lineHref = buildLineUrl(lineRaw);

  if (display === "cta") {
    /* The same strict read as the submit button above. These two kept the bug
       the comment beside submit_label describes as already fixed: a block with
       Chinese-only labels rendered 「LINE 詢問」and「填寫預約需求」as the two
       buttons on the English page, and the English defaults on this line were
       unreachable. */
    const lineLabel = strictLabel(config, "line_label", lang) || (lang === "zh" ? "LINE 詢問" : "Enquire on LINE");
    const ctaLabel = strictLabel(config, "cta_label", lang) || (lang === "zh" ? "填寫預約需求" : "Booking request");
    return (
      <section className="page-block page-block-booking-cta">
        {eyebrow && <div className="page-block-contact-form-eyebrow eyebrow">{eyebrow}</div>}
        {title && <h2 className="page-block-contact-form-title">{title}</h2>}
        {subtitle && <p className="page-block-contact-form-subtitle">{subtitle}</p>}
        <div className="booking-cta-actions">
          {lineHref && (
            <a className="button" href={lineHref} target="_blank" rel="noopener noreferrer">
              {lineLabel}
            </a>
          )}
          {ctaHref && (
            <a className="button button-ghost" href={ctaHref}>
              {ctaLabel}
            </a>
          )}
        </div>
      </section>
    );
  }

  async function handleSubmit(formData: FormData) {
    setStatus("sending");
    const payload: Record<string, unknown> = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      line_id: String(formData.get("line_id") ?? ""),
      subject: String(formData.get("subject") ?? "").trim(),
      message: String(formData.get("message") ?? ""),
      // A booking form has no type picker — the form itself is the type.
      /* No longer asked for on the form (客戶: 移除「諮詢類型」欄位). The API
         still models it and the inbox still files by it, so the block's
         configured first type stands in — every enquiry from this form is
         that kind by definition now. */
      /* `inquiryTypes`, not `typeOptions`. typeOptions falls back to
         L.sourceOptions when the block configures none, and ITS first entry is
         ["住宿詢問", "booking"] — so on every site that has not filled in
         詢問類型 (the common case) a press, careers or franchise enquiry was
         filed as a room request. Nothing on screen said so: the 諮詢類型 field
         was deliberately removed, so the guess reaches the inbox as a fact and
         來源分流 reported BOOKING as the top source whatever anyone wrote.
         "website" is what the API documents for an unspecified source, and the
         block's own list labels it 一般諮詢 / General. The inbox prints the raw
         code when it has one, so 來源分流 now reports `website` rather than
         mislabelling the enquiry as a booking. */
      source: isBooking ? "booking" : (inquiryTypes[0]?.[1] || "website"),
      // Honeypot — sighted humans don't see this field, bots auto-fill it.
      website: String(formData.get("website") ?? ""),
    };
    // Stay detail links carry ?stay=<id>; preserve that context in both forms.
    const stayId = typeof window !== "undefined" ? stayIdFromSearch(window.location.search) : undefined;
    if (stayId !== undefined) payload.stay_id = stayId;
    if (isBooking) {
      payload.check_in = String(formData.get("check_in") ?? "") || null;
      payload.check_out = String(formData.get("check_out") ?? "") || null;
      if (payload.check_in && payload.check_out && String(payload.check_out) <= String(payload.check_in)) {
        setStatus("date-error");
        return;
      }
      /* `??` never fires here: an emptied number input posts "" — not null —
         so Number("") sent `guests: 0` to the inbox. The field has no `required`
         and a min of 1, so clearing it is an ordinary thing to do. */
      const rawGuests = String(formData.get("guests") ?? "").trim();
      const guests = Number(rawGuests);
      payload.guests = rawGuests && Number.isFinite(guests) && guests > 0 ? guests : 2;
    }
    try {
      const host = typeof window !== "undefined" ? window.location.host : "";
      const params = new URLSearchParams();
      if (host) params.set("host", host);
      if (siteSlug) params.set("site", siteSlug);
      const query = params.toString() ? `?${params.toString()}` : "";
      const endpoint = isBooking ? "/booking-requests" : "/inquiries";
      const response = await fetch(`${API_URL}${endpoint}${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setStatus(response.ok ? "sent" : response.status === 429 ? "rate-limited" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <section className="page-block page-block-contact-form">
        {eyebrow && <div className="page-block-contact-form-eyebrow eyebrow">{eyebrow}</div>}
        {title && <h2 className="page-block-contact-form-title">{title}</h2>}
        <div className="inquiry-success">
          <div className="inquiry-success-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="var(--accent)" opacity="0.12" />
              <circle cx="24" cy="24" r="18" fill="var(--accent)" opacity="0.18" />
              <path d="M16 24.5L21.5 30L32 19" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="inquiry-success-title">{L.sent}</h3>
          <button className="button inquiry-submit" type="button" onClick={() => setStatus("idle")}>
            {L.sendAnother}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`page-block page-block-contact-form is-${layout}`}>
      {(eyebrow || title || subtitle) && (
        <div className="page-block-contact-form-header">
          {eyebrow && <div className="page-block-contact-form-eyebrow eyebrow">{eyebrow}</div>}
          {title && <h2 className="page-block-contact-form-title">{title}</h2>}
          {subtitle && <p className="page-block-contact-form-subtitle">{subtitle}</p>}
        </div>
      )}
      <form className="form inquiry-form" onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit(new FormData(event.currentTarget));
      }}>
        {/* Honeypot — off-screen, aria-hidden, tabIndex -1 so keyboard and
            screen-reader users never reach it. Bots that auto-fill every
            named input populate it and the backend silently drops the
            submission. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          style={{ position: "absolute", left: "-10000px", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
        <div className="inquiry-form-grid">
          <label>
            <span>{L.name}</span>
            <input name="name" placeholder={L.namePlaceholder} required minLength={2} />
          </label>
          <label>
            <span>{L.phone}</span>
            <input name="phone" placeholder={L.phonePlaceholder} />
          </label>
          <label>
            <span>{L.email}</span>
            <input name="email" type="email" placeholder={L.emailPlaceholder} required />
          </label>
          {/* Beside Email, not after 主旨. They are the two ways to reach the
              same person, so they read as a pair; 主旨 is about the enquiry
              (客戶: line_id 要在 email 後面). */}
          {showLine && (
            <label>
              <span>{L.line}</span>
              <input name="line_id" placeholder={L.line} />
            </label>
          )}
          {/* A free-text 主旨 as well as the routing picker. Relabelling the
              picker "主旨" made it look like this field and quietly removed it:
              the built-in form has always had a subject line, and a routing
              code is not a subject — one files the enquiry, the other says what
              it is about.

              Full width once LINE ID is showing: Email and LINE ID then take a
              row of their own and 主旨 would otherwise sit alone in the left
              column with a gap beside it (客戶: 如果有 line_id 主旨就要 100%). */}
          {!isBooking && (
            <label className={showLine ? "inquiry-full-field" : undefined}>
              <span>{L.subject}</span>
              <input name="subject" placeholder={L.subjectPlaceholder} maxLength={120} />
            </label>
          )}
          {/* Date & guest fields — only for booking type */}
          {isBooking && (
            <>
              <label>
                <span>{L.checkIn}</span>
                <input name="check_in" type="date" aria-label={L.checkIn} />
              </label>
              <label>
                <span>{L.checkOut}</span>
                <input name="check_out" type="date" aria-label={L.checkOut} />
              </label>
              <label>
                <span>{L.guests}</span>
                {/* max, because the API is `ge=1, le=20` on both the inquiry and
                    the booking schema — without it 25 passes the browser's own
                    validation, the request 422s, and the visitor sees only the
                    generic 送出失敗. */}
                <input name="guests" type="number" min="1" max="20" defaultValue="2" aria-label={L.guests} />
              </label>
            </>
          )}
        </div>
        <label>
          <span>{L.message}</span>
          <textarea name="message" placeholder={L.messagePlaceholder} />
        </label>
        {status === "date-error" && <p className="inquiry-error-msg" role="alert">{L.dateError}</p>}
        {status === "error" && <p className="inquiry-error-msg" role="alert">{L.error}</p>}
        {status === "rate-limited" && <p className="inquiry-error-msg" role="alert">{L.rateLimited}</p>}
        <button className="button inquiry-submit" type="submit" disabled={status === "sending"}>
          {status === "sending" ? L.sending : submitLabel}
        </button>
        {footnote && <p className="inquiry-footnote">{footnote}</p>}
      </form>
    </section>
  );
}
