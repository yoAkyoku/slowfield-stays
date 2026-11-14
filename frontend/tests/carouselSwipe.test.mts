import assert from "node:assert/strict";
import test from "node:test";

import { jsxTags, evaluateExpression } from "./sourceEval";
import { swipeDirection, swipePoint } from "../app/modules/swipe.ts";

/**
 * The swipe itself: does dragging the photo sideways move it, and does that
 * drag stay a drag rather than turning into a tap.
 *
 * tests/carouselTouchAction.test.mts owns the other half — that the browser is
 * told to hand the gesture over. The two are separate on purpose: a carousel can
 * have a correct `touch-action` and no handler (which is what the homepage hero
 * and the stay cards were: their slides moved on a timer, the dots were the only
 * manual control, and 客戶: 手機版沒有滑動功能 outlived the touch-action fix
 * because there was no swipe to fix), or a handler and no `touch-action` (which
 * is what the villa hero was, and why its swipe worked only depending on the
 * angle of the finger).
 *
 * These run the components' real handlers, lifted from the JSX. A test that only
 * grepped for `onTouchStart` would pass on a handler that recorded the touch and
 * did nothing with it.
 *
 * THE TAP-THROUGH is the part that is easy to get wrong and invisible until a
 * phone is in someone's hand. A touch that ends is followed by a synthesised
 * click, and both of these carousels have a link under the finger — the stay
 * card is covered edge to edge by `.stay-card-media-link` so that tapping the
 * photo opens the stay, and the homepage hero holds the two CTAs. Without a
 * guard, every swipe would also navigate, which is worse than having no swipe:
 * the reader loses their place instead of merely not moving the photo.
 */

type Point = [number, number];

/** A touch that starts at `from` and lifts at `to`. */
function drag(handlers: Handlers, from: Point, to: Point): void {
  handlers.start({ touches: [{ clientX: from[0], clientY: from[1] }] });
  handlers.end({ changedTouches: [{ clientX: to[0], clientY: to[1] }] });
}

type Handlers = {
  start: (event: unknown) => void;
  end: (event: unknown) => void;
  click?: (event: unknown) => void;
};

/**
 * The component's own touch handlers, compiled out of its JSX.
 *
 * `ctx` supplies everything the handler closes over — the refs, the mover, and
 * the two helpers — so what runs here is the component's code and not a
 * paraphrase of it.
 */
function handlersOf(file: string, ctx: Record<string, unknown>): Handlers {
  const tag = jsxTags(file).find((t) => t.attrs.has("onTouchStart"));
  assert.ok(tag, `${file}: no element binds onTouchStart any more`);
  const build = (name: string) => {
    const source = tag.attrs.get(name);
    assert.ok(source, `${file}: the swipe surface has no ${name}`);
    return evaluateExpression(source, Object.keys(ctx))(ctx) as (event: unknown) => void;
  };
  const out: Handlers = { start: build("onTouchStart"), end: build("onTouchEnd") };
  if (tag.attrs.has("onClickCapture")) out.click = build("onClickCapture");
  return out;
}

/** A ref object as React hands one to a handler. */
const ref = <T,>(value: T) => ({ current: value });

/* ── the villa detail hero ────────────────────────────────────────────────── */

const VILLA_HERO = "app/modules/stays/StayHeroCarousel.tsx";

function villaHero() {
  const moves: number[] = [];
  const ctx = {
    touchRef: ref<unknown>(null),
    swipePoint,
    swipeDirection,
    go: (direction: number) => moves.push(direction),
  };
  return { moves, handlers: handlersOf(VILLA_HERO, ctx) };
}

test("villa hero: a drag left advances, a drag right goes back", () => {
  const left = villaHero();
  drag(left.handlers, [300, 200], [100, 210]);
  assert.deepEqual(left.moves, [1]);

  const right = villaHero();
  drag(right.handlers, [100, 200], [300, 210]);
  assert.deepEqual(right.moves, [-1]);
});

test("villa hero: scrolling past it does not move it", () => {
  const { moves, handlers } = villaHero();
  drag(handlers, [200, 100], [220, 400]);
  assert.deepEqual(moves, [], "a mostly-vertical drag moved the hero");
});

/* ── the homepage hero ────────────────────────────────────────────────────── */

const HOME_HERO = "app/modules/home/HomeHeroCarousel.tsx";

function homeHero({ slideCount = 3, index = 1 } = {}) {
  const goneTo: number[] = [];
  const swipedRef = ref(false);
  const ctx = {
    touchRef: ref<unknown>(null),
    swipedRef,
    swipePoint,
    swipeDirection,
    index,
    slides: { length: slideCount },
    goTo: (next: number) => goneTo.push(next),
  };
  return { goneTo, swipedRef, handlers: handlersOf(HOME_HERO, ctx) };
}

test("homepage hero: a drag left asks for the next banner", () => {
  /* goTo takes an absolute index and wraps it, so from banner 1 the next one is
     2 — the direction has to be added to where we are, not passed on its own. */
  const { goneTo, handlers } = homeHero({ index: 1 });
  drag(handlers, [320, 400], [80, 415]);
  assert.deepEqual(goneTo, [2]);
});

