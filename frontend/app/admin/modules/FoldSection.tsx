"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A collapsible inspector section, styled to match .hpb-insp__section so it
 * drops in wherever one of those is used. Built on native <details>/<summary>:
 * a closed section keeps its inputs mounted in the DOM, so anything inside still
 * submits with the form — the fold only hides fields, it never unmounts them.
 *
 * Secondary groups (spacing, background, alignment, layout, SEO…) collapse by
 * default so the panel opens on the fields that matter (client: 欄位要能折疊).
 */
export default function FoldSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="hpb-insp__section hpb-fold" {...(defaultOpen ? { open: true } : {})}>
      <summary className="hpb-fold__summary">
        <span className="hpb-insp__label hpb-fold__label">{title}</span>
        <ChevronDown className="hpb-fold__chevron" aria-hidden="true" />
      </summary>
      <div className="hpb-fold__body">{children}</div>
    </details>
  );
}
