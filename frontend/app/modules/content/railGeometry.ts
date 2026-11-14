/** Layout measurements, independent of scroll position and responsive CSS gaps. */
export function railGeometry(cards: Array<{ left: number; width: number }>, originalCount: number, viewportWidth: number, gap: number) {
  const first = cards[0];
  const last = cards[Math.min(originalCount, cards.length) - 1];
  if (!first || !last) return { overflows: false, step: 0, period: 0 };
  const contentWidth = last.left - first.left + last.width;
  return {
    // Ignore repeated copies when deciding whether this row needs to loop.
    overflows: contentWidth > viewportWidth + 2,
    step: cards[1] ? cards[1].left - first.left : first.width + gap,
    period: cards[originalCount] ? cards[originalCount].left - first.left : contentWidth + gap,
  };
}
