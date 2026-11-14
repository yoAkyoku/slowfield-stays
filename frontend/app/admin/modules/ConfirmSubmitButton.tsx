"use client";

import { useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { Button, Dialog, DialogActions } from "../ui";

/**
 * A submit button that asks first. It sits in front of 刪除站台, 刪除頁面 and
 * the other irreversible actions. The question is the kit Dialog (Escape,
 * focus trap, scroll lock). Without `action` it submits the form it sits in.
 */
export default function ConfirmSubmitButton({
  action,
  body,
  cancelLabel,
  children,
  className,
  confirmLabel,
  title
}: {
  action?: (formData: FormData) => void;
  body: string;
  cancelLabel: string;
  children: ReactNode;
  /** Extra class on the trigger — used to mark the irreversible ones. */
  className?: string;
  confirmLabel: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function submit() {
    setOpen(false);
    if (action) {
      startTransition(() => action(new FormData()));
    } else {
      buttonRef.current?.form?.requestSubmit();
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className={[className, pending ? "is-pending" : ""].filter(Boolean).join(" ") || undefined}
      >
        {pending ? <span className="admin-spinner" /> : null}
        {children}
      </button>
      <Dialog
        closeLabel={cancelLabel}
        description={body}
        footer={
          <DialogActions>
            <Button onClick={() => setOpen(false)}>{cancelLabel}</Button>
            <Button onClick={submit} variant="danger">
              {confirmLabel}
            </Button>
          </DialogActions>
        }
        onClose={() => setOpen(false)}
        open={open}
        size="sm"
        title={title}
      />
    </>
  );
}
