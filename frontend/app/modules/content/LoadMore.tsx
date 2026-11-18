"use client";

import { useState, type ReactNode } from "react";

/**
 * A grid that shows `initialCount` items and a 「載入更多」 button that adds as
 * many again, then says there is no more.
 *
 * The content listings and the stays page each had their own copy; this is the
 * one, and the caller says how an item is drawn.
 */
export default function LoadMore<T>({
  items,
  initialCount,
  loadMoreLabel,
  noMoreLabel,
  className,
  render,
}: {
  items: T[];
  initialCount: number;
  loadMoreLabel: string;
  noMoreLabel: string;
  className: string;
  render: (item: T, index: number) => ReactNode;
}) {
  const [shown, setShown] = useState(initialCount);
  const hasMore = shown < items.length;

  return (
    <>
      <div className={className}>
        {items.slice(0, shown).map((item, index) => render(item, index))}
      </div>
      <div className="load-more-container">
        {hasMore ? (
          <button
            className="load-more-button"
            type="button"
            onClick={() => setShown((s) => Math.min(s + initialCount, items.length))}
          >
            {loadMoreLabel}
          </button>
        ) : items.length > initialCount ? (
          <span className="load-more-done">{noMoreLabel}</span>
        ) : null}
      </div>
    </>
  );
}
