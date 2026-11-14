import type { ReactNode } from "react";
import { blockPairStyle, withoutPad } from "./blockStyle";
import BlockWrapper from "./BlockWrapper";

/**
 * 與下一個區塊並排 — the block-pairing pass, in one place.
 *
 * The editor offers 與下一個區塊並排 / 交換左右 / 上下並排 / 併入上一組 on every
 * block it can reach, and the rules for them lived only inside
 * PropertyPageRenderer. Group content pages (/brand, /journal, /contact) go
 * through PageBlocks instead, which mapped one wrapper per block and never
 * looked at the four keys — so an editor could tick 並排, save without error,
 * watch the admin's own preview (which renders through the property component)
 * show the pair correctly, and find the published page still stacking the blocks
 * one above the other.
 *
 * Two copies of the same loop is what let that happen, so there is now one:
 * both renderers call this, and a fix to the pairing rules cannot reach one kind
 * of page and miss the other.
 */

export type PairableBlock = {
  id: string;
  type: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

/**
 * The ids of blocks that render as a pair's SECOND column.
 *
 * The editor needs this to withhold a control the pair wrapper makes inert, and
 * it has to agree with the loop below exactly or it withholds the wrong one. Two
 * ways a hand-rolled "is the previous block's _pairNext set" check disagrees,
 * both reachable from the editor:
 *
 *   · a DISABLED block between them. The loop pairs over `enabled`, so
 *     A(_pairNext) · B(disabled) · C pairs A+C — the naive check flags B.
 *   · two _pairNext in a row. A(_pairNext) · B(_pairNext) · C consumes A+B and
 *     leaves C standalone — the naive check flags C, whose padding IS read.
 *
 * Written here, beside the loop it mirrors, so the two move together.
 */
export function pairSecondIds<B extends PairableBlock>(blocks: B[]): Set<string> {
  const enabled = blocks.filter((b) => b.enabled !== false);
  const out = new Set<string>();
  for (let i = 0; i < enabled.length; i++) {
    const cfg = (enabled[i].config ?? {}) as Record<string, unknown>;
    if (!cfg._pairNext || i + 1 >= enabled.length) continue;
    out.add(enabled[i + 1].id);
    let k = i + 2;
    while (k < enabled.length && ((enabled[k].config ?? {}) as Record<string, unknown>)._pairJoin === true) k++;
    i = k - 1;
  }
  return out;
}

export function renderWithPairs<B extends PairableBlock>({
  blocks,
  render,
  adaptPaired,
  wrap = (block, cfg, el) => <BlockWrapper key={block.id} type={block.type} config={cfg}>{el}</BlockWrapper>,
}: {
  blocks: B[];
  /** Turns one block into its element. Returning null drops it. */
  render: (block: B, cfg: Record<string, unknown>) => ReactNode;
  /** Villa pages fold the SPACE section's steps into the block paired with them;
   *  a page that has no such convention passes nothing. */
  adaptPaired?: (block: B, cfg: Record<string, unknown>) => Record<string, unknown>;
  /**
   * How one block is wrapped. Must set `key={block.id}` — the results go into an
   * array.
   *
   * The group homepage wraps differently on purpose: it applies the full-bleed
   * half of the editor's width control but NOT `.property-block-contained`,
   * which is not just a width cap — it centres headings, tints eyebrows with the
   * accent and reshapes section padding, i.e. the villa pages' whole look. So
   * the homepage kept a third copy of this loop rather than share one that
   * hardcoded the wrapper. The wrapper is the parameter now, and the pairing
   * rules are not duplicated a third time.
   */
  wrap?: (block: B, cfg: Record<string, unknown>, el: ReactNode) => ReactNode;
}): ReactNode[] {
  const enabled = blocks.filter((b) => b.enabled !== false);
  const output: ReactNode[] = [];

  for (let i = 0; i < enabled.length; i++) {
    const block = enabled[i];
    const cfg = (block.config ?? {}) as Record<string, unknown>;

    if (cfg._pairNext && i + 1 < enabled.length) {
      const nextBlock = enabled[i + 1];
      const rawNextCfg = (nextBlock.config ?? {}) as Record<string, unknown>;
      const nextCfg = adaptPaired ? adaptPaired(nextBlock, rawNextCfg) : rawNextCfg;
      const reverse = cfg._pairReverse === true;

      // 併入上一組 — a pair holds two columns, but the second one can hold more
      // than one block. Feature highlights used to live inside the rich text and
      // so sat under it in the pair; once they became their own block the pair
      // had no room for them and they fell to full width below. Any following
      // block marked _pairJoin stacks into the same column instead.
      const joined: B[] = [];
      let k = i + 2;
      while (k < enabled.length && ((enabled[k].config ?? {}) as Record<string, unknown>)._pairJoin === true) {
        joined.push(enabled[k]);
        k++;
      }

      const el = render(block, cfg);
      const nextEl = render(nextBlock, nextCfg);
      // 上下並排 — the pair can stack instead of sitting side by side; "reverse"
      // then means bottom-to-top rather than right-to-left (see the CSS for why
      // this needs its own class rather than reusing is-reversed's rtl trick).
      const column = cfg._pairDirection === "column";
      /* A block that renders nothing contributes no column.
       *
       * Every one of these renderers returns null for a block with no content —
       * an 入住須知 with no rules, an empty gallery, a table with no rows — and
       * the pair wrapped that null anyway. The wrapper is a real element with a
       * real class, so it took one of the two grid tracks and held it open: the
       * block that DID have content came out at 0.92fr or 1.08fr of the pair,
       * roughly half width, beside an empty gap. From the editor it reads as the
       * surviving block having mysteriously shrunk, and the usual first move —
       * deleting the empty block — is also the fix, so it looks self-inflicted.
       *
       * Dropping the wrapper leaves the pair with a single child, which the
       * stylesheet spans across both tracks (see .property-block-pair >
       * :only-child), so the content keeps full width. */
      const wrapIf = (b: B, c: Record<string, unknown>, e: ReactNode): ReactNode =>
        e ? wrap(b, c, e) : null;
      /* The padding is the PAIR's, not each column's — see blockPairStyle. Left
         in on the columns too it was applied twice on the first one and once on
         the second, which shows as misalignment under `align-items: stretch`.
         The rendered element is built from the untouched config; only the
         wrapper's styling loses the two keys. */
      const first = wrapIf(block, withoutPad(cfg), el);
      const joinedEls = joined
        .map((jb) => {
          const jcfg = (jb.config ?? {}) as Record<string, unknown>;
          return wrapIf(jb, withoutPad(jcfg), render(jb, jcfg));
        })
        .filter(Boolean);
      const nextWrapped = wrapIf(nextBlock, withoutPad(nextCfg), nextEl);
      const secondColumn = joinedEls.length > 0 ? (
        // Only wrapped when something joins — an unwrapped pair keeps the exact
        // DOM the CSS was written against.
        <div className="property-block-pair__stack">
          {nextWrapped}
          {joinedEls}
        </div>
      ) : (
        nextWrapped
      );
      if (first || secondColumn) {
        output.push(
          <div
            key={block.id}
            className={`property-block-pair${reverse ? " is-reversed" : ""}${column ? " is-column" : ""}`}
            /* The pair's own 上下/左右留白, from the block that declares it —
               see blockPairStyle. Without this the wrapper kept the
               stylesheet's clamp whatever the editor was set to. */
            style={blockPairStyle(cfg, nextCfg)}
          >
            {first}
            {secondColumn}
          </div>,
        );
      }
      i = k - 1;
      continue;
    }

    const el = render(block, cfg);
    if (!el) continue;
    output.push(wrap(block, cfg, el));
  }

  return output;
}
