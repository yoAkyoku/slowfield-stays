"use client";

import { useState } from "react";
import { PUBLIC_API_URL } from "../apiBase";

export type SignupStatus = "idle" | "sending" | "sent" | "error";

/**
 * Subscribing to the newsletter, for any form that offers it.
 *
 * The footer's one-line signup and the 電子報 block each posted to the same
 * endpoint with their own copy of this. Use `submit` as the form's action; a
 * `name` field is sent if the form has one. The subscription goes to `siteSlug`
 * — a villa's footer signs people up to that villa, not to the brand.
 */
export default function useNewsletterSignup(siteSlug?: string) {
  const [status, setStatus] = useState<SignupStatus>("idle");

  async function submit(formData: FormData) {
    setStatus("sending");
    try {
      const params = siteSlug ? `?site=${encodeURIComponent(siteSlug)}` : "";
      const response = await fetch(`${PUBLIC_API_URL}/newsletter/subscribe${params}`, {
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

  return { status, submit };
}
