import type { ReactNode } from "react";
import type { Banner } from "./api";
import type { Locale } from "./i18n";
import BlockFlow from "./home/blocks/BlockFlow";
import BlockStays from "./home/blocks/BlockStays";
import BlockGallery from "./home/blocks/BlockGallery";
import BlockPathways from "./home/blocks/BlockPathways";
import BlockEditorial from "./home/blocks/BlockEditorial";
import BlockAbout from "./home/blocks/BlockAbout";
import BlockNewsletter from "./home/blocks/BlockNewsletter";
import BlockSearchBar, { type SearchBarInitial } from "./home/blocks/BlockSearchBar";
import BlockHeroBanner from "./property/blocks/BlockHeroBanner";
import BlockRichText from "./property/blocks/BlockRichText";
import BlockFeatureList from "./property/blocks/BlockFeatureList";
import BlockImageGallery from "./property/blocks/BlockImageGallery";
import BlockFaqAccordion from "./property/blocks/BlockFaqAccordion";
import BlockTable from "./property/blocks/BlockTable";
import BlockContactInfo from "./property/blocks/BlockContactInfo";
import BlockMap from "./property/blocks/BlockMap";
import BlockAttractions from "./property/blocks/BlockAttractions";
import BlockPartners from "./property/blocks/BlockPartners";
import BlockHouseRules from "./property/blocks/BlockHouseRules";
import BlockFeatureBadges from "./property/blocks/BlockFeatureBadges";
import BlockOembed from "./property/blocks/BlockOembed";
import BlockVideoText from "./property/blocks/BlockVideoText";
import BlockFeatureHero from "./property/blocks/BlockFeatureHero";
import BlockAlternating from "./property/blocks/BlockAlternating";
import BlockRooms from "./property/blocks/BlockRooms";
import ContactFormBlock from "./content/ContactFormBlock";

/**
 * The block types every page renderer draws, and how.
 *
 * The brand homepage (HomepageBlocks), villa pages (PropertyPageRenderer) and
 * group content pages (PageBlocks) each had a switch over the same 26 types,
 * mostly the same one-liners. A type missing from one of them saved without
 * complaint and rendered as nothing on that kind of page, which happened more
 * than once. One table now; a renderer lists only what it does differently
 * (the brand homepage's own hero carousel, the contact page's card layout).
 *
 * What a block may read from the page comes in through the context. A renderer
 * leaves out what it does not have — the brand homepage has no villa, so no
 * siteLine — and the block falls back to its own config as before.
 */
export type BlockContext = {
  key: string;
  locale: Locale;
  cfg: Record<string, unknown>;
  /** The site whose page this is. */
  siteSlug?: string;
  /** The villa's LINE id, for the contact blocks' fallback. */
  siteLine?: string;
  /** The site's hero banners, for hero_banner. */
  banners?: Banner[];
  /** Pre-filled search values, for the search bar on the stays page. */
  searchInitial?: SearchBarInitial;
  /** Scopes the stays block to one villa (villa pages only). */
  staySlug?: string;
};

export type BlockRenderer = (c: BlockContext) => ReactNode;

export const SHARED_BLOCKS: Record<string, BlockRenderer> = {
  flow: (c) => <BlockFlow key={c.key} locale={c.locale} config={c.cfg} />,
  stays: (c) => <BlockStays key={c.key} locale={c.locale} config={c.cfg} staySlug={c.staySlug} />,
  gallery: (c) => <BlockGallery key={c.key} locale={c.locale} config={c.cfg} />,
  pathways: (c) => <BlockPathways key={c.key} locale={c.locale} config={c.cfg} />,
  editorial: (c) => <BlockEditorial key={c.key} locale={c.locale} config={c.cfg} />,
  about: (c) => <BlockAbout key={c.key} locale={c.locale} config={c.cfg} />,
  newsletter: (c) => <BlockNewsletter key={c.key} locale={c.locale} config={c.cfg} siteSlug={c.siteSlug} />,
  /* The 住宿搜尋 bar fetches the stay catalogue itself, so any page can carry it. */
  search: (c) => <BlockSearchBar key={c.key} locale={c.locale} config={c.cfg} initial={c.searchInitial} />,
  hero_banner: (c) => <BlockHeroBanner key={c.key} locale={c.locale} config={c.cfg} banners={c.banners} />,
  rich_text: (c) => <BlockRichText key={c.key} locale={c.locale} config={c.cfg} />,
  feature_list: (c) => <BlockFeatureList key={c.key} locale={c.locale} config={c.cfg} />,
  image_gallery: (c) => <BlockImageGallery key={c.key} locale={c.locale} config={c.cfg} />,
  rooms: (c) => <BlockRooms key={c.key} locale={c.locale} config={c.cfg} />,
  faq_accordion: (c) => <BlockFaqAccordion key={c.key} locale={c.locale} config={c.cfg} />,
  house_rules: (c) => <BlockHouseRules key={c.key} locale={c.locale} config={c.cfg} />,
  table: (c) => <BlockTable key={c.key} locale={c.locale} config={c.cfg} />,
  contact_info: (c) => <BlockContactInfo key={c.key} locale={c.locale} config={c.cfg} siteLine={c.siteLine} siteSlug={c.siteSlug} />,
  map: (c) => <BlockMap key={c.key} locale={c.locale} config={c.cfg} />,
  attractions: (c) => <BlockAttractions key={c.key} locale={c.locale} config={c.cfg} />,
  partners: (c) => <BlockPartners key={c.key} locale={c.locale} config={c.cfg} />,
  feature_badges: (c) => <BlockFeatureBadges key={c.key} locale={c.locale} config={c.cfg} />,
  oembed: (c) => <BlockOembed key={c.key} locale={c.locale} config={c.cfg} />,
  video_text: (c) => <BlockVideoText key={c.key} locale={c.locale} config={c.cfg} />,
  feature_hero: (c) => <BlockFeatureHero key={c.key} locale={c.locale} config={c.cfg} />,
  alternating: (c) => <BlockAlternating key={c.key} locale={c.locale} config={c.cfg} />,
  contact_form: (c) => <ContactFormBlock key={c.key} locale={c.locale} config={c.cfg} siteLine={c.siteLine} />,
};

/**
 * Draw a block: the renderer's own version of the type if it has one, the
 * shared one otherwise. `undefined` means nobody knows the type — the caller
 * reports it.
 */
export function renderBlockType(
  type: string,
  context: BlockContext,
  own: Record<string, BlockRenderer> = {},
): ReactNode | undefined {
  const draw = own[type] ?? SHARED_BLOCKS[type];
  return draw ? draw(context) : undefined;
}
