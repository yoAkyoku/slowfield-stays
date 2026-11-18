"use client";

import Link from "next/link";
import { useErrorScreen } from "../modules/useErrorScreen";

const copy = {
  en: {
    eyebrow: "Website unavailable",
    title: "We could not load the site content.",
    text: "The website data service is not responding. Please try again shortly or contact the team directly.",
    retry: "Try again",
    contact: "Contact"
  },
  zh: {
    eyebrow: "網站暫時無法使用",
    title: "目前無法載入網站內容。",
    text: "內容服務暫時沒有回應。請稍後再試，或直接聯絡團隊。",
    retry: "重試",
    contact: "聯絡我們"
  }
} as const;

export default function SiteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useErrorScreen(error);
  const labels = copy[locale];

  return (
    <main className="site-error-page">
      <section className="site-error-panel">
        <span>{labels.eyebrow}</span>
        <h1>{labels.title}</h1>
        <p>{labels.text}</p>
        <div>
          <button type="button" onClick={reset}>
            {labels.retry}
          </button>
          <Link href="/contact">{labels.contact}</Link>
        </div>
      </section>
    </main>
  );
}
