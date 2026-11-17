import type { Banner } from "../api";
import type { Locale } from "../i18n";
import type { PropertyBlock } from "./types";
import { renderWithPairs } from "../blockPairs";

// Reuse parent site blocks
import type { SearchBarInitial } from "../home/blocks/BlockSearchBar";

// Property-specific blocks
import { reportUnknownBlock } from "../unknownBlock";
import { renderBlockType } from "../blockRegistry";

function renderBlock(
  block: PropertyBlock,
  cfg: Record<string, unknown>,
  locale: Locale,
  extra: { banners?: Banner[]; siteSlug?: string; siteLine?: string; searchInitial?: SearchBarInitial },
): React.ReactNode {
  /* Every type comes from the shared table in modules/blockRegistry. A villa
     page hands it the villa's banners, LINE id and slug, which also scopes the
     stays block to this villa. */
  return renderBlockType(block.type, {
    key: block.id,
    locale,
    cfg,
    siteSlug: extra.siteSlug,
    siteLine: extra.siteLine,
    banners: extra.banners,
    searchInitial: extra.searchInitial,
    staySlug: extra.siteSlug,
  }) ?? reportUnknownBlock("PropertyPageRenderer", block.type);
}

export default function PropertyPageRenderer({
  blocks,
  locale,
  banners,
  siteSlug,
  siteLine,
  searchInitial,
}: {
  blocks: PropertyBlock[];
  locale: Locale;
  banners?: Banner[];
  siteSlug?: string;
  siteLine?: string;
  /** Passed straight through to a `search` block — see SearchBarInitial. */
  searchInitial?: SearchBarInitial;
}) {
  const extra = { banners, siteSlug, siteLine, searchInitial };

  // Take steps from the first flow block only (typically the space/about section).
  // Read from `blocks`, not the enabled subset, so hiding the SPACE section in the
  // admin still leaves its steps available as the paired block's feature highlights.
  const firstFlow = blocks.find((b) => b.type === "flow");
  const flowSteps = firstFlow && Array.isArray((firstFlow.config as Record<string, unknown>)?.steps)
    ? ((firstFlow.config as Record<string, unknown>).steps as Array<Record<string, unknown>>).slice(0, 4)
    : [];

  /* The pairing loop itself now lives in modules/blockPairs, because the group
     content renderer needs the same rules and had none — 並排 saved and did
     nothing on every /brand, /journal and /contact page. Only the villa-specific
     part stays here. */
  const output = renderWithPairs<PropertyBlock>({
    blocks,
    render: (block, cfg) => renderBlock(block, cfg, locale, extra),
    adaptPaired: (nextBlock, nextCfg) => {
      // Auto-inject flow steps as feature items into the paired text block
      const isText = nextBlock.type === "rich_text" || nextBlock.type === "about";
      if (!isText || Array.isArray(nextCfg.items) || flowSteps.length === 0) return nextCfg;
      const defaultIcons = ["icon:house", "icon:water", "icon:bed", "icon:sofa"];
      const items = flowSteps.map((step, idx) => ({
        icon: typeof step.icon === "string" && step.icon ? step.icon : (defaultIcons[idx] || ""),
        label: step.title ?? { zh: "", en: "" },
        detail: step.text ?? { zh: "", en: "" },
      }));
      return { ...nextCfg, items };
    },
  });

  return <>{output}</>;
}
