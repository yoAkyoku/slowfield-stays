"use client";

import { flashMessage } from "../modules/flashMessage";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

export type ToastTone = "success" | "error";

/**
 * The saved / failed message after an action: slides in at the top, clears
 * itself (4.5s, or 7s for an error) and takes the notice/error query that
 * carried it off the URL so a reload does not show it again.
 */
function stripFlashParams() {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ["notice", "error", "_t"]) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState(window.history.state, "", url.pathname + (url.search || ""));
  }
}

export function Toast({
  closeLabel,
  message,
  title,
  tone,
  nonce,
}: {
  closeLabel: string;
  message?: string;
  title: string;
  tone: ToastTone;
  nonce?: string;
}) {
  const [visible, setVisible] = useState(Boolean(message));
  const duration = tone === "error" ? 7000 : 4500;

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return;
    stripFlashParams();
    const timer = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timer);
  }, [duration, message, nonce]);

  if (!message || !visible) return null;

  return (
    <aside
      className={`a-toast a-toast-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      style={{ "--a-toast-duration": `${duration}ms` } as CSSProperties}
    >
      <span className="a-toast-mark" aria-hidden="true" />
      <div className="a-toast-copy">
        <strong>{title}</strong>
        <p>{flashMessage(message, /[\u3400-\u9fff]/.test(title))}</p>
      </div>
      <button className="a-toast-close" type="button" onClick={() => setVisible(false)} aria-label={closeLabel}>
        x
      </button>
      <span className="a-toast-progress" aria-hidden="true" />
    </aside>
  );
}
