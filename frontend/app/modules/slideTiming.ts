/**
 * How long one slide stays, from the block's 輪播秒數 setting.
 *
 * Three hero carousels ran at 6500 / 6500 / 5000 ms, none of them settable —
 * `HeroBannerCarousel` had taken an `intervalMs` prop the whole time and no
 * caller had ever passed one (客戶: 速度好像不太一樣 / 那它的速度也可以自己定義嗎).
 *
 * The same number answers a second request. A `.mp4` in a hero already plays
 * with `autoPlay muted loop`, so 「我蠻希望這邊是有一個 15 秒一直在循環的」 was
 * already possible — until a second slide existed, at which point the fixed 6.5s
 * interval cut the clip off a third of the way through. Setting the slide to the
 * clip's length is what makes a video hero work in a carousel.
 *
 * Its own module rather than an export from the carousel component: this is a
 * number, and the villa block should not have to import a client component to
 * read it.
 */

/** The default, in milliseconds. */
export const SLIDE_DURATION_MS = 6500;

/**
 * Seconds from the editor → milliseconds, or the default.
 *
 * Bounded at both ends: a zero or a negative would spin the carousel, and past
 * thirty seconds reads as a typo rather than an intent. Anything the number
 * input could not have produced falls back rather than throwing, because this
 * value arrives from stored config and a bad one must not take the page down.
 */
/* The bounds, named and exported rather than written as two literals inside the
   check below. The editor's number box carried `min={2} max={30}` as its own
   pair of literals, and an HTML `min` only drives validation UI — it does not
   stop a value being stored. So a client typed 1, it saved as 1, and this
   function silently handed back the 6.5s default: the setting was reported as
   broken when it had in fact been discarded on arrival. One definition now, so
   what the box accepts and what the carousel honours cannot drift apart. */
export const SLIDE_MIN_SECONDS = 2;
export const SLIDE_MAX_SECONDS = 30;

/** True when a value typed into 輪播秒數 will actually be honoured. Blank means
 *  "use the default" and is not an error. */
export function isHonouredSlideSeconds(raw: unknown): boolean {
  const s = String(raw ?? "").trim();
  if (!s) return true;
  const n = Number(s);
  return Number.isFinite(n) && n >= SLIDE_MIN_SECONDS && n <= SLIDE_MAX_SECONDS;
}

export function slideMs(raw: unknown, fallback: number = SLIDE_DURATION_MS): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < SLIDE_MIN_SECONDS || n > SLIDE_MAX_SECONDS) return fallback;
  return Math.round(n * 1000);
}
