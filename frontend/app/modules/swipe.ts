/**
 * A left/right swipe, told apart from a scroll.
 *
 * Three carousels read the same gesture and each needs the same two guards, so
 * the decision lives here once rather than being copied into each of them:
 *
 *   · the movement has to be more horizontal than vertical. A finger dragged
 *     down the page passes over a full-bleed photo constantly, and treating that
 *     as a swipe would move the slide out from under someone who was scrolling.
 *   · it has to travel far enough to be a swipe rather than a tap that wandered
 *     a few pixels, which is what every tap on a phone does.
 *
 * The first guard is also what makes `touch-action: pan-y` the correct value for
 * these boxes: vertical belongs to the page, so it is handed back. If a carousel
 * ever starts acting on `dy` as well, that declaration becomes the thing that
 * breaks it — tests/carouselTouchAction.test.mts holds the two together.
 */

/** Below this, the finger was tapping and drifted. In CSS pixels. */
export const SWIPE_MIN_PX = 40;

export type SwipePoint = { x: number; y: number };

/** Where a touch is, in the shape this module compares. */
export function swipePoint(touch: { clientX: number; clientY: number }): SwipePoint {
  return { x: touch.clientX, y: touch.clientY };
}

/**
 * Which way the carousel should move, or 0 when this was not a swipe.
 *
 * `1` advances and `-1` goes back, matching the direction argument the
 * carousels' own `go`/`move`/`goTo` helpers already take — a finger travelling
 * left pulls the next slide in from the right, which is the direction every
 * native gallery moves.
 */
export function swipeDirection(start: SwipePoint, end: SwipePoint): -1 | 0 | 1 {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_MIN_PX) return dx < 0 ? 1 : -1;
  return 0;
}
