"use client";

import type { ReactNode } from "react";
import { Disclosure } from "../ui";

/**
 * A collapsible inspector section: the kit Disclosure, dressed to match
 * .hpb-insp__section (no box, the inspector's small-caps label). Native
 * <details>, so a closed section keeps its inputs mounted and they still submit
 * with the form — the fold only hides fields, it never unmounts them.
 *
 * Secondary groups (spacing, background, alignment, layout, SEO…) collapse by
 * default so the panel opens on the fields that matter (client: 欄位要能折疊).
 * It used to be its own <details> with its own summary and chevron markup.
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
    <Disclosure
      className="hpb-insp__section hpb-fold"
      summary={<span className="hpb-insp__label hpb-fold__label">{title}</span>}
      defaultOpen={defaultOpen}
    >
      {children}
    </Disclosure>
  );
}
