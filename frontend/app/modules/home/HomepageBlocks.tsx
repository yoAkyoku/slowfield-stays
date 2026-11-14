import type { ReactNode } from "react";
import type { Banner } from "../api";
import type { Locale } from "../i18n";
import BlockFlow from "./blocks/BlockFlow";
import BlockStays from "./blocks/BlockStays";
import BlockGallery from "./blocks/BlockGallery";
import BlockPathways from "./blocks/BlockPathways";
import BlockEditorial from "./blocks/BlockEditorial";
import BlockAbout from "./blocks/BlockAbout";
import BlockNewsletter from "./blocks/BlockNewsletter";
import BlockDestinations from "./blocks/BlockDestinations";
import BlockArticles from "./blocks/BlockArticles";
import BlockRichText from "../property/blocks/BlockRichText";
import BlockFeatureList from "../property/blocks/BlockFeatureList";
import BlockImageGallery from "../property/blocks/BlockImageGallery";
import BlockMap from "../property/blocks/BlockMap";
import BlockAttractions from "../property/blocks/BlockAttractions";
import BlockPartners from "../property/blocks/BlockPartners";
import BlockOembed from "../property/blocks/BlockOembed";
import BlockVideoText from "../property/blocks/BlockVideoText";
import BlockFeatureHero from "../property/blocks/BlockFeatureHero";
import BlockAlternating from "../property/blocks/BlockAlternating";
import BlockRooms from "../property/blocks/BlockRooms";
import BlockFaqAccordion from "../property/blocks/BlockFaqAccordion";
import BlockTable from "../property/blocks/BlockTable";
import BlockContactInfo from "../property/blocks/BlockContactInfo";
import BlockFeatureBadges from "../property/blocks/BlockFeatureBadges";
import BlockHouseRules from "../property/blocks/BlockHouseRules";
import ContactFormBlock from "../content/ContactFormBlock";
import { blockStyle, safeAnchor } from "../blockStyle";
import HomeHeroCarousel from "./HomeHeroCarousel";
import BlockSearchBar from "./blocks/BlockSearchBar";
import { reportUnknownBlock } from "../unknownBlock";
import { renderWithPairs } from "../blockPairs";

