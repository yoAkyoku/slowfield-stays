"use client";

import { useMemo, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import useAutoAdvance from "./useAutoAdvance";
import { swipeDirection, swipePoint, type SwipePoint } from "./swipe";

/**
 * The photo strip on a stay card: which photo is showing, the arrows, dots,
 * swipe and autoplay, and photos that turn out not to exist.
 *
 * StayCard had all of this; StayShowcaseCard (the homepage's featured villas)
 * had its own smaller copy with no swipe — on a phone the arrows were the only
 * way through the photos — and nothing for a missing photo, which left a blank
 * frame in the carousel. Both cards use this now.
 *
 * Pass the photos with their `src`. A src that fails to load is taken out, so
 * the count that drives the arrows, dots and autoplay is the count of photos
 * that can be shown; when all of them fail the list is empty and the card
 * draws its placeholder.
 */
export default function useCardGallery<T extends { src: string }>(photos: T[]) {
  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);
  const gallery = useMemo(() => photos.filter((p) => !failedSrcs.includes(p.src)), [photos, failedSrcs]);

  /* What the reader picked, and what is on screen. The list shrinks when a
     photo is missing, so the selection is folded back into the photos that
     exist rather than indexing past the end. */
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeIndex = gallery.length ? selectedIndex % gallery.length : 0;

  /* Did the reader ask for this photo, or did the timer bring it? A live
     region should report the result of an action, not narrate a slideshow, so
     only the reader's own moves arm it. Set just before the state update that
     renders it, so the flag and the index are committed together. */
  const userDrivenRef = useRef(false);

  const step = (direction: number) => {
    userDrivenRef.current = true;
    setSelectedIndex((current) => (current + direction + gallery.length) % gallery.length);
  };
  const select = (index: number) => {
    userDrivenRef.current = true;
    setSelectedIndex(index);
  };

  /* For a control laid over a link (the card's photo opens the stay): change
     the photo, do not follow the link. */
  const onStep = (event: MouseEvent, direction: number) => {
    event.preventDefault();
    event.stopPropagation();
    step(direction);
  };
  const onSelect = (event: MouseEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    select(index);
  };

  const autoRef = useAutoAdvance(
    () => {
      userDrivenRef.current = false;
      setSelectedIndex((current) => (current + 1) % gallery.length);
    },
    { count: gallery.length },
  );

  /* Swipe. A swipe ends with a synthesised click, which the link covering the
     photo would follow; the click is swallowed after a swipe, and the flag is
     cleared on the next touch so a genuine tap still opens the stay. */
  const touchRef = useRef<SwipePoint | null>(null);
  const swipedRef = useRef(false);
  const swipeHandlers = {
    onTouchStart: (event: TouchEvent) => {
      swipedRef.current = false;
      touchRef.current = gallery.length > 1 ? swipePoint(event.touches[0]) : null;
    },
    onTouchEnd: (event: TouchEvent) => {
      if (!touchRef.current) return;
      const direction = swipeDirection(touchRef.current, swipePoint(event.changedTouches[0]));
      touchRef.current = null;
      if (!direction) return;
      swipedRef.current = true;
      step(direction);
    },
    /* Capture, so the click is stopped before the overlay link acts on it. */
    onClickCapture: (event: MouseEvent) => {
      if (!swipedRef.current) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };

  /* For an <img onError>. A load cancelled because the element left the
     document fires the same event as a missing file; only a refused load on an
     element still in the page means the photo is not there. */
  const markFailed = (src: string, element: Element) => {
    if (!element.isConnected) return;
    setFailedSrcs((current) => (current.includes(src) ? current : [...current, src]));
  };

  return { gallery, activeIndex, userDriven: userDrivenRef.current, onStep, onSelect, autoRef, swipeHandlers, markFailed };
}
