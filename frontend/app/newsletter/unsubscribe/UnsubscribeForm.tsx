"use client";

import { useState } from "react";
import type { publicUiText } from "../../modules/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
type UnsubscribeCopy = ReturnType<typeof publicUiText>["unsubscribe"];

export default function UnsubscribeForm({ copy, token }: { copy: UnsubscribeCopy; token: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [siteName, setSiteName] = useState<string | null>(null);

  async function unsubscribe() {
    setStatus("sending");
    try {
      const response = await fetch(`${API_URL}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: "POST"
      });
      if (response.ok) {
        try {
          const data = await response.json();
          setSiteName(typeof data?.site_name === "string" ? data.site_name : null);
        } catch {
          setSiteName(null);
        }
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="unsub-result unsub-result--done" role="status">
        <span className="unsub-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        {siteName ? (
          <div className="unsub-result-site">
            <span className="unsub-result-site-label">{copy.siteLabel}</span>
            <span className="unsub-result-site-name">{siteName}</span>
          </div>
        ) : null}
        <p className="unsub-result-text">{copy.done}</p>
      </div>
    );
  }

  return (
    <div className="unsub-actions">
      <button
        className="unsub-btn"
        disabled={!token || status === "sending"}
        onClick={unsubscribe}
        type="button"
      >
        {status === "sending" ? copy.processing : copy.action}
      </button>
      {status === "error" ? <p className="unsub-note unsub-note--error" role="alert">{copy.error}</p> : null}
    </div>
  );
}
