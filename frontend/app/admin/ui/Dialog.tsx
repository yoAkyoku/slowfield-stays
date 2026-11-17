"use client";

import { useId, useRef, type ReactNode } from "react";
import { useOverlay } from "../../modules/useOverlay";
import { cx } from "./cx";

/**
 * The one modal for the back office: Escape closes, focus is trapped, the page
 * behind stops scrolling (all via useOverlay), and the layer click closes it.
 * Render it conditionally or keep it mounted with `open`.
 *
 * `keepMounted` keeps a closed dialog's content in the page, hidden. A dialog
 * whose fields belong to the surrounding <form> needs it: unmounted fields do
 * not post, so closing the dialog would drop what was typed in it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  dismissible = true,
  closeLabel = "Close",
  keepMounted = false
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Usually <DialogActions> with Cancel / Confirm buttons. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** false: clicking the backdrop does nothing (forms with unsaved input). */
  dismissible?: boolean;
  /** Accessible name of the X button; pass the localised word (關閉 / Close). */
  closeLabel?: string;
  /** Keep the content mounted (hidden) while closed — see above. */
  keepMounted?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  useOverlay(open, onClose, { trapFocus: ref });
  if (!open && !keepMounted) return null;
  return (
    <div className="a-dialog-layer" role="presentation" style={open ? undefined : { display: "none" }} onMouseDown={(e) => { if (dismissible && e.target === e.currentTarget) onClose(); }}>
      <section aria-labelledby={titleId} aria-modal="true" className={cx("a-dialog", `a-dialog--${size}`, className)} ref={ref} role="dialog">
        <header className="a-dialog__head">
          <div>
            <h2 className="a-dialog__title" id={titleId}>{title}</h2>
            {description ? <p className="a-dialog__desc">{description}</p> : null}
          </div>
          <button aria-label={closeLabel} className="a-dialog__close" title={closeLabel} onClick={onClose} type="button">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="18"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>
        {children != null ? <div className="a-dialog__body">{children}</div> : null}
        {footer ? <footer className="a-dialog__foot">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="a-dialog__actions">{children}</div>;
}
