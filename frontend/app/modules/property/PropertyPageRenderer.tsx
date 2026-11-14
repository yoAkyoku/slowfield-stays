import type { CSSProperties } from "react";
import type { Banner } from "../api";
import type { Locale } from "../i18n";
import type { PropertyBlock } from "./types";
import { renderWithPairs } from "../blockPairs";

// Reuse parent site blocks
import BlockAbout from "../home/blocks/BlockAbout";
import BlockNewsletter from "../home/blocks/BlockNewsletter";
import BlockEditorial from "../home/blocks/BlockEditorial";
import BlockGallery from "../home/blocks/BlockGallery";
import BlockFlow from "../home/blocks/BlockFlow";
import BlockStays from "../home/blocks/BlockStays";
import BlockPathways from "../home/blocks/BlockPathways";
import BlockSearchBar, { type SearchBarInitial } from "../home/blocks/BlockSearchBar";

// Property-specific blocks
import BlockHeroBanner from "./blocks/BlockHeroBanner";
import BlockRichText from "./blocks/BlockRichText";
import BlockFeatureList from "./blocks/BlockFeatureList";
import BlockImageGallery from "./blocks/BlockImageGallery";
import BlockFaqAccordion from "./blocks/BlockFaqAccordion";
import BlockTable from "./blocks/BlockTable";
import BlockContactInfo from "./blocks/BlockContactInfo";
import BlockMap from "./blocks/BlockMap";
import BlockAttractions from "./blocks/BlockAttractions";
import BlockPartners from "./blocks/BlockPartners";
import BlockHouseRules from "./blocks/BlockHouseRules";
import BlockFeatureBadges from "./blocks/BlockFeatureBadges";
import BlockOembed from "./blocks/BlockOembed";
import BlockVideoText from "./blocks/BlockVideoText";
import BlockFeatureHero from "./blocks/BlockFeatureHero";
import BlockAlternating from "./blocks/BlockAlternating";
import BlockRooms from "./blocks/BlockRooms";
import ContactFormBlock from "../content/ContactFormBlock";
import BlockWrapper from "../BlockWrapper";
import { reportUnknownBlock } from "../unknownBlock";

function renderBlock(
  block: PropertyBlock,
  cfg: Record<string, unknown>,
  locale: Locale,
  extra: { banners?: Banner[]; siteSlug?: string; siteLine?: string; searchInitial?: SearchBarInitial },
): React.ReactNode {
  switch (block.type) {
    case "hero_banner":
      return <BlockHeroBanner key={block.id} locale={locale} config={cfg} banners={extra.banners} />;
    case "search":
      /* The 住宿搜尋 bar. It self-fetches the stay catalogue, so it needs no
         wiring from the page — which is what lets 精品Villa carry it as a
         block the editor can move or hide, instead of the hardcoded one that
         used to sit between the hero and the listing (客戶: 我需要這個區塊在頁
         面編輯中添加至精品Villa，移除默認的搜尋列). */
      return <BlockSearchBar key={block.id} locale={locale} config={cfg} initial={extra.searchInitial} />;
    case "rich_text":
      return <BlockRichText key={block.id} locale={locale} config={cfg} />;
    case "feature_list":
      return <BlockFeatureList key={block.id} locale={locale} config={cfg} />;
    case "image_gallery":
      return <BlockImageGallery key={block.id} locale={locale} config={cfg} />;
    case "rooms":
      return <BlockRooms key={block.id} locale={locale} config={cfg} />;
    case "faq_accordion":
      return <BlockFaqAccordion key={block.id} locale={locale} config={cfg} />;
    case "house_rules":
      return <BlockHouseRules key={block.id} locale={locale} config={cfg} />;
    case "table":
      return <BlockTable key={block.id} locale={locale} config={cfg} />;
    case "contact_info":
      return <BlockContactInfo key={block.id} locale={locale} config={cfg} siteLine={extra.siteLine} siteSlug={extra.siteSlug} />;
    case "map":
      return <BlockMap key={block.id} locale={locale} config={cfg} />;
    case "attractions":
      return <BlockAttractions key={block.id} locale={locale} config={cfg} />;
    case "partners":
      return <BlockPartners key={block.id} locale={locale} config={cfg} />;
    case "feature_badges":
      return <BlockFeatureBadges key={block.id} locale={locale} config={cfg} />;
    case "oembed":
      return <BlockOembed key={block.id} locale={locale} config={cfg} />;
    case "video_text":
      return <BlockVideoText key={block.id} locale={locale} config={cfg} />;
    case "feature_hero":
      return <BlockFeatureHero key={block.id} locale={locale} config={cfg} />;
    case "alternating":
      return <BlockAlternating key={block.id} locale={locale} config={cfg} />;
    case "contact_form":
      return <ContactFormBlock key={block.id} config={cfg} locale={locale} siteLine={extra.siteLine} />;
    case "about":
      return <BlockAbout key={block.id} locale={locale} config={cfg} />;
    case "newsletter":
      return <BlockNewsletter key={block.id} locale={locale} config={cfg} siteSlug={extra.siteSlug} />;
    case "editorial":
      return <BlockEditorial key={block.id} locale={locale} config={cfg} />;
    case "gallery":
      return <BlockGallery key={block.id} locale={locale} config={cfg} />;
    case "flow":
      return <BlockFlow key={block.id} locale={locale} config={cfg} />;
    case "stays":
      return <BlockStays key={block.id} locale={locale} config={cfg} staySlug={extra.siteSlug} />;
    // Offered by the villa block editor and by the CMS page renderer, but never
    // wired here: the block saved without complaint and the villa page showed
    // nothing at all where it sat.
    case "pathways":
      return <BlockPathways key={block.id} locale={locale} config={cfg} />;
    default:
      return reportUnknownBlock("PropertyPageRenderer", block.type);
  }
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
