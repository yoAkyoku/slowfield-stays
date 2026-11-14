import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "sm" | "md" | "lg";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon (e.g. a lucide-react element). */
  icon?: ReactNode;
  /** Render as a square icon-only button; `children` becomes the accessible label. */
  iconOnly?: boolean;
  block?: boolean;
  className?: string;
  children?: ReactNode;
};

/** Class string for the shared button look, for elements that cannot use <Button>
 *  (e.g. SubmitButton / ConfirmSubmitButton, which own their own <button>). */
export function buttonClass({
  variant = "secondary",
  size = "md",
  iconOnly,
  block,
  className
}: Pick<Common, "variant" | "size" | "iconOnly" | "block" | "className"> = {}): string {
  return cx("a-btn", `a-btn--${variant}`, `a-btn--${size}`, iconOnly && "a-btn--icon", block && "a-btn--block", className);
}

function Inner({ icon, iconOnly, children }: Pick<Common, "icon" | "iconOnly" | "children">) {
  if (iconOnly) {
    return (
      <>
        {icon}
        <span className="a-sr-only">{children}</span>
      </>
    );
  }
  return (
    <>
      {icon}
      {children != null ? <span>{children}</span> : null}
    </>
  );
}

type ButtonProps = Common & Omit<ComponentPropsWithoutRef<"button">, "className" | "children">;

/** The one button for the back office. Use `href` via <ButtonLink> for navigation. */
export function Button({ variant, size, icon, iconOnly, block, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      className={buttonClass({ variant, size, iconOnly, block, className })}
      title={iconOnly && typeof children === "string" ? children : undefined}
      type={type}
      {...rest}
    >
      <Inner icon={icon} iconOnly={iconOnly}>{children}</Inner>
    </button>
  );
}

type ButtonLinkProps = Common & Omit<ComponentPropsWithoutRef<typeof Link>, "className" | "children"> & {
  /** Plain <a> instead of next/link (external links, downloads, new tabs). */
  external?: boolean;
};

export function ButtonLink({ variant, size, icon, iconOnly, block, className, children, external, href, ...rest }: ButtonLinkProps) {
  const cls = buttonClass({ variant, size, iconOnly, block, className });
  const title = iconOnly && typeof children === "string" ? children : undefined;
  if (external) {
    const { prefetch: _prefetch, replace: _replace, scroll: _scroll, shallow: _shallow, ...anchorRest } = rest as Record<string, unknown>;
    return (
      <a className={cls} href={String(href)} title={title} {...(anchorRest as ComponentPropsWithoutRef<"a">)}>
        <Inner icon={icon} iconOnly={iconOnly}>{children}</Inner>
      </a>
    );
  }
  return (
    <Link className={cls} href={href} title={title} {...rest}>
      <Inner icon={icon} iconOnly={iconOnly}>{children}</Inner>
    </Link>
  );
}
