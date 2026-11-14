"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconLine } from "../modules/icons/SocialIcons";

/**
 * Mobile-only sticky action bar: keeps 立即預約 (and LINE, if configured) always
 * reachable on phones, per the design brief. Slides up after the hero scrolls
 * past so it never covers the opening view. Desktop hides it via CSS.
 */
export default function MobileActionBar({
  lineHref,
  contactHref = "/contact",
  locale,
}: {
  lineHref?: string | null;
  contactHref?: string;
  locale: string;
}) {
  const zh = locale === "zh";
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 360);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`mobile-action-bar${show ? " is-shown" : ""}`} aria-hidden={!show}>
      {lineHref && (
        <a className="mab-btn mab-btn--line" href={lineHref} target="_blank" rel="noopener noreferrer">
          <IconLine size={18} />
          <span>LINE</span>
        </a>
      )}
      <Link className="mab-btn mab-btn--book" href={contactHref}>
        {zh ? "立即預約" : "Reserve"}
      </Link>
    </div>
  );
}
