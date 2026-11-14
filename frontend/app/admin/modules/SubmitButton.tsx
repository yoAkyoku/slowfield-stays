"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/**
 * Drop-in replacement for `<button type="submit">` that automatically
 * disables itself while the form action is pending, preventing double-submit.
 * Shows a spinner next to children when pending.
 */
export default function SubmitButton({
  children,
  className,
  disabled,
  formAction
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  formAction?: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      disabled={disabled || pending}
      formAction={formAction}
      type="submit"
    >
      {pending && !formAction ? <span className="admin-spinner" /> : null}
      {children}
    </button>
  );
}
