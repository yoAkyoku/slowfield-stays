"use client";



import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronUp,
  Columns,
  Copy,
  GripVertical,
  Heading,
  Image,
  LayoutGrid,
  Eye,
  EyeOff,
  Minus,
  MousePointer,
  Play,
  Plus,
  Quote,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { platformForUrl } from "../../../modules/media";
import { sanitizeInlineHtml, plainText } from "../../../modules/safeHtml";
import RichTextEditor from "../../modules/RichTextEditor";
import type { CmsContentBlock } from "../../modules/adminApi";
import ImageUploadInput from "../homepage/ImageUploadInput";
import { PartnersConfigForm, radioGroupKeys } from "../../modules/blockForms";
import PreviewOverlay, { previewDeviceClass } from "../../modules/PreviewOverlay";
import UndoRedoButtons from "../../modules/UndoRedoButtons";
import { getVal, setVal } from "../../modules/localizedValue";
import { useOverlay } from "../../../modules/useOverlay";
import { extractText, resolveText } from "../../modules/blockText";
import { useUndoableList } from "../../modules/useUndoableList";
import { useUnsavedGuard } from "../../modules/useUnsavedGuard";
import { useConfirm } from "../../ui";
import ContentBlocks from "../../../modules/content/ContentBlocks";
import { activateOnKey, bi } from "../../modules/blockEditorUtils";

/* ────────────────────────────────────────────
   Types
   ──────────────────────────────────────────── */

type BlockEditorCopy = {
  title: string;
  text: string;
  addBlock: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  blockType: string;
  fields: Record<string, string>;
  types: Record<string, string>;
  videoNote: string;
};

type TextAlign = "left" | "center" | "right";

/* ────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────── */

const BLOCK_META: Record<
  string,
  { icon: typeof AlignLeft; color: string }
> = {
  heading: { icon: Heading, color: "var(--accent)" },
  paragraph: { icon: AlignLeft, color: "var(--line)" },
  image: { icon: Image, color: "#3b82f6" },
  image_grid: { icon: LayoutGrid, color: "#0ea5e9" },
  columns: { icon: Columns, color: "#8b5cf6" },
  video_embed: { icon: Play, color: "#ef4444" },
  quote: { icon: Quote, color: "var(--forest)" },
  cta: { icon: MousePointer, color: "#a855f7" },
  spacer: { icon: Minus, color: "transparent" },
  // Content pages (seeded + parent/child journals) use "rich_text" body blocks
  // from the homepage vocabulary; support it here so editing those pages works.
  rich_text: { icon: AlignLeft, color: "var(--accent)" },
  partners: { icon: LayoutGrid, color: "#0f766e" }
};

// Fallback for any block type not in BLOCK_META, so an unknown type can never
// crash the editor (previously threw "Cannot read properties of undefined").
const FALLBACK_META = { icon: AlignLeft, color: "var(--line)" };

const PRIMARY_TYPES: CmsContentBlock["type"][] = [
  "heading", "paragraph", "image", "image_grid", "columns", "video_embed", "cta",
  // Not a CMS-native type, but an article about a service is exactly where a
  // partner list belongs, so it is offered here rather than only reachable by
  // having been placed in the JSON by hand.
  "partners" as CmsContentBlock["type"],
];

// Allowed types inside a column (no nested columns)
const COLUMN_TYPES: CmsContentBlock["type"][] = [
  "paragraph", "heading", "image", "video_embed", "cta"
];

/* ────────────────────────────────────────────
   Utilities
   ──────────────────────────────────────────── */

function blockId() {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Everything in this admin is zh/en; the block controls were the one corner
 *  still emitting raw enum values ("left", "Desktop") as their only label. */
/* ── Bilingual helpers ── */

/* Article blocks keep their text at the top level rather than under `config`,
 * which is the only reason these two exist as separate functions at all — they
 * are thin adapters over the shared helpers, not a second implementation.
 *
 * They used to be a second implementation, and it had drifted: this copy still
 * seeded a legacy plain string into *both* locale slots, so the first edit of
 * any pre-bilingual field stamped its Chinese into the English slot, where
 * nothing afterwards can tell it apart from a real translation. The homepage
 * editor was fixed and this one was not. */
function getLocalVal(block: CmsContentBlock, key: string, locale: string): string {
  return getVal(block as unknown as Record<string, unknown>, key, locale);
}

function setLocalVal(block: CmsContentBlock, key: string, locale: string, value: string): Partial<CmsContentBlock> {
  const merged = setVal(block as unknown as Record<string, unknown>, key, locale, value);
  return { [key]: merged[key] } as Partial<CmsContentBlock>;
}

/** Ready-made layouts offered above the individual block buttons. */
type TemplateKey = "image_text" | "image_left" | "image_right" | "gallery_text" | "video_text";

const TEMPLATES: { key: TemplateKey; zh: string; en: string }[] = [
  { key: "image_text", zh: "上圖下文", en: "Image over text" },
  { key: "image_left", zh: "左圖右文", en: "Image left" },
  { key: "image_right", zh: "左文右圖", en: "Image right" },
  { key: "gallery_text", zh: "多圖＋文字", en: "Gallery + text" },
  { key: "video_text", zh: "影片＋文字", en: "Video + text" },
];

function buildTemplate(key: TemplateKey): CmsContentBlock[] {
  const image = () => emptyBlock("image");
  const text = () => emptyBlock("paragraph");
  switch (key) {
    case "image_text":
      return [image(), text()];
    case "image_left":
      return [{ id: blockId(), type: "columns", items: [{ blocks: [image()], flex: 5 }, { blocks: [text()], flex: 5 }] }];
    case "image_right":
      return [{ id: blockId(), type: "columns", items: [{ blocks: [text()], flex: 5 }, { blocks: [image()], flex: 5 }] }];
    case "gallery_text":
      return [emptyBlock("image_grid"), text()];
    case "video_text":
      return [emptyBlock("video_embed"), text()];
  }
}

/** Blocks saved in the property/homepage format can sit in an article body —
 *  the public renderer handles them — but this editor has no form for them, and
 *  an unnamed block with no editor is one an editor deletes to find out what it
 *  was. Naming them is the least this can do until they get a form of their own. */
const FOREIGN_BLOCK_LABELS: Record<string, [string, string]> = {
  rich_text: ["圖文段落", "Rich text"],
  partners: ["合作品牌", "Partner brands"],
  oembed: ["社群嵌入", "Social embed"],
};

function blockTypeLabel(type: string, copy: BlockEditorCopy, editLocale: string): string {
  const known = copy.types[type];
  if (known) return known;
  const foreign = FOREIGN_BLOCK_LABELS[type];
  if (foreign) return editLocale === "zh" ? foreign[0] : foreign[1];
  return type;
}

function emptyBlock(type: CmsContentBlock["type"]): CmsContentBlock {
  const id = blockId();
  switch (type) {
    case "heading": return { id, type, level: "h2", text: "", align: "left" };
    case "paragraph": return { id, type, text: "", align: "left", fontSize: 16 };
    case "image": return { id, type, url: "" };
    case "image_grid": return { id, type, images: [], columns: 2, gap: "normal" };
    case "columns": return { id, type, items: [{ blocks: [], flex: 5 }, { blocks: [], flex: 5 }] };
    case "video_embed": return { id, type, platform: "auto", url: "", title: "", caption: "", cover: "" };
    case "quote": return { id, type, text: "", source: "" };
    case "cta": return { id, type, label: "", href: "", style: "primary" };
    case "spacer": return { id, type, size: "medium" };
    default:
      // Property-format block: config-shaped, not field-shaped like the rest,
      // so it is not in the CmsContentBlock union and lands here.
      if ((type as string) === "partners") {
        return { id, type, config: { layout: "cards", items: [] } } as unknown as CmsContentBlock;
      }
      return { id, type: "paragraph", text: "" };
  }
}

/** Migrate old left/right/ratio columns to new items format */
function migrateColumns(block: CmsContentBlock): CmsContentBlock {
  if (block.type !== "columns") return block;
  if (block.items?.length) return block;
  const left = block.left ?? [];
  const right = block.right ?? [];
  const ratio: string = block.ratio ?? "50-50";
  const parts = ratio.split("-").map(Number);
  return {
    ...block,
    items: [
      { blocks: left, flex: (parts[0] ?? 50) / 10 },
      { blocks: right, flex: (parts[1] ?? 50) / 10 }
    ]
  };
}

/** Give a block and everything nested inside it an id. Mirrors stripIds, which
    removes them recursively before saving — so blocks read back from a saved
    page have none, and the lists that render them would fall back to index keys. */
function withIds(block: CmsContentBlock): CmsContentBlock {
  const next = migrateColumns({ ...block, id: block.id || blockId() });
  if (next.type === "columns" && next.items) {
    return {
      ...next,
      items: next.items.map((col) => ({ ...col, blocks: col.blocks.map(withIds) }))
    } as CmsContentBlock;
  }
  return next;
}

function normalizeBlocks(
  blocks: CmsContentBlock[] | undefined,
  body: string | undefined
): CmsContentBlock[] {
  if (blocks?.length) return blocks.map(withIds);
  return (body ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ id: blockId(), type: "paragraph" as const, text }));
}

