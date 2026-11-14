"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import type { Locale } from "../../i18n";
import { cfgT , eyebrowT} from "../../tr";
import { safeCssBackground, safeCssColor } from "../../fontPresets";
import { safeHtml } from "../../safeHtml";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type BlockNewsletterConfig = {
  eyebrow?: string | Record<string, string>;
  title?: string | Record<string, string>;
  body?: string | Record<string, string>;
  text_color?: string;
  bg_color?: string;
  full_bleed?: boolean;
  submit_label?: string | Record<string, string>;
  email_placeholder?: string | Record<string, string>;
  /** The envelope disc beside the copy — the contact page band has it, the
   *  homepage band never has. */
  show_icon?: boolean;
};

export default function BlockNewsletter({
  locale,
  config,
  siteSlug,
}: {
  locale: Locale;
  config?: BlockNewsletterConfig;
  siteSlug?: string;
}) {
  const zh = locale === "zh";
  const c = (config ?? {}) as Record<string, unknown>;
  /* Every default here names the thing being subscribed to 「電子報」 and nothing
     else (客戶: 直接明確改成「電子報」，不要消費者不容易理解的名稱). The band used
     to introduce itself as 慢域優惠 / SELECT OFFERS above a form whose button read
     訂閱優惠訊息 — three labels for one feature, none of them the word a reader is
     looking for, and "offers" reads as a coupon list rather than a mailing list. */
  const eyebrow = eyebrowT(c, locale, zh ? "電子報" : "NEWSLETTER");
  const title = cfgT(c, "title", locale, zh ? "訂閱慢域電子報" : "Subscribe to our newsletter");
  const body = cfgT(c, "body", locale, zh ? "最新優惠、季節住宿與慢域旅宿靈感，定期寄到你的信箱。" : "Latest offers, seasonal stays and curated travel ideas, sent to your inbox.");
  const submitLabel = cfgT(c, "submit_label", locale, zh ? "訂閱電子報" : "Subscribe");
  const emailPlaceholder = cfgT(c, "email_placeholder", locale, zh ? "輸入您的 Email" : "you@example.com");
  /* The disc with the envelope. Off by default so the homepage band, which
     has never had one, is unchanged; the contact page turns it on. */
  const showIcon = c.show_icon === true;
  const textColor = typeof c.text_color === "string" && c.text_color ? c.text_color : "";
  // Accept either the generic block-background key (_bgColor, used by the shared
  // block-style control / BlockWrapper) or the legacy newsletter bg_color.
  const bgColor =
    (typeof c._bgColor === "string" && c._bgColor ? c._bgColor : "") ||
    (typeof c.bg_color === "string" && c.bg_color ? c.bg_color : "");
  const fullBleed = c.full_bleed === true;

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(formData: FormData) {
    setStatus("sending");
    try {
      const params = siteSlug ? `?site=${encodeURIComponent(siteSlug)}` : "";
      const response = await fetch(`${API_URL}/newsletter/subscribe${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          name: String(formData.get("name") ?? ""),
          groups: ["public"],
        }),
      });
      setStatus(response.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  const style: React.CSSProperties = {};
  // `background` is the shorthand, so an unvalidated value here accepts
  // url(https://…) and calls out on every render.
  const safeBg = safeCssBackground(bgColor);
  const safeText = safeCssColor(textColor);
  if (safeBg) style.background = safeBg;
  if (safeText) style.color = safeText;

  return (
    <section
      className={`block-newsletter${fullBleed ? " block-newsletter--bleed" : ""}`}
      style={Object.keys(style).length ? style : undefined}
    >
      <div className="block-newsletter-inner">
        {/* The icon and the copy are one grid child, not two. The band's grid is
            two columns — what it is, then how to do it — so an icon added as a
            third child pushed the form onto its own row and the block fell
            apart everywhere except the contact page, which had its own
            three-column override. */}
        <div className="block-newsletter-head">
          {showIcon && (
            <span className="block-newsletter-icon" aria-hidden="true">
              <Mail size={22} />
            </span>
          )}
          <div className="block-newsletter-copy">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
          <p dangerouslySetInnerHTML={{ __html: safeHtml(body, { convertNewlines: true }) }} />
          </div>
        </div>
        <form className="block-newsletter-form" action={submit}>
          {/* Email-only — fewer fields reads more refined and converts better. */}
          <label>
            <span>{zh ? "電子信箱" : "Email"}</span>
            <input name="email" type="email" required placeholder={emailPlaceholder} />
          </label>
          <button type="submit" disabled={status === "sending"}>
            {!showIcon && <Mail size={16} />}
            {status === "sending" ? (zh ? "送出中…" : "Sending…") : submitLabel}
          </button>
          {status === "sent" ? <p className="block-newsletter-msg">{zh ? "感謝訂閱！" : "Thanks for subscribing!"}</p> : null}
          {status === "error" ? <p className="block-newsletter-msg">{zh ? "送出失敗，請稍後再試。" : "Something went wrong. Please try again."}</p> : null}
        </form>
      </div>
    </section>
  );
}
