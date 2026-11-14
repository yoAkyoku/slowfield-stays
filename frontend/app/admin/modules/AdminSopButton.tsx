"use client";

import { CircleAlert, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDismiss } from "../../modules/useDismiss";

export default function AdminSopButton({
  children,
  label = "SOP"
}: {
  children: React.ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useDismiss([panelRef, buttonRef], close, open);

  return (
    <div className="admin-sop-wrapper">
      <button
        ref={buttonRef}
        className="admin-sop-trigger"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={label}
        title={label}
      >
        <CircleAlert size={18} />
      </button>
      {open && (
        <div className="admin-sop-panel" ref={panelRef}>
          <div className="admin-sop-panel-head">
            <strong>{label}</strong>
            <button type="button" onClick={close} aria-label="Close">
              <X size={15} />
            </button>
          </div>
          <div className="admin-sop-panel-body">{children}</div>
        </div>
      )}
    </div>
  );
}