function stripIds(block: CmsContentBlock): CmsContentBlock {
  const { id, ...rest } = block;
  if (rest.type === "columns" && rest.items) {
    return {
      ...rest,
      items: rest.items.map((col) => ({ ...col, blocks: col.blocks.map(stripIds) }))
    } as CmsContentBlock;
  }
  return rest as CmsContentBlock;
}

/** Deep copy of a block with fresh ids throughout.
 *
 *  Ids must not be shared: the list keys on them, so a duplicate carrying the
 *  original's id makes React treat the two rows as one and the copy's open
 *  editor writes into the original. Nested column children get new ids too.
 *  structuredClone rather than a spread: config-shaped blocks (partners,
 *  rich_text) nest arrays and objects a shallow copy would leave shared, so
 *  editing the duplicate's third brand would edit the original's as well. */
function cloneBlock(block: CmsContentBlock): CmsContentBlock {
  const copy = structuredClone(block) as CmsContentBlock;
  copy.id = blockId();
  if (copy.type === "columns" && copy.items) {
    return {
      ...copy,
      items: copy.items.map((col) => ({ ...col, blocks: col.blocks.map(cloneBlock) }))
    } as CmsContentBlock;
  }
  return copy;
}

/** Whether deleting this block would lose work the author cannot retype from
 *  the row alone. Used to decide if a delete is worth interrupting: confirming
 *  every delete trains people to dismiss the dialog, so a blank block just
 *  added by a misclick goes without one. */
function blockHasContent(block: CmsContentBlock): boolean {
  const b = block as Record<string, unknown>;
  const filled = (v: unknown) => plainText(resolveText(v)).length > 0;
  if (filled(b.text) || filled(b.label) || filled(b.source) || filled(b.title) || filled(b.caption)) return true;
  if (typeof b.url === "string" && b.url.trim()) return true;
  if (typeof b.href === "string" && b.href.trim()) return true;
  if (Array.isArray(b.images) && b.images.length > 0) return true;
  if (block.type === "columns" && block.items) {
    return block.items.some((col) => col.blocks.some(blockHasContent));
  }
  // Config-shaped blocks (partners, rich_text) keep their fields one level down.
  const cfg = b.config as Record<string, unknown> | undefined;
  if (cfg) {
    if (filled(cfg.heading) || filled(cfg.body)) return true;
    if (Array.isArray(cfg.items) && cfg.items.length > 0) return true;
  }
  return false;
}

/** Name the block being deleted rather than asking "are you sure?" about
 *  nothing: the actions row only appears on hover, so the block under the
 *  cursor is not necessarily the one the author thinks they are on. */
function confirmDeleteText(block: CmsContentBlock, copy: BlockEditorCopy, editLocale: string): string {
  const label = blockTypeLabel(block.type, copy, editLocale);
  return editLocale === "zh"
    ? `刪除「${label}」區塊？裡面的內容會一併移除，且無法復原。`
    : `Delete this "${label}" block? Its content goes with it and cannot be restored.`;
}

/** Same guard as the block delete, worded for a column. The "−" button drops the
 *  LAST column and every block in it, and was the one destructive control in
 *  this editor with no dialog at all. Empty column goes without a prompt, on the
 *  same reasoning as blockHasContent: a dialog on every press gets dismissed. */
function confirmDeleteColumnText(columnNumber: number, editLocale: string): string {
  return editLocale === "zh"
    ? `移除第 ${columnNumber} 欄？欄位裡的區塊會一併刪除，且無法復原。`
    : `Remove column ${columnNumber}? The blocks inside it go with it and cannot be restored.`;
}

/** Honour the OS "reduce motion" setting for the scroll that follows an insert:
 *  the scroll exists to say where the new block went, and for a reader who gets
 *  motion sick from it a jump says the same thing. */
