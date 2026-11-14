import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx("a-badge", `a-badge--${tone}`, className)}>
      {dot ? <span className="a-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** A KPI tile. Pass `href` to make the whole tile a link. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  href,
  className
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="a-stat__top">
        <span className="a-stat__label">{label}</span>
        {icon ? <span className={cx("a-stat__icon", `a-tone--${tone}`)}>{icon}</span> : null}
      </div>
      <strong className="a-stat__value">{value}</strong>
      {hint ? <span className="a-stat__hint">{hint}</span> : null}
    </>
  );
  return href ? (
    <Link className={cx("a-stat", "a-stat--link", className)} href={href}>{body}</Link>
  ) : (
    <div className={cx("a-stat", className)}>{body}</div>
  );
}

export type TabItem = { href: string; label: ReactNode; count?: number | string; active?: boolean };

/** Link-based tabs (each tab is a URL, so state survives reloads and sharing). */
export function Tabs({ items, className, ariaLabel }: { items: TabItem[]; className?: string; ariaLabel?: string }) {
  return (
    <nav aria-label={ariaLabel} className={cx("a-tabs", className)}>
      {items.map((item) => (
        <Link aria-current={item.active ? "page" : undefined} className={cx("a-tab", item.active && "is-active")} href={item.href} key={item.href}>
          <span>{item.label}</span>
          {item.count != null ? <span className="a-tab__count">{item.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Label / value pairs. */
export function DescriptionList({ items, className, columns = 2 }: { items: Array<{ label: ReactNode; value: ReactNode }>; className?: string; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cx("a-dl", `a-dl--${columns}`, className)}>
      {items.map((item, i) => (
        <div className="a-dl__item" key={i}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Clickable tile with icon, title and one line of text — quick actions, workspace shortcuts. */
export function ActionTile({ href, icon, title, text, tone = "brand", trailing, className }: { href: string; icon?: ReactNode; title: ReactNode; text?: ReactNode; tone?: Tone; trailing?: ReactNode; className?: string }) {
  return (
    <Link className={cx("a-tile", className)} href={href}>
      {icon ? <span className={cx("a-tile__icon", `a-tone--${tone}`)} aria-hidden="true">{icon}</span> : null}
      <span className="a-tile__text">
        <strong>{title}</strong>
        {text ? <span>{text}</span> : null}
      </span>
      {trailing ? <span className="a-tile__trailing">{trailing}</span> : null}
    </Link>
  );
}

/** Simple vertical list with dividers; each row is title/meta on the left and an action on the right. */
export function ListRows({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cx("a-list", className)}>{children}</ul>;
}
export function ListRow({ title, meta, aside, href, className }: { title: ReactNode; meta?: ReactNode; aside?: ReactNode; href?: string; className?: string }) {
  const body = (
    <>
      <span className="a-list__main">
        <span className="a-list__title">{title}</span>
        {meta ? <span className="a-list__meta">{meta}</span> : null}
      </span>
      {aside ? <span className="a-list__aside">{aside}</span> : null}
    </>
  );
  return <li className={cx("a-list__row", className)}>{href ? <Link className="a-list__link" href={href}>{body}</Link> : <div className="a-list__link">{body}</div>}</li>;
}

/** Thin progress bar with a label. */
export function Progress({ value, max = 100, label, tone = "brand" }: { value: number; max?: number; label?: ReactNode; tone?: Tone }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / (max || 1)) * 100)));
  return (
    <div className="a-progress">
      {label ? <div className="a-progress__label"><span>{label}</span><strong>{pct}%</strong></div> : null}
      <div className="a-progress__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className={cx("a-progress__bar", `a-progress__bar--${tone}`)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Inline notice / callout. */
export function Callout({ tone = "info", title, children, icon, actions, className, live }: {
  tone?: Tone; title?: ReactNode; children?: ReactNode; icon?: ReactNode; actions?: ReactNode; className?: string;
  /** Announce to screen readers when it appears: "status" (polite, e.g. saved / sent) or "alert"
   *  (assertive). Defaults to "alert" for danger and to nothing for static notes. */
  live?: "status" | "alert" | false;
}) {
  const role = live === false ? undefined : live ?? (tone === "danger" ? "alert" : undefined);
  return (
    <div className={cx("a-callout", `a-callout--${tone}`, className)} role={role}>
      {icon ? <span className="a-callout__icon">{icon}</span> : null}
      <div className="a-callout__body">
        {title ? <strong className="a-callout__title">{title}</strong> : null}
        {children ? <div className="a-callout__text">{children}</div> : null}
      </div>
      {actions ? <div className="a-callout__actions">{actions}</div> : null}
    </div>
  );
}