test("homepage hero: a drag right asks for the previous banner", () => {
  const { goneTo, handlers } = homeHero({ index: 1 });
  drag(handlers, [80, 400], [320, 415]);
  assert.deepEqual(goneTo, [0]);
});

test("homepage hero: scrolling down the page does not change the banner", () => {
  /* The one that matters most here: this hero is a whole screen tall, so almost
     every downward scroll on the homepage starts with a thumb on it. */
  const { goneTo, handlers } = homeHero();
  drag(handlers, [200, 120], [230, 500]);
  assert.deepEqual(goneTo, []);
});

test("homepage hero: a single banner is not a carousel", () => {
  const { goneTo, handlers } = homeHero({ slideCount: 1 });
  drag(handlers, [320, 400], [80, 415]);
  assert.deepEqual(goneTo, [], "swiping a one-banner hero asked it to move");
});

test("homepage hero: a swipe does not follow the CTA under the finger", () => {
  const { swipedRef, handlers } = homeHero();
  drag(handlers, [320, 400], [80, 415]);
  assert.equal(swipedRef.current, true, "the swipe did not arm the click guard");

  let prevented = false;
  handlers.click?.({ preventDefault: () => { prevented = true; }, stopPropagation: () => {} });
  assert.equal(prevented, true, "the click synthesised after a swipe was allowed through to the CTA");
});

test("homepage hero: a tap still reaches the CTA", () => {
  const { handlers } = homeHero();
  /* A tap that drifts a few pixels, which is what every tap on a phone does. */
  drag(handlers, [200, 400], [204, 402]);

  let prevented = false;
  handlers.click?.({ preventDefault: () => { prevented = true; }, stopPropagation: () => {} });
  assert.equal(prevented, false, "a tap was swallowed as though it were a swipe");
});

/* ── the stay card gallery ────────────────────────────────────────────────── */

const STAY_CARD = "app/modules/stays/StayCard.tsx";

function stayCard({ photos = 4 } = {}) {
  const steps: number[] = [];
  const swipedRef = ref(false);
  const ctx = {
    touchRef: ref<unknown>(null),
    swipedRef,
    swipePoint,
    swipeDirection,
    gallery: { length: photos },
    step: (direction: number) => steps.push(direction),
  };
  return { steps, swipedRef, handlers: handlersOf(STAY_CARD, ctx) };
}

test("stay card: dragging the photo moves the gallery both ways", () => {
  const next = stayCard();
  drag(next.handlers, [300, 200], [120, 190]);
  assert.deepEqual(next.steps, [1]);

  const back = stayCard();
  drag(back.handlers, [120, 200], [300, 190]);
  assert.deepEqual(back.steps, [-1]);
});

test("stay card: scrolling the list past a card does not flip its photo", () => {
  /* Several of these sit in a vertical grid, so a thumb crossing one is the
     normal way of reading the page rather than an edge case. */
  const { steps, handlers } = stayCard();
  drag(handlers, [200, 100], [180, 420]);
  assert.deepEqual(steps, []);
});

test("stay card: a card with one photo has nothing to swipe", () => {
  const { steps, handlers } = stayCard({ photos: 1 });
  drag(handlers, [300, 200], [120, 190]);
  assert.deepEqual(steps, []);
});

test("stay card: a swipe does not open the stay", () => {
  /* `.stay-card-media-link` covers the whole photo, so without the guard every
     swipe would navigate away from the list being browsed. */
  const { swipedRef, handlers } = stayCard();
  drag(handlers, [300, 200], [120, 190]);
  assert.equal(swipedRef.current, true, "the swipe did not arm the click guard");

  let prevented = false;
  handlers.click?.({ preventDefault: () => { prevented = true; }, stopPropagation: () => {} });
  assert.equal(prevented, true, "the swipe was allowed through to the overlay link");
});

test("stay card: tapping the photo still opens the stay", () => {
  const { handlers } = stayCard();
  drag(handlers, [200, 200], [203, 201]);

  let prevented = false;
  handlers.click?.({ preventDefault: () => { prevented = true; }, stopPropagation: () => {} });
  assert.equal(prevented, false, "tapping the photo no longer opens the stay");
});

test("stay card: the tap after a swipe opens the stay", () => {
  /* The guard is cleared by the next touchstart rather than by the click it
     blocks, so a swipe followed by a deliberate tap is not swallowed. Clearing
     it on use would work for the swipe that produces a click and strand the
     flag set for the one that does not. */
  const { swipedRef, handlers } = stayCard();
  drag(handlers, [300, 200], [120, 190]);
  assert.equal(swipedRef.current, true);

  drag(handlers, [200, 200], [202, 201]);
  let prevented = false;
  handlers.click?.({ preventDefault: () => { prevented = true; }, stopPropagation: () => {} });
  assert.equal(prevented, false, "a tap after a swipe was still being swallowed");
});
