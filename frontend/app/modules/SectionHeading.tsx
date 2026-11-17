import type { CSSProperties, ReactNode } from "react";

/**
 * A block's eyebrow and heading: the small kicker line above, the h2 below.
 *
 * Twenty-odd blocks wrote these two lines out by hand. Some printed an empty
 * <h2></h2> when the heading was cleared and some did not; the eyebrow class
 * and the heading level were the same everywhere only by habit. Each part is
 * drawn only when it has text, and no wrapper is added, so the markup a block
 * produces is exactly what it wrote before.
 *
 * Returns an array rather than a fragment so it renders the same through the
 * stub JSX runtime the block tests use.
 */
export default function SectionHeading({
  eyebrow,
  title,
  headingStyle,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  /** Inline style for the heading (BlockRichText's per-block colour and size). */
  headingStyle?: CSSProperties;
}) {
  return [
    eyebrow ? <div className="eyebrow" key="eyebrow">{eyebrow}</div> : null,
    title ? <h2 key="title" style={headingStyle}>{title}</h2> : null,
  ];
}
