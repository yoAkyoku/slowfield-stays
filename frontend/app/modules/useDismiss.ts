"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Close a menu, dropdown or panel when the pointer goes down outside it, or on
 * Escape.
 *
 * This existed four times, each spelled differently: two listened for mousedown
 * and one for pointerdown, and only two of the four closed on Escape — so
 * whether a menu could be dismissed from the keyboard depended on which menu it
 * was. pointerdown is the one to keep, since it covers touch and pen as well as
 * a mouse, and Escape now applies to all of them.
 *
 * Pass several refs when one control is made of more than one element, such as
 * a panel and the button that opens it: a press on any of them counts as
 * inside.
 */
export function useDismiss(
  refs: RefObject<HTMLElement | null> | Array<RefObject<HTMLElement | null>>,
  onClose: () => void,
  enabled = true,
) {
  // Held in refs so a caller passing an inline array or arrow function does not
  // rebind the document listeners on every render.
  const refsRef = useRef(refs);
  refsRef.current = refs;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;

    const isInside = (target: Node) => {
      const current = refsRef.current;
      const list = Array.isArray(current) ? current : [current];
      return list.some((ref) => ref.current?.contains(target));
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!isInside(event.target as Node)) closeRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);
}

export default useDismiss;
