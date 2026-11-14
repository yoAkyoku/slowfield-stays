type ScreenRect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

/** Return true when the floating control would cover a usable click target. */
export function overlapsInteractiveTarget(control: ScreenRect, target: ScreenRect) {
  const overlapX = Math.min(control.right, target.right) - Math.max(control.left, target.left);
  const overlapY = Math.min(control.bottom, target.bottom) - Math.max(control.top, target.top);
  return overlapX >= 8 && overlapY >= 8;
}
