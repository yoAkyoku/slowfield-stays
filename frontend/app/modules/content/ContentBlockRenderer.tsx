import type { CmsContentBlock } from "../api";
import type { Locale } from "../i18n";
import BlockOembed from "../property/blocks/BlockOembed";
import ContentBlocks, { type OembedRenderer } from "./ContentBlocks";

/* oembed blocks fetch the provider's embed while rendering (an async server
   component), so they are drawn here, on the server, and nowhere else. */
const renderOembed: OembedRenderer = (config, key, locale) => <BlockOembed key={key} locale={locale} config={config} />;

/** An article body on the published page: the shared blocks, with oembed. */
export default function ContentBlockRenderer({ blocks, locale = "zh" }: { blocks: CmsContentBlock[]; locale?: Locale }) {
  return <ContentBlocks blocks={blocks} locale={locale} oembed={renderOembed} />;
}