export type HomepageBlock = {
  id: string;
  type: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

export const DEFAULT_BLOCKS: HomepageBlock[] = [
  { id: "stays", type: "stays", enabled: true },
  { id: "about", type: "about", enabled: true },
  { id: "gallery", type: "gallery", enabled: true },
  { id: "articles", type: "articles", enabled: true, config: { variant: "feature" } },
  { id: "destinations", type: "destinations", enabled: true },
  { id: "pathways", type: "pathways", enabled: true },
  { id: "editorial", type: "editorial", enabled: true },
];

function renderBlock(
  block: HomepageBlock,
  cfg: Record<string, unknown>,
  locale: Locale,
  extra: { banners?: Banner[]; siteSlug?: string; heroFallbacks?: { eyebrow: string; title: string; subtitle: string } },
): ReactNode {
  const { banners, siteSlug, heroFallbacks } = extra;
  let el: ReactNode;
  switch (block.type) {
    case "flow":
      el = <BlockFlow key={block.id} locale={locale} config={cfg} />; break;
    case "stays":
      el = <BlockStays key={block.id} locale={locale} config={cfg} />; break;
    case "gallery":
      el = <BlockGallery key={block.id} locale={locale} config={cfg} />; break;
    case "pathways":
      el = <BlockPathways key={block.id} locale={locale} config={cfg} />; break;
    case "editorial":
      el = <BlockEditorial key={block.id} locale={locale} config={cfg} />; break;
    case "about":
      el = <BlockAbout key={block.id} locale={locale} config={cfg} />; break;
    case "newsletter":
      el = <BlockNewsletter key={block.id} locale={locale} config={cfg} siteSlug={siteSlug} />; break;
    case "destinations":
      el = <BlockDestinations key={block.id} locale={locale} config={cfg} />; break;
    case "articles":
      el = <BlockArticles key={block.id} locale={locale} config={cfg} />; break;
    case "rich_text":
      el = <BlockRichText key={block.id} locale={locale} config={cfg} />; break;
    case "feature_list":
      el = <BlockFeatureList key={block.id} locale={locale} config={cfg} />; break;
    case "search":
      el = <BlockSearchBar key={block.id} locale={locale} config={cfg} />; break;
    case "hero_banner":
      // The group site's hero is its own carousel, not the villa one —
      // rendering the villa hero here would have changed how the front
      // page looks the moment anyone added the block.
      el = (
        <HomeHeroCarousel
          key={block.id}
          config={cfg}
          banners={banners ?? []}
          eyebrow={heroFallbacks?.eyebrow ?? ""}
          fallbackTitle={heroFallbacks?.title ?? ""}
          fallbackSubtitle={heroFallbacks?.subtitle ?? ""}
          locale={locale}
        />
      ); break;
    case "image_gallery":
      el = <BlockImageGallery key={block.id} locale={locale} config={cfg} />; break;
    case "map":
      el = <BlockMap key={block.id} locale={locale} config={cfg} />; break;
    case "attractions":
      el = <BlockAttractions key={block.id} locale={locale} config={cfg} />; break;
    case "partners":
      el = <BlockPartners key={block.id} locale={locale} config={cfg} />; break;
    // Offered by the homepage editor's block list, so leaving it out here meant
    // an editor could add a social embed, save it, and get nothing on the page.
    case "oembed":
      el = <BlockOembed key={block.id} locale={locale} config={cfg} />; break;
    case "video_text":
      el = <BlockVideoText key={block.id} locale={locale} config={cfg} />; break;
    case "feature_hero":
      el = <BlockFeatureHero key={block.id} locale={locale} config={cfg} />; break;
    case "alternating":
      el = <BlockAlternating key={block.id} locale={locale} config={cfg} />; break;
    // The same seven the villa renderer has always had. The homepage editor
    // offers all of them with working config forms, so without these an admin
    // could build a whole 入住須知 section, save it without error, and find the
    // front page unchanged — the failure gave no sign it had happened.
    case "rooms":
      el = <BlockRooms key={block.id} locale={locale} config={cfg} />; break;
    case "faq_accordion":
      el = <BlockFaqAccordion key={block.id} locale={locale} config={cfg} />; break;
    case "table":
      el = <BlockTable key={block.id} locale={locale} config={cfg} />; break;
    case "feature_badges":
      el = <BlockFeatureBadges key={block.id} locale={locale} config={cfg} />; break;
    case "house_rules":
      el = <BlockHouseRules key={block.id} locale={locale} config={cfg} />; break;
    // No siteLine is threaded through: that is a per-villa contact setting, and
    // the group homepage has no villa. Both blocks fall back to the LINE id
    // typed into their own config, which is the only one an admin can set here.
    case "contact_info":
      el = <BlockContactInfo key={block.id} locale={locale} config={cfg} />; break;
    case "contact_form":
      el = <ContactFormBlock key={block.id} locale={locale} config={cfg} />; break;
    default:
      el = reportUnknownBlock("HomepageBlocks", block.type);
  }
  return el;
}

// Every block gets the same wrapper, so the rule drawn between blocks has
// something consistent to hang on. Previously only blocks with a section tag
// were wrapped, which meant the divider appeared or not depending on whether
// someone had happened to set an anchor. The anchor id is still only set when
// there is a tag to jump to.
//
// It also carries the per-block styling the editor writes. The villa pages
// have applied this since it was added, through BlockWrapper in
// PropertyPageRenderer; the group homepage never did, so setting a background
// here changed the preview and nothing else. Only the newsletter block
// worked, because it reads the key itself.
function BlockWrapper({ id, type, cfg, children }: { id: string; type?: string; cfg: Record<string, unknown>; children: ReactNode }) {
  // An empty string is not an anchor: it used to reach the DOM as id="".
  const anchor = safeAnchor(cfg.anchor);
  // 滿版 (full_bleed) is written by the same editor control the villa pages and
  // the content pages read, so it takes the same class they hand to the CSS
  // rather than a homepage-only rule that would drift from them.
  //
  // Only the full-bleed half is applied. Its counterpart
  // .property-block-contained is not just a width cap: it also centres headings,
  // tints eyebrows with the accent and reshapes section padding, which is the
  // villa pages' look. Putting it on every homepage block to mirror the villa
  // renderer exactly would have restyled the whole front page as the price of a
  // toggle nobody had switched on. Unset already means contained here.
  const fullBleed = cfg.full_bleed === true;
  // font size / line height / text align are written as inline style on this
  // wrapper, but a block's inner <p>/<h2>/<li> carry their own explicit sizes
  // and alignment in CSS, which win over inheritance — so the inspector's 字體
  // 大小／行距／對齊 saved fine here and did nothing. The villa and content
  // renderers add .property-block-styled + these is-* classes, which the
  // stylesheet keys on to force those descendants back to `inherit`. Mirrored
  // here so the same three controls take effect on the group homepage too.
  //
  // The type goes with it so a block that paints its own background is not
  // painted a second time here — see SELF_PAINTING_BLOCK_TYPES. The note above
  // ("Only the newsletter block worked, because it reads the key itself") is
  // what that double paint looked like from the other side.
  const style = blockStyle(cfg, type);
  // Only carry .property-block-styled when a typography control is actually set:
  // the class on its own also centres eyebrows (see globals.css), which is the
  // villa look, not the homepage's — a block that only set a background/padding
  // should keep its eyebrow where it was.
  /* Per-role typography counts too. It did not, so a homepage block whose
     author set only 各別文字格式 never got the class every --r-* rule hangs off
     and the whole panel did nothing there — and the site-group page editor now
     edits this page, offering that panel in full. The eyebrow-centring side
     effect the comment above describes has been split out of
     `.property-block-styled` in globals.css, so carrying the class no longer
     drags the villa look onto the homepage. */
  const hasRoleType = Object.keys(style ?? {}).some((k) => k.startsWith("--r-"));
  const hasType = !!(style?.fontSize || style?.lineHeight || style?.textAlign) || hasRoleType;
  const className = [
    "home-block",
    anchor ? "home-anchor" : "",
    fullBleed ? "property-block-full-bleed" : "",
    hasType ? "property-block-styled" : "",
    style?.fontSize ? "is-font-size" : "",
    style?.lineHeight ? "is-line-height" : "",
    style?.textAlign ? "is-text-align" : "",
  ].filter(Boolean).join(" ");
  return (
    <div
      id={anchor}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}

export default function HomepageBlocks({
  blocks,
  locale,
  banners,
  siteSlug,
  heroFallbacks,
}: {
  blocks: HomepageBlock[];
  locale: Locale;
  banners?: Banner[];
  siteSlug?: string;
  /** Copy the hero falls back to when a banner has none of its own. */
  heroFallbacks?: { eyebrow: string; title: string; subtitle: string };
}) {
  const extra = { banners, siteSlug, heroFallbacks };
  /* The pairing rules live in modules/blockPairs. This renderer kept a third
     copy of the loop because it wraps blocks differently on purpose — it takes
     the full-bleed half of the width control but not .property-block-contained,
     which would restyle the whole front page. The wrapper is a parameter now,
     so the copy is gone and a change to 並排 cannot reach two of the three
     renderers and miss this one. */
  const output = renderWithPairs<HomepageBlock>({
    blocks,
    render: (block, cfg) => renderBlock(block, cfg, locale, extra),
    wrap: (block, cfg, el) => (
      <BlockWrapper key={block.id} id={block.id} type={block.type} cfg={cfg}>{el}</BlockWrapper>
    ),
  });

  return <>{output}</>;
}
