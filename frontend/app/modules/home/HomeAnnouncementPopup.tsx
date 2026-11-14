"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Announcement } from "../api";
import type { Locale } from "../i18n";
import { isSafeUrl } from "../safeHtml";
import { trs } from "../tr";

export default function HomeAnnouncementPopup({ announcements, readMoreLabel, locale }: { announcements: Announcement[]; readMoreLabel: string; locale: Locale }) {
  const [announcement] = announcements.filter((item) => item.display_mode === "popup");
  const storageKey = announcement ? `announcement-dismissed-${announcement.id}` : "";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!announcement) return;
    try {
      if (!sessionStorage.getItem(storageKey)) setOpen(true);
    } catch { /* SSR or private browsing */ }
  }, [announcement, storageKey]);

  function dismiss() {
    setOpen(false);
    try { sessionStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
  }

  if (!open || !announcement) return null;

  const title = trs(announcement, "title", locale);
  const body = trs(announcement, "body", locale);
  const ctaLabel = trs(announcement, "cta_label", locale);

  return (
    <div className="announcement-popup">
      <button aria-label="Close announcement" onClick={dismiss} type="button">
        x
      </button>
      {announcement.image_url ? <img src={announcement.image_url} alt={title} loading="lazy" /> : null}
      <h2>{title}</h2>
      <p>{body}</p>
      {announcement.cta_href && isSafeUrl(announcement.cta_href) ? (
        <Link className="button" href={announcement.cta_href}>
          {ctaLabel || readMoreLabel}
        </Link>
      ) : null}
    </div>
  );
}
