"use client";

/**
 * The "content" half of a block's inspector, and the row thumbnail.
 *
 * Both block editors switched over the same block types and handed the same
 * props to the same forms; the two switches were the same 28 cases in a
 * different order. One table now, so a new block type is editable from the
 * brand homepage and from villa pages as soon as it is listed here.
 */
import type { ComponentType } from "react";
import type { AdminContentTag, AdminSite } from "./adminApi";
import type { PreviewRenderer } from "../../modules/previewRenderer";
import BlockLivePreview from "./BlockLivePreview";
import type { EditorBlock } from "./blockEditorUtils";
import {
  AboutConfigForm,
  AlternatingConfigForm,
  AttractionsConfigForm,
  ContactFormConfigForm,
  ContactInfoConfigForm,
  EditorialConfigForm,
  FaqConfigForm,
  FeatureBadgesConfigForm,
  FeatureHeroConfigForm,
  FeatureListConfigForm,
  FlowConfigForm,
  GalleryConfigForm,
  HeroBannerConfigForm,
  HouseRulesConfigForm,
  MapConfigForm,
  NewsletterConfigForm,
  OembedConfigForm,
  PartnersConfigForm,
  PathwaysConfigForm,
  RichTextConfigForm,
  RoomsConfigForm,
  SearchBarConfigForm,
  StaysConfigForm,
  TableConfigForm,
  VideoTextConfigForm,
  type ContentSource,
} from "./blockForms";

type FormProps = { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void };
type Ctx = { site: AdminSite; contentSources: ContentSource[]; contentTags: AdminContentTag[] };
type Entry = { Form: ComponentType<FormProps & Record<string, unknown>>; extra?: (ctx: Ctx) => Record<string, unknown> };

/** A table entry, checked: the extras must be exactly the props the form wants
 *  beyond the four every form takes. */
function form<P extends FormProps>(Form: ComponentType<P>, extra?: (ctx: Ctx) => Omit<P, keyof FormProps>): Entry {
  return { Form: Form as unknown as Entry["Form"], extra: extra as Entry["extra"] };
}

/** Block type → its form, and what extra context the form needs. */
const FORMS: Record<string, Entry> = {
  hero_banner: form(HeroBannerConfigForm),
  search: form(SearchBarConfigForm),
  image_gallery: form(GalleryConfigForm),
  // BlockGallery reads only images, eyebrow, title and display; the layout
  // options would be settings it ignores.
  gallery: form(GalleryConfigForm, () => ({ showLayoutOptions: false })),
  rooms: form(RoomsConfigForm, ({ site }) => ({ site })),
  rich_text: form(RichTextConfigForm),
  feature_list: form(FeatureListConfigForm),
  flow: form(FlowConfigForm),
  stays: form(StaysConfigForm, ({ site, contentSources, contentTags }) => ({ contentSources, contentTags, siteSlug: site.slug })),
  pathways: form(PathwaysConfigForm),
  editorial: form(EditorialConfigForm),
  video_text: form(VideoTextConfigForm),
  feature_hero: form(FeatureHeroConfigForm),
  alternating: form(AlternatingConfigForm),
  about: form(AboutConfigForm),
  newsletter: form(NewsletterConfigForm),
  faq_accordion: form(FaqConfigForm),
  table: form(TableConfigForm),
  contact_info: form(ContactInfoConfigForm),
  map: form(MapConfigForm, ({ site }) => ({ site })),
  attractions: form(AttractionsConfigForm),
  partners: form(PartnersConfigForm),
  contact_form: form(ContactFormConfigForm, ({ site }) => ({ site })),
  feature_badges: form(FeatureBadgesConfigForm, ({ site }) => ({ site })),
  house_rules: form(HouseRulesConfigForm),
  oembed: form(OembedConfigForm),
};

export function BlockConfigForm({
  block,
  zh,
  editLocale,
  onChange,
  site,
  contentSources,
  contentTags,
}: {
  block: EditorBlock;
  zh: boolean;
  editLocale: string;
  onChange: (c: Record<string, unknown>) => void;
  site: AdminSite;
  contentSources: ContentSource[];
  contentTags: AdminContentTag[];
}) {
  const entry = FORMS[block.type];
  if (!entry) {
    return <p className="a-field__hint">{zh ? "此區塊類型無可編輯欄位" : "No configurable fields for this block type"}</p>;
  }
  const props: FormProps = { c: block.config, zh, editLocale, onChange };
  const { Form } = entry;
  return <Form {...props} {...(entry.extra?.({ site, contentSources, contentTags }) ?? {})} />;
}

/** A row's thumbnail: nothing but the live frame of the real block, drawn by
 *  whichever renderer will draw the page (villa pages and the brand homepage
 *  use different ones). */
export function BlockThumb({ block, siteSlug, renderer }: { block: EditorBlock; siteSlug?: string; renderer: PreviewRenderer }) {
  return (
    <div className="hpb-thumb">
      <BlockLivePreview type={block.type} config={block.config} siteSlug={siteSlug} renderer={renderer} />
    </div>
  );
}
