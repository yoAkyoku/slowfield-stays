import type { Locale } from "../../i18n";
import { cfgT, eyebrowT } from "../../tr";
import { galleryImages } from "../../galleryImages";
import LightboxGallery from "../LightboxGallery";
import SectionHeading from "../../SectionHeading";

export default function BlockImageGallery({ locale, config }: { locale: Locale; config: Record<string, unknown> }) {
  const images = galleryImages(config.images, locale);
  const columns = Number(config.columns ?? 2);
  const layout = String(config.layout ?? "grid");
  const isCollage = layout === "collage";
  const isCentered = layout === "centered";
  const isCarousel = layout === "carousel";
  // 拼貼 — spread apart on desktop/tablet, overlapping on phones. "overlap" is
  // the legacy value for what is now the same single collage layout, so blocks
  // saved before the redesign pick up the new composition without re-saving.
  const isScatter = layout === "scatter" || layout === "overlap";
  // Centered width preset (how small): narrow / medium / wide.
  const WIDTHS: Record<string, number> = { narrow: 560, medium: 760, wide: 960 };
  const centeredMaxWidth = WIDTHS[String(config.galleryWidth ?? "medium")] ?? 760;
  const eyebrow = eyebrowT(config, locale);
  const title = cfgT(config, "title", locale);
  const caption = cfgT(config, "caption", locale);
  // 卡片比例 — "" keeps each photo's own proportions (the previous behaviour);
  // anything else crops every card to the same shape so a row of mixed
  // portrait/landscape uploads lines up.
  const RATIOS: Record<string, string> = {
    "4:3": "4 / 3", "1:1": "1 / 1", "3:4": "3 / 4", "16:9": "16 / 9", "3:2": "3 / 2",
  };
  const ratio = RATIOS[String(config.cardRatio ?? "")] ?? "";
  /* Paired beside another block, the picture is centred against its neighbour
     by default and only stretches to match when the editor asks for it. */
  const fillHeight = config.fill_height === true;
  const cols = Math.min(Math.max(Math.round(columns) || 2, 1), 4);

  if (!images.length) return null;

  return (
    <section
      className={`property-image-gallery section${ratio ? " has-card-ratio" : ""}${fillHeight ? " is-fill-height" : ""}`}
      style={ratio ? ({ "--gallery-card-ratio": ratio } as React.CSSProperties) : undefined}
    >
      {(eyebrow || title) && (
        <div className="section-header">
          <div>
            <SectionHeading eyebrow={eyebrow} title={title} />
          </div>
        </div>
      )}
      <LightboxGallery
        title={title}
        collage={isScatter}
        carousel={isCarousel}
        columns={cols}
        images={images}
        gridClassName={`property-image-gallery-grid${isCollage ? " property-image-gallery-grid--collage" : ""}${isCentered ? " property-image-gallery-grid--centered" : ""}`}
        gridStyle={{
          // Clamped both ends: 1 is a valid choice (one image per row) but 0 or
          // a non-numeric value would emit `repeat(0, 1fr)` and collapse the grid.
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          /* The same count as a variable. The phone rule used to force two
             columns with !important — the only way to beat an inline template —
             so 欄數 = 1 came out as two on a phone, and asking for a single
             column there was impossible. With the count in a variable the phone
             rule caps it (min(n, 2)) instead of replacing it. */
          ["--gallery-cols" as string]: String(cols),
          ...(isCentered ? { maxWidth: centeredMaxWidth } : {}),
        }}
      />
      {caption && <p className="property-image-gallery-caption">{caption}</p>}
    </section>
  );
}
