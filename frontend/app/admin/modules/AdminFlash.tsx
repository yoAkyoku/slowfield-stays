"use client";

import { flashMessage } from "./flashMessage";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type FlashTone = "success" | "error";

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

export default function AdminFlash({
  closeLabel,
  message,
  title,
  tone,
  nonce,
}: {
  closeLabel: string;
  message?: string;
  title: string;
  tone: FlashTone;
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
      className={`admin-flash admin-flash-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      style={{ "--flash-duration": `${duration}ms` } as CSSProperties}
    >
      <span className="admin-flash-mark" aria-hidden="true" />
      <div className="admin-flash-copy">
        <strong>{title}</strong>
        <p>{flashMessage(message, /[\u3400-\u9fff]/.test(title))}</p>
      </div>
      <button className="admin-flash-close" type="button" onClick={() => setVisible(false)} aria-label={closeLabel}>
        x
      </button>
      <span className="admin-flash-progress" aria-hidden="true" />
    </aside>
  );
}
