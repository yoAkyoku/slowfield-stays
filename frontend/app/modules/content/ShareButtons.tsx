"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { IconFacebook, IconLine } from "../icons/SocialIcons";

/**
 * The share row under an article headline (客戶: 參考 oahotels 的分享).
 *
 * Facebook / LINE / X open a share dialog for the current page; the last button
 * copies the link. The URL is read from the browser at click time rather than
 * threaded down as a prop, so it is always the canonical page the reader is on
 * and needs no server round-trip. Copy falls back to a hidden textarea where
 * the async clipboard API is unavailable (older in-app browsers).
 */
export default function ShareButtons({ title, label }: { title: string; label: string }) {
  const [copied, setCopied] = useState(false);

  function currentUrl() {
    return typeof window === "undefined" ? "" : window.location.href.split("#")[0];
  }

  function open(kind: "facebook" | "line" | "x") {
    const u = encodeURIComponent(currentUrl());
    const t = encodeURIComponent(title);
    const href =
      kind === "facebook"
        ? `https://www.facebook.com/sharer/sharer.php?u=${u}`
        : kind === "line"
          ? `https://social-plugins.line.me/lineit/share?url=${u}`
          : `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=560");
  }

  async function copy() {
    const url = currentUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing more to try; leave the URL selected */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="article-share" aria-label={label}>
      <span className="article-share-label">{label}</span>
      <button type="button" className="article-share-btn" aria-label="Facebook" onClick={() => open("facebook")}>
        <IconFacebook size={16} />
      </button>
      <button type="button" className="article-share-btn" aria-label="LINE" onClick={() => open("line")}>
        <IconLine size={16} />
      </button>
      <button type="button" className="article-share-btn" aria-label="X" onClick={() => open("x")}>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.968 6.817H1.475l7.73-8.835L1.05 2.25h6.83l4.713 6.231 5.651-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
        </svg>
      </button>
      <button type="button" className="article-share-btn" aria-label={copied ? "Copied" : "Copy link"} onClick={copy}>
        {copied ? <Check size={16} /> : <Link2 size={16} />}
      </button>
    </div>
  );
}
