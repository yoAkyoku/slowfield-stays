import type { ReactNode } from "react";
import { cx } from "./cx";

/** Page wrapper: consistent max width and vertical rhythm for every admin screen. */
export function Page({ children, className, width = "default" }: { children: ReactNode; className?: string; width?: "default" | "wide" | "narrow" }) {
  return <main className={cx("admin-page", "a-page", width !== "default" && `a-page--${width}`, className)}>{children}</main>;
}

/** The title row at the top of every screen. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  help,
  className
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons on the right. */
  actions?: ReactNode;
  /** Small inline items under the title (counts, help links). */
  meta?: ReactNode;
  /** Help / SOP trigger shown beside the title (kept outside the <h1>). */
  help?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("a-page-header", className)}>
      <div className="a-page-header__text">
        {eyebrow ? <p className="a-eyebrow">{eyebrow}</p> : null}
        <div className="a-page-title-row"><h1 className="a-page-title">{title}</h1>{help}</div>
        {description ? <p className="a-page-desc">{description}</p> : null}
        {meta ? <div className="a-page-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="a-page-header__actions">{actions}</div> : null}
    </header>
  );
}

/** A surface. With `title` it renders a header row (title, description, actions). */
export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush,
  as: Tag = "section",
  id
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** No body padding — for tables and lists that run edge to edge. */
  flush?: boolean;
  as?: "section" | "div" | "article" | "aside";
  id?: string;
}) {
  return (
    <Tag className={cx("a-card", className)} id={id}>
      {title || actions ? (
        <div className="a-card__head">
          <div className="a-card__heading">
            {title ? <h2 className="a-card__title">{title}</h2> : null}
            {description ? <p className="a-card__desc">{description}</p> : null}
          </div>
          {actions ? <div className="a-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children != null ? <div className={cx("a-card__body", flush && "a-card__body--flush", bodyClassName)}>{children}</div> : null}
    </Tag>
  );
}

/** Horizontal bar of filters / search / bulk actions. */
export function Toolbar({ children, className, end }: { children?: ReactNode; className?: string; end?: ReactNode }) {
  return (
    <div className={cx("a-toolbar", className)}>
      <div className="a-toolbar__main">{children}</div>
      {end ? <div className="a-toolbar__end">{end}</div> : null}
    </div>
  );
}

/** Responsive grid helper. */
export function Grid({ children, cols = 3, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 5; className?: string }) {
  return <div className={cx("a-grid", `a-grid--${cols}`, className)}>{children}</div>;
}

/** Vertical stack with consistent gaps. */
export function Stack({ children, gap = "md", className }: { children: ReactNode; gap?: "sm" | "md" | "lg"; className?: string }) {
  return <div className={cx("a-stack", `a-stack--${gap}`, className)}>{children}</div>;
}
