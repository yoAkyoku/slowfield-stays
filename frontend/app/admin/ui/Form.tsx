import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./cx";

/** Label + control + hint/error. Wrap any input, select, textarea or custom control. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
  span
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  /** Span the full row inside a <FormGrid>. */
  span?: "full";
}) {
  const Tag = htmlFor ? "div" : "label";
  return (
    <Tag className={cx("a-field", span === "full" && "a-field--full", error ? "has-error" : null, className)}>
      {label ? (
        htmlFor ? (
          <label className="a-field__label" htmlFor={htmlFor}>{label}{required ? <span className="a-field__req" aria-hidden="true">*</span> : null}</label>
        ) : (
          <span className="a-field__label">{label}{required ? <span className="a-field__req" aria-hidden="true">*</span> : null}</span>
        )
      ) : null}
      {children}
      {error ? <span className="a-field__error" role="alert">{error}</span> : hint ? <span className="a-field__hint">{hint}</span> : null}
    </Tag>
  );
}

/** Two-column (responsive) grid of Fields. */
export function FormGrid({ children, cols = 2, className }: { children: ReactNode; cols?: 1 | 2 | 3; className?: string }) {
  return <div className={cx("a-form-grid", `a-form-grid--${cols}`, className)}>{children}</div>;
}

/** Titled group of fields inside a form. */
export function FormSection({ title, description, children, actions, className }: { title?: ReactNode; description?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <fieldset className={cx("a-form-section", className)}>
      {title || actions ? (
        <div className="a-form-section__head">
          <div>
            {title ? <legend className="a-form-section__title">{title}</legend> : null}
            {description ? <p className="a-form-section__desc">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </fieldset>
  );
}

/** Sticky footer row for Save / Cancel. */
export function FormActions({ children, className, sticky }: { children: ReactNode; className?: string; sticky?: boolean }) {
  return <div className={cx("a-form-actions", sticky && "a-form-actions--sticky", className)}>{children}</div>;
}

export function Input({ className, ...rest }: ComponentPropsWithoutRef<"input">) {
  return <input className={cx("a-input", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentPropsWithoutRef<"select">) {
  return <select className={cx("a-input", "a-select", className)} {...rest}>{children}</select>;
}

export function Textarea({ className, ...rest }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cx("a-input", "a-textarea", className)} {...rest} />;
}

/** Search box with a leading icon. Pass `onClear` (controlled inputs) for the built-in × button. */
export function SearchInput({
  className,
  icon,
  trailing,
  onClear,
  clearLabel = "Clear search",
  ...rest
}: ComponentPropsWithoutRef<"input"> & {
  icon?: ReactNode;
  /** Anything else to sit inside the right edge of the box. */
  trailing?: ReactNode;
  /** Shown while the box has a value; empties it in one tap (24px target). */
  onClear?: () => void;
  clearLabel?: string;
}) {
  const clear = onClear && rest.value ? (
    <button aria-label={clearLabel} className="a-search__clear" onClick={onClear} title={clearLabel} type="button">
      <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="14"><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
  ) : null;
  const end = clear || trailing ? <span className="a-search__trailing">{clear}{trailing}</span> : null;
  return (
    <span className={cx("a-search", className)}>
      {icon ? <span className="a-search__icon" aria-hidden="true">{icon}</span> : null}
      <input className="a-input" type="search" {...rest} />
      {end}
    </span>
  );
}

/** Checkbox / radio with its label. */
export function Check({ label, hint, className, type = "checkbox", ...rest }: Omit<ComponentPropsWithoutRef<"input">, "type"> & { label: ReactNode; hint?: ReactNode; type?: "checkbox" | "radio" }) {
  return (
    <label className={cx("a-check", className)}>
      <input type={type} {...rest} />
      <span className="a-check__text">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}