function scrollBehaviour(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

/** Enter/Space on a role="button" element, which the browser only does for real
 *  buttons. The row cannot BE a button: its preview renders headings and
 *  paragraphs, which are invalid inside one and lose their styling there. */
/** Accessible name for the row that opens a block's settings. Without it the
 *  row announces its whole preview text with no hint that it is a control. */
function openBlockLabel(block: CmsContentBlock, copy: BlockEditorCopy, editLocale: string): string {
  const label = blockTypeLabel(block.type, copy, editLocale);
  return editLocale === "zh" ? `編輯「${label}」區塊` : `Edit ${label} block`;
}

function stripHtmlForPreview(html: string): string {
  return plainText(html) || "…";
}

/* ────────────────────────────────────────────
   AlignmentPicker
   ──────────────────────────────────────────── */

function AlignmentPicker({
  value,
  onChange,
  label,
  editLocale
}: {
  value: TextAlign;
  onChange: (a: TextAlign) => void;
  label?: string;
  editLocale: string;
}) {
  const opts: { val: TextAlign; Icon: typeof AlignLeft; zh: string; en: string }[] = [
    { val: "left", Icon: AlignLeft, zh: "靠左對齊", en: "Align left" },
    { val: "center", Icon: AlignCenter, zh: "置中對齊", en: "Align centre" },
    { val: "right", Icon: AlignRight, zh: "靠右對齊", en: "Align right" }
  ];
  return (
    <div className="pbe-align-picker">
      {label && <span>{label}</span>}
      {/* radiogroup, not three loose buttons: the choice is one-of-three, and
          aria-checked is what tells a screen reader which one is in effect.
          Previously the only label was the raw value ("left") via title. */}
      <div className="pbe-align-buttons" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={label || bi(editLocale, "對齊", "Alignment")}>
        {opts.map(({ val, Icon, zh, en }) => {
          const name = bi(editLocale, zh, en);
          return (
            <button
              key={val}
              type="button"
              role="radio"
              aria-checked={value === val}
              className={`pbe-align-btn${value === val ? " pbe-align-btn--active" : ""}`}
              onClick={() => onChange(val)}
              title={name}
              aria-label={name}
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   Preview Components
   ──────────────────────────────────────────── */

function HeadingPreview({ block, locale }: { block: CmsContentBlock; locale?: string }) {
  if (block.type !== "heading") return null;
  const Tag = (block.level === "h3" ? "h3" : "h2") as "h2";
  return (
    <div className="pbe-heading-preview">
      <Tag dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(resolveText(block.text, locale) || "…") }} />
    </div>
  );
}

function ParagraphPreview({ block, locale }: { block: CmsContentBlock; locale?: string }) {
  if (block.type !== "paragraph") return null;
  return <p className="pbe-paragraph-preview">{stripHtmlForPreview(resolveText(block.text, locale))}</p>;
}

function ImagePreview({ block, locale }: { block: CmsContentBlock; locale?: string }) {
  if (block.type !== "image") return null;
  const alt = resolveText(block.alt, locale);
  const caption = resolveText(block.caption, locale);
  return (
    <div className="pbe-image-preview">
      {block.url ? <img src={block.url} alt={alt} /> : <div className="pbe-image-empty" />}
      <span>{alt || caption || "…"}</span>
      {block.size && block.size !== "full" && <span className="pbe-size-badge">{block.size}</span>}
    </div>
  );
}

function ImageGridPreview({ block, locale }: { block: CmsContentBlock; locale?: string }) {
  if (block.type !== "image_grid") return null;
  const count = block.images?.length ?? 0;
  return (
    <div className="pbe-grid-preview">
      {block.images?.slice(0, 4).map((img, i) => (
        img.url ? (
          <img key={i} src={img.url} alt={resolveText(img.alt, locale)} className="pbe-grid-preview-thumb" />
        ) : (
          <div key={i} className="pbe-image-empty pbe-grid-preview-thumb" />
        )
      ))}
      <span className="pbe-grid-count">{count} {count === 1 ? "image" : "images"} &middot; {block.columns ?? 2} cols</span>
    </div>
  );
}

function VideoPreview({ block, locale }: { block: CmsContentBlock; locale?: string }) {
  if (block.type !== "video_embed") return null;
  /* The same platform test as the preview and the page. This badge used to run
     its own, and was the only place in the app that named Vimeo — a platform
     the renderer has never embedded. */
  const platform = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", unknown: "Video" }[platformForUrl(block.url)];
  return (
    <div className="pbe-video-preview">
      {block.cover ? (
        <img src={block.cover} alt="" className="pbe-video-cover-thumb" />
      ) : (
        <span className="pbe-video-badge">{platform}</span>
      )}
      <span className="pbe-video-url">{resolveText(block.title, locale) || block.url || "…"}</span>
    </div>
  );
}

function QuotePreview({ block, locale }: { block: CmsContentBlock; locale?: string }) {
  if (block.type !== "quote") return null;
  return (
    <blockquote className="pbe-quote-preview">
      <p>{stripHtmlForPreview(resolveText(block.text, locale))}</p>
      {block.source && <cite>&mdash; {resolveText(block.source, locale)}</cite>}
    </blockquote>
  );
}

function CtaPreview({ block, locale }: { block: CmsContentBlock; locale?: string }) {
  if (block.type !== "cta") return null;
  const s = block.style ?? "primary";
  return (
    <div className="pbe-cta-preview">
      <span className={`pbe-cta-button pbe-cta-${s}`}>{resolveText(block.label, locale) || "Button"}</span>
      <small>{block.href || "…"}</small>
    </div>
  );
}

function ColumnsPreview({ block, copy }: { block: CmsContentBlock; copy: BlockEditorCopy }) {
  if (block.type !== "columns" || !block.items) return null;
  const totalBlocks = block.items.reduce((sum, col) => sum + col.blocks.length, 0);
  const ratioStr = block.items.map((c) => c.flex).join(" : ");
  return (
    <div className="pbe-columns-preview">
      <span>{block.items.length} {copy.fields.gridColumns || "cols"}</span>
      <span className="pbe-columns-ratio-badge">{ratioStr}</span>
      <span className="pbe-columns-total">{totalBlocks} blocks</span>
    </div>
  );
}

function SpacerPreview() {
  return <div className="pbe-spacer-preview" />;
}

function BlockPreview({ block, copy, locale }: { block: CmsContentBlock; copy: BlockEditorCopy; locale?: string }) {
  switch (block.type as string) {
    case "rich_text": {
      const cfg = ((block as any).config ?? {}) as Record<string, unknown>;
      const txt = resolveText(cfg.heading, locale) || resolveText(cfg.body, locale);
      return <span className="pbe-block-preview-text">{txt || "Rich text"}</span>;
    }
    case "partners": {
      // The row should say what is in the block; "合作品牌" alone does not tell
      // you whether it holds three brands or none.
      const cfg = ((block as any).config ?? {}) as Record<string, unknown>;
      const items = Array.isArray(cfg.items) ? (cfg.items as Record<string, unknown>[]) : [];
      const names = items.map((it) => resolveText(it.name, locale)).filter(Boolean);
      const zh = locale === "zh";
      return (
        <span className="pbe-block-preview-text">
          {names.length ? `${names.length} ${zh ? "家" : "brands"} · ${names.slice(0, 3).join("、")}` : (zh ? "尚未加入品牌" : "No brands yet")}
        </span>
      );
    }
    case "heading": return <HeadingPreview block={block} locale={locale} />;
    case "paragraph": return <ParagraphPreview block={block} locale={locale} />;
    case "image": return <ImagePreview block={block} locale={locale} />;
    case "image_grid": return <ImageGridPreview block={block} locale={locale} />;
    case "video_embed": return <VideoPreview block={block} locale={locale} />;
    case "quote": return <QuotePreview block={block} locale={locale} />;
    case "cta": return <CtaPreview block={block} locale={locale} />;
    case "columns": return <ColumnsPreview block={block} copy={copy} />;
    case "spacer": return <SpacerPreview />;
    default: return null;
  }
}

/* ────────────────────────────────────────────
   Edit Forms
   ──────────────────────────────────────────── */

function BlockEditForm({
  block,
  copy,
  editLocale,
  onChange
}: {
  block: CmsContentBlock;
  copy: BlockEditorCopy;
  editLocale: string;
  onChange: (patch: Partial<CmsContentBlock>) => void;
}) {
  /* ── Rich text (content pages / journals use this homepage-vocabulary block) ── */
  if ((block.type as string) === "rich_text") {
    // rich_text fields live under block.config.{heading,body}, each an
    // {en,zh} object (or legacy plain string). Read/write at that path.
    const cfg = ((block as any).config ?? {}) as Record<string, unknown>;
    const getCfg = (key: string): string => {
      const v = cfg[key];
      if (v != null && typeof v === "object" && !Array.isArray(v)) {
        return String((v as Record<string, string>)[editLocale] ?? "");
      }
      return String(v ?? "");
    };
    const setCfg = (key: string, value: string) => {
      const prev = cfg[key];
      let obj: Record<string, string>;
      if (prev != null && typeof prev === "object" && !Array.isArray(prev)) {
        obj = { ...(prev as Record<string, string>) };
      } else {
        const fallback = String(prev ?? "");
        obj = { en: fallback, zh: fallback };
      }
      obj[editLocale] = value;
      onChange({ config: { ...cfg, [key]: obj } } as any);
    };
    return (
      <div className="pbe-block-form">
        <div className="pbe-field">
          <span>{copy.types.heading}</span>
          <RichTextEditor
            variant="inline"
            value={getCfg("heading")}
            onChange={(t) => setCfg("heading", t)}
            singleLine
            placeholder={copy.types.heading}
            localeKey={editLocale}
          />
        </div>
        <div className="pbe-field">
          <span>{copy.fields.text}</span>
          <RichTextEditor
            variant="inline"
            value={getCfg("body")}
            onChange={(t) => setCfg("body", t)}
            placeholder={copy.fields.text}
            localeKey={editLocale}
          />
        </div>
      </div>
    );
  }

  /* ── Partner brands (合作品牌) ──
     Same config shape and the same form the homepage editor uses, imported
     rather than reimplemented: two forms for one block is how the two drift
     apart, and this one already knows the field list. */
  if ((block.type as string) === "partners") {
    const cfg = ((block as any).config ?? {}) as Record<string, unknown>;
    return (
      <PartnersConfigForm
        c={cfg}
        zh={editLocale === "zh"}
        editLocale={editLocale}
        onChange={(next) => onChange({ config: next } as Partial<CmsContentBlock>)}
      />
    );
  }

  /* ── Heading ── */
  if (block.type === "heading") {
    return (
      <div className="pbe-block-form">
        <div className="pbe-form-row">
          <label className="pbe-form-narrow">
            <span>{copy.fields.level}</span>
            <select value={block.level ?? "h2"} onChange={(e) => onChange({ level: e.target.value as "h2" | "h3" })}>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
            </select>
          </label>
          <AlignmentPicker value={(block.align as TextAlign) ?? "left"} onChange={(a) => onChange({ align: a })} label={copy.fields.align} editLocale={editLocale} />
        </div>
        <div className="pbe-field">
          <span>{copy.fields.text}</span>
          <RichTextEditor
            variant="inline"
            value={getLocalVal(block, "text", editLocale)}
            onChange={(t) => onChange(setLocalVal(block, "text", editLocale, t))}
            singleLine
            autoFocus
            placeholder={copy.types.heading}
            localeKey={editLocale}
          />
        </div>
      </div>
    );
  }

  /* ── Paragraph ── */
  if (block.type === "paragraph") {
    return (
      <div className="pbe-block-form">
        <div className="pbe-form-row">
          <AlignmentPicker value={(block.align as TextAlign) ?? "left"} onChange={(a) => onChange({ align: a })} label={copy.fields.align} editLocale={editLocale} />
          <label className="pbe-form-narrow">
            <span>{copy.fields.fontSize}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number"
                min={10}
                max={72}
                value={typeof block.fontSize === "number" ? block.fontSize : 16}
                onChange={(e) => onChange({ fontSize: parseInt(e.target.value) || 16 })}
                style={{ width: 64 }}
              />
              <span style={{ fontSize: 11, color: "var(--muted)" }}>px</span>
            </div>
          </label>
        </div>
        <div className="pbe-field">
          <span>{copy.fields.text}</span>
          <RichTextEditor
            variant="inline"
            value={getLocalVal(block, "text", editLocale)}
            onChange={(t) => onChange(setLocalVal(block, "text", editLocale, t))}
            minRows={4}
            autoFocus
            placeholder={copy.types.paragraph}
            localeKey={editLocale}
          />
        </div>
      </div>
    );
  }

  /* ── Image ──
     The picker used to be the whole form, so every photo in every article
     shipped with no alt text at all, while ImagePreview, the live preview and
     the public renderer were all already reading alt / caption / size. Fields
     mirror the image_grid row; alt and caption are bilingual because the public
     renderer resolves them per locale, and a plain string would show the
     Chinese caption on the English page. */
  if (block.type === "image") {
    const sizeLabel = copy.fields.imageSize || copy.fields.size;
    return (
      <div className="pbe-block-form">
        <ImageUploadInput value={block.url ?? ""} onChange={(url) => onChange({ url })} uploadLabel="上傳" />
        <div className="pbe-form-row">
          <label className="pbe-form-grow">
            <span>{copy.fields.alt}</span>
            <input
              value={getLocalVal(block, "alt", editLocale)}
              onChange={(e) => onChange(setLocalVal(block, "alt", editLocale, e.target.value))}
            />
          </label>
          <label className="pbe-form-grow">
            <span>{copy.fields.caption}</span>
            <input
              value={getLocalVal(block, "caption", editLocale)}
              onChange={(e) => onChange(setLocalVal(block, "caption", editLocale, e.target.value))}
            />
          </label>
        </div>
        <label className="pbe-form-narrow">
          <span>{sizeLabel}</span>
          {/* Blank option rather than defaulting to "full": an image saved by
              the old form has no size key, and writing one on open would change
              every existing block the moment its editor was opened. */}
          <select
            value={block.size ?? ""}
            onChange={(e) =>
              onChange({ size: (e.target.value || undefined) as "full" | "wide" | "medium" | "small" | undefined })
            }
          >
            <option value="">{bi(editLocale, "預設", "Default")}</option>
            <option value="full">{bi(editLocale, "滿版", "Full")}</option>
            <option value="wide">{bi(editLocale, "寬版", "Wide")}</option>
            <option value="medium">{bi(editLocale, "中等", "Medium")}</option>
            <option value="small">{bi(editLocale, "小", "Small")}</option>
          </select>
        </label>
      </div>
    );
  }

  /* ── Image Grid ── */
  if (block.type === "image_grid") {
    return <ImageGridForm block={block} copy={copy} editLocale={editLocale} onChange={onChange} />;
  }

  /* ── Columns ── */
  if (block.type === "columns") {
    return <ColumnsForm block={block} copy={copy} editLocale={editLocale} onChange={onChange} />;
  }

  /* ── Video Embed ── */
  if (block.type === "video_embed") {
    return (
      <div className="pbe-block-form">
        <label>
          <span>{copy.fields.url}</span>
          <input value={block.url ?? ""} onChange={(e) => onChange({ url: e.target.value, platform: "auto" })} autoFocus placeholder="https://..." />
          <small>{copy.videoNote}</small>
        </label>
        <div className="pbe-form-row">
          <label className="pbe-form-grow">
            <span>{copy.fields.title}</span>
            <input value={getLocalVal(block, "title", editLocale)} onChange={(e) => onChange(setLocalVal(block, "title", editLocale, e.target.value))} />
          </label>
          <label className="pbe-form-grow">
            <span>{copy.fields.caption}</span>
            <input value={getLocalVal(block, "caption", editLocale)} onChange={(e) => onChange(setLocalVal(block, "caption", editLocale, e.target.value))} />
          </label>
        </div>
        {/* A cover image is not decoration: it replaces the player with a
            thumbnail that opens the video platform in a new tab. Nothing on
            this form said so, and it is the one setting that turns 頁面內觀看
            back into 跳轉 YouTube. */}
        <div className="pbe-field">
          <span>{copy.fields.cover || "Cover image"}</span>
          <ImageUploadInput value={block.cover ?? ""} onChange={(url) => onChange({ cover: url })} uploadLabel="上傳" />
          <small>
            {block.cover
              ? "已設封面圖：頁面上會顯示這張圖，點擊後開新分頁前往影片平台，不會在頁面內播放。留空才會直接內嵌播放器。"
              : "留空，YouTube 影片會直接嵌在頁面內播放。填了封面圖則改為顯示縮圖，點擊後開新分頁前往影片平台。"}
          </small>
        </div>
      </div>
    );
  }

  /* ── Quote (backward compat — no longer in add-block) ── */
  if (block.type === "quote") {
    return (
      <div className="pbe-block-form">
        <div className="pbe-field">
          <span>{copy.fields.text}</span>
          <RichTextEditor
            variant="inline"
            value={getLocalVal(block, "text", editLocale)}
            onChange={(t) => onChange(setLocalVal(block, "text", editLocale, t))}
            minRows={3}
            autoFocus
            placeholder={copy.types.quote}
            localeKey={editLocale}
          />
        </div>
        <label>
          <span>{copy.fields.source}</span>
          <input value={getLocalVal(block, "source", editLocale)} onChange={(e) => onChange(setLocalVal(block, "source", editLocale, e.target.value))} />
        </label>
      </div>
    );
  }

  /* ── CTA ── */
  if (block.type === "cta") {
    return (
      <div className="pbe-block-form">
        <div className="pbe-form-row">
          <label className="pbe-form-grow">
            <span>{copy.fields.label}</span>
            <input value={getLocalVal(block, "label", editLocale)} onChange={(e) => onChange(setLocalVal(block, "label", editLocale, e.target.value))} autoFocus />
          </label>
          <label className="pbe-form-narrow">
            <span>{copy.fields.style}</span>
            <select value={block.style ?? "primary"} onChange={(e) => onChange({ style: e.target.value as "primary" | "outline" | "ghost" })}>
              <option value="primary">Primary</option>
              <option value="outline">Outline</option>
              <option value="ghost">Ghost</option>
            </select>
          </label>
        </div>
        <label>
          <span>{copy.fields.href}</span>
          <input value={block.href ?? ""} onChange={(e) => onChange({ href: e.target.value })} placeholder="https://..." />
        </label>
      </div>
    );
  }

  /* ── Spacer (backward compat) ── */
  if (block.type === "spacer") {
    return (
      <div className="pbe-block-form">
        <label>
          <span>{copy.fields.size}</span>
          <select value={block.size ?? "medium"} onChange={(e) => onChange({ size: e.target.value as "small" | "medium" | "large" })}>
            <option value="small">S</option>
            <option value="medium">M</option>
            <option value="large">L</option>
          </select>
        </label>
      </div>
    );
  }

  return null;
}

/* ────────────────────────────────────────────
   ImageGridForm
   ──────────────────────────────────────────── */

function ImageGridForm({
  block,
  copy,
  editLocale,
  onChange
}: {
  block: Extract<CmsContentBlock, { type: "image_grid" }>;
  copy: BlockEditorCopy;
  editLocale: string;
  onChange: (patch: Partial<CmsContentBlock>) => void;
}) {
  const images = block.images ?? [];

  // `unknown` for alt / caption: they hold an {en,zh} object now, and the row
  // type still declares them as string for the blocks written before that.
  const updateImage = (idx: number, patch: Record<string, unknown>) => {
    const next = images.map((img, i) => (i === idx ? { ...img, ...patch } : img));
    onChange({ images: next } as Partial<CmsContentBlock>);
  };

  /** Alt and caption were written as plain strings while the public renderer
   *  read them through pickT, so typing an English caption replaced the Chinese
   *  one. Same {en,zh} treatment as every other text field here; a legacy plain
   *  string is migrated on first edit by setLocalVal. */
  const getRowVal = (img: unknown, key: string) => getLocalVal(img as CmsContentBlock, key, editLocale);
  const setRowVal = (idx: number, img: unknown, key: string, value: string) =>
    updateImage(idx, setLocalVal(img as CmsContentBlock, key, editLocale, value) as Record<string, unknown>);

  const removeImage = (idx: number) => {
    onChange({ images: images.filter((_, i) => i !== idx) });
  };

  const addImage = () => {
    onChange({ images: [...images, { url: "", alt: "", caption: "" }] } as Partial<CmsContentBlock>);
  };

  return (
    <div className="pbe-block-form">
      <div className="pbe-form-row">
        <label className="pbe-form-narrow">
          <span>{copy.fields.gridColumns || "Columns"}</span>
          <select
            value={block.columns ?? 2}
            onChange={(e) => onChange({ columns: Number(e.target.value) as 2 | 3 | 4 })}
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label className="pbe-form-narrow">
          <span>{copy.fields.gap || "Gap"}</span>
          <select
            value={block.gap ?? "normal"}
            onChange={(e) => onChange({ gap: e.target.value as "tight" | "normal" | "wide" })}
          >
            <option value="tight">Tight</option>
            <option value="normal">Normal</option>
            <option value="wide">Wide</option>
          </select>
        </label>
      </div>

      <div className="pbe-grid-editor">
        {images.map((img, i) => (
          <div key={i} className="pbe-grid-row">
            <div className="pbe-grid-row-head">
              <span className="pbe-grid-row-num">{i + 1}</span>
              {img.url && <img src={img.url} alt={resolveText(img.alt, editLocale)} className="pbe-grid-row-thumb" />}
              <button type="button" className="pbe-action-delete" onClick={() => removeImage(i)} title={copy.remove}>
                <Trash2 size={12} />
              </button>
            </div>
            <ImageUploadInput value={img.url} onChange={(url) => updateImage(i, { url })} placeholder="URL" uploadLabel="上傳" />
            <div className="pbe-form-row">
              <input placeholder={copy.fields.alt} aria-label={copy.fields.alt} value={getRowVal(img, "alt")} onChange={(e) => setRowVal(i, img, "alt", e.target.value)} />
              <input placeholder={copy.fields.caption} aria-label={copy.fields.caption} value={getRowVal(img, "caption")} onChange={(e) => setRowVal(i, img, "caption", e.target.value)} />
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="pbe-add-btn" onClick={addImage}>
        <Plus size={14} />
        <span>{copy.fields.addImage || "Add image"}</span>
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────
   Multi-column Form (with MiniBlockList)
   ──────────────────────────────────────────── */

function MiniBlockList({
  blocks,
  onChange,
  copy,
  editLocale,
  label
}: {
  blocks: CmsContentBlock[];
  onChange: (blocks: CmsContentBlock[]) => void;
  copy: BlockEditorCopy;
  editLocale: string;
  label: string;
}) {
  const { ask } = useConfirm();
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const update = (idx: number, patch: Partial<CmsContentBlock>) => {
    onChange(blocks.map((b, i) => (i === idx ? { ...b, ...patch } as CmsContentBlock : b)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= blocks.length) return;
    const arr = [...blocks];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onChange(arr);
    setEditIdx((cur) => (cur === idx ? next : cur === next ? idx : cur));
  };

  const remove = async (idx: number) => {
    if (blockHasContent(blocks[idx]) && !(await ask({ tone: "danger", title: confirmDeleteText(blocks[idx], copy, editLocale) }))) return;
    onChange(blocks.filter((_, i) => i !== idx));
    setEditIdx(null);
  };

  const duplicate = (idx: number) => {
    const next = [...blocks];
    next.splice(idx + 1, 0, cloneBlock(blocks[idx]));
    onChange(next);
    setEditIdx(idx + 1);
  };

  const add = (type: CmsContentBlock["type"]) => {
    const b = emptyBlock(type);
    onChange([...blocks, b]);
    setEditIdx(blocks.length);
  };

  return (
    <div className="pbe-columns-side">
      <div className="pbe-columns-side-header">{label}</div>
      <div className="pbe-columns-mini-list">
        {blocks.map((block, i) => {
          const meta = BLOCK_META[block.type] ?? FALLBACK_META;
          const Icon = meta.icon;
          const isEditing = editIdx === i;
          return (
            <div
              key={block.id ?? i}
              className={`pbe-block pbe-block--mini${isEditing ? " pbe-block--editing" : ""}`}
              style={{ borderLeftColor: meta.color }}
            >
              <div className="pbe-block-top">
                <div
                  className="pbe-block-open"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isEditing}
                  aria-label={openBlockLabel(block, copy, editLocale)}
                  onClick={() => setEditIdx(isEditing ? null : i)}
                  onKeyDown={(e) => activateOnKey(e, () => setEditIdx(isEditing ? null : i))}
                >
                  <div className="pbe-block-icon"><Icon size={12} /></div>
                  <div className="pbe-block-content">
                    <div className="pbe-block-type-label">{blockTypeLabel(block.type, copy, editLocale)}</div>
                    <BlockPreview block={block} copy={copy} locale={editLocale} />
                  </div>
                </div>
                <div className="pbe-block-actions">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title={copy.moveUp} aria-label={copy.moveUp}><ChevronUp size={12} /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} title={copy.moveDown} aria-label={copy.moveDown}><ChevronDown size={12} /></button>
                  <button type="button" onClick={() => duplicate(i)} title={bi(editLocale, "複製", "Duplicate")} aria-label={bi(editLocale, "複製", "Duplicate")}><Copy size={12} /></button>
                  <button type="button" onClick={() => remove(i)} className="pbe-action-delete" title={copy.remove} aria-label={copy.remove}><Trash2 size={12} /></button>
                </div>
              </div>
              {isEditing && (
                <BlockEditForm block={block} copy={copy} editLocale={editLocale} onChange={(patch) => update(i, patch)} />
              )}
            </div>
          );
        })}
      </div>
      <div className="pbe-columns-add">
        {COLUMN_TYPES.map((type) => {
          const meta = BLOCK_META[type];
          const Icon = meta.icon;
          return (
            <button key={type} type="button" className="pbe-add-btn pbe-add-btn--sm" onClick={() => add(type)}>
              <Icon size={12} />
              <span>{blockTypeLabel(type, copy, editLocale)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColumnsForm({
  block,
  copy,
  editLocale,
  onChange
}: {
  block: Extract<CmsContentBlock, { type: "columns" }>;
  copy: BlockEditorCopy;
  editLocale: string;
  onChange: (patch: Partial<CmsContentBlock>) => void;
}) {
  const { ask } = useConfirm();
  const items = block.items ?? [{ blocks: [], flex: 5 }, { blocks: [], flex: 5 }];
  const colCount = items.length;

  const updateFlex = (idx: number, flex: number) => {
    const clamped = Math.max(1, Math.min(12, flex || 1));
    const next = items.map((col, i) => (i === idx ? { ...col, flex: clamped } : col));
    onChange({ items: next });
  };

  const updateColumnBlocks = (idx: number, blocks: CmsContentBlock[]) => {
    const next = items.map((col, i) => (i === idx ? { ...col, blocks } : col));
    onChange({ items: next });
  };

  const addColumn = () => {
    if (colCount >= 6) return;
    onChange({ items: [...items, { blocks: [], flex: 5 }] });
  };

  const removeColumn = async () => {
    if (colCount <= 2) return;
    // Guarded like the block-level delete: this drops the last column AND every
    // block in it, and there is no undo.
    const last = items[colCount - 1];
    if (last.blocks.some(blockHasContent) && !(await ask({ tone: "danger", title: confirmDeleteColumnText(colCount, editLocale) }))) return;
    onChange({ items: items.slice(0, -1) });
  };

  const addColumnLabel = copy.fields.addColumn || bi(editLocale, "新增欄位", "Add column");
  const removeColumnLabel = copy.fields.removeColumn || bi(editLocale, "移除欄位", "Remove column");

  return (
    <div className="pbe-block-form">
      <div className="pbe-columns-controls">
        <div className="pbe-columns-col-count">
          {/* The glyphs are the whole label otherwise: a screen reader announced
              these two as "minus" and "plus" with no object. */}
          <button type="button" onClick={removeColumn} disabled={colCount <= 2} className="pbe-col-count-btn" title={removeColumnLabel} aria-label={removeColumnLabel}>&minus;</button>
          <span>{colCount} {copy.fields.gridColumns || "cols"}</span>
          <button type="button" onClick={addColumn} disabled={colCount >= 6} className="pbe-col-count-btn" title={addColumnLabel} aria-label={addColumnLabel}>+</button>
        </div>
        <div className="pbe-columns-flex-inputs">
          <span className="pbe-flex-label">{copy.fields.ratio || "Ratio"}</span>
          {items.map((col, i) => (
            <span key={i} className="pbe-flex-input-group">
              {i > 0 && <span className="pbe-flex-sep">:</span>}
              <input
                type="number"
                min={1}
                max={12}
                value={col.flex}
                onChange={(e) => updateFlex(i, parseInt(e.target.value) || 1)}
                className="pbe-flex-input"
              />
            </span>
          ))}
        </div>
      </div>
      <div
        className="pbe-columns-editor"
        // Keep the wide-screen ratio in a variable so CSS can stack columns
        // on small screens without relying on JavaScript resize events.
        style={{ "--pbe-column-tracks": items.map((c) => `${c.flex}fr`).join(" ") } as React.CSSProperties}
      >
        {items.map((col, i) => (
          <MiniBlockList
            key={i}
            blocks={col.blocks}
            onChange={(blocks) => updateColumnBlocks(i, blocks)}
            copy={copy}
            editLocale={editLocale}
            label={`${copy.fields.column || "Column"} ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   Live Preview Modal
   ──────────────────────────────────────────── */

/* The block as the published page draws it: the same ContentBlocks the public
   renderer uses (see that file). oembed is the one thing it cannot show here —
   it is fetched by a server component — so it previews as nothing, as before. */
function LivePreviewBlock({ block, locale }: { block: CmsContentBlock; locale?: string }) {
  return <ContentBlocks blocks={[block]} locale={locale === "en" ? "en" : "zh"} />;
}

/* ────────────────────────────────────────────
   Main Editor
   ──────────────────────────────────────────── */

export default function PageBlockEditor({
  body,
  blocks,
  copy,
  editLocale = "zh",
  canonicalLocale = "zh",
  previewUrl,
  showPreview = false,
  canWrite = true,
  onClosePreview
}: {
  body?: string;
  blocks?: CmsContentBlock[];
  copy: BlockEditorCopy;
  editLocale?: string;
  /** The site's own language, which the derived `body` column is written in.
   *  Distinct from `editLocale`, which is only the tab currently open. */
  canonicalLocale?: string;
  /** Public front-end URL of the saved page — the preview iframes the REAL page
      (full site chrome, fonts, blocks) instead of a stripped admin view. */
  previewUrl?: string;
  /** Preview modal open state — controlled by the parent (button sits under 儲存內容頁). */
  showPreview?: boolean;
  canWrite?: boolean;
  onClosePreview?: () => void;
}) {
  const { ask } = useConfirm();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // Closing the open form on every undo / redo: the form is addressed by index,
  // and a step that changes the list length (an undone delete, a redone
  // duplicate) would leave it open on a different block, writing the next
  // keystroke into the wrong one.
  const history = useUndoableList<CmsContentBlock[]>(() => normalizeBlocks(blocks, body), {
    onTravel: () => setEditingIndex(null),
  });
  // Named so the existing call sites keep reading as ordinary state; the second
  // argument is the coalescing tag (see historyStack), and everything that omits
  // it is a structural change worth exactly one undo step.
  const items = history.value;
  const setItems = history.set;
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  // Which version the overlay shows. Draft by default: the reason to open a
  // preview is nearly always the change just made, and the saved route showed
  // the last publish with nothing saying so.
  const [previewSource, setPreviewSource] = useState<"draft" | "saved">("draft");
  const listRef = useRef<HTMLDivElement | null>(null);
  const addRowRef = useRef<HTMLDivElement | null>(null);
  // Index of a row just inserted that still needs scrolling to. A ref, not
  // state: the scroll is a one-shot side effect of the insert, and holding it in
  // state would re-run it on the next unrelated render.
  const revealIdxRef = useRef<number | null>(null);

  useEffect(() => {
    const idx = revealIdxRef.current;
    if (idx === null) return;
    revealIdxRef.current = null;
    const row = listRef.current?.children[idx];
    if (row instanceof HTMLElement) {
      row.scrollIntoView({ behavior: scrollBehaviour(), block: "center" });
    }
  }, [items]);

  // Escape closed nothing: the preview covers the whole screen and its only
  // exits were the backdrop and an unlabelled X, so a keyboard user was stuck.
  const previewPanelRef = useRef<HTMLDivElement>(null);
  useOverlay(showPreview, () => onClosePreview?.(), { trapFocus: previewPanelRef });

  // ── Drag-and-drop state ──
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number, e: React.DragEvent) => {
    setDragIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    // currentTarget is the grip, not the row: fade the row it belongs to, which
    // is what the drag actually moves.
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.closest<HTMLElement>(".pbe-block")?.style.setProperty("opacity", "0.4");
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.closest<HTMLElement>(".pbe-block")?.style.removeProperty("opacity");
    }
    setDragIdx(null);
    setDropIdx(null);
  }, []);

  const handleDragOver = useCallback((index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIdx(index);
  }, []);

  const handleDrop = useCallback((targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const sourceIndex = dragIdx;
    if (sourceIndex === null || sourceIndex === targetIndex) {
      setDragIdx(null);
      setDropIdx(null);
      return;
    }
    setItems((current) => {
      const arr = [...current];
      const [moved] = arr.splice(sourceIndex, 1);
      // Land ON the highlighted row, which is what pbe-block--drop-target
      // promises. The old `targetIndex - 1` for downward drags came from a
      // drop-between-gaps model and left the block one slot short of the
      // highlight; dragging down by exactly one cancelled itself out and
      // looked like drag-and-drop was broken.
      arr.splice(targetIndex, 0, moved);
      return arr;
    });
    // Keep the open editor on the block that moved rather than on whatever
    // slid into its old slot.
    if (editingIndex !== null) {
      if (editingIndex === sourceIndex) {
        setEditingIndex(targetIndex);
      } else if (sourceIndex < editingIndex && targetIndex >= editingIndex) {
        setEditingIndex(editingIndex - 1);
      } else if (sourceIndex > editingIndex && targetIndex <= editingIndex) {
        setEditingIndex(editingIndex + 1);
      }
    }
    setDragIdx(null);
    setDropIdx(null);
  }, [dragIdx, editingIndex, setItems]);

  const serialized = useMemo(
    () => JSON.stringify(items.map(stripIds)),
    [items]
  );

  /* The unsaved-work guard.
     Compared against the blocks as the SERVER last sent them, not against a
     copy taken on the first render: a save that lands hands the same blocks
     back and the warning goes quiet by itself, while a rejected save re-renders
     with the old saved blocks and the warning correctly stays. Ids are stripped
     on both sides because `normalizeBlocks` mints a fresh one for every block
     that has none — and saved blocks have none, `stripIds` takes them off on
     the way out — so comparing with ids in would call every page dirty
     immediately and permanently. This is the same string the form submits. */
  const savedSerialized = useMemo(
    () => JSON.stringify(normalizeBlocks(blocks, body).map(stripIds)),
    [blocks, body]
  );
  useUnsavedGuard(serialized !== savedSerialized);

  /* The canonical `body` column, mirrored from the blocks for search and for
     the SEO description fallback. Built in the site's own language — it is the
     untranslated column, so deriving it from whichever tab happened to be open
     would file an English page's text as the Chinese original. */
  const bodyText = useMemo(
    () => extractText(items, canonicalLocale).join("\n\n"),
    [items, canonicalLocale]
  );

  /** Tagged per block, so a run of keystrokes in one field collapses into a
   *  single undo step while moving to another block starts a new one. Untagged
   *  would put an undo boundary between every character typed. */
  const update = useCallback((index: number, patch: Partial<CmsContentBlock>) => {
    setItems(
      (current) => current.map((block, i) => (i === index ? ({ ...block, ...patch } as CmsContentBlock) : block)),
      `edit:${index}`,
    );
  }, [setItems]);

  const move = useCallback((index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= items.length) return;
    setItems((current) => {
      const cp = [...current];
      [cp[index], cp[next]] = [cp[next], cp[index]];
      return cp;
    });
    // Follow the block that moved, so the open editor stays on it rather than
    // becoming the editor for whatever swapped into that slot.
    setEditingIndex((cur) => (cur === index ? next : cur === next ? index : cur));
  }, [items.length, setItems]);

  /** Delete, guarded when there is something to lose. There is no undo and no
   *  version history (out of scope), so the dialog is the only thing between a
   *  mis-aimed click and a retyped paragraph. */
  const remove = useCallback(async (index: number) => {
    const block = items[index];
    if (block && blockHasContent(block) && !(await ask({ tone: "danger", title: confirmDeleteText(block, copy, editLocale) }))) return;
    setItems((current) => current.filter((_, i) => i !== index));
    setEditingIndex(null);
    // Focus used to fall to <body>, dropping a keyboard user at the top of the
    // page after every delete. Hand it to the row that took the deleted one's
    // place, or the one above when the last block goes.
    requestAnimationFrame(() => {
      const rows = listRef.current?.querySelectorAll<HTMLElement>(".pbe-block-open");
      if (!rows?.length) {
        addRowRef.current?.querySelector<HTMLElement>("button")?.focus();
        return;
      }
      (rows[Math.min(index, rows.length - 1)])?.focus();
    });
  }, [items, copy, editLocale, setItems, ask]);

  /** Duplicate: the everyday move this editor had no answer for. Rebuilding an
   *  image-plus-caption or a three-column row by hand each time is where the
   *  "why is this not like WordPress" came from. */
  const duplicate = useCallback((index: number) => {
    setItems((current) => {
      const arr = [...current];
      arr.splice(index + 1, 0, cloneBlock(arr[index]));
      return arr;
    });
    setEditingIndex(index + 1);
  }, [setItems]);

  /** Hide a block without deleting it — for copy that is finished but not yet
   *  meant to be public, where the alternative was to delete it and retype it
   *  later. `enabled: false` is what the other two block systems already use. */
  const toggleEnabled = useCallback((index: number) => {
    setItems((current) =>
      current.map((block, i) => (i === index ? { ...block, enabled: block.enabled === false } : block))
    );
  }, [setItems]);

  /** Insert next to the block being worked on, open it, and scroll to it.
   *
   *  Appending to the end meant that with a block selected mid-article the new
   *  one landed below the fold with nothing moving on screen, so it read as
   *  "I clicked and nothing happened" and was then walked up one 上移 at a time.
   *  With nothing selected the end is still where it belongs. */
  const insertAt = useCallback((newBlocks: CmsContentBlock[]) => {
    const at = editingIndex === null ? items.length : editingIndex + 1;
    setItems((current) => {
      const arr = [...current];
      arr.splice(at, 0, ...newBlocks);
      return arr;
    });
    setEditingIndex(at);
    revealIdxRef.current = at;
  }, [editingIndex, items.length, setItems]);

  const addBlock = useCallback((type: CmsContentBlock["type"]) => {
    insertAt([emptyBlock(type)]);
  }, [insertAt]);

  /** Append a named layout. Every one of these was already buildable by hand —
   *  a two-column block with an image on one side and a paragraph on the other
   *  is just three clicks — but the person writing a news post should not have
   *  to rediscover the recipe each time. The blocks are ordinary ones once
   *  inserted, so a template can be edited or taken apart afterwards.
   *
   *  Placed and opened like a single block: a template that appended silently
   *  and opened nothing was the worst version of the "nothing happened" problem,
   *  because it added several blocks at once. */
  const addTemplate = useCallback((key: TemplateKey) => {
    insertAt(buildTemplate(key));
  }, [insertAt]);

  // Prevent Enter key inside block editor inputs from submitting the parent form
  const preventFormSubmit = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
      e.preventDefault();
    }
  }, []);

  return (
    <div className="pbe-editor" onKeyDown={preventFormSubmit}>
      <input name="body_blocks" type="hidden" value={serialized} />
      <input name="body" type="hidden" value={bodyText} />
      {!canWrite && <div className="content-detail-body">{items.filter(block => block.enabled !== false).map((block,i) => <LivePreviewBlock key={block.id ?? i} block={block} locale={editLocale} />)}</div>}
      <div hidden={!canWrite} inert={!canWrite}>
      <div className="pbe-header">
        <div className="pbe-header__text">
          <p className="a-eyebrow">{copy.title}</p>
          <p>{copy.text}</p>
        </div>
        <UndoRedoButtons
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={history.undo}
          onRedo={history.redo}
          editLocale={editLocale}
          size={14}
        />
      </div>

      {/* Block list */}
      <div className="pbe-list" ref={listRef}>
        {items.map((block, index) => {
          const meta = BLOCK_META[block.type] ?? FALLBACK_META;
          const Icon = meta.icon;
          const isEditing = editingIndex === index;
          const isDragOver = dropIdx === index && dragIdx !== index;

          return (
            <div
              key={block.id ?? index}
              className={`pbe-block${isEditing ? " pbe-block--editing" : ""}${isDragOver ? " pbe-block--drop-target" : ""}`}
              style={{ borderLeftColor: meta.color }}
              onDragOver={(e) => handleDragOver(index, e)}
              onDrop={(e) => handleDrop(index, e)}
            >
              <div className="pbe-block-top">
                {/* draggable lives on the grip, never on the row: with it on the
                    row, selecting text with the mouse inside the open paragraph
                    editor started a row drag and dropping reordered the article.
                    Same split HomepageBlockEditor already uses. */}
                <div
                  className="pbe-drag-handle"
                  draggable
                  onDragStart={(e) => handleDragStart(index, e)}
                  onDragEnd={handleDragEnd}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={bi(editLocale, "拖曳可調整順序（也可用上移／下移）", "Drag to reorder (or use move up / down)")}
                  aria-hidden="true"
                >
                  <GripVertical size={14} />
                </div>
                <div
                  className="pbe-block-open"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isEditing}
                  aria-label={openBlockLabel(block, copy, editLocale)}
                  onClick={() => setEditingIndex(isEditing ? null : index)}
                  onKeyDown={(e) => activateOnKey(e, () => setEditingIndex(isEditing ? null : index))}
                >
                  <div className="pbe-block-icon">
                    <Icon size={16} />
                  </div>
                  <div className="pbe-block-content">
                    <div className="pbe-block-type-label">{blockTypeLabel(block.type, copy, editLocale)}</div>
                    <BlockPreview block={block} copy={copy} locale={editLocale} />
                  </div>
                </div>
                <div className="pbe-block-actions">
                  <button
                    type="button"
                    onClick={() => toggleEnabled(index)}
                    aria-pressed={block.enabled === false}
                    aria-label={block.enabled === false
                      ? (editLocale === "zh" ? "顯示此區塊" : "Show block")
                      : (editLocale === "zh" ? "隱藏此區塊" : "Hide block")}
                    title={block.enabled === false
                      ? (editLocale === "zh" ? "顯示此區塊" : "Show block")
                      : (editLocale === "zh" ? "隱藏此區塊" : "Hide block")}
                  >
                    {block.enabled === false ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} title={copy.moveUp} aria-label={copy.moveUp}>
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} title={copy.moveDown} aria-label={copy.moveDown}>
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicate(index)}
                    title={bi(editLocale, "複製此區塊", "Duplicate block")}
                    aria-label={bi(editLocale, "複製此區塊", "Duplicate block")}
                  >
                    <Copy size={14} />
                  </button>
                  <button type="button" onClick={() => remove(index)} className="pbe-action-delete" title={copy.remove} aria-label={copy.remove}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {isEditing && (
                <BlockEditForm
                  block={block}
                  copy={copy}
                  editLocale={editLocale}
                  onChange={(patch) => update(index, patch)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state. It used to be a dashed box reading "新增區塊" that looked
          like the button to press and was not one: clicking it did nothing.
          Now it says where to start and the one control in it works. */}
      {items.length === 0 && (
        <div className="pbe-empty">
          <strong>{bi(editLocale, "還沒有任何內容", "Nothing here yet")}</strong>
          <span>
            {bi(
              editLocale,
              "從下方選一個「版型」開始，或直接加入單一區塊。",
              "Start from a layout below, or add a single block."
            )}
          </span>
          <button type="button" className="pbe-empty-cta" onClick={() => addBlock("paragraph")}>
            <Plus size={14} />
            <span>{bi(editLocale, "新增段落", "Add a paragraph")}</span>
          </button>
        </div>
      )}

      {/* Templates first: for most posts one of these is the whole layout, and
          reaching for single blocks is the exception rather than the start. */}
      <div className="pbe-template-row">
        <span className="pbe-template-label">{editLocale === "zh" ? "版型" : "Layouts"}</span>
        {TEMPLATES.map((tpl) => (
          <button key={tpl.key} type="button" className="pbe-template-btn" onClick={() => addTemplate(tpl.key)}>
            {editLocale === "zh" ? tpl.zh : tpl.en}
          </button>
        ))}
      </div>

      {/* Add block row */}
      <div className="pbe-add-row" ref={addRowRef}>
        {PRIMARY_TYPES.map((type) => {
          const meta = BLOCK_META[type];
          const Icon = meta.icon;
          return (
            <button key={type} type="button" className="pbe-add-btn" onClick={() => addBlock(type)}>
              <Icon size={16} />
              <span>{blockTypeLabel(type, copy, editLocale)}</span>
            </button>
          );
        })}
      </div>

      </div>
      {/* Live Preview Modal — opened from the button under "儲存內容頁" (see PageFormEditor).
          Same full-screen overlay + device toggles as the homepage editor. When the page
          is saved we iframe the real rendered page (real site fonts / chrome); for a
          brand-new unsaved page we fall back to the in-editor block render. */}
      {showPreview && (
        <PreviewOverlay
          zh={editLocale === "zh"}
          title={editLocale === "zh" ? "文章即時預覽" : "Article Live Preview"}
          onClose={() => onClosePreview?.()}
          device={previewDevice}
          onDevice={setPreviewDevice}
          source={previewUrl ? previewSource : undefined}
          onSource={setPreviewSource}
          panelRef={previewPanelRef}
        >
              {/* The saved route (/admin/preview/content/{id}) reads the page
                  back from the database, so it can only ever show the last save.
                  The draft view renders the blocks the editor is holding — the
                  same components this file already uses for the unsaved-page
                  case — which is why it is the default, and why the banner says
                  what it trades away. A whole article does not fit in a URL or a
                  cookie (a measured page of blocks runs to tens of KB), so there
                  is no third option that is both current and server-rendered. */}
              {previewUrl && previewSource === "saved" ? (
                <iframe
                  src={previewUrl}
                  title={editLocale === "zh" ? "已儲存的文章" : "Saved article"}
                  data-preview-source="saved"
                  className={`hpb-overlay__frame${previewDeviceClass(previewDevice)}`}
                />
              ) : (
                <div
                  className="pbe-live-preview content-detail-body"
                  data-preview-source="draft"
                  style={{ width: previewDevice === "mobile" ? 390 : previewDevice === "tablet" ? 768 : "100%", maxWidth: "100%", minWidth: 0, margin: "0 auto", background: "#fff", overflowY: "auto" }}
                >
                  <p className="hpb-draft__banner">
                    {editLocale === "zh"
                      ? "顯示編輯中的內容（含未儲存的變更）。字體與頁面外框以編輯器樣式呈現，非前台字體。"
                      : "Showing your current edits, unsaved changes included. Drawn with the editor's own styling, not the site fonts."}
                  </p>
                  {/* Hidden blocks are dropped, as extractText and the public
                      renderer already do: a preview that shows what will not be
                      published is worse than no preview. */}
                  {items.filter((block) => block.enabled !== false).map((block, i) => (
                    <LivePreviewBlock key={`preview-${block.id ?? i}`} block={block} locale={editLocale} />
                  ))}
                  {previewUrl ? null : (
                    <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: "16px" }}>
                      {editLocale === "zh" ? "儲存後即可用真實前台樣式預覽（字體、區塊）。" : "Save to preview with the real front-end styling (fonts, blocks)."}
                    </p>
                  )}
                </div>
              )}
        </PreviewOverlay>
      )}
    </div>
  );
}
