import type { Locale } from "../../i18n";
import { t } from "../../i18n";
import { cfgT, eyebrowT } from "../../tr";
import { galleryImages } from "../../galleryImages";
import HomePhotoGallery, { type HomeGalleryImage } from "../HomePhotoGallery";

export type BlockGalleryConfig = {
  /** Legacy entries are bare URLs; the editor writes { url, caption }. */
  images?: Array<string | { url?: string; caption?: unknown }>;
  eyebrow?: string | Record<string, string>;
  title?: string | Record<string, string>;
  /** "wall" = every photo at once in equal tiles; default is the carousel. */
  display?: "carousel" | "wall";
};

export default function BlockGallery({ locale, config }: { locale: Locale; config?: BlockGalleryConfig }) {
  const { home: h } = t(locale);
  const c = (config ?? {}) as Record<string, unknown>;
  /* The 相簿 editor normalises every entry to { url, caption } the moment
     anyone adds, deletes, reorders or captions an image, but this cast
     asserted string[] — so those entries reached <img src> as the literal
     "[object Object]" and the whole gallery rendered broken. Accept both
     shapes, the way BlockImageGallery already does.

     The caption came off with the same rewrite that fixed the URL: it was
     mapped away here and the gallery's props had nowhere to put it, so 圖片說明
     was a field the editor could fill for every photo and no reader ever saw.
     It is a bilingual field like every other visitor-facing string — the form
     writes { zh, en } per editing locale — so it resolves through pickT rather
     than being read as a plain string. */
  const images: HomeGalleryImage[] = galleryImages(c.images, locale);

  return (
    <HomePhotoGallery
      images={images}
      eyebrow={eyebrowT(c, locale, h.galleryEyebrow)}
      title={cfgT(c, "title", locale, h.galleryTitle)}
      display={c.display === "wall" ? "wall" : "carousel"}
      zh={locale === "zh"}
    />
  );
}
