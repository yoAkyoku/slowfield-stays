import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type SegmentedOption<V extends string> = { value: V; label: ReactNode; icon?: ReactNode; href?: string; title?: string };

/**
 * Small exclusive toggle (grid/list, 中文/English, schedule/now).
 * Controlled with `value` + `onChange`, or link-based when options carry `href`.
 */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
  className,
  block
}: {
  options: SegmentedOption<V>[];
  value: V;
  onChange?: (value: V) => void;
  /** "tabs" renders as an underline tab strip (state-driven tabs). */
  size?: "sm" | "md" | "tabs";
  ariaLabel?: string;
  className?: string;
  /** Stretch to the container width; options share it equally. */
  block?: boolean;
}) {
  return (
    <div aria-label={ariaLabel} className={cx("a-seg", `a-seg--${size}`, block && "a-seg--block", className)} role="group">
      {options.map((opt) => {
        const active = opt.value === value;
        const inner = (
          <>
            {opt.icon}
            {opt.label != null ? <span>{opt.label}</span> : null}
          </>
        );
        return opt.href ? (
          <Link aria-current={active ? "true" : undefined} className={cx("a-seg__item", active && "is-active")} href={opt.href} key={opt.value} title={opt.title}>
            {inner}
          </Link>
        ) : (
          <button aria-pressed={active} className={cx("a-seg__item", active && "is-active")} key={opt.value} onClick={() => onChange?.(opt.value)} title={opt.title} type="button">
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/** Button group for a table row or card footer. <form> wrappers inside are laid out inline. */
export function RowActions({ children, className, align = "end" }: { children: ReactNode; className?: string; align?: "start" | "end" }) {
  return <div className={cx("a-row-actions", align === "start" && "a-row-actions--start", className)}>{children}</div>;
}

/** Frame + horizontal scroll for a hand-built <table className="a-table">. */
export function TableFrame({
  children,
  className,
  footer,
  label,
  scrollHint,
  stack
}: {
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  /** Names the scroll area and makes it keyboard-scrollable (role="region"). */
  label?: string;
  /** One line telling touch users the table scrolls sideways; shown on narrow screens only. */
  scrollHint?: ReactNode;
  /** Below ~980px of available width, show each row as a card: cells stack and
   *  each one is titled by its `data-label`. Give every <td> a data-label. */
  stack?: boolean;
}) {
  return (
    <div className={cx("a-table-frame", stack && "a-table-frame--stack", className)}>
      {scrollHint ? <p className="a-table-hint">{scrollHint}</p> : null}
      <div className="a-table-scroll" {...(label ? { role: "region", "aria-label": label, tabIndex: 0 } : {})}>{children}</div>
      {footer ? <div className="a-table-foot">{footer}</div> : null}
    </div>
  );
}

/** Title + subtitle inside a table cell. */
export function CellTitle({ title, sub, media }: { title: ReactNode; sub?: ReactNode; media?: ReactNode }) {
  return (
    <div className="a-cell-title">
      {media ? <span className="a-cell-title__media">{media}</span> : null}
      <span className="a-cell-title__text">
        <strong>{title}</strong>
        {sub ? <span>{sub}</span> : null}
      </span>
    </div>
  );
}

/** Collapsible section styled for forms and cards. */
export function Disclosure({ summary, children, defaultOpen, className, hint }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; hint?: ReactNode }) {
  return (
    <details className={cx("a-disclosure", className)} open={defaultOpen}>
      <summary>
        <span className="a-disclosure__summary">{summary}</span>
        {hint ? <span className="a-disclosure__hint">{hint}</span> : null}
        <svg aria-hidden="true" className="a-disclosure__chev" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="16"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="a-disclosure__body">{children}</div>
    </details>
  );
}

/** Wrapping row of badges / tags. */
export function Chips({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("a-chips", className)}>{children}</div>;
}

/** Inputs and a button on one row (e.g. "add amenity" field + Add). */
export function InputGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("a-input-group", className)}>{children}</div>;
}

/** Done / not-done list; each item may link to where it is fixed. */
export function Checklist({ items, className }: { items: Array<{ title: ReactNode; text?: ReactNode; ok: boolean; href?: string }>; className?: string }) {
  return (
    <ul className={cx("a-checklist", className)}>
      {items.map((item, i) => {
        const body = (
          <>
            <span className={cx("a-checklist__mark", item.ok ? "a-tone--success" : "a-tone--warning")}>
              {item.ok ? (
                <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeWidth="3" viewBox="0 0 24 24" width="12"><path d="M20 6 9 17l-5-5" /></svg>
              ) : (
                <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeDasharray="3 3" strokeWidth="3" viewBox="0 0 24 24" width="12"><circle cx="12" cy="12" r="9" /></svg>
              )}
            </span>
            <span>
              <strong>{item.title}</strong>
              {item.text ? <span className="a-checklist__text">{item.text}</span> : null}
            </span>
          </>
        );
        return <li key={i}>{item.href ? <Link href={item.href}>{body}</Link> : <div className="a-checklist__row">{body}</div>}</li>;
      })}
    </ul>
  );
}
