import type { ReactNode } from "react";
import { blockStyle, blockWrapperAttrs } from "./blockStyle";

/**
 * The element every admin-authored block is rendered inside: its own background,
 * spacing, type settings, full-bleed choice and 區塊標記 anchor.
 *
 * There were two of these, and they drifted the way copies do. The styling half
 * was extracted into blockStyle.ts after the last drift; the wrapper half was
 * not, and it drifted again — this time over `anchor`. The property renderer
 * emitted the id, the page renderer did not, while the editor offered the 區塊標記
 * field on every page either of them renders. An editor could tag a block on a
 * category page, point a nav item at it, and the jump silently did nothing.
 */
export default function BlockWrapper({
  config,
  type,
  children,
}: {
  config: Record<string, unknown>;
  /** The block's type. Only the background reads it — a block that paints its
   *  own (the newsletter band) must not also be painted by this wrapper. */
  type?: string;
  children: ReactNode;
}) {
  const style = blockStyle(config, type);
  const { id, className } = blockWrapperAttrs(config, style);
  return <div id={id} className={className} style={style}>{children}</div>;
}
