"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "cookie-consent-accepted";

export default function CookieConsentBanner({
  cookieNotice,
  gdprNotice,
  locale = "zh"
}: {
  cookieNotice: string;
  gdprNotice?: string;
  locale?: "zh" | "en";
}) {
  const zh = locale === "zh";
  const labels = {
    more: zh ? "了解更多" : "Learn more",
    hide: zh ? "隱藏詳情" : "Hide details",
    accept: zh ? "接受" : "Accept",
    reject: zh ? "拒絕" : "Decline",
    title: zh ? "Cookie 同意" : "Cookie consent"
  };
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      // A stored value of either kind — accepted ("1") or refused ("0") — is a
      // decision, so the banner does not return until the choice is cleared.
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function decide(accepted: boolean) {
    try { localStorage.setItem(STORAGE_KEY, accepted ? "1" : "0"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  const detailsId = "cookie-consent-gdpr";

  return (
    /* role="dialog" only. It also carried aria-live="polite", and the two are
       different promises about the same element: a dialog is announced when it
       takes focus, a live region is announced whenever its contents change. A
       screen reader given both read the whole banner out again every time the
       details were toggled — while the reader was inside it. */
    <div
      className="cookie-consent-banner"
      role="dialog"
      aria-label={labels.title}
    >
      <div className="cookie-consent-inner">
        <p className="cookie-consent-text">{cookieNotice}</p>
        {gdprNotice && (
          <>
            <button
              type="button"
              className="cookie-consent-toggle"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-controls={detailsId}
            >
              {/* The arrow is decoration and was a bare text node, so it went
                  into the button's name: the control announced itself as "black
                  right-pointing small triangle 了解更多". aria-hidden leaves the
                  glyph on screen and out of the name. */}
              <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>{" "}
              {expanded ? labels.hide : labels.more}
            </button>
            {/* Always rendered, hidden when collapsed, rather than mounted on
                expand: aria-controls above has to point at something that
                exists, and a dangling IDREF is a broken relationship rather
                than an absent one. `hidden` keeps it out of the layout and out
                of the accessibility tree just as unmounting did. */}
            <p className="cookie-consent-gdpr" id={detailsId} hidden={!expanded}>{gdprNotice}</p>
          </>
        )}
        <div className="cookie-consent-actions">
          <button type="button" className="cookie-consent-reject" onClick={() => decide(false)}>
            {labels.reject}
          </button>
          <button type="button" className="cookie-consent-accept" onClick={() => decide(true)}>
            {labels.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
