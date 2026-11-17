"use client";

import { useState } from "react";
import type { Locale } from "../i18n";
import { PUBLIC_API_URL as API_URL } from "../apiBase";

/**
 * One-line newsletter signup for the site footers. The 電子報訂閱 block is the
 * full-width band with a heading and body copy — far too much for a footer —
 * so this is email-only and posts to the same endpoint.
 */
export default function FooterNewsletter({
  locale,
  siteSlug,
}: {
  locale: Locale;
  siteSlug?: string;
}) {
  const zh = locale === "zh";
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(formData: FormData) {
    setStatus("sending");
    try {
      const params = siteSlug ? `?site=${encodeURIComponent(siteSlug)}` : "";
      const res = await fetch(`${API_URL}/newsletter/subscribe${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(formData.get("email") ?? ""), name: "", groups: ["public"] }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="footer-newsletter">
      <span className="footer-newsletter-label">
        {zh ? "訂閱電子報" : "Newsletter"}
      </span>
      {status === "sent" ? (
        <p className="footer-newsletter-done" role="status">
          {zh ? "訂閱成功，感謝你。" : "You're subscribed — thank you."}
        </p>
      ) : (
        <form action={submit} className="footer-newsletter-form">
          <input
            name="email"
            type="email"
            required
            placeholder={zh ? "你的 Email" : "Your email"}
            aria-label={zh ? "電子郵件" : "Email"}
          />
          <button type="submit" disabled={status === "sending"}>
            {status === "sending" ? (zh ? "送出中…" : "Sending…") : (zh ? "訂閱" : "Subscribe")}
          </button>
        </form>
      )}
      {status === "error" && (
        <p className="footer-newsletter-error" role="alert">
          {zh ? "送出失敗，請稍後再試。" : "Something went wrong — please try again."}
        </p>
      )}
    </div>
  );
}
