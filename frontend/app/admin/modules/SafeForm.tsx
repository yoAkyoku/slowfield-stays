"use client";

/**
 * Form wrapper that prevents accidental submission when pressing Enter
 * inside text inputs. Only allows submission via actual submit buttons.
 *
 * This solves the React error:
 * "A React form was unexpectedly submitted. If you called form.submit()
 *  manually, consider using form.requestSubmit() instead."
 */
export default function SafeForm({
  children,
  className,
  action,
  noValidate,
  style,
  onBeforeSubmit,
  formRef
}: {
  children: React.ReactNode;
  className?: string;
  action: (formData: FormData) => void;
  noValidate?: boolean;
  style?: React.CSSProperties;
  /** Runs just before the server action, with the form element. Used to stash a
   *  draft: these actions redirect on failure as well as success, so whatever
   *  is in the form has to be written down before it is handed over.
   *  Returning false cancels the submit, for a check the browser cannot make
   *  itself (a required value that is submitted through a hidden field). */
  onBeforeSubmit?: (form: HTMLFormElement) => void | boolean;
  /** Receives the form element on mount. Draft recovery needs it to find the
   *  fields to restore, before any submit has handed one over. */
  formRef?: (form: HTMLFormElement | null) => void;
}) {
  return (
    <form
      ref={formRef}
      className={className}
      style={style}
      action={action}
      noValidate={noValidate}
      onSubmit={(e) => {
        if (onBeforeSubmit?.(e.currentTarget) === false) e.preventDefault();
      }}
      onKeyDown={(e) => {
        // Prevent Enter key in single-line inputs from submitting the form
        if (
          e.key === "Enter" &&
          e.target instanceof HTMLInputElement &&
          e.target.type !== "submit" &&
          e.target.type !== "button"
        ) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
