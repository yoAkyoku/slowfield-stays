"use client";

/**
 * Block config forms shared by the homepage editor and the site page editor.
 *
 * These three (hero banner, rooms, newsletter) lived only in the homepage
 * editor, yet PropertyPageRenderer renders all three on property pages — so a
 * page could show a rooms block nobody could edit from page management. They
 * move here so both editors offer the same block types from the same source.
 */

import Link from "next/link";
import { useState, useEffect, useMemo, useRef, useId } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
import type { AdminSite } from "./adminApi";
import { siteContentTypesFromConfig } from "./siteContentTypes";
import { PUBLIC_API_URL as API_URL } from "../../modules/apiBase";

/** The read-only shape of the site's managed bilingual tag catalogue. */
export type ManagedTagOption = {
  slug: string;
  name_zh: string;
  name_en: string;
  status?: string;
};

/**
 * Resolve entry tags to the managed label for the current editor language and
 * append managed tags that have not appeared on a fetched entry yet. The
 * latter matters for a new/empty category: an editor can configure a filter
 * before its first article is published, instead of seeing an empty picker.
 */
export function mergeManagedTagOptions(
  entryTags: string[] | null | undefined,
  managedTags: ManagedTagOption[] = [],
  locale: string,
): string[] {
  const aliasToLabel = new Map<string, string>();
  for (const tag of managedTags) {
    const label = (locale === "en" ? tag.name_en : tag.name_zh) || tag.name_zh || tag.name_en || tag.slug;
    if (!label.trim()) continue;
    for (const alias of [tag.slug, tag.name_zh, tag.name_en]) {
      const key = String(alias ?? "").trim().toLocaleLowerCase();
      if (key) aliasToLabel.set(key, label.trim());
    }
  }
  const seen = new Set<string>();
  const output: string[] = [];
  const add = (raw: string) => {
    const value = raw.trim();
    const key = value.toLocaleLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(value);
  };
  for (const raw of entryTags ?? []) {
    const value = String(raw ?? "").trim();
    add(aliasToLabel.get(value.toLocaleLowerCase()) ?? value);
  }
  for (const tag of managedTags) {
    const label = (locale === "en" ? tag.name_en : tag.name_zh) || tag.name_zh || tag.name_en || tag.slug;
    add(String(label ?? ""));
  }
  return output;
}

/**
 * Read the value shown in the editor without filling an empty field.
 *
 * The public renderer applies the default label at display time. The editor
 * must keep an empty string visible and writable, otherwise clearing the
 * controlled input immediately replaces it with the default and the author
 * can never save an intentional blank.
 */
export function resolveHeroScrollLabel(raw: unknown, locale: string): string {
  const value = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)[locale]
    : raw;
  const text = typeof value === "string" ? value.trim() : "";
  // Numeric leftovers came from an old field-shape collision with the slide
  // count. They are data corruption, not meaningful copy, so show an empty
  // editable value and let the public renderer supply its locale default.
  if (/^\d+$/.test(text)) return "";
  return text;
}

/**
 * Arrow keys for a radiogroup of buttons.
 *
 * The groups already carry the radiogroup and radio roles with `aria-checked` —
 * the half that makes a screen reader announce them correctly. This adds the
 * arrows, which is what a reader in forms mode reaches for and what the role
 * implies.
 *
 * Deliberately WITHOUT a roving tabindex, unlike the role tablist further down
 * this file. Roving would make each group one tab stop, which is the fuller ARIA
 * pattern — but it also makes an option unreachable whenever the roving state is
 * wrong, and several of these groups have no checked option at all (「預設」 is
 * the empty string, so `aria-checked` is false on every button). Every option
 * stays tabbable: the arrows are an addition here, not a replacement.
 *
 * Selection follows focus, which is the pattern for a group this small — the
 * click handler each button already has is what commits the value, so there is
 * no second code path to keep in step.
 */
export function radioGroupKeys(e: ReactKeyboardEvent<HTMLDivElement>): void {
  const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
  if (!KEYS.includes(e.key)) return;
  const buttons = Array.from(e.currentTarget.querySelectorAll("button"));
  if (buttons.length < 2) return;
  e.preventDefault();
  const focused = buttons.findIndex((b) => b === document.activeElement);
  const checked = buttons.findIndex((b) => b.getAttribute("aria-checked") === "true");
  const cur = focused !== -1 ? focused : (checked !== -1 ? checked : 0);
  const to = e.key === "Home" ? 0
    : e.key === "End" ? buttons.length - 1
    : (e.key === "ArrowLeft" || e.key === "ArrowUp") ? (cur - 1 + buttons.length) % buttons.length
    : (cur + 1) % buttons.length;
  buttons[to].focus();
  buttons[to].click();
}
import ImageUploadInput from "../(dashboard)/homepage/ImageUploadInput";
import { resolveMapMode } from "../../modules/property/blocks/mapMode";
import { useOverlay } from "../../modules/useOverlay";
import RichTextEditor from "./RichTextEditor";
import { Field, FieldLabel, HeadingInput, getVal, setVal } from "./blockFields";
import { altRowRenders, altReindex, anyLocale } from "./alternatingRows";
import FeatureIcon from "../../modules/property/blocks/FeatureIcon";
import { staysVariantsFor } from "../../modules/blockStyle";
import { FontFacePicker } from "./FontFacePicker";
import FoldSection from "./FoldSection";
import DeletedBadge from "./DeletedBadge";
import { safeCssColor, safeFace, safeLength } from "../../modules/fontPresets";
import { normaliseAboutImages } from "../../modules/home/blocks/aboutImages";
import { contentFilterTags } from "../../modules/contentFilter";

/** Common villa amenities offered as one-click checkboxes so staff don't have to
 *  hand-type every 設施 (client: 設施介紹的選項後台盡量做勾選). Custom badges can
 *  still be added freely below. */
export const COMMON_AMENITIES: { icon: string; zh: string; en: string }[] = [
  { icon: "🏊", zh: "私人泳池", en: "Private pool" },
  { icon: "♨️", zh: "湯池", en: "Hot tub" },
  { icon: "🍳", zh: "早餐", en: "Breakfast" },
  { icon: "👨‍🍳", zh: "私廚", en: "Private dining" },
  { icon: "🧑‍💼", zh: "管家服務", en: "Butler service" },
  { icon: "🎤", zh: "KTV", en: "KTV" },
  { icon: "🔥", zh: "戶外BBQ", en: "Outdoor BBQ" },
  { icon: "🅿️", zh: "免費停車", en: "Free parking" },
  { icon: "📶", zh: "免費WiFi", en: "Free WiFi" },
  { icon: "❄️", zh: "空調", en: "Air conditioning" },
  { icon: "🍽️", zh: "全套廚房", en: "Full kitchen" },
  { icon: "🛁", zh: "獨立衛浴", en: "En-suite bath" },
  { icon: "🏞️", zh: "景觀視野", en: "Scenic view" },
  { icon: "🐾", zh: "寵物友善", en: "Pet friendly" },
  { icon: "📽️", zh: "投影設備", en: "Projector" },
  { icon: "🎲", zh: "桌遊", en: "Board games" },
  { icon: "🧺", zh: "洗衣設備", en: "Laundry" },
  { icon: "🚭", zh: "全區禁菸", en: "Non-smoking" },
];

/** Split a stored "中文 · English" amenity into halves and guess an icon from the
 *  common-amenity table by keyword. Used to import a stay's amenities as badges. */
export function splitAmenity(raw: string): { zh: string; en: string; icon: string } {
  const s = String(raw || "").trim();
  const parts = s.split(/\s*[·|｜]\s*/);
  const zh = (parts[0] || s).trim();
  const en = (parts.length > 1 ? parts.slice(1).join(" ") : s).trim();
  const hay = `${zh} ${en}`.toLowerCase();
  const hit = COMMON_AMENITIES.find(
    (a) => hay.includes(a.en.toLowerCase()) || (zh && (zh.includes(a.zh) || a.zh.includes(zh))),
  );
  return { zh, en, icon: hit?.icon ?? "" };
}

export type ParentRoom = { name: string; capacity: number; description: string };

/**
 * Condense a free-text room description into a one-line 房型格局 summary such as
 * "2 間雙人房＋1 間四人房". Counts occurrences of each bed-type keyword (both the
 * "雙人房×2" and "2 間雙人房" spellings) and re-renders them in a fixed order.
 * Returns null when nothing countable is found, so the caller can fall back.
 */
export function summariseRoomLayout(description: string): { zh: string; en: string } | null {
  if (!description) return null;
  const TYPES: Array<{ zh: string; en: string; re: RegExp }> = [
    { zh: "雙人房", en: "double", re: /雙人房/g },
    { zh: "四人房", en: "quad", re: /四人房/g },
    { zh: "三人房", en: "triple", re: /三人房/g },
    { zh: "六人房", en: "six-bed", re: /六人房/g },
    { zh: "通鋪", en: "tatami", re: /通鋪/g },
  ];
  const counts: Array<{ zh: string; en: string; n: number }> = [];
  for (const t of TYPES) {
    // "雙人房×3" / "雙人房 x3" / "雙人房*3" — an explicit multiplier wins.
    // The bracket clause is optional but common in real listings, e.g.
    // "雙人房(一大床)×1"; without it the multiplier is missed and the count
    // falls through to counting bare mentions, which over-counts any room
    // type that also appears in a descriptive phrase.
    const mult = new RegExp(`${t.zh}\\s*(?:[（(][^）)]*[）)])?\\s*[×xX*]\\s*(\\d+)`, "g");
    // "3 間雙人房" — a leading count.
    const lead = new RegExp(`(\\d+)\\s*間\\s*${t.zh}`, "g");
    // exec loops rather than matchAll: this project's tsconfig target predates
    // the iterator protocol matchAll returns.
    let n = 0;
    for (const re of [mult, lead]) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(description)) !== null) n += Number(m[1]) || 0;
    }
    // Neither spelling → fall back to counting bare mentions.
    if (!n) n = (description.match(t.re) || []).length;
    if (n > 0) counts.push({ zh: t.zh, en: t.en, n });
  }
  if (!counts.length) return null;
  return {
    zh: counts.map((c) => `${c.n} 間${c.zh}`).join("＋"),
    en: counts.map((c) => `${c.n} ${c.en}${c.n > 1 ? "s" : ""}`).join(" + "),
  };
}

/** For a child site, load its linked parent-catalogue stay's room_types
 *  (房型格局: name + capacity). Returns null while loading, then the list. */
export function useParentStayRooms(site: AdminSite): ParentRoom[] | null {
  const [rooms, setRooms] = useState<ParentRoom[] | null>(site.parent_site_id ? null : []);
  useEffect(() => {
    if (!site.parent_site_id) { setRooms([]); return; }
    let alive = true;
    fetch(`${API_URL}/stays`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!alive) return;
        const arr = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
        const stay = arr.find((s) => s.slug === site.slug);
        const rt = Array.isArray(stay?.room_types) ? (stay!.room_types as Record<string, unknown>[]) : [];
        setRooms(rt.map((r) => ({ name: String(r.name ?? ""), capacity: Number(r.capacity) || 0, description: String(r.description ?? "") })));
      })
      .catch(() => { if (alive) setRooms([]); });
    return () => { alive = false; };
  }, [site.parent_site_id, site.slug]);
  return rooms;
}

/* ── Hero banner config (image + bilingual title/subtitle + height + text colours) ── */

export function HeroBannerConfigForm({
  c,
  zh,
  editLocale,
  onChange,
}: {
  c: Record<string, unknown>;
  zh: boolean;
  editLocale: string;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const height = String(c.height ?? "");
  const titleColor = String(c.titleColor ?? "#ffffff");
  const subtitleColor = String(c.subtitleColor ?? "#ffffff");
  // Carousel images live on the block itself (config.images). 2+ images → the
  // hero auto-rotates as a carousel. (CMS Banners still override if you set 2+
  // there, but for a single homepage this list is the simplest path.)
  const imageFields: ItemFields = [
    { key: "url", label: zh ? "圖片" : "Image", type: "image", bilingual: false },
  ];
  const images = normaliseItemRows(c.images, imageFields);
  const setImages = (next: Record<string, unknown>[]) => onChange({ ...c, images: next });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <FieldLabel>{zh ? "輪播圖片（2 張以上自動輪播）" : "Carousel images (2+ auto-rotate)"}</FieldLabel>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{images.length}</span>
      </div>
      <ItemsEditor
        items={images}
        fields={imageFields}
        zh={zh}
        editLocale={editLocale}
        onChange={setImages}
        newItem={() => ({ url: "" })}
        noun={{ zh: "輪播圖片", en: "carousel image" }}
        addLabel={zh ? "+ 新增輪播圖片" : "+ Add carousel image"}
      />
      {/* The condition, not just the promise. With no image in the list above,
          both hero renderers fall back to the CMS banners — HomeHeroCarousel
          takes the active banner's own title (`trs(active, "title") ||
          blockTitle`) and BlockHeroBanner hands the banners straight to the
          carousel without passing the block's copy at all. That fallback is
          right; what was wrong is that this hint said "no CMS Banner needed"
          flatly, so an author filled in 標題 with an empty image list, saw the
          banner's title, and read the field as broken. */}
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 14px", lineHeight: 1.5 }}>
        {zh
          ? "先在上面加一張圖片，下面的標題／副標才會用得到：這一格沒有圖片時，主視覺整個改用 CMS Banner，標題也會是 Banner 的。CMS Banner 是跨頁共用橫幅的另一種方式。"
          : "Add an image above first — the title and subtitle below are only used once this block has one. With the list empty the hero falls back to the CMS Banner, and takes the banner's title with it. CMS Banners are an alternative for shared cross-page banners."}
      </p>
      {/* The label used to promise the opening slide only. Both hero renderers
          deliberately repeat the block's one title over every slide —
          BlockHeroBanner copies it onto each
          synthesised slide so the copy stays readable as the photo rotates, and
          HomeHeroCarousel draws a single .hero-content for the whole carousel,
          so there is no per-slide title for it to be the first of. Measured on
          the preview route with two block images: one <h1>, shown throughout.
          A label that promises less than the control does sends an author
          hunting for the other three title fields. */}
      <Field label={zh ? "標題（每張都會顯示）" : "Title (shown on every slide)"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={(v) => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      <Field label={zh ? "副標" : "Subtitle"}>
        <HeadingInput value={getVal(c, "subtitle", editLocale)} onChange={(v) => onChange(setVal(c, "subtitle", editLocale, v))} />
      </Field>
      <Field label={zh ? "向下探索文字" : "Scroll cue text"}>
        <input
          value={resolveHeroScrollLabel(c.scroll_label, editLocale)}
          onChange={(e) => onChange(setVal(c, "scroll_label", editLocale, e.target.value))}
          placeholder={zh ? "向下探索" : "Scroll to explore"}
        />
        <p className="hpb-field-hint">
          {zh
            ? "支援中文與英文；未設定時使用預設文字，清空後不顯示文字。"
            : "Supports Chinese and English; unset uses the default, clearing hides the text."}
        </p>
      </Field>
      <Field label={zh ? "高度" : "Height"}>
        <select
          value={height}
          onChange={(e) => onChange({ ...c, height: e.target.value })}
          style={{ width: "100%" }}
        >
          {/* The winning min-height when this is unset is 100dvh on .hero and 100vh on
              .hero.hero-carousel — never 55vh. Labelled 55vh, picking 中 (55vh) to
              "keep the default" halved the hero instead. */}
          <option value="">{zh ? "預設（滿版）" : "Default (full screen)"}</option>
          <option value="small">{zh ? "小 (320px)" : "Small (320px)"}</option>
          <option value="medium">{zh ? "中 (55vh)" : "Medium (55vh)"}</option>
          <option value="large">{zh ? "大 (75vh)" : "Large (75vh)"}</option>
          <option value="full">{zh ? "全螢幕 (100vh)" : "Full (100vh)"}</option>
        </select>
      </Field>
      {/* One control, two complaints. 速度好像不太一樣 — the three hero
          carousels ran at 6500/6500/5000 ms with no way to change any of them
          (HeroBannerCarousel took an intervalMs prop that no caller ever passed).
          And 我蠻希望這邊是有一個 15 秒一直在循環的 — a .mp4 already plays here
          with autoPlay muted loop, but the fixed 6.5s slide cut a 15-second clip
          off a third of the way through. */}
      <Field label={zh ? "輪播秒數（每張停留）" : "Seconds per slide"}>
        <input
          type="number"
          min={2}
          max={30}
          step={0.5}
          value={String(c.slide_seconds ?? "")}
          placeholder="6.5"
          onChange={e => onChange({ ...c, slide_seconds: e.target.value ? Number(e.target.value) : undefined })}
        />
        <p className="hpb-field-hint">
          {zh
            ? "留空為預設 6.5 秒。只有兩張以上才會輪播；放影片時設成影片長度，它才不會播到一半被換掉。"
            : "Blank is the 6.5s default. Only applies with two or more slides — set it to a video’s length so a clip is not cut off part-way."}
        </p>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {/* A Field is a <label>, and a label names only its first control — so
            the hex box beside each swatch had no accessible name at all. Both
            halves are named explicitly rather than relying on that. */}
        <Field label={zh ? "標題顏色" : "Title colour"}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="color"
              aria-label={zh ? "標題顏色（色票）" : "Title colour (swatch)"}
              value={titleColor}
              onChange={(e) => onChange({ ...c, titleColor: e.target.value })}
              style={{ width: 40, height: 32, border: "1px solid var(--line)", borderRadius: 4, cursor: "pointer" }}
            />
            <input type="text" aria-label={zh ? "標題顏色（色碼）" : "Title colour (hex)"} value={titleColor} onChange={(e) => onChange({ ...c, titleColor: e.target.value })} style={{ flex: 1 }} />
          </div>
        </Field>
        <Field label={zh ? "副標顏色" : "Subtitle colour"}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="color"
              aria-label={zh ? "副標顏色（色票）" : "Subtitle colour (swatch)"}
              value={subtitleColor}
              onChange={(e) => onChange({ ...c, subtitleColor: e.target.value })}
              style={{ width: 40, height: 32, border: "1px solid var(--line)", borderRadius: 4, cursor: "pointer" }}
            />
            <input type="text" aria-label={zh ? "副標顏色（色碼）" : "Subtitle colour (hex)"} value={subtitleColor} onChange={(e) => onChange({ ...c, subtitleColor: e.target.value })} style={{ flex: 1 }} />
          </div>
        </Field>
      </div>
    </div>
  );
}

/* ── Rooms / Facilities wall (photo carousel + specs per room) ──────── */

export function RoomsConfigForm({
  c,
  zh,
  editLocale,
  onChange,
  site,
}: {
  c: Record<string, unknown>;
  zh: boolean;
  editLocale: string;
  onChange: (c: Record<string, unknown>) => void;
  site: AdminSite;
}) {
  const items = (Array.isArray(c.items) ? c.items : []) as Record<string, unknown>[];
  const setItems = (next: Record<string, unknown>[]) => onChange({ ...c, items: next });

  const photoFields: ItemFields = [
    { key: "url", label: zh ? "照片" : "Photo", type: "image", bilingual: false },
  ];
  const specFields: ItemFields = [
    { key: "label", label: zh ? "項目" : "Label", inline: true, placeholder: zh ? "項目（適合人數）" : "Label (Capacity)" },
    { key: "value", label: zh ? "內容" : "Value", inline: true, placeholder: zh ? "內容（2 人）" : "Value (2 guests)" },
  ];
  const roomFields: ItemFields = [
    { key: "number", label: zh ? "棟別／編號" : "No.", inline: true, inlineWidth: "80px", placeholder: zh ? "A棟" : "Villa A" },
    { key: "name", label: zh ? "名稱" : "Name", inline: true },
    {
      key: "images",
      label: zh ? "照片（可多張，輪播）" : "Photos (carousel)",
      type: "items",
      fields: photoFields,
      addLabel: zh ? "+ 新增照片" : "+ Add photo",
      newItem: () => ({ url: "" }),
      noun: { zh: "照片", en: "photo" },
    },
    {
      key: "specs",
      label: zh ? "規格（如 適合人數 / 樓層 / 格局）" : "Specs (e.g. capacity / floors / layout)",
      type: "items",
      fields: specFields,
      addLabel: zh ? "+ 新增規格" : "+ Add spec",
      noun: { zh: "規格", en: "spec" },
    },
  ];

  // 房型格局 DB 讀寫：pull the linked parent stay's room_types and turn each into a
  // room item — name from the room type, 適合人數 spec from its capacity.
  const parentRooms = useParentStayRooms(site);
  const importParentRooms = () => {
    if (!parentRooms || !parentRooms.length) return;
    const next = parentRooms.map((r, i) => {
      const nm = splitAmenity(r.name); // reuse "中文 · English" splitter
      const letter = String.fromCharCode(65 + i); // A, B, C…
      const specs: Record<string, unknown>[] = [
        { label: { zh: "可容納人數", en: "Capacity" }, value: { zh: `${r.capacity} 人`, en: `${r.capacity} guests` } },
      ];
      // 房型格局 stays a one-line summary (客戶：格局要簡短，幾間雙人＋幾間四人).
      // A long free-text description is condensed to "N 間雙人房＋M 間四人房";
      // only if nothing countable is found do we fall back to the raw text.
      const layout = summariseRoomLayout(r.description);
      if (layout) {
        specs.push({ label: { zh: "房型格局", en: "Layout" }, value: { zh: layout.zh, en: layout.en } });
      } else if (r.description) {
        const d = splitAmenity(r.description);
        specs.push({ label: { zh: "房型格局", en: "Layout" }, value: { zh: d.zh, en: d.en } });
      }
      const existing = items[i] as Record<string, unknown> | undefined;
      return {
        number: { zh: `${letter}棟`, en: `Villa ${letter}` },
        name: { zh: nm.zh, en: nm.en },
        images: existing && Array.isArray(existing.images) ? existing.images : [],
        specs,
      };
    });
    setItems(next);
  };

  return (
    <div>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={(v) => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={(v) => onChange(setVal(c, "title", editLocale, v))} />
      </Field>

      {site.parent_site_id ? (
        <div className="amenity-import">
          <div className="amenity-import-head">
            <FieldLabel>{zh ? "母站房型格局（讀取住宿房型）" : "Room layout from parent stay"}</FieldLabel>
            {parentRooms && parentRooms.length > 0 && (
              <button type="button" className="amenity-import-all" onClick={importParentRooms}>
                {zh ? "帶入（覆蓋目前）" : "Import (replace)"}
              </button>
            )}
          </div>
          {parentRooms === null ? (
            <p className="amenity-import-hint">{zh ? "載入母站房型中…" : "Loading parent rooms…"}</p>
          ) : parentRooms.length === 0 ? (
            <p className="amenity-import-hint">{zh ? "母站住宿尚未設定房型（room types）。" : "No room types on the parent stay yet."}</p>
          ) : (
            <p className="amenity-import-hint">
              {zh ? "將帶入：" : "Will import: "}
              {parentRooms.map((r) => `${splitAmenity(r.name).zh || splitAmenity(r.name).en}（${r.capacity}人）`).join("、")}
            </p>
          )}
        </div>
      ) : null}

      <FieldLabel>{zh ? "房型 / 空間項目" : "Rooms / Spaces"}</FieldLabel>
      <div style={{ marginTop: 8 }}>
        <ItemsEditor
          items={items}
          fields={roomFields}
          zh={zh}
          editLocale={editLocale}
          onChange={setItems}
          // A room saved without 棟別 renders an unlabelled card, so a new one is
          // seeded with the next letter exactly as the old add button did.
          newItem={(i) => {
            const L = String.fromCharCode(65 + i);
            return { number: { zh: `${L}棟`, en: `Villa ${L}` }, images: [], specs: [] };
          }}
          noun={{ zh: "房型", en: "room" }}
          addLabel={zh ? "+ 新增房型" : "+ Add room"}
        />
      </div>
    </div>
  );
}

/* ── Search bar config ──────────────────────────────────────────── */

export function SearchBarConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        {zh
          ? "縣市、地區、人數、服務設施選項自動取自住宿目錄，這裡只能改標題文字。"
          : "Region, guest and facility options come from the stay catalogue automatically — only the heading is editable here."}
      </p>
      <Field label={zh ? "標題（選填）" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={v => onChange(setVal(c, "title", editLocale, v))} placeholder={zh ? "依你想要的旅行方式探索" : "Find a stay that fits your mood"} />
      </Field>
    </div>
  );
}

/* ── Newsletter signup config ────────────────────────────────────── */

export function NewsletterConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  const textColor = String(c.text_color ?? "");
  const bgColor = String(c.bg_color ?? c._bgColor ?? "");
  // The newsletter manages its own background + contained/bleed width, so it must
  // NOT route its colour through the generic _bgColor key — that makes BlockWrapper
  // wrap it in a 100vw full-width strip and the "留白置中" option never takes effect.
  const setBg = (v: string) => {
    const { _bgColor, ...rest } = c as Record<string, unknown>;
    void _bgColor;
    onChange(v ? { ...rest, bg_color: v } : (() => { const { bg_color, ...r } = rest as Record<string, unknown>; void bg_color; return r; })());
  };
  return (
    <div>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={v => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題（選填）" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={v => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      <Field label={zh ? "內文（選填）" : "Body"}>
        <textarea rows={3} value={getVal(c, "body", editLocale)} onChange={e => onChange(setVal(c, "body", editLocale, e.target.value))} />
      </Field>
      <Field label={zh ? "Email 欄位提示文字" : "Email placeholder"}>
        <input type="text" value={getVal(c, "email_placeholder", editLocale)} onChange={e => onChange(setVal(c, "email_placeholder", editLocale, e.target.value))} placeholder={zh ? "輸入您的 Email" : "you@example.com"} />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px", fontSize: 13 }}>
        <input type="checkbox" checked={c.show_icon === true} onChange={e => onChange({ ...c, show_icon: e.target.checked })} />
        <span>{zh ? "顯示左側信封圖示（聯絡頁版面）" : "Show the envelope disc"}</span>
      </label>
      <Field label={zh ? "按鈕文字（選填）" : "Button label"}>
        <input type="text" value={getVal(c, "submit_label", editLocale)} onChange={e => onChange(setVal(c, "submit_label", editLocale, e.target.value))} />
      </Field>
      <Field label={zh ? "背景顏色" : "Background colour"}>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="color" aria-label={zh ? "背景顏色（色票）" : "Background colour (swatch)"} value={bgColor || "#ffffff"} onChange={e => setBg(e.target.value)} style={{ width: 44, height: 32, cursor: "pointer" }} />
          <input type="text" aria-label={zh ? "背景顏色（色碼）" : "Background colour (hex)"} value={bgColor} onChange={e => setBg(e.target.value)} placeholder={zh ? "預設" : "Default"} style={{ flex: 1 }} />
        </div>
      </Field>
      <Field label={zh ? "文字顏色" : "Text colour"}>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="color" aria-label={zh ? "文字顏色（色票）" : "Text colour (swatch)"} value={textColor || "#3a322b"} onChange={e => onChange({ ...c, text_color: e.target.value })} style={{ width: 44, height: 32, cursor: "pointer" }} />
          <input type="text" aria-label={zh ? "文字顏色（色碼）" : "Text colour (hex)"} value={textColor} onChange={e => onChange({ ...c, text_color: e.target.value })} placeholder={zh ? "預設" : "Default"} style={{ flex: 1 }} />
        </div>
      </Field>
      {/* full_bleed moved to inspector panel */}
    </div>
  );
}

/**
 * List markers globals.css draws for a rich-text body.
 *
 * `.property-rich-text-body--ls-*` has carried eight of these for a while and
 * no control wrote the key, so all eight were unreachable. A test checks this
 * list against the stylesheet so a marker added to one cannot go missing from
 * the other.
 */
export const LIST_STYLES: Array<[string, string, string]> = [
  ["decimal", "數字 1. 2. 3.", "Numbers"],
  ["roman", "羅馬數字 i. ii. iii.", "Roman numerals"],
  ["disc", "實心圓點", "Filled bullet"],
  ["circle", "空心圓點", "Hollow bullet"],
  ["square", "方點", "Square bullet"],
  ["dash", "破折號 –", "Dash"],
  ["asterisk", "星號 *", "Asterisk"],
  ["none", "不顯示符號", "None"],
];

export function RichTextConfigForm({
  c,
  zh,
  editLocale,
  onChange,
}: {
  c: Record<string, unknown>;
  zh: boolean;
  editLocale: string;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const align = String(c._textAlign ?? "");
  const headingColor = String(c.heading_color ?? "");
  const bodyColor = String(c.body_color ?? "");
  const bgColor = String(c._bgColor ?? "");
  // The glyph is the whole button, so "左" alone was the accessible name for a
  // control that toggles: spell out the action and let aria-checked below carry
  // whether it is the one in effect.
  const ALIGNS = [
    { v: "left",   label: zh ? "靠左對齊" : "Align left",   glyph: "⯇" },
    { v: "center", label: zh ? "置中對齊" : "Align centre", glyph: "≡" },
    { v: "right",  label: zh ? "靠右對齊" : "Align right",  glyph: "⯈" },
  ] as const;

  return (
    <div className="rtc-form">
      {/* Compact controls row (align + font size + heading colour + body colour) */}
      <div className="rtc-row" style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>{zh ? "對齊" : "Align"}</FieldLabel>
          <div className="rtc-align" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={zh ? "對齊方式" : "Text align"} style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
            {ALIGNS.map((a, i) => (
              <button
                key={a.v}
                type="button"
                role="radio"
                aria-checked={align === a.v}
                title={a.label}
                aria-label={a.label}
                onClick={() => onChange({ ...c, _textAlign: align === a.v ? undefined : a.v })}
                style={{
                  width: 30, height: 30, padding: 0, background: align === a.v ? "var(--accent, #b78b58)" : "var(--bg)",
                  color: align === a.v ? "#fff" : "var(--ink)",
                  border: 0, borderLeft: i > 0 ? "1px solid var(--line)" : "0",
                  cursor: "pointer", fontSize: 14,
                }}
              >
                <span aria-hidden="true">{a.glyph}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>{zh ? "行距" : "Line height"}</FieldLabel>
          <select value={String(c._lineHeight ?? "")} onChange={(e) => onChange(e.target.value ? { ...c, _lineHeight: e.target.value } : (() => { const { _lineHeight, ...rest } = c as Record<string, unknown>; void _lineHeight; return rest; })())}>
            <option value="">{zh ? "預設" : "Default"}</option>
            {["1.2","1.4","1.6","1.8","2.0","2.2"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>{zh ? "字間" : "Letter spacing"}</FieldLabel>
          <select value={String(c._letterSpacing ?? "")} onChange={(e) => onChange(e.target.value ? { ...c, _letterSpacing: e.target.value } : (() => { const { _letterSpacing, ...rest } = c as Record<string, unknown>; void _letterSpacing; return rest; })())}>
            <option value="">{zh ? "預設" : "Default"}</option>
            {["0px","0.5px","1px","1.5px","2px","3px"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>{zh ? "標題色" : "Heading"}</FieldLabel>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {/* FieldLabel is a <span>, so these swatches sat beside a caption
                that names nothing: without an explicit label they read out as
                bare colour pickers. */}
            <input
              type="color"
              aria-label={zh ? "標題色" : "Heading colour"}
              value={headingColor || "#283d34"}
              onChange={(e) => onChange({ ...c, heading_color: e.target.value })}
              style={{ width: 32, height: 30, border: "1px solid var(--line)", borderRadius: 4, cursor: "pointer", padding: 0 }}
            />
            {headingColor && (
              <button
                type="button"
                title={zh ? "清除標題色" : "Clear heading colour"}
                aria-label={zh ? "清除標題色" : "Clear heading colour"}
                onClick={() => { const { heading_color, ...rest } = c as Record<string, unknown>; void heading_color; onChange(rest); }}
                style={{ border: "1px solid var(--line)", background: "var(--bg)", width: 22, height: 22, borderRadius: 3, cursor: "pointer", fontSize: 11 }}
              >×</button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>{zh ? "內文色" : "Body"}</FieldLabel>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="color"
              aria-label={zh ? "內文色" : "Body colour"}
              value={bodyColor || "#666666"}
              onChange={(e) => onChange({ ...c, body_color: e.target.value })}
              style={{ width: 32, height: 30, border: "1px solid var(--line)", borderRadius: 4, cursor: "pointer", padding: 0 }}
            />
            {bodyColor && (
              <button
                type="button"
                title={zh ? "清除內文色" : "Clear body colour"}
                aria-label={zh ? "清除內文色" : "Clear body colour"}
                onClick={() => { const { body_color, ...rest } = c as Record<string, unknown>; void body_color; onChange(rest); }}
                style={{ border: "1px solid var(--line)", background: "var(--bg)", width: 22, height: 22, borderRadius: 3, cursor: "pointer", fontSize: 11 }}
              >×</button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldLabel>{zh ? "區塊背景" : "Background"}</FieldLabel>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="color"
              aria-label={zh ? "區塊背景色" : "Block background colour"}
              value={bgColor || "#ffffff"}
              onChange={(e) => onChange({ ...c, _bgColor: e.target.value })}
              style={{ width: 32, height: 30, border: "1px solid var(--line)", borderRadius: 4, cursor: "pointer", padding: 0 }}
            />
            {bgColor && (
              <button
                type="button"
                title={zh ? "清除背景色" : "Clear background colour"}
                aria-label={zh ? "清除背景色" : "Clear background colour"}
                onClick={() => { const { _bgColor, ...rest } = c as Record<string, unknown>; void _bgColor; onChange(rest); }}
                style={{ border: "1px solid var(--line)", background: "var(--bg)", width: 22, height: 22, borderRadius: 3, cursor: "pointer", fontSize: 11 }}
              >×</button>
            )}
          </div>
        </div>
      </div>

      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={(v) => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題" : "Heading"}>
        <HeadingInput value={getVal(c, "heading", editLocale)} onChange={(v) => onChange(setVal(c, "heading", editLocale, v))} />
      </Field>
      <Field label={zh ? "內文" : "Body"}>
        <RichTextEditor
          value={getVal(c, "body", editLocale)}
          onChange={(html) => onChange(setVal(c, "body", editLocale, html))}
          placeholder={zh ? "在此編輯段落內文…" : "Edit body…"}
          minRows={5}
          localeKey={editLocale}
        />
      </Field>
      {/* Three settings BlockRichText has always read and this form never
          offered: config.image turns the block into the two-column 圖文分欄
          layout, image_side flips it, and _listStyle picks one of eight
          list markers that globals.css already draws. The split layout is also
          the only thing that reads 文字對齊圖片, so without an image field that
          control could never do anything either. */}
      <Field label={zh ? "側邊圖片（選填，加了就變成圖文分欄）" : "Side image (optional — turns the block into two columns)"}>
        <ImageUploadInput
          value={String(c.image ?? "")}
          onChange={(url) => onChange({ ...c, image: url })}
        />
      </Field>
      {Boolean(c.image) && (
        <Field label={zh ? "圖片方向" : "Image side"}>
          <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={zh ? "圖片方向" : "Image side"}>
            {([["right", zh ? "圖在右" : "Picture right"], ["left", zh ? "圖在左" : "Picture left"]] as [string, string][]).map(([v, lbl]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={(c.image_side === "left" ? "left" : "right") === v}
                className={`hpb-variant-pick__btn${(c.image_side === "left" ? "left" : "right") === v ? " is-active" : ""}`}
                onClick={() => onChange({ ...c, image_side: v })}
              >
                {lbl}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label={zh ? "清單樣式" : "List markers"}>
        <select value={String(c._listStyle ?? "")} onChange={(e) => onChange({ ...c, _listStyle: e.target.value || undefined })}>
          <option value="">{zh ? "預設" : "Default"}</option>
          {LIST_STYLES.map(([v, zhL, enL]) => (
            <option key={v} value={v}>{zh ? zhL : enL}</option>
          ))}
        </select>
        <p className="hpb-field-hint">
          {zh ? "套用到內文裡的項目符號與編號清單。" : "Applies to bulleted and numbered lists in the body."}
        </p>
      </Field>
      {/* Feature highlights used to live here too — split out into their own
          "特色亮點清單" block (client: 特色亮點移出來，做成新內容區塊) so a text
          block is just text, and the highlights can be placed, reordered, and
          hidden independently of any particular paragraph. */}
      {/* full_bleed moved to inspector panel */}
    </div>
  );
}

/* ── Image gallery config (configurable columns + image list) ──────── */

export type FlowStep = Record<string, unknown>;

export function FlowConfigForm({
  c,
  zh,
  editLocale,
  onChange,
}: {
  c: Record<string, unknown>;
  zh: boolean;
  editLocale: string;
  onChange: (c: Record<string, unknown>) => void;
}) {
  // Read straight from the config rather than mirroring it in state: the mirror
  // was seeded once, so a step list arriving from an undo or a block switch was
  // ignored, and every eyebrow edit re-wrote the stale copy back over the config.
  const steps = (Array.isArray(c.steps) ? c.steps : []) as FlowStep[];
  const update = (next: FlowStep[]) => onChange({ ...c, steps: next });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <FieldLabel>{zh ? "步驟（留空則使用預設）" : "Steps (leave empty for defaults)"}</FieldLabel>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{steps.length}</span>
      </div>
      <ItemsEditor
        items={steps}
        fields={[
          { key: "title", label: zh ? "步驟標題" : "Step title" },
          { key: "text", label: zh ? "步驟說明（選填）" : "Step text" },
        ]}
        zh={zh}
        editLocale={editLocale}
        onChange={update}
        newItem={() => ({ title: { en: "", zh: "" }, text: { en: "", zh: "" } })}
        noun={{ zh: "步驟", en: "step" }}
        numbered
        addLabel={zh ? "+ 新增步驟" : "+ Add step"}
      />
      <div style={{ marginTop: 16 }}>
        <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
          <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={v => onChange(setVal(c, "eyebrow", editLocale, v))} />
        </Field>
        <Field label={zh ? "標題（選填）" : "Title"}>
          <HeadingInput value={getVal(c, "title", editLocale)} onChange={v => onChange(setVal(c, "title", editLocale, v))} />
        </Field>
        <Field label={zh ? "說明（選填）" : "Intro"}>
          <textarea rows={3} value={getVal(c, "intro", editLocale)} onChange={e => onChange(setVal(c, "intro", editLocale, e.target.value))} />
        </Field>
      </div>
    </div>
  );
}

/* ── Featured Collection config (stays / CMS content) ──────────────── */

export type MappableStay = { name: string; slug: string; summary: string; image: string; lat: number; lng: number };

/**
 * Stays that can be placed on a map — the ones whose location_config carries
 * coordinates. Everything else a marker needs (name, blurb, photo, link) is
 * already on the stay, so the only thing an admin fills in by hand is the
 * lat/lng, once, on the stay itself.
 */
export function useMappableStays(site: AdminSite): MappableStay[] | null {
  const [stays, setStays] = useState<MappableStay[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/stays?site=${encodeURIComponent(site.slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!alive) return;
        const arr = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
        setStays(
          arr
            .map((st) => {
              const loc = (st.location_config ?? {}) as Record<string, unknown>;
              return {
                name: String(st.name ?? ""),
                slug: String(st.slug ?? ""),
                summary: String(st.summary ?? ""),
                image: String(st.hero_image_url ?? ""),
                lat: parseFloat(String(loc.lat ?? "")),
                lng: parseFloat(String(loc.lng ?? "")),
              };
            })
            .filter((st) => st.name && Number.isFinite(st.lat) && Number.isFinite(st.lng)),
        );
      })
      .catch(() => { if (alive) setStays([]); });
    return () => { alive = false; };
  }, [site.slug]);
  return stays;
}

export function MapConfigForm({
  c,
  zh,
  editLocale,
  onChange,
  site,
}: {
  c: Record<string, unknown>;
  zh: boolean;
  editLocale: string;
  onChange: (c: Record<string, unknown>) => void;
  site: AdminSite;
}) {
  const markers = Array.isArray(c.markers) ? (c.markers as Record<string, unknown>[]) : [];
  // Through the same resolver the renderer uses. A stored mode that no longer
  // exists matched no <option>, so the browser showed the first one while the
  // saved value stayed put — the editor was told a mode the page was not using.
  const mode = resolveMapMode(c.mode, markers.length);
  const setMode = (m: string) => onChange({ ...c, mode: m });
  const updateMarkers = (next: Record<string, unknown>[]) => onChange({ ...c, markers: next });

  // 民宿同步上圖: build a pin per stay that has coordinates. Existing markers for
  // the same stay are replaced rather than duplicated, so re-importing after
  // adding a villa is safe; hand-made pins for anything else are left alone.
  const mappableStays = useMappableStays(site);
  const importStays = () => {
    if (!mappableStays?.length) return;
    const imported = mappableStays.map((st) => ({
      name: { zh: st.name, en: st.name },
      desc: { zh: st.summary, en: st.summary },
      image: st.image,
      link: `/stays/${st.slug}`,
      lat: st.lat,
      lng: st.lng,
      _stay: st.slug,
    }));
    const bySlug = new Set(imported.map((m) => m._stay));
    const kept = markers.filter((m) => !bySlug.has(String(m._stay ?? "")));
    updateMarkers([...kept, ...imported]);
  };
  return (
    <div>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={(v) => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題（選填）" : "Heading"}>
        <HeadingInput value={getVal(c, "heading", editLocale)} onChange={(v) => onChange(setVal(c, "heading", editLocale, v))} />
      </Field>
      <Field label={zh ? "地圖類型" : "Map type"}>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="stays">{zh ? "所有民宿（自動同步）" : "All villas (auto)"}</option>
          <option value="pins">{zh ? "多點標記（自家地圖）" : "Multi-pin (built-in)"}</option>
          <option value="embed">{zh ? "Google 地圖嵌入" : "Google Map embed"}</option>
        </select>
      </Field>
      {mode === "stays" && (
        <p style={{ fontSize: 11, color: "#888", margin: "-4px 0 10px" }}>
          {zh
            ? "每次開啟頁面時重新讀取民宿列表，新增民宿會自動出現，不必回來按帶入。民宿需先在「住宿管理 → 交通位置」填入緯度／經度。下方手動標記仍會一併顯示。"
            : "Reads the villa list on every page load, so a new villa appears without coming back here. Each villa needs latitude / longitude under Stays → Location. Manual pins below still show as well."}
        </p>
      )}

      {mode === "embed" ? (
        <>
          <Field label={zh ? "Google 地圖嵌入碼 / 網址" : "Google Map embed code / URL"}>
            <textarea rows={4} style={{ fontFamily: "monospace", fontSize: 11 }} value={String(c.embed ?? c.map_embed ?? "")} onChange={(e) => onChange({ ...c, embed: e.target.value })} placeholder={'<iframe src="https://www.google.com/maps/d/embed?mid=…"></iframe>'} />
          </Field>
          <p style={{ fontSize: 11, color: "#888", margin: "4px 0 10px" }}>
            {zh ? "用 Google「我的地圖」建立座標 → 分享 → 嵌入地圖，貼上 <iframe>。" : "Build a Google “My Maps” map, then paste its Embed <iframe>."}
          </p>
        </>
      ) : (
        <>
          <div className="amenity-import">
            <div className="amenity-import-head">
              <FieldLabel>{zh ? "從住宿資料帶入" : "Import from stays"}</FieldLabel>
              {mappableStays && mappableStays.length > 0 && (
                <button type="button" className="amenity-import-all" onClick={importStays}>
                  {zh ? `帶入 ${mappableStays.length} 間` : `Import ${mappableStays.length}`}
                </button>
              )}
            </div>
            {mappableStays === null ? (
              <p className="amenity-import-hint">{zh ? "載入住宿中…" : "Loading stays…"}</p>
            ) : mappableStays.length === 0 ? (
              <p className="amenity-import-hint">
                {zh
                  ? "尚無住宿填了座標。到「住宿管理 → 交通位置」填入緯度／經度後，這裡就能一鍵帶入。"
                  : "No stay has coordinates yet. Fill in latitude / longitude under Stays → Location and they can be imported here."}
              </p>
            ) : (
              <p className="amenity-import-hint">
                {zh ? "將帶入：" : "Will import: "}
                {mappableStays.map((st) => st.name).join("、")}
              </p>
            )}
          </div>
          <FieldLabel>{zh ? "地圖標記（每間民宿一個）" : "Map markers (one per stay)"}</FieldLabel>
          <ItemsEditor
            items={markers}
            fields={[
              { key: "name", label: zh ? "名稱" : "Name" },
              { key: "lat", label: zh ? "緯度 Lat" : "Lat", type: "decimal", bilingual: false, inline: true, placeholder: "24.6543" },
              { key: "lng", label: zh ? "經度 Lng" : "Lng", type: "decimal", bilingual: false, inline: true, placeholder: "121.7812" },
              { key: "desc", label: zh ? "說明（選填）" : "Note" },
              { key: "image", label: zh ? "民宿照片（選填，顯示在彈窗）" : "Photo (optional, shown in popup)", type: "image", bilingual: false },
              { key: "link", label: zh ? "民宿頁面連結（點擊跳轉）" : "Stay page link (click to open)", bilingual: false, placeholder: "/stays/hejing" },
            ]}
            zh={zh}
            editLocale={editLocale}
            onChange={updateMarkers}
            newItem={() => ({ name: { zh: "", en: "" } })}
            noun={{ zh: "標記", en: "marker" }}
            addLabel={zh ? "+ 新增標記" : "+ Add marker"}
          />
          <p style={{ fontSize: 11, color: "#888", margin: "8px 0 10px" }}>
            {zh ? "座標取得：Google 地圖上對該地點按右鍵 → 點最上方的座標數字即可複製（例 24.6543, 121.7812）。" : "Coordinates: right-click the place in Google Maps, then click the lat,lng at the top to copy."}
          </p>
        </>
      )}

      <Field label={zh ? "高度" : "Height"}>
        <select value={String(c.height ?? "medium")} onChange={(e) => onChange({ ...c, height: e.target.value })}>
          <option value="short">{zh ? "矮 (320px)" : "Short (320px)"}</option>
          <option value="medium">{zh ? "中 (460px)" : "Medium (460px)"}</option>
          <option value="tall">{zh ? "高 (620px)" : "Tall (620px)"}</option>
        </select>
      </Field>
      <Field label={zh ? "說明文字（選填）" : "Caption"}>
        <input type="text" value={getVal(c, "caption", editLocale)} onChange={(e) => onChange(setVal(c, "caption", editLocale, e.target.value))} />
      </Field>
      <Field label={zh ? "「在 Google 地圖開啟」連結（選填）" : "Open-in-Maps link (optional)"}>
        <input type="text" value={String(c.link ?? "")} onChange={(e) => onChange({ ...c, link: e.target.value })} placeholder="https://maps.app.goo.gl/…" />
      </Field>
    </div>
  );
}

export function EditorialConfigForm({
  c,
  zh,
  editLocale,
  onChange,
}: {
  c: Record<string, unknown>;
  zh: boolean;
  editLocale: string;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const [imgUrl, setImgUrl] = useState(String(c.image ?? ""));
  /* Default "top", matching the renderer. It read "right" here, so the panel
     highlighted 圖片靠右 on a block that was in fact drawing the picture-on-top
     layout — the switch describing a state the page did not have. */
  const position = String(c.image_position ?? "top") === "left" ? "left"
    : String(c.image_position ?? "top") === "right" ? "right" : "top";

  return (
    <div>
      <Field label={zh ? "圖片（選填）" : "Image"}>
        <ImageUploadInput
          value={imgUrl}
          onChange={url => {
            setImgUrl(url);
            onChange({ ...c, image: url });
          }}
        />
      </Field>
      {imgUrl && (
        <Field label={zh ? "圖片位置" : "Image placement"}>
          <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={zh ? "圖片位置" : "Image placement"}>
            {(["top", "left", "right"] as const).map(side => (
              <button
                key={side}
                type="button"
                role="radio"
                aria-checked={position === side}
                className={`hpb-variant-pick__btn${position === side ? " is-active" : ""}`}
                onClick={() => onChange({ ...c, image_position: side })}
              >
                {side === "top"
                  ? (zh ? "大圖在上" : "Large image on top")
                  : side === "left" ? (zh ? "圖片靠左" : "Image left") : (zh ? "圖片靠右" : "Image right")}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={v => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題（選填）" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={v => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      <Field label={zh ? "內文（選填）" : "Body"}>
        <textarea
          rows={4}
          value={getVal(c, "body", editLocale)}
          onChange={e => onChange(setVal(c, "body", editLocale, e.target.value))}
        />
      </Field>
      <Field label={zh ? "CTA 文字（留空則不顯示按鈕）" : "CTA label (empty hides button)"}>
        <input type="text" value={getVal(c, "cta_label", editLocale)} onChange={e => onChange(setVal(c, "cta_label", editLocale, e.target.value))} />
      </Field>
      <Field label={zh ? "CTA 連結（選填）" : "CTA href"}>
        <input type="text" defaultValue={String(c.cta_href ?? "")} onChange={e => onChange({ ...c, cta_href: e.target.value })} />
      </Field>
    </div>
  );
}

/* ── About / Brand Story config ──────────────────────────────────── */

export function AboutConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  type AboutImageItem = { url: string; alt: Record<string, string>; [key: string]: unknown };
  const toImage = (raw: unknown): AboutImageItem => {
    if (typeof raw === "string") return { url: raw, alt: {} };
    const item = (raw ?? {}) as Record<string, unknown>;
    const rawAlt = item.alt;
    return {
      ...item,
      url: String(item.url ?? ""),
      alt: rawAlt && typeof rawAlt === "object" ? rawAlt as Record<string, string> : (typeof rawAlt === "string" ? { zh: rawAlt, en: rawAlt } : {}),
    };
  };
  const images: AboutImageItem[] = normaliseAboutImages(c, { includeEmpty: true }).map(toImage);
  const [imageError, setImageError] = useState("");
  const updateImages = (next: AboutImageItem[]) => onChange({ ...c, images: next });
  const setImageUrl = (index: number, url: string) => {
    if (/\.(?:mp4|webm|mov|avi)$/i.test(url.split(/[?#]/, 1)[0])) {
      setImageError(zh ? "此區塊只接受圖片，請選擇圖片檔。" : "This block accepts images only. Choose an image file.");
      return;
    }
    setImageError("");
    updateImages(images.map((image, i) => i === index ? { ...image, url } : image));
  };
  const setImageAlt = (index: number, value: string) => updateImages(images.map((image, i) =>
    i === index ? { ...image, alt: { ...image.alt, [editLocale]: value } } : image,
  ));
  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    updateImages(next);
  };
  const removeImage = (index: number) => {
    const image = images[index];
    if (image.url || Object.values(image.alt).some(Boolean)) {
      const name = image.alt[editLocale] || image.url.split("/").pop() || image.url;
      if (!window.confirm(zh ? `移除「${name}」（第 ${index + 1} 張圖片）？` : `Remove "${name}" (image ${index + 1})?`)) return;
    }
    updateImages(images.filter((_, i) => i !== index));
  };
  const position = String(c.image_position ?? "right");
  return (
    <div>
      <Field label={zh ? "輪播圖片（可拖曳滑動，支援替換、排序與替代文字）" : "Carousel images (swipe, replace, reorder, and add alt text)"}>
        <div className="about-image-list">
          {images.map((image, index) => (
            <div className="about-image-list__item" key={`${index}-${image.url}`}>
              <div className="about-image-list__picker">
                <ImageUploadInput
                  value={image.url}
                  onChange={(url) => setImageUrl(index, url)}
                  uploadLabel={zh ? "上傳圖片" : "Upload image"}
                  libraryLabel={zh ? "從媒體庫選圖片" : "Choose image"}
                />
                <div className="about-image-list__actions">
                  <span>{zh ? `第 ${index + 1} 張` : `Image ${index + 1}`}</span>
                  <button type="button" style={{ ...rowToolButtonStyle, opacity: index === 0 ? 0.4 : 1 }} disabled={index === 0} aria-label={zh ? `第 ${index + 1} 張上移` : `Move image ${index + 1} up`} onClick={() => moveImage(index, -1)}>
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" style={{ ...rowToolButtonStyle, opacity: index === images.length - 1 ? 0.4 : 1 }} disabled={index === images.length - 1} aria-label={zh ? `第 ${index + 1} 張下移` : `Move image ${index + 1} down`} onClick={() => moveImage(index, 1)}>
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" className="items-editor-remove" style={{ ...rowToolButtonStyle, position: "static" }} aria-label={zh ? `移除第 ${index + 1} 張圖片` : `Remove image ${index + 1}`} onClick={() => removeImage(index)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <label className="about-image-list__alt">
                <span>{zh ? "圖片替代文字（無障礙／搜尋描述，選填）" : "Image alt text (accessibility / search description, optional)"}</span>
                <input
                  type="text"
                  value={String(image.alt[editLocale] ?? "")}
                  onChange={(event) => setImageAlt(index, event.target.value)}
                  placeholder={zh ? "簡短描述圖片內容" : "Briefly describe the image"}
                />
              </label>
            </div>
          ))}
          <button type="button" className="items-editor-add" onClick={() => { setImageError(""); updateImages([...images, { url: "", alt: {} }]); }}>
            {zh ? "+ 新增輪播圖片" : "+ Add carousel image"}
          </button>
          {imageError && <p role="alert" className="about-image-list__error">{imageError}</p>}
        </div>
      </Field>
      {images.length > 0 && (
        <Field label={zh ? "圖片方向" : "Image side"}>
          <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={zh ? "圖片方向" : "Image side"}>
            {(["left", "right"] as const).map(side => (
              <button
                key={side}
                type="button"
                role="radio"
                aria-checked={position === side}
                className={`hpb-variant-pick__btn${position === side ? " is-active" : ""}`}
                onClick={() => onChange({ ...c, image_position: side })}
              >
                {side === "left" ? (zh ? "圖片靠左" : "Image left") : (zh ? "圖片靠右" : "Image right")}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={v => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題（選填）" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={v => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      <Field label={zh ? "內文（選填，可換行＝分行詩句）" : "Body (line breaks = separate lines)"}>
        <textarea rows={4} value={getVal(c, "body", editLocale)} onChange={e => onChange(setVal(c, "body", editLocale, e.target.value))} />
      </Field>
      <Field label={zh ? "結語（選填）" : "Caption"}>
        <input type="text" value={getVal(c, "caption", editLocale)} onChange={e => onChange(setVal(c, "caption", editLocale, e.target.value))} />
      </Field>
      <AboutItemsEditor c={c} zh={zh} editLocale={editLocale} onChange={onChange} />
      <Field label={zh ? "CTA 文字（選填）" : "CTA label"}>
        <input type="text" value={getVal(c, "cta_label", editLocale)} onChange={e => onChange(setVal(c, "cta_label", editLocale, e.target.value))} />
      </Field>
      <Field label={zh ? "CTA 連結（選填）" : "CTA href"}>
        <input type="text" defaultValue={String(c.cta_href ?? "")} onChange={e => onChange({ ...c, cta_href: e.target.value })} />
      </Field>
    </div>
  );
}

export function AboutItemsEditor({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  const [items, setItems] = useState<Record<string, unknown>[]>(() =>
    Array.isArray(c.items) ? (c.items as Record<string, unknown>[]) : [],
  );
  const update = (next: Record<string, unknown>[]) => { setItems(next); onChange({ ...c, items: next }); };
  const updateItem = (i: number, patch: Record<string, unknown>) => update(items.map((x, j) => j === i ? patch : x));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  // The card body cannot go through ItemsEditor (it draws a live FeatureIcon
  // preview from two fields at once, which no field descriptor describes), but
  // an unconfirmed delete is the same lost work here as anywhere else.
  const remove = (i: number) => {
    if (repeatedItemHasContent(items[i])) {
      const what = getVal(items[i], "label", editLocale) || (zh ? "這個亮點" : "this highlight");
      const msg = zh
        ? `刪除「${what}」（第 ${i + 1} 個亮點）？裡面的內容會一併移除，且無法復原。`
        : `Delete "${what}" (highlight ${i + 1})? Its content goes with it and cannot be restored.`;
      if (!window.confirm(msg)) return;
    }
    update(items.filter((_, j) => j !== i));
  };
  return (
    <div className="fl-editor">
      {items.map((item, i) => {
        const isCustomIcon = !String(item.icon ?? "").startsWith("icon:");
        const color = String(item.icon_color ?? "#b78b58");
        return (
          <div key={i} className="fl-card">
            <div className="fl-card__preview" style={{ color }}>
              {isCustomIcon
                ? <span className="fl-card__emoji">{String(item.icon ?? "") || "＋"}</span>
                : <FeatureIcon icon={String(item.icon)} color={color} />}
            </div>
            <div className="fl-card__fields">
              <div className="fl-card__row">
                <select
                  aria-label={zh ? `第 ${i + 1} 項圖示` : `Item ${i + 1} icon`}
                  value={String(item.icon ?? "").startsWith("icon:") ? String(item.icon) : ""}
                  onChange={e => updateItem(i, { ...item, icon: e.target.value })}
                >
                  <option value="">{zh ? "自訂 emoji →" : "Custom emoji →"}</option>
                  {FEATURE_ICON_KEYS.map(([key, zhL, enL]) => (
                    <option key={key} value={`icon:${key}`}>{zh ? zhL : enL}</option>
                  ))}
                </select>
                {isCustomIcon && (
                  <input
                    type="text"
                    className="fl-card__emoji-input"
                    value={String(item.icon ?? "")}
                    placeholder={zh ? "貼上一個 emoji" : "Paste an emoji"}
                    onChange={e => updateItem(i, { ...item, icon: e.target.value })}
                  />
                )}
                <input
                  type="color"
                  value={color}
                  title={zh ? "圖示顏色" : "Icon colour"}
                  aria-label={zh ? `第 ${i + 1} 項圖示顏色` : `Item ${i + 1} icon colour`}
                  onChange={e => updateItem(i, { ...item, icon_color: e.target.value })}
                />
              </div>
              <input
                type="text"
                className="fl-card__title"
                value={getVal(item, "label", editLocale)}
                placeholder={zh ? "標題" : "Title"}
                onChange={e => updateItem(i, setVal(item, "label", editLocale, e.target.value))}
              />
              <input
                type="text"
                className="fl-card__detail"
                value={getVal(item, "detail", editLocale)}
                placeholder={zh ? "說明（選填）" : "Detail (optional)"}
                onChange={e => updateItem(i, setVal(item, "detail", editLocale, e.target.value))}
              />
            </div>
            <div className="fl-card__actions">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={zh ? "上移" : "Move up"}>↑</button>
              <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={zh ? "下移" : "Move down"}>↓</button>
              <button type="button" className="fl-card__remove" onClick={() => remove(i)} aria-label={zh ? "刪除" : "Remove"}>&#10005;</button>
            </div>
          </div>
        );
      })}
      <button type="button" className="items-editor-add" onClick={() => update([...items, { icon: "", label: { zh: "", en: "" }, detail: { zh: "", en: "" } }])}>
        {zh ? "+ 新增亮點" : "+ Add highlight"}
      </button>
    </div>
  );
}

/* ── Feature list block (清單區塊) ─────────────────────────────────
   Split out of the rich-text block, which used to carry an eyebrow, a whole
   WYSIWYG body AND this repeatable icon list — three different jobs in one
   editor panel (client: 特色亮點移出來，做成新內容區塊). A page that only wants
   the highlights no longer has to fill in an empty body to get them. */
export function FeatureListConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={v => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題（選填）" : "Heading"}>
        <HeadingInput value={getVal(c, "heading", editLocale)} onChange={v => onChange(setVal(c, "heading", editLocale, v))} />
      </Field>
      <Field label={zh ? "排版" : "Layout"}>
        <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={zh ? "排版" : "Layout"}>
          {([["row", "橫向並排", "In a row"], ["grid", "多欄網格", "Grid"]] as const).map(([val, zhL, enL]) => (
            <button
              key={val}
              type="button"
              role="radio"
              aria-checked={String(c.layout ?? "row") === val}
              className={`hpb-variant-pick__btn${String(c.layout ?? "row") === val ? " is-active" : ""}`}
              onClick={() => onChange({ ...c, layout: val === "row" ? undefined : val })}
            >
              {zh ? zhL : enL}
            </button>
          ))}
        </div>
      </Field>
      <AboutItemsEditor c={c} zh={zh} editLocale={editLocale} onChange={onChange} />
    </div>
  );
}

/* ── FAQ config ──────────────────────────────────────────────────── */

export type ItemField = {
  key: string;
  label: string;
  /** "url" is a plain text field that must carry an absolute http(s) address:
   *  the renderers drop anything else rather than guessing a scheme.
   *  "decimal" is free text too, not <input type=number>: coordinates are stored
   *  as typed and a number input eats a half-typed "24." while the caret is in it.
   *  "items" nests another list (a room's photos, its specs). */
  /** "icon" is a picker for the drawn badge icons plus a free-text box for an
   *  emoji, on one key. BlockFeatureBadges carries 38 line icons keyed by slug
   *  and no admin control could produce one of those slugs, so the whole set
   *  was unreachable and every badge came out as an emoji or the fallback
   *  diamond. */
  type?: "text" | "textarea" | "image" | "select" | "richtext" | "url" | "decimal" | "items" | "icon";
  options?: { value: string; label: string }[];
  bilingual?: boolean;
  placeholder?: string;
  /** Off for a field that cannot name the row when it is collapsed: a badge's
   *  icon is the first field on the line but "🏊" alone does not say which badge
   *  is about to be deleted. */
  summary?: boolean;
  /** Put this field on the same line as the neighbouring inline fields. Kept as a
   *  per-field flag rather than a layout array so the fields list stays one
   *  ordered thing to read. */
  inline?: boolean;
  /** Grid track for this field when inline, e.g. "80px" for a 棟別 box that
   *  should not take a third of the row. */
  inlineWidth?: string;
  /** type: "items" only — the nested list's own descriptors and labels. */
  fields?: ItemFields;
  addLabel?: string;
  newItem?: (index: number) => Record<string, unknown>;
  noun?: ItemNoun;
};

export type ItemFields = ItemField[];

/** What the author just did, so a caller keeping a second array in step (table
 *  rows against table columns) can apply the same edit rather than guess it by
 *  diffing two arrays that may legitimately contain equal values. */
export type ItemsChange =
  | { kind: "add" }
  | { kind: "edit"; index: number }
  | { kind: "move"; from: number; to: number }
  | { kind: "remove"; index: number };

/** What one row is called, for the row toolbar's accessible names: "刪除步驟 2"
 *  reads as an instruction, "刪除第 2 項" makes a screen-reader user work out
 *  which list they are in. */
export type ItemNoun = { zh: string; en: string };

const DEFAULT_NOUN: ItemNoun = { zh: "項目", en: "item" };

/** Readable text carried by one stored field, whether it is a plain string or a
 *  { zh, en } pair. HTML is stripped so a richtext answer contributes its words
 *  rather than its tags. */
function itemFieldText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(itemFieldText).filter(Boolean).join(" ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      // Same convention PageBlockEditor's blockHasContent follows: "_"-prefixed
      // keys are styling the author can retype from the row, not authored work.
      .filter(([k]) => !k.startsWith("_"))
      .map(([, x]) => itemFieldText(x))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

/** Whether removing this row would lose work the author cannot retype from the
 *  collapsed summary alone. Confirming every delete trains people to dismiss the
 *  dialog, so a blank row just added by a misclick still goes in one click. */
export function repeatedItemHasContent(item: Record<string, unknown> | undefined): boolean {
  if (!item) return false;
  return Object.entries(item).some(([k, v]) => !k.startsWith("_") && itemFieldText(v).length > 0);
}

/** One line naming the row: the first field that has anything in it. Falls back
 *  to an image's file name, because a photo-only row is still identifiable and
 *  labelling it "empty" would read as safe to delete. */
function clip(s: string): string {
  return s.length > 56 ? `${s.slice(0, 56)}…` : s;
}

function repeatedItemSummary(
  item: Record<string, unknown>,
  fields: ItemFields,
  editLocale: string,
  zh: boolean,
): string {
  for (const f of fields) {
    if (f.type === "image" || f.summary === false) continue;
    const raw = f.bilingual !== false ? getVal(item, f.key, editLocale) : String(item[f.key] ?? "");
    const txt = itemFieldText(raw);
    if (txt) return clip(txt);
  }
  for (const f of fields) {
    if (f.type !== "image") continue;
    const url = String(item[f.key] ?? "").trim();
    if (url) return clip(url.split("/").pop() || url);
  }
  return zh ? "（尚未填寫）" : "(empty)";
}

/** Square icon buttons for the row toolbar. Inline because this file has no
 *  stylesheet of its own and the shared admin CSS is another agent's file. */
const rowToolButtonStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--line, #ddd)",
  borderRadius: 4,
  color: "var(--muted)",
  cursor: "pointer",
  flexShrink: 0,
  fontSize: 12,
  height: 24,
  lineHeight: 1,
  padding: 0,
  width: 24,
};

/**
 * The row chrome every repeated-item list in this file shares: reorder, a delete
 * that asks before it destroys work, and collapse-to-summary.
 *
 * Generic over the row type because a table row is a `string[]`, not a field
 * bag: it still needs exactly this behaviour, and a second copy of it is how the
 * six hand-rolled lists ended up with none of it. Callers describe their row
 * (does it hold anything, what does it say when collapsed, how is it edited) and
 * this owns the rest.
 */
function RepeatedRows<T>({
  items,
  zh,
  onChange,
  addLabel,
  newItem,
  hasContent,
  summary,
  children,
  maxItems,
  noun = DEFAULT_NOUN,
  numbered = false,
  collapsible = true,
}: {
  items: T[];
  zh: boolean;
  onChange: (items: T[], change: ItemsChange) => void;
  addLabel: string;
  newItem: (index: number) => T;
  hasContent: (item: T) => boolean;
  summary: (item: T, index: number) => string;
  children: (item: T, index: number, bodyId: string) => React.ReactNode;
  maxItems?: number;
  noun?: ItemNoun;
  /** Show the 01 / 02 badge a numbered sequence reads by. */
  numbered?: boolean;
  /** Off for grid-shaped rows (a table), where hiding the cells behind a summary
   *  costs a click per row and the row is one line of inputs anyway. */
  collapsible?: boolean;
}) {
  const baseId = useId();
  // Choose the initial state once. Recomputing it from content while typing
  // closes a new row as soon as its first field gains a value.
  // Keep states aligned when rows move or are removed.
  const [openState, setOpenState] = useState<boolean[]>(() => items.map((item) => !hasContent(item)));
  const open = openState.length === items.length ? openState : items.map((item, i) => openState[i] ?? !hasContent(item));
  const isOpen = (i: number) => (collapsible ? open[i] : true);

  const commit = (nextItems: T[], nextOpen: boolean[], change: ItemsChange) => {
    setOpenState(nextOpen);
    onChange(nextItems, change);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const nextItems = [...items];
    [nextItems[i], nextItems[j]] = [nextItems[j], nextItems[i]];
    const nextOpen = [...open];
    [nextOpen[i], nextOpen[j]] = [nextOpen[j], nextOpen[i]];
    commit(nextItems, nextOpen, { kind: "move", from: i, to: j });
  };
  const removeItem = (i: number) => {
    // A row still identical to the one the add button made is not work: a new
    // room is seeded with its 棟別 letter, and asking "delete C棟?" about a row
    // created by the click before is exactly the noise that trains people to
    // dismiss the dialog unread. Compared by value because the seed is rebuilt,
    // not held; a saved row whose keys come back in another order simply asks.
    const pristine = JSON.stringify(items[i]) === JSON.stringify(newItem(i));
    // There is no undo and no version history here, so this dialog is the only
    // thing between a mis-aimed click and retyping a brand's whole entry.
    if (!pristine && hasContent(items[i])) {
      const what = summary(items[i], i);
      const msg = zh
        ? `刪除「${what}」（第 ${i + 1} 個${noun.zh}）？裡面的內容會一併移除，且無法復原。`
        : `Delete "${what}" (${noun.en} ${i + 1})? Its content goes with it and cannot be restored.`;
      if (!window.confirm(msg)) return;
    }
    commit(items.filter((_, j) => j !== i), open.filter((_, j) => j !== i), { kind: "remove", index: i });
  };
  const toggle = (i: number) => setOpenState(open.map((v, j) => (j === i ? !isOpen(i) : v)));

  return (
    <div>
      {items.map((item, i) => {
        const bodyId = `${baseId}-row-${i}`;
        const expanded = isOpen(i);
        const head = (
          <>
            {collapsible && (
              <span aria-hidden="true" style={{ color: "var(--muted)", flexShrink: 0, fontSize: 9 }}>{expanded ? "▼" : "▶"}</span>
            )}
            <span style={{ color: "var(--muted)", flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
              {zh ? `第 ${i + 1} / ${items.length} 個${noun.zh}` : `${noun.en} ${i + 1} of ${items.length}`}
            </span>
            <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {summary(item, i)}
            </span>
          </>
        );
        return (
        <div key={i} className="items-editor-row" style={{ gridTemplateColumns: "1fr", marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
            {collapsible ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={bodyId}
                onClick={() => toggle(i)}
                style={{ alignItems: "center", background: "none", border: 0, color: "var(--ink)", cursor: "pointer", display: "flex", flex: 1, font: "inherit", gap: 6, minWidth: 0, padding: "2px 0", textAlign: "left" }}
              >
                {head}
              </button>
            ) : (
              <span style={{ alignItems: "center", color: "var(--ink)", display: "flex", flex: 1, gap: 6, minWidth: 0, padding: "2px 0" }}>
                {head}
              </span>
            )}
            <button type="button" style={{ ...rowToolButtonStyle, opacity: i === 0 ? 0.35 : 1 }} disabled={i === 0} aria-label={zh ? `${noun.zh} ${i + 1} 上移` : `Move ${noun.en} ${i + 1} up`} onClick={() => move(i, -1)}>&#8593;</button>
            <button type="button" style={{ ...rowToolButtonStyle, opacity: i === items.length - 1 ? 0.35 : 1 }} disabled={i === items.length - 1} aria-label={zh ? `${noun.zh} ${i + 1} 下移` : `Move ${noun.en} ${i + 1} down`} onClick={() => move(i, 1)}>&#8595;</button>
            <button type="button" className="items-editor-remove" style={{ ...rowToolButtonStyle, position: "static" }} aria-label={zh ? `刪除${noun.zh} ${i + 1}` : `Remove ${noun.en} ${i + 1}`} onClick={() => removeItem(i)}>&#10005;</button>
          </div>
          <div id={bodyId} hidden={!expanded}>
            {expanded && numbered && <div className="hpb-step-badge">{String(i + 1).padStart(2, "0")}</div>}
            {expanded && children(item, i, bodyId)}
          </div>
        </div>
        );
      })}
      {(!maxItems || items.length < maxItems) && (
        <button type="button" className="items-editor-add" onClick={() => commit([...items, newItem(items.length)], [...open, true], { kind: "add" })}>
          {addLabel}
        </button>
      )}
    </div>
  );
}

/** Rows of a nested list. A legacy photo list stored bare URL strings; a string
 *  can only be the first field's value, so widen it rather than dropping the row
 *  and losing the photo. Nothing is written back until the author edits, so an
 *  untouched block keeps its stored strings. */
export function normaliseItemRows(raw: unknown, fields: ItemFields): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  const first = fields[0]?.key ?? "value";
  return raw.map((x) =>
    typeof x === "string" ? { [first]: x } : ((x ?? {}) as Record<string, unknown>),
  );
}

export function ItemsEditor({
  items,
  fields,
  zh,
  editLocale,
  onChange,
  addLabel,
  maxItems,
  newItem,
  noun,
  numbered,
}: {
  items: Record<string, unknown>[];
  fields: ItemFields;
  zh: boolean;
  editLocale: string;
  onChange: (items: Record<string, unknown>[], change: ItemsChange) => void;
  addLabel: string;
  maxItems?: number;
  /** The shape a fresh row is saved with. Defaults to {}; lists whose renderer
   *  or whose author expects seeded keys (a room's auto 棟別 letter) pass it. */
  newItem?: (index: number) => Record<string, unknown>;
  noun?: ItemNoun;
  numbered?: boolean;
}) {
  const updateItem = (i: number, patch: Record<string, unknown>) => {
    onChange(items.map((x, j) => (j === i ? patch : x)), { kind: "edit", index: i });
  };

  const renderField = (f: ItemField, item: Record<string, unknown>, i: number, bodyId: string) => {
    if (f.type === "image") {
      return (
        <Field key={f.key} label={f.label}>
          <ImageUploadInput
            value={String(item[f.key] ?? "")}
            onChange={(v) => updateItem(i, { ...item, [f.key]: v })}
          />
        </Field>
      );
    }
    if (f.type === "items") {
      const nestedFields = f.fields ?? [];
      return (
        <div key={f.key} style={{ marginBottom: 10 }}>
          <FieldLabel>{f.label}</FieldLabel>
          <div style={{ marginTop: 6 }}>
            <ItemsEditor
              items={normaliseItemRows(item[f.key], nestedFields)}
              fields={nestedFields}
              zh={zh}
              editLocale={editLocale}
              onChange={(next) => updateItem(i, { ...item, [f.key]: next })}
              addLabel={f.addLabel ?? (zh ? "+ 新增" : "+ Add")}
              newItem={f.newItem}
              noun={f.noun}
            />
          </div>
        </div>
      );
    }
    if (f.type === "url") {
      const raw = String(item[f.key] ?? "");
      // BlockPartners keeps only absolute http(s) hrefs and silently
      // drops everything else, so "www.example.com" saved clean and then
      // rendered an unlinked card. Say so here instead of at render time.
      const bad = raw.trim() !== "" && !/^https?:\/\//i.test(raw.trim());
      const errId = `${bodyId}-${f.key}-error`;
      return (
        <div key={f.key}>
          <Field label={f.label}>
            <input
              type="text"
              value={raw}
              placeholder={f.placeholder ?? "https://www.example.com"}
              aria-invalid={bad}
              aria-describedby={bad ? errId : undefined}
              style={bad ? { borderColor: "#b3261e" } : undefined}
              onChange={(e) => updateItem(i, { ...item, [f.key]: e.target.value })}
            />
          </Field>
          {bad && (
            <p id={errId} style={{ color: "#b3261e", fontSize: 11, lineHeight: 1.5, margin: "-6px 0 10px" }}>
              {zh
                ? "網址要以 https:// 或 http:// 開頭（例如 https://www.example.com）。照現在這樣存檔，卡片會少掉連結。"
                : "The address must start with https:// or http:// (e.g. https://www.example.com). Saved as written, the card renders with no link."}
            </p>
          )}
        </div>
      );
    }
    if (f.type === "decimal") {
      return (
        <Field key={f.key} label={f.label}>
          <input
            type="text"
            inputMode="decimal"
            value={String(item[f.key] ?? "")}
            placeholder={f.placeholder}
            onChange={(e) => updateItem(i, { ...item, [f.key]: e.target.value })}
          />
        </Field>
      );
    }
    if (f.bilingual !== false) {
      if (f.type === "richtext") {
        return (
          <div key={`${f.key}-${editLocale}`} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
            <FieldLabel>{f.label}</FieldLabel>
            <RichTextEditor
              value={getVal(item, f.key, editLocale)}
              onChange={(html) => updateItem(i, setVal(item, f.key, editLocale, html))}
              minRows={4}
              localeKey={editLocale}
            />
          </div>
        );
      }
      return (
        <Field key={`${f.key}-${editLocale}`} label={f.label}>
          {f.type === "textarea" ? (
            <textarea
              rows={3}
              value={getVal(item, f.key, editLocale)}
              placeholder={f.placeholder}
              onChange={(e) => updateItem(i, setVal(item, f.key, editLocale, e.target.value))}
            />
          ) : (
            <input
              type="text"
              value={getVal(item, f.key, editLocale)}
              placeholder={f.placeholder}
              onChange={(e) => updateItem(i, setVal(item, f.key, editLocale, e.target.value))}
            />
          )}
        </Field>
      );
    }
    if (f.type === "icon") {
      /* Same shape as the 亮點 editor's icon row: a select for the drawn set,
         and the free-text box only while the value is not one of them, so an
         emoji already saved keeps working and is still editable. */
      const current = String(item[f.key] ?? "");
      const isDrawn = BADGE_ICON_KEYS.some(([key]) => key === current);
      return (
        <Field key={f.key} label={f.label}>
          <select
            aria-label={f.label}
            value={isDrawn ? current : ""}
            onChange={(e) => updateItem(i, { ...item, [f.key]: e.target.value })}
          >
            <option value="">{zh ? "自訂 emoji →" : "Custom emoji →"}</option>
            {BADGE_ICON_KEYS.map(([key, zhL, enL]) => (
              <option key={key} value={key}>{zh ? zhL : enL}</option>
            ))}
          </select>
          {!isDrawn && (
            <input
              type="text"
              value={current}
              placeholder={f.placeholder}
              onChange={(e) => updateItem(i, { ...item, [f.key]: e.target.value })}
            />
          )}
        </Field>
      );
    }
    if (f.type === "select") {
      return (
        <Field key={f.key} label={f.label}>
          <select
            value={String(item[f.key] ?? "")}
            onChange={(e) => updateItem(i, { ...item, [f.key]: e.target.value })}
          >
            <option value="">—</option>
            {(f.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      );
    }
    return (
      <Field key={f.key} label={f.label}>
        <input
          type="text"
          value={String(item[f.key] ?? "")}
          placeholder={f.placeholder}
          onChange={(e) => updateItem(i, { ...item, [f.key]: e.target.value })}
        />
      </Field>
    );
  };

  // Runs of consecutive inline fields share one line (緯度 beside 經度, the icon
  // box beside the label it belongs to). Grouping here rather than in each form
  // keeps the fields list a single ordered description of the row.
  const groups: ItemFields[] = [];
  for (const f of fields) {
    const last = groups[groups.length - 1];
    if (f.inline && last && last[0].inline) last.push(f);
    else groups.push([f]);
  }

  return (
    <RepeatedRows<Record<string, unknown>>
      items={items}
      zh={zh}
      onChange={onChange}
      addLabel={addLabel}
      maxItems={maxItems}
      newItem={(i) => (newItem ? newItem(i) : {})}
      hasContent={repeatedItemHasContent}
      summary={(item) => repeatedItemSummary(item, fields, editLocale, zh)}
      noun={noun}
      numbered={numbered}
    >
      {(item, i, bodyId) =>
        groups.map((group, gi) =>
          group.length > 1 ? (
            <div
              key={`g${gi}`}
              style={{ display: "grid", gridTemplateColumns: group.map((f) => f.inlineWidth ?? "1fr").join(" "), gap: 8 }}
            >
              {group.map((f) => renderField(f, item, i, bodyId))}
            </div>
          ) : (
            renderField(group[0], item, i, bodyId)
          ),
        )
      }
    </RepeatedRows>
  );
}

/* ── Inline HTML sanitizer ── */

/** Map the legacy "overlap" layout onto the single 拼貼 option that replaced it. */
export function normaliseLayout(layout: unknown): string {
  const v = String(layout ?? "grid");
  return v === "overlap" ? "scatter" : v;
}

/** Feature-highlight rows. The icon is a picker, not free text: the renderer
    resolves the `icon:` keys through FeatureIcon's SVG set, so a typed value
    would silently render nothing. Keys must match FeatureIcon's ICONS map. */
/** The drawn icons FeatureIcon can render, as [key, zh, en]. */
/**
 * The badge icons the editor can pick, in the order they appear in the list.
 *
 * BlockFeatureBadges draws 38 icons keyed by slug and nothing in the admin
 * could write a slug — the 一鍵勾選 amenities write emoji and the free-text box
 * took whatever was typed — so the whole set was decoration nobody could
 * reach. tests/controlHasEffect checks this list against the component's own
 * keys, so an icon added there cannot stay unreachable.
 */
export const BADGE_ICON_KEYS: Array<[string, string, string]> = [
  ["pool", "私人泳池", "Pool"],
  ["pet", "寵物友善", "Pet friendly"],
  ["family", "親子", "Family"],
  ["elderly", "長者友善", "Elder friendly"],
  ["elevator", "電梯", "Elevator"],
  ["parking", "停車", "Parking"],
  ["wifi", "WiFi", "WiFi"],
  ["bbq", "烤肉", "BBQ"],
  ["ktv", "KTV", "KTV"],
  ["chef", "私廚", "Private chef"],
  ["spa", "SPA", "Spa"],
  ["gym", "健身房", "Gym"],
  ["garden", "庭園", "Garden"],
  ["view", "景觀", "View"],
  ["mahjong", "麻將", "Mahjong"],
  ["hotspring", "溫泉", "Hot spring"],
  ["kidpool", "兒童池", "Kids' pool"],
  ["projector", "投影機", "Projector"],
  ["tv", "電視", "TV"],
  ["boardgame", "桌遊", "Board games"],
  ["gaming", "電玩", "Gaming"],
  ["ih", "IH 爐", "Induction hob"],
  ["dishwasher", "洗碗機", "Dishwasher"],
  ["oven", "烤箱", "Oven"],
  ["microwave", "微波爐", "Microwave"],
  ["fridge", "冰箱", "Fridge"],
  ["coffee", "咖啡機", "Coffee"],
  ["minibar", "迷你吧", "Minibar"],
  ["water", "飲水設備", "Drinking water"],
  ["utensils", "餐具", "Utensils"],
  ["outdoor_dining", "戶外用餐", "Outdoor dining"],
  ["crib", "嬰兒床", "Crib"],
  ["bathtub", "浴缸", "Bathtub"],
  ["sterilizer", "消毒鍋", "Steriliser"],
  ["toiletries", "盥洗用品", "Toiletries"],
  ["hairdryer", "吹風機", "Hairdryer"],
  ["firstaid", "急救箱", "First aid"],
  ["extinguisher", "滅火器", "Extinguisher"],
];

export const FEATURE_ICON_KEYS: Array<[string, string, string]> = [
  ["house", "房屋", "House"],
  ["water", "水波／泳池", "Water / pool"],
  ["bed", "床／房型", "Bed"],
  ["sofa", "沙發／起居", "Sofa"],
  ["leaf", "葉／自然", "Leaf"],
  ["paw", "寵物", "Pet"],
  ["pin", "地點", "Location"],
  ["phone", "電話", "Phone"],
  ["mail", "信件", "Mail"],
  ["chat", "訊息", "Chat"],
];

export function GalleryConfigForm({
  c,
  zh,
  editLocale,
  onChange,
  showLayoutOptions = true,
}: {
  c: Record<string, unknown>;
  zh: boolean;
  editLocale: string;
  onChange: (c: Record<string, unknown>) => void;
  showLayoutOptions?: boolean;
}) {
  // Images may be plain URL strings (legacy) or { url, caption } objects. Normalise
  // to objects for editing so the URL field never receives an object (which would
  // render as "[object Object]") and captions stay editable per locale.
  type GImg = { url: string; caption: Record<string, string> };
  const toImg = (it: unknown): GImg => {
    if (typeof it === "string") return { url: it, caption: {} };
    const o = (it ?? {}) as Record<string, unknown>;
    const cap = o.caption;
    return {
      url: String(o.url ?? ""),
      caption: cap && typeof cap === "object" ? (cap as Record<string, string>) : (typeof cap === "string" && cap ? { zh: cap, en: cap } : {}),
    };
  };
  const images: GImg[] = (Array.isArray(c.images) ? c.images : []).map(toImg);

  const update = (next: GImg[]) => {
    onChange({ ...c, images: next });
  };
  const setUrl = (i: number, url: string) => update(images.map((x, j) => (j === i ? { ...x, url } : x)));
  const setCaption = (i: number, val: string) =>
    update(images.map((x, j) => (j === i ? { ...x, caption: { ...x.caption, [editLocale]: val } } : x)));
  // Same reorder-and-guard shape as ItemsEditor: a gallery is a sequence, and
  // rebuilding one by deleting and re-picking is how the order used to be fixed.
  const moveImage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const removeImage = (i: number) => {
    const img = images[i];
    const caption = Object.values(img.caption ?? {}).map((v) => String(v ?? "").trim()).find(Boolean) ?? "";
    const filled = Boolean(img.url.trim() || caption);
    if (filled) {
      const what = caption || img.url.split("/").pop() || img.url;
      const msg = zh
        ? `刪除「${what}」（第 ${i + 1} 張）？無法復原。`
        : `Delete "${what}" (image ${i + 1})? This cannot be undone.`;
      if (!window.confirm(msg)) return;
    }
    update(images.filter((_, j) => j !== i));
  };

  return (
    <div>
      {/* Eight, not twelve. HomePhotoGallery slices to 8, so entries 9-12 could be
          uploaded, saved and never drawn — with nothing to say so. Matching the
          form to the renderer keeps the promise honest without changing what any
          existing page shows. */}
      {/* The block's own caption, under the whole gallery — BlockImageGallery
          draws it and only the per-image caption had a field, so this one could
          not be written at all.
          Behind showLayoutOptions, which is what separates 圖片相簿 from the
          homepage 相片拼貼牆: the latter renders through HomePhotoGallery, which
          takes images/eyebrow/title and no caption. Offered there it would have
          been exactly the kind of dead control this pass exists to remove — the
          form's own field-list test caught it. */}
      {showLayoutOptions && (
        <Field label={zh ? "相簿說明（選填，顯示在整個相簿下方）" : "Gallery caption (optional, under the whole gallery)"}>
          <HeadingInput value={getVal(c, "caption", editLocale)} onChange={v => onChange(setVal(c, "caption", editLocale, v))} />
        </Field>
      )}
      {/* 相片拼貼牆 only: one large photo at a time, or every photo at once. */}
      {!showLayoutOptions && (
        <Field label={zh ? "顯示方式" : "Display"}>
          <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={zh ? "顯示方式" : "Display"}>
            {(["carousel", "wall"] as const).map(mode => {
              const current = c.display === "wall" ? "wall" : "carousel";
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={current === mode}
                  className={`hpb-variant-pick__btn${current === mode ? " is-active" : ""}`}
                  onClick={() => onChange({ ...c, display: mode })}
                >
                  {mode === "wall" ? (zh ? "小圖牆" : "Photo wall") : (zh ? "大圖輪播" : "Large carousel")}
                </button>
              );
            })}
          </div>
        </Field>
      )}
      {/* The cap belongs to 相片拼貼牆 only. HomePhotoGallery slices to 8, so its
          entries 9 and up were uploaded, saved and never drawn. 圖片組 shares this
          form and its renderer (BlockImageGallery) has no cap at all, so the same
          guard took a limit that fits one block and imposed it on another —
          showLayoutOptions is what tells the two apart everywhere else here. */}
      <FieldLabel>
        {showLayoutOptions
          ? (zh ? "圖片" : "Images")
          : (zh ? "圖片（最多 8 張）" : "Images (up to 8)")}
      </FieldLabel>
      <div style={{ marginTop: 8, marginBottom: 10 }}>
        {images.map((img, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--line, #eee)" }}>
            <div className="items-editor-row" style={{ gridTemplateColumns: "1fr auto" }}>
              <ImageUploadInput value={img.url} onChange={(v) => setUrl(i, v)} />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{zh ? `第 ${i + 1} 張` : `#${i + 1}`}</span>
                <button type="button" style={{ ...rowToolButtonStyle, opacity: i === 0 ? 0.35 : 1 }} disabled={i === 0} aria-label={zh ? `第 ${i + 1} 張圖片上移` : `Move image ${i + 1} up`} onClick={() => moveImage(i, -1)}>&#8593;</button>
                <button type="button" style={{ ...rowToolButtonStyle, opacity: i === images.length - 1 ? 0.35 : 1 }} disabled={i === images.length - 1} aria-label={zh ? `第 ${i + 1} 張圖片下移` : `Move image ${i + 1} down`} onClick={() => moveImage(i, 1)}>&#8595;</button>
                <button type="button" className="items-editor-remove" style={{ ...rowToolButtonStyle, position: "static" }} aria-label={zh ? `刪除圖片 ${i + 1}` : `Remove image ${i + 1}`} onClick={() => removeImage(i)}>
                  &#10005;
                </button>
              </div>
            </div>
            <input
              type="text"
              value={String(img.caption[editLocale] ?? "")}
              onChange={(e) => setCaption(i, e.target.value)}
              placeholder={zh ? "圖片說明（選填）" : "Caption (optional)"}
              style={{ fontSize: 12 }}
            />
          </div>
        ))}
        {(showLayoutOptions || images.length < 8) && (
          <button type="button" className="items-editor-add" onClick={() => update([...images, { url: "", caption: {} }])}>
            {zh ? "+ 新增圖片" : "+ Add image"}
          </button>
        )}
      </div>
      {showLayoutOptions && (
        <Field label={zh ? "排版" : "Layout"}>
          {/* "overlap" is the legacy value for 拼貼 — show it as the same option
              so pre-redesign blocks don't render this select blank. */}
          <select value={normaliseLayout(c.layout)} onChange={(e) => onChange({ ...c, layout: e.target.value })}>
            <option value="grid">{zh ? "網格" : "Grid"}</option>
            <option value="carousel">{zh ? "輪播（左右滑動）" : "Carousel (scroll with arrows)"}</option>
            <option value="scatter">{zh ? "拼貼（桌面散落／手機重疊）" : "Collage (scatter desktop / overlap mobile)"}</option>
            <option value="collage">{zh ? "主圖拼貼（首圖放大）" : "Feature (large first image)"}</option>
            <option value="centered">{zh ? "置中小圖" : "Centered (smaller)"}</option>
          </select>
        </Field>
      )}
      {showLayoutOptions && String(c.layout ?? "grid") === "centered" && (
        <Field label={zh ? "置中寬度" : "Centered width"}>
          <select value={String(c.galleryWidth ?? "medium")} onChange={(e) => onChange({ ...c, galleryWidth: e.target.value })}>
            <option value="narrow">{zh ? "窄（560px）" : "Narrow (560px)"}</option>
            <option value="medium">{zh ? "中（760px）" : "Medium (760px)"}</option>
            <option value="wide">{zh ? "寬（960px）" : "Wide (960px)"}</option>
          </select>
        </Field>
      )}
      {/* 拼貼 has no columns to set. Each count from 1 to 6 is a hand-composed
          arrangement — the tiles are placed by `grid-column`/`grid-row` (or, at
          five images, absolutely) inside a container whose own
          `grid-template-columns` the composition depends on. The number chosen
          here was silently dropped for that layout, and honouring it would mean
          overwriting the composition's own column track with an inline style and
          scattering the placements. Offering the field at all was the mistake;
          the other four layouts read it exactly as before. */}
      {showLayoutOptions && normaliseLayout(c.layout) !== "scatter" && (
        <Field label={zh ? "欄數" : "Columns"}>
          <select value={String(c.columns ?? "2")} onChange={(e) => onChange({ ...c, columns: Number(e.target.value) })}>
            {/* 1 shows one image per row at full width — the single-image
                treatment needs it and the list started at 2. */}
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </Field>
      )}
      {/* Withdrawn on 拼貼 for the same reason 欄數 is, one field up: each
          arrangement places its tiles absolutely with explicit width/height, and
          the composition's own rules outrank .has-card-ratio, so a chosen ratio
          moved no tile there. A one-image collage takes 16/9 by design and the
          rest cannot take a ratio at all. */}
      {showLayoutOptions && normaliseLayout(c.layout) !== "scatter" && (
        <Field label={zh ? "卡片比例" : "Card ratio"}>
          <select value={String(c.cardRatio ?? "")} onChange={(e) => onChange({ ...c, cardRatio: e.target.value })}>
            {/* Blank keeps each photo's own shape, which is how every existing
                block already renders — so this stays opt-in. */}
            <option value="">{zh ? "原始比例" : "Original"}</option>
            <option value="4:3">{zh ? "4:3 橫式" : "4:3 landscape"}</option>
            <option value="3:2">{zh ? "3:2 橫式" : "3:2 landscape"}</option>
            <option value="16:9">{zh ? "16:9 寬幅" : "16:9 wide"}</option>
            <option value="1:1">{zh ? "1:1 正方形" : "1:1 square"}</option>
            <option value="3:4">{zh ? "3:4 直式" : "3:4 portrait"}</option>
          </select>
        </Field>
      )}
      {/* Only meaningful when this block is paired beside another one. Off by
          default: the picture keeps its own height and sits centred against
          its neighbour, which is how every existing block already renders.

          Inside the layout-options guard like everything above it: this is the
          only switch that sat outside, so the 相片拼貼牆 (gallery) — the one
          caller that passes showLayoutOptions={false} — offered it too. That
          block renders as .home-gallery-section, and the rule behind the switch
          is scoped to .property-block-pair .property-image-gallery, so ticking
          it there changed nothing on the page and never could.

          It stays on 圖片相簿 (image_gallery), the block the rule was written
          for — though measured on the live page it is inert there too for a
          different, fixable reason: an earlier rule gives
          `.property-block-pair .property-image-gallery-grid` height: 100%
          unconditionally, so the unticked state already fills the column and
          the switch has nothing left to turn on. Dropping the grid from that
          selector makes it work; that is a globals.css change and not this
          file's to make. */}
      {showLayoutOptions && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={c.fill_height === true}
            onChange={(e) => onChange({ ...c, fill_height: e.target.checked })}
          />
          <span>{zh ? "並排時圖片填滿欄高（自適應填充）" : "Fill the column height when paired"}</span>
        </label>
      )}
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={(v) => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題（選填）" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={(v) => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
    </div>
  );
}

/* ── Block schematic thumbnail ── */

/* ── Contact info (交通聯繫) ─────────────────────────────────────────
   The page-management version, which is the complete one: the homepage copy
   offered a "map_url" field that BlockContactInfo never reads (it reads
   map_embed), so setting it did nothing at all. */

export function ContactInfoConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  const plain = (label: string, key: string, rows = 0) => (
    <Field key={key} label={label}>
      {rows ? (
        <textarea rows={rows} value={String(c[key] ?? "")} onChange={(e) => onChange({ ...c, [key]: e.target.value })} />
      ) : (
        <input type="text" value={String(c[key] ?? "")} onChange={(e) => onChange({ ...c, [key]: e.target.value })} />
      )}
    </Field>
  );
  const bilingual = (label: string, key: string, rows = 0) => (
    <Field key={`${key}-${editLocale}`} label={label}>
      {rows ? (
        <textarea rows={rows} value={getVal(c, key, editLocale)} onChange={(e) => onChange(setVal(c, key, editLocale, e.target.value))} />
      ) : (
        /* HeadingInput, not <input>. This block builds its fields through this
           helper, so the conversion that made every other block's 眉批/標題 able
           to hold a typed line break skipped all of them — an input cannot
           contain a newline at all. 地址 wants the same: a street address is
           routinely written over two lines. */
        <HeadingInput
          value={getVal(c, key, editLocale)}
          onChange={(v) => onChange(setVal(c, key, editLocale, v))}
        />
      )}
    </Field>
  );

  return (
    <div>
      {/* 「三張卡片（Reach / 地址 / 如何抵達）」 described one of the two
          renderers. PageBlocks sends this value to its own ContactInfo, which
          draws a labelled TEL / MAIL / LINE / ADDRESS row — /contact is designed
          around that treatment and it is deliberate — while BlockContactInfo on
          a villa page draws the numbered cards the label named. Only 經典 is
          the same drawing on both. The stored value stays `cards`; the option
          and the hint stop promising a villa layout on a group page. */}
      <Field label={zh ? "版型" : "Layout"}>
        <select value={String(c.layout ?? "cards")} onChange={(e) => onChange({ ...c, layout: e.target.value })}>
          <option value="cards">{zh ? "卡片（預設）" : "Cards (default)"}</option>
          <option value="classic">{zh ? "經典（資訊欄＋側邊地圖）" : "Classic (info column + side map)"}</option>
        </select>
        <p className="hpb-field-hint">
          {zh
            ? "「卡片」在民宿頁是三張卡片（Reach／地址／如何抵達），在站群頁面則畫成標示式的聯絡列（TEL／MAIL／LINE／ADDRESS）。「經典」兩邊都是資訊欄＋側邊地圖。"
            : "“Cards” draws three cards (Reach / Address / How to arrive) on a villa page, and a labelled contact row (TEL / MAIL / LINE / ADDRESS) on a group page. “Classic” is the info column with a side map on both."}
        </p>
      </Field>
      {bilingual(zh ? "眉批（選填）" : "Eyebrow", "eyebrow")}
      {bilingual(zh ? "標題" : "Title", "title")}
      {bilingual(zh ? "地址" : "Address", "address")}
      {plain(zh ? "電話" : "Phone", "phone")}
      {plain("Email", "email")}
      {plain("LINE", "line")}
      <Field label={zh ? "Google Map 嵌入碼" : "Google Map embed code"}>
        <textarea rows={3} style={{ fontFamily: "monospace", fontSize: 11 }} value={String(c.map_embed ?? "")} onChange={(e) => onChange({ ...c, map_embed: e.target.value })} />
      </Field>
      {bilingual(zh ? "交通指引" : "Directions", "directions", 4)}
      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 12px", fontSize: 13 }}>
        <input
          type="checkbox"
          checked={c.show_primary !== false}
          onChange={(e) => onChange({ ...c, show_primary: e.target.checked })}
        />
        <span>{zh ? "顯示上方中央聯絡資訊卡（電話／Email／LINE）" : "Show the central contact card (phone / email / LINE)"}</span>
      </label>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
        {zh
          ? "關掉後上面欄位仍會保留，只是不顯示；通訊處列表不受影響。列了通訊處的頁面通常不需要它。"
          : "Turning this off keeps the values above, it only hides the card. The office list is unaffected."}
      </p>
      <FieldLabel>{zh ? "通訊處（可多個：台北 / 台南 / 台東…）" : "Offices (add several)"}</FieldLabel>
      <div style={{ marginTop: 8 }}>
        <ItemsEditor
          items={Array.isArray(c.offices) ? (c.offices as Record<string, unknown>[]) : []}
          fields={[
            { key: "name", label: zh ? "名稱（例：台北通訊處）" : "Name" },
            { key: "phone", label: zh ? "電話" : "Phone", bilingual: false },
            /* Each 通訊處 carries its own address — a branch that answers its
               own mail was asked for alongside its own phone, and only the
               one central address existed. */
            { key: "email", label: zh ? "Email" : "Email", bilingual: false },
            /* Each office can carry its own official account — 客戶: 因為我們最近
               在徵才，就會放徵才中心的 LINE. lineUrl() takes either an @handle or
               a full URL, so the field accepts whichever the editor has. */
            { key: "line", label: "LINE", bilingual: false, placeholder: "@example" },
            { key: "address", label: zh ? "地址" : "Address", type: "textarea" },
            /* Optional. Everything else is on the row itself, so this is the
               only thing a 通訊處 can expand to show — fill it in and the row
               gets a disclosure arrow; leave it blank and there is none,
               rather than an arrow that opens onto nothing. */
            { key: "note", label: zh ? "展開說明（選填：服務時間、交通…）" : "Expanded note (optional)", type: "textarea" },
          ]}
          zh={zh}
          editLocale={editLocale}
          onChange={(offices) => onChange({ ...c, offices })}
          addLabel={zh ? "+ 新增通訊處" : "+ Add office"}
        />
      </div>
    </div>
  );
}

/* ── Nearby spots (周邊景點) ─────────────────────────────────────── */

export function AttractionsConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={(v) => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題" : "Heading"}>
        <HeadingInput value={getVal(c, "heading", editLocale)} onChange={(v) => onChange(setVal(c, "heading", editLocale, v))} />
      </Field>
      {/* The renderer has always read a caption; it just had no field. */}
      <Field label={zh ? "說明（選填）" : "Caption (optional)"}>
        <textarea rows={4} value={getVal(c, "caption", editLocale)} onChange={(e) => onChange(setVal(c, "caption", editLocale, e.target.value))} />
      </Field>
      <FieldLabel>{zh ? "景點項目" : "Attractions"}</FieldLabel>
      <div style={{ marginTop: 8 }}>
        <ItemsEditor
          items={Array.isArray(c.items) ? (c.items as Record<string, unknown>[]) : []}
          fields={[
            { key: "image", label: zh ? "照片" : "Photo", type: "image" },
            { key: "name", label: zh ? "名稱" : "Name" },
            { key: "meta", label: zh ? "地區 / 距離（選填）" : "Area / distance (optional)" },
            { key: "desc", label: zh ? "簡介（選填）" : "Note (optional)", type: "textarea" },
            { key: "link", label: zh ? "連結（選填）" : "Link (optional)", bilingual: false },
          ]}
          zh={zh}
          editLocale={editLocale}
          onChange={(items) => onChange({ ...c, items })}
          addLabel={zh ? "+ 新增景點" : "+ Add attraction"}
        />
        {/* The 連結 field used to accept only http(s):// and dropped anything
            else without a word — a card given a site path simply stopped being
            clickable, with nothing on the form to explain why. It takes both
            now, and this says so, because a bare text box was how the silent
            drop went unnoticed. */}
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
          {zh
            ? "連結可填完整網址（https://，會另開分頁），或站內路徑（例如 /stays/hejing）與頁內錨點（例如 #rooms），站內連結在同分頁開啟。"
            : "A link can be a full https:// URL, which opens in a new tab, or a path on this site such as /stays/hejing or an anchor such as #rooms, which open in the same tab."}
        </p>
      </div>
    </div>
  );
}

/* ── FAQ accordion ──────────────────────────────────────────────── */

export function FaqConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={(v) => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={(v) => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      <FieldLabel>{zh ? "問答項目" : "FAQ Items"}</FieldLabel>
      <div style={{ marginTop: 8 }}>
        <ItemsEditor
          items={Array.isArray(c.items) ? (c.items as Record<string, unknown>[]) : []}
          fields={[
            { key: "question", label: zh ? "問題" : "Question" },
            { key: "answer", label: zh ? "回答" : "Answer", type: "richtext" },
          ]}
          zh={zh}
          editLocale={editLocale}
          onChange={(items) => onChange({ ...c, items })}
          addLabel={zh ? "+ 新增問答" : "+ Add FAQ item"}
        />
      </div>
    </div>
  );
}

/* ── Pathways (探索路徑) ─────────────────────────────────────────── */

export function PathwaysConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={(v) => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題（選填）" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={(v) => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      <Field label={zh ? "說明（選填）" : "Intro"}>
        <textarea rows={3} value={getVal(c, "intro", editLocale)} onChange={(e) => onChange(setVal(c, "intro", editLocale, e.target.value))} />
      </Field>
      <FieldLabel>{zh ? "路徑卡片（留空則使用預設）" : "Pathway items (leave empty for defaults)"}</FieldLabel>
      <div style={{ marginTop: 8 }}>
        <ItemsEditor
          items={Array.isArray(c.items) ? (c.items as Record<string, unknown>[]) : []}
          fields={[
            { key: "image", label: zh ? "圖片（選填）" : "Image", type: "image" },
            { key: "title", label: zh ? "標題" : "Title" },
            { key: "description", label: zh ? "說明（選填）" : "Description" },
            { key: "href", label: zh ? "連結" : "Link href", bilingual: false },
          ]}
          zh={zh}
          editLocale={editLocale}
          onChange={(items) => onChange({ ...c, items })}
          addLabel={zh ? "+ 新增路徑卡片" : "+ Add pathway card"}
        />
      </div>
    </div>
  );
}

export const STAYS_VARIANTS: Array<[string, string, string]> = [
  ["grid",    "網格", "Grid"],
  ["list",    "列表", "List"],
  ["compact", "緊湊", "Compact"],
  ["feature", "精選大圖", "Featured"],
  ["index",   "編號列表", "Numbered"],
  ["news",    "最新消息卡", "News Cards"],
];

export function StaysConfigForm({
  c,
  zh,
  editLocale,
  onChange,
  contentSources,
  contentTags = [],
  siteSlug = "",
}: {
  c: Record<string, unknown>;
  zh: boolean;
  editLocale: string;
  onChange: (c: Record<string, unknown>) => void;
  contentSources: ContentSource[];
  contentTags?: ManagedTagOption[];
  /** Needed to list the entries a manual pick chooses from. */
  siteSlug?: string;
}) {
  const source = String(c.source ?? "stays");
  const variant = String(c.variant ?? "grid");
  /* Extras beyond the primary source. `extra_sources` is filtered against the
     primary on read (BlockStays.tsx), so count it the same way here rather
     than trusting its length — a stale duplicate would otherwise read as a
     second source and hide the tag picker on a single-source block. */
  const extraSources = (Array.isArray(c.extra_sources) ? (c.extra_sources as unknown[]) : [])
    .map((s) => String(s).trim())
    .filter((s) => s && s !== source);
  const extraSourceCount = extraSources.length;
  /* 手動 with nothing ticked yet is not manual on the page: BlockStays takes the
     automatic path whenever picked_ids is empty (`manual = pick_mode ===
     "manual" && pickedIds.length > 0`). Gating the count and the category filter
     on the dropdown alone therefore withdrew them at exactly the moment they
     were still the only things deciding what the block shows — the panel said
     the entries had been chosen by hand while the page went on drawing the
     newest N by a number nobody could see. */
  const pickedCount = (Array.isArray(c.picked_ids) ? (c.picked_ids as unknown[]) : [])
    .filter((n) => Number.isFinite(n)).length;
  const isStays = source === "stays";
  const filterBy = c.filter_by === "tags" || c.filter_by === "category" ? c.filter_by : extraSourceCount > 0 ? "category" : "tags";
  /* The two gates below read in several places, and they were spelled out at
     each one. Named once so a change to either cannot land on the count and
     miss the filter. */
  const stillAutomatic = String(c.pick_mode ?? "auto") !== "manual" || pickedCount === 0;
  const sourceLabel = (val: string, displayLocale = (zh ? "zh" : "en")) => {
    const found = contentSources.find(([v]) => v === val);
    return found ? (displayLocale === "zh" ? found[1] : found[2]) : val;
  };
  const sourceNames = [source, ...extraSources].map((value) => sourceLabel(value)).join(zh ? "、" : ", ");
  const topicNames = contentFilterTags(c);
  const visitorFilters = !["feature", "index"].includes(variant) && (variant === "news" || c.show_filter === true);
  const cardLabels = !["feature", "index"].includes(variant) && (variant === "news" || c.show_tags === true);
  const presets = isStays ? [
    { label: zh ? "住宿大圖" : "Featured stays", hint: zh ? "逐筆大圖介紹" : "Large images and details", config: { variant: "feature", rail: false } },
    { label: zh ? "住宿網格" : "Stay grid", hint: zh ? "並排瀏覽住宿" : "Browse stays side by side", config: { variant: "grid", rail: false } },
  ] : [
    { label: zh ? "消息輪播" : "News carousel", hint: zh ? "卡片輪播，依顯示頁面篩選" : "Scrolling cards with listing filters", config: { variant: "news", rail: true, filter_by: "category", show_tags: true, show_filter: true } },
    { label: zh ? "主題文章" : "Topic articles", hint: zh ? "網格卡片，依主題篩選" : "Grid cards with topic filters", config: { variant: "grid", rail: false, filter_by: "tags", show_tags: true, show_filter: true } },
    { label: zh ? "簡潔列表" : "Simple list", hint: zh ? "直式文章清單，沒有標籤列" : "Vertical entries without label rows", config: { variant: "index", rail: false } },
  ];
  const effectiveSettings: Record<string, unknown> = { ...c, variant, rail: !["feature", "index"].includes(variant) && c.rail === true, filter_by: filterBy, show_tags: cardLabels, show_filter: visitorFilters };
  const matchesPreset = (settings: Record<string, unknown>) => Object.entries(settings).every(([key, value]) => effectiveSettings[key] === value);
  const matchingPreset = presets.find((preset) => matchesPreset(preset.config));
  return (
    <div>
      <section className="hpb-collection-summary" aria-label={zh ? "目前收錄與顯示設定" : "Current collection settings"}>
        <strong>{zh ? "這個區塊目前如何顯示？" : "How will this section appear?"}</strong>
        <p className="hpb-field-hint" role="status">{matchingPreset ? (zh ? `目前配置：${matchingPreset.label}` : `Current layout: ${matchingPreset.label}`) : (zh ? "目前配置：自訂配置。各項設定依下方摘要顯示，可繼續調整或套用常用配置。" : "Current layout: custom. The summary below reflects your settings. Keep adjusting or apply a common layout.")}</p>
        <dl>
          <div><dt>{zh ? "內容來自" : "Sources"}</dt><dd>{sourceNames}</dd></div>
          <div><dt>{zh ? "版面" : "Layout"}</dt><dd>{STAYS_VARIANTS.find(([value]) => value === variant)?.[zh ? 1 : 2] ?? variant}{c.rail === true && !["feature", "index"].includes(variant) ? (zh ? "（內容足夠時橫向捲動）" : " (scrolls with enough entries)") : ""}</dd></div>
          <div><dt>{zh ? "區塊標題" : "Section title"}</dt><dd>{getVal(c, "headline", editLocale) || (zh ? "未設定自訂標題" : "No custom title")}</dd></div>
          <div><dt>{zh ? "收錄內容" : "Included entries"}</dt><dd>{!stillAutomatic ? (zh ? `手動選擇 ${pickedCount} 筆` : `${pickedCount} manually selected`) : (!isStays && topicNames.length ? (zh ? `符合任一主題：${topicNames.join("、")}` : `Any topic: ${topicNames.join(", ")}`) : (zh ? "來源中的可公開內容" : "Public entries in the sources"))}{stillAutomatic && <small>{zh ? `依排序每個來源最多 ${String(c.limit ?? 6)} 筆，重複文章只顯示一次` : `Up to ${String(c.limit ?? 6)} per source by sort order; duplicates appear once`}</small>}</dd></div>
          <div><dt>{zh ? "訪客篩選" : "Visitor filters"}</dt><dd>{visitorFilters ? (isStays ? (zh ? "依住宿標籤" : "By stay tags") : filterBy === "category" ? (zh ? "依顯示頁面" : "By listing page") : (zh ? "依主題標籤" : "By topic")) : (zh ? "不顯示篩選按鈕" : "No filter buttons")}</dd></div>
          <div><dt>{zh ? "卡片標籤" : "Card labels"}</dt><dd>{cardLabels ? (isStays ? (zh ? "依住宿設定" : "From each stay’s settings") : (zh ? "依各篇文章的卡片設定" : "From each article’s card settings")) : (zh ? "此版面不顯示" : "Hidden in this layout")}</dd></div>
        </dl>
      </section>
      <details className="hpb-collection-presets">
        <summary>{zh ? "使用常用配置" : "Use a common layout"} <small>{matchingPreset?.label ?? (zh ? "自訂配置" : "Custom")}</small></summary>
        <p>{zh ? "只調整版面與訪客篩選；保留已選來源、文章與主題。套用後可繼續微調，儲存才會更新網站。" : "Changes layout and visitor filters only. Keeps sources, selected entries and topics. Adjust further before saving to update the site."}</p>
        <div>{presets.map((preset) => {
          const active = matchesPreset(preset.config);
          return <button key={preset.label} type="button" aria-pressed={active} className={active ? "is-active" : undefined} onClick={() => onChange({ ...c, ...preset.config })}><strong>{preset.label}</strong><span>{preset.hint}</span><small>{active ? (zh ? "目前使用此配置" : "Current layout") : (zh ? "套用配置" : "Apply layout")}</small></button>;
        })}</div>
      </details>
      {/* Keep inclusion visible; the summary exposes layout and text while their controls are folded. */}
      <FoldSection title={zh ? "來源與數量" : "Source & count"} defaultOpen>
        <p className="hpb-field-hint">{zh ? "先選文章來自哪些頁面，再挑選內容。卡片文字在各篇文章內管理。" : "Choose listing pages, then select entries. Manage card labels within each article."}</p>
        <SourcesPicker
          contentSources={contentSources}
          zh={zh}
          source={source}
          extra={Array.isArray(c.extra_sources) ? (c.extra_sources as string[]) : []}
          onChange={(src, extra) => onChange({
            ...c,
            source: src,
            extra_sources: extra,
            filter_by: filterBy,
            // Ids picked under the old sources mean nothing under the new ones;
            // left in place they resolve to unrelated entries rather than fail.
            picked_ids: [],
          })}
        />
        {/* 挑選方式 comes before the count and the filter because it decides
            whether either of them applies at all. Underneath them, switching it
            to 手動 and ticking an entry made the two fields ABOVE it vanish —
            the panel appeared to lose settings in response to a change made
            below them, which reads as a bug rather than as a rule. */}
        <Field label={zh ? "挑選方式" : "How entries are chosen"}>
          <select
            value={String(c.pick_mode ?? "auto")}
            onChange={(e) => onChange({ ...c, pick_mode: e.target.value })}
          >
            <option value="auto">{zh ? "自動：依排序取前 N 篇" : "Automatic: top N by sort order"}</option>
            <option value="manual">{zh ? "手動：自行挑選文章" : "Manual: pick entries yourself"}</option>
          </select>
        </Field>
        {String(c.pick_mode ?? "auto") === "manual" && (
          <EntryPicker
            sources={contentSources.filter(([val]) =>
              val === source || (Array.isArray(c.extra_sources) && (c.extra_sources as string[]).includes(val)))}
            siteSlug={siteSlug}
            locale={editLocale}
            zh={zh}
            selected={Array.isArray(c.picked_ids) ? (c.picked_ids as number[]) : []}
            onChange={(ids) => onChange({ ...c, picked_ids: ids })}
          />
        )}
        {/* Manual picking shows exactly what was ticked, so the count is not
            applied — see the manual branch in BlockStays. Until something IS
            ticked, that branch is not taken and the count still decides the row,
            so the field stays. */}
        {stillAutomatic && (
        <Field label={isStays
          ? (zh ? "顯示數量" : "How many to show")
          : (zh ? "每個來源顯示數量" : "Count per source")}>
          <input
            type="number"
            min={1}
            max={30}
            value={String(c.limit ?? 6)}
            onChange={e => onChange({ ...c, limit: Math.max(1, Number(e.target.value) || 1) })}
          />
          {/* 住宿目錄 cannot be held together with a category (SourcesPicker
              clears one when the other is picked), so "每個來源" there always
              means the one source — a multiplication the editor can never
              perform, described as though they could. */}
          <p className="hpb-field-hint">
            {zh
              ? isStays
                ? "最多顯示幾筆住宿。住宿目錄不能和文章分類混用，所以這裡只會有一個來源。"
                : "每個頁面各取此數量；同一篇文章只顯示一次，去重後總數可能較少。"
              : isStays
                ? "How many stays to show. The catalogue cannot be combined with article categories, so there is only ever one source here."
                : "Applied to each listing. Duplicate articles appear once, so the final total may be lower."}
          </p>
        </Field>
        )}
        {/* Read only where it does something: the 住宿目錄 branch never looks at
            filter_tag, and manual picking deliberately bypasses it (the choice is
            the filter). Shown unconditionally it saved and did nothing in both.
            「Manual」 with nothing ticked is still the automatic branch, so the
            filter is offered there — same rule as the count above. */}
        {!isStays && stillAutomatic && (
        <>
          <ContentTagFilterPicker
            sources={[source, ...extraSources]}
            siteSlug={siteSlug}
            locale={editLocale}
            zh={zh}
            contentTags={contentTags}
            value={contentFilterTags(c)}
            onChange={(tags) => onChange({ ...c, filter_tags: tags })}
          />
          {/* 分類過濾 and 要顯示的標籤 are both about tags and neither label said
              which end it acts on: one decides WHICH ENTRIES are collected, the
              other only which tags are PRINTED. */}
          <p className="hpb-field-hint" style={{ marginTop: -6, marginBottom: 12 }}>
            {zh
              ? "這裡決定「哪些文章會出現」。例如選擇「親子」，只收錄來源中帶有親子主題的文章。可複選，符合任一主題即可；留空則不限制主題。卡片印出的標籤在各篇文章內設定。"
              : "This decides which articles appear. For example, Family includes only articles with that topic. Any selected topic matches; leave empty for no topic restriction. Choose printed labels in each article."}
          </p>
        </>
        )}
      </FoldSection>
      <FoldSection title={zh ? "版面" : "Layout"}>
        <Field label={zh ? "排版樣式" : "Layout variant"}>
          {/* Only the layouts this source can actually draw. 精選大圖 is built
              from the stay catalogue; 最新消息卡 and 編號列表 are built from CMS
              pages. Offered against the other source they fell through to a row
              with a class no stylesheet defines, so the button appeared selected
              and the page looked exactly like 網格 — the setting saved and did
              nothing. The list comes from the same helper the renderer falls back
              through, so the two cannot drift apart. */}
          <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={zh ? "排版樣式" : "Layout variant"}>
            {STAYS_VARIANTS.filter(([val]) => staysVariantsFor(source === "stays").includes(val)).map(([val, zhL, enL]) => (
              <button
                key={val}
                type="button"
                role="radio"
                aria-checked={variant === val}
                className={`hpb-variant-pick__btn${variant === val ? " is-active" : ""}`}
                onClick={() => onChange({ ...c, variant: val })}
              >
                {zh ? zhL : enL}
              </button>
            ))}
          </div>
          <p className="hpb-field-hint">
            {zh
              ? isStays
                ? "「精選大圖」每一筆都是大圖＋詳情，適合主打住宿。顯示幾筆由上方「來源與數量」裡的數量決定。（「最新消息卡」與「編號列表」只適用於文章分類，選了文章來源才會出現。）"
                : "「編號列表」適合內容集合（如旅誌），「最新消息卡」帶分類篩選。顯示幾筆由上方「來源與數量」裡的數量決定。（「精選大圖」只適用於住宿目錄。）"
              : isStays
                ? "“Featured” gives every item a large image and details. The count under Source & count above sets how many show. (“News cards” and “Numbered” are drawn from article categories and appear when one is selected.)"
                : "“Numbered” suits content collections such as the Journal, and “News cards” carries the category filter. The count under Source & count above sets how many show. (“Featured” is drawn from the stay catalogue.)"}
          </p>
        </Field>
        {/* 精選大圖 draws its own showcase and returns before any of this is
            reached, so the row and tag controls below saved values the layout
            never read (客戶: 檢查所有 block 的設置是否生效). Hidden rather than
            left to look available. */}
        {variant === "feature" ? (
          <p className="hpb-field-hint" style={{ marginTop: 10 }}>
            {zh
              ? "「精選大圖」有自己的版面（每筆大圖＋照片輪播），因此不提供「橫向捲動」與標籤設定。需要那些請改用其他排版樣式。"
              : "“Featured” has a layout of its own — a large image and photo carousel per entry — so the card row and tag controls do not apply. Pick another layout for those."}
          </p>
        ) : variant === "index" ? (
          /* 編號列表 is a vertical numbered list. .is-rail sets display/overflow but
             never flex-direction, so the column stayed a column and every row took
             a 240-320px flex basis as its HEIGHT, with no horizontal scroll — the
             tick visibly broke the block rather than doing nothing. Tags are a
             separate matter: the index rows draw none and the chip row excludes
             this variant, so both switches were inert here too. */
          <p className="hpb-field-hint" style={{ marginTop: 10 }}>
            {zh
              ? "「編號列表」是直式的編號清單，沒有卡片列，因此不提供「橫向捲動」與標籤設定。需要那些請改用「網格」或「最新消息卡」。"
              : "“Numbered index” is a vertical list rather than a card row, so the side-scroll and tag controls do not apply. Use 網格 or 最新消息卡 for those."}
          </p>
        ) : (
        /* 「排列方式」 and 「排版樣式」 above it were near-synonyms in Chinese —
           two labels that read the same for a six-way layout choice and a single
           tick. The tick is named after what it does; the stored key stays
           `rail`, so nothing saved changes. */
        <Field label={zh ? "橫向捲動" : "Side-scroll"}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={c.rail === true}
              onChange={(e) => onChange({ ...c, rail: e.target.checked })}
              style={{ width: "auto" }}
            />
            <span>{zh ? "排成一列，可左右捲動" : "One row, scrolling sideways"}</span>
          </label>
          {/* The three-entry floor, in the hint rather than in a gate on the
              control. BlockStays drops the rail under three cards (`shortRow`)
              because one or two cards in a scrolling row is a narrow card
              against an empty strip — deliberate, and the tick on a two-card
              row produces byte-identical markup. How many entries the row will
              hold is data, resolved at render time from the source and the
              count, so the editor cannot know it while you are editing: say the
              condition instead of hiding the control on a guess. */}
          <p className="hpb-field-hint">
            {zh
              ? "內容變多時不會把頁面往下拉長，適合最新消息。關閉則照原本的網格換行排列。這一列至少要有三筆才會生效：只有一、兩筆時沒有東西可捲，會維持原本的短列版面。"
              : "Keeps a growing section from stretching the page downward — suits 最新消息. Off wraps into the usual grid. Takes effect from three entries up: with one or two there is nothing to scroll, so the row keeps its short-row layout."}
          </p>
        </Field>
        )}
        {/* 標籤 — the news variant has always printed a category and (since the
            filter was added) offered chips. These bring the same CMS tags to the
            other variants, which showed nothing at all. Both off by default.
            Withheld on 精選大圖, which returns before reading either. */}
        {!["feature", "index"].includes(variant) && (
        <div className="hpb-field" role="group" aria-label={zh ? "卡片標籤與訪客篩選" : "Card labels and visitor filters"}>
          <FieldLabel>{zh ? "卡片標籤與訪客篩選" : "Card labels and visitor filters"}</FieldLabel>
          {/* 最新消息卡 prints the entry tags unconditionally and brings its own
              chip row, so both switches saved a value it never read. The picker
              below is a different matter — visibleTags() narrows those same tags
              by picked_tags on every variant, news included — so it stays. */}
          {variant !== "news" && (<>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={c.show_tags === true}
              onChange={(e) => onChange({ ...c, show_tags: e.target.checked })}
              style={{ width: "auto" }}
            />
            <span>{zh ? "在卡片上顯示標籤" : "Show tags on the cards"}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={c.show_filter === true}
              onChange={(e) => onChange({ ...c, show_filter: e.target.checked })}
              style={{ width: "auto" }}
            />
            <span>{zh ? "顯示分類篩選按鈕" : "Show the category filter chips"}</span>
          </label>
          </>)}
          {!isStays && <div className="hpb-field">
            <span>{zh ? "訪客看到哪種篩選按鈕？" : "Which filter buttons will visitors see?"}</span>
            <select aria-label={zh ? "訪客篩選方式" : "Visitor filter mode"} value={filterBy} onChange={(e) => onChange({ ...c, filter_by: e.target.value })}>
              <option value="category">{zh ? "顯示頁面（最新消息、慢域體驗等）" : "Listing page (News, Experiences, etc.)"}</option>
              <option value="tags">{zh ? "主題標籤（親子、宜蘭、夏天等）" : "Topic tags (Family, Yilan, Summer, etc.)"}</option>
            </select>
            <p className="hpb-field-hint">{zh ? "這裡決定「訪客如何瀏覽已收錄的文章」。例如選擇主題標籤，訪客可按「親子」查看親子文章；不會因此增加或移除收錄內容。卡片文字仍依文章設定。" : "This decides how visitors browse the collected articles. Topic buttons let visitors narrow the view, for example to Family. They do not change which articles are collected. Card labels follow each article."}</p>
          </div>}
          <p className="hpb-field-hint">{zh ? "卡片顯示標籤由每篇文章決定；到文章編輯頁選擇，這裡只設定區塊是否顯示。" : "Each article owns its card labels. Choose them in the article editor; this section controls whether the collection displays them."}</p>
          {!isStays && <p className="hpb-field-hint">{zh ? "收錄條件在「來源與數量 → 只收錄哪些主題」設定。" : "Set inclusion rules under Source & count → Topic inclusion."}</p>}
          <Link className="admin-link-button" href="/admin/cms?tab=pages">{zh ? "前往文章管理卡片標籤" : "Manage card labels in articles"}</Link>
        </div>
        )}
      </FoldSection>
      <FoldSection title={zh ? "文字內容" : "Text content"}>
        {/* 文字內容, not 文字 — 「文字外觀」 is the fold immediately below this
            form and holds the font size and line height. Two groups called 文字
            in one panel would be the same collision this audit is undoing. */}
        <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
          <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={v => onChange(setVal(c, "eyebrow", editLocale, v))} />
        </Field>
        <Field label={zh ? "標題（選填）" : "Headline"}>
          <HeadingInput value={getVal(c, "headline", editLocale)} onChange={v => onChange(setVal(c, "headline", editLocale, v))} />
        </Field>
        <Field label={zh ? "「查看更多」文字（選填）" : "\"View more\" text (optional)"}>
          <input
            type="text"
            value={getVal(c, "view_all_label", editLocale)}
            onChange={e => onChange(setVal(c, "view_all_label", editLocale, e.target.value))}
            placeholder={zh ? "留空則依內容類型自動帶入" : "Leave blank to auto-fill by content type"}
          />
          {/* Where the link actually goes. It has only ever had one destination
              — the primary source's own index — and on a row that merges
              categories that was invisible: 最新消息＋餐飲服務＋慢域選品 sends
              every reader to /news. The destination is named here, and the
              automatic label names it on the page too (BlockStays), so the
              promise matches the page the reader lands on. */}
          <p className="hpb-field-hint">
            {zh
              ? (isStays
                  ? "連結固定指向住宿列表頁（/stays）。"
                  : `連結固定指向主要來源「${sourceLabel(source)}」的分類頁。`)
              : (isStays
                  ? "The link always points at the stay listing (/stays)."
                  : `The link always points at the ${sourceLabel(source)} index page.`)}
          </p>
          {extraSourceCount > 0 && (
            <p className="hpb-field-hint" style={{ marginTop: 6 }}>
              {zh
                ? `這個區塊還併了「${extraSources.map((source) => sourceLabel(source)).join("、")}」，那些內容不會出現在該頁——所以留空時會自動帶入「查看更多${sourceLabel(source)}」，讓連結文字和落點一致。要各自獨立的入口，請拆成多個區塊。`
                : `This block also merges ${extraSources.map((source) => sourceLabel(source)).join(", ")}, which that page does not list — so a blank label auto-fills as “More ${sourceLabel(source)}”, matching the text to where it lands. Split the row into separate blocks if each category needs its own entry point.`}
            </p>
          )}
        </Field>
      </FoldSection>
    </div>
  );
}

/* ── Gallery config ────────────────────────────────────────────────── */

export function HouseRulesConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  // Was a state mirror of c.items plus `{ ...c, items, ...setVal(c, …) }` on the
  // heading fields: setVal returns the whole config, so its `items` overwrote the
  // mirror that was spread in just before it. Reading the config directly is both
  // the fix and what every migrated list here does.
  const items = Array.isArray(c.items) ? (c.items as Record<string, unknown>[]) : [];

  return (
    <div>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} placeholder={zh ? "旅宿規範" : "GUEST GUIDELINES"} onChange={v => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} placeholder={zh ? "入住須知" : "House Rules"} onChange={v => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      <Field label={zh ? "版型" : "Layout"}>
        <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={zh ? "版型" : "Layout"}>
          {([
            ["rows", zh ? "條列" : "Rows"],
            ["columns", zh ? "三欄" : "Three columns"],
          ] as [string, string][]).map(([v, lbl]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={(c.layout === "columns" ? "columns" : "rows") === v}
              className={`hpb-variant-pick__btn${(c.layout === "columns" ? "columns" : "rows") === v ? " is-active" : ""}`}
              onClick={() => onChange({ ...c, layout: v === "columns" ? "columns" : undefined })}
            >
              {lbl}
            </button>
          ))}
        </div>
        <p className="hpb-field-hint">
          {zh
            ? "「條列」是每項一行、中間有分隔線；「三欄」把編號放在文字上方，三項並排（手機一樣會自動變成一欄）。"
            : "Rows gives one hairlined line per item; three columns puts the number above its copy and sets three side by side (still one column on a phone)."}
        </p>
      </Field>
      <FieldLabel>{zh ? "規則項目" : "Rule Items"}</FieldLabel>
      <div style={{ marginTop: 6 }}>
        <ItemsEditor
          items={items}
          fields={[
            { key: "label", label: zh ? "規則名稱" : "Rule" },
            { key: "detail", label: zh ? "說明（選填）" : "Detail" },
          ]}
          zh={zh}
          editLocale={editLocale}
          onChange={(next) => onChange({ ...c, items: next })}
          newItem={() => ({ label: { zh: "", en: "" }, detail: { zh: "", en: "" } })}
          noun={{ zh: "規則", en: "rule" }}
          addLabel={zh ? "+ 新增規則" : "+ Add rule"}
        />
      </div>
    </div>
  );
}

/* ── Table config ────────────────────────────────────────────────── */

export function TableConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  const cols = Array.isArray(c.columns) ? (c.columns as Record<string, unknown>[]) : [];
  const trows = Array.isArray(c.rows) ? (c.rows as string[][]) : [];
  const updateRows = (next: string[][]) => onChange({ ...c, rows: next });

  // Columns and rows are two arrays describing one grid, so a column edit has to
  // land on both in a single write: two onChange calls would make the second one
  // overwrite the first from the same stale config. The change descriptor says
  // which column moved, which is why reordering columns is possible at all now
  // (a diff of two label arrays could not tell a swap from two renames).
  const changeCols = (next: Record<string, unknown>[], change: ItemsChange) => {
    let rows = trows;
    if (change.kind === "add") rows = trows.map((r) => [...r, ""]);
    else if (change.kind === "remove") rows = trows.map((r) => r.filter((_, j) => j !== change.index));
    else if (change.kind === "move") {
      rows = trows.map((r) => {
        // A short row (saved before a column was added) has no cell to swap, and
        // leaving the hole would put every later cell under the wrong heading.
        const copy = [...r];
        while (copy.length < next.length) copy.push("");
        [copy[change.from], copy[change.to]] = [copy[change.to], copy[change.from]];
        return copy;
      });
    }
    onChange({ ...c, columns: next, rows });
  };

  return (
    <div>
      <Field label={zh ? "標題（選填）" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={v => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      {/* Both drawn by the renderers all along and offered by neither form. */}
      <Field label={zh ? "表格前言（選填）" : "Intro above the table (optional)"}>
        <HeadingInput value={getVal(c, "intro", editLocale)} onChange={v => onChange(setVal(c, "intro", editLocale, v))} />
      </Field>
      <FieldLabel>{zh ? "欄位標題" : "Column Headers"}</FieldLabel>
      <div style={{ marginTop: 6, marginBottom: 10 }}>
        <ItemsEditor
          items={cols}
          fields={[{ key: "label", label: zh ? "欄位標題" : "Column header" }]}
          zh={zh}
          editLocale={editLocale}
          onChange={changeCols}
          newItem={() => ({ label: { zh: "", en: "" } })}
          noun={{ zh: "欄", en: "column" }}
          addLabel={zh ? "+ 新增欄" : "+ Add column"}
        />
      </div>
      <FieldLabel>{zh ? `資料列（${trows.length}）` : `Rows (${trows.length})`}</FieldLabel>
      <div style={{ marginTop: 6 }}>
        {/* A row is a positional string[], not a field bag, so it drives the shared
            row chrome directly rather than through the field descriptors. */}
        <RepeatedRows<string[]>
          items={trows}
          zh={zh}
          onChange={updateRows}
          newItem={() => Array(Math.max(cols.length, 1)).fill("")}
          hasContent={(row) => row.some((cell) => String(cell ?? "").trim() !== "")}
          summary={(row) => clip(row.map((cell) => String(cell ?? "").trim()).filter(Boolean).join(zh ? "、" : " · ")) || (zh ? "（尚未填寫）" : "(empty)")}
          noun={{ zh: "列", en: "row" }}
          collapsible={false}
          addLabel={zh ? "+ 新增列" : "+ Add row"}
        >
          {(row, ri) => (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(cols.length, 1)}, 1fr)`, gap: 4 }}>
              {row.map((cell, ci) => (
                <input
                  key={ci}
                  type="text"
                  value={String(cell ?? "")}
                  aria-label={zh ? `第 ${ri + 1} 列，${getVal(cols[ci] ?? {}, "label", editLocale) || `第 ${ci + 1} 欄`}` : `Row ${ri + 1}, ${getVal(cols[ci] ?? {}, "label", editLocale) || `column ${ci + 1}`}`}
                  placeholder={getVal(cols[ci] ?? {}, "label", editLocale) || `${ci + 1}`}
                  onChange={(e) => { const next = trows.map((r) => [...r]); next[ri][ci] = e.target.value; updateRows(next); }}
                />
              ))}
            </div>
          )}
        </RepeatedRows>
      </div>
      <Field label={zh ? "表格附註（選填，每行一則）" : "Notes under the table (optional, one per line)"}>
        <HeadingInput
          value={getVal(c, "notes", editLocale)}
          onChange={v => onChange(setVal(c, "notes", editLocale, v))}
          placeholder={zh ? "價格含稅\n連假加收 20%" : "Prices include tax"}
        />
      </Field>
    </div>
  );
}

/* ── Contact Info config ─────────────────────────────────────────── */

export function ContactFormConfigForm({
  c, zh, editLocale, onChange, site,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void; site: AdminSite }) {
  const display = String(c.display ?? "form");
  return (
    <div>
      {/* ContactFormBlock has read config.site all along — it becomes the
          ?site= on the enquiry POST and decides whose inbox the message lands
          in — and no control wrote it, so a child site enquiry fell to the
          group inbox with no way to say otherwise. Two options rather than a
          free-text slug: a mistyped one would route messages nowhere. */}
      {/* Hidden in 預約入口 mode, where it decides nothing. That branch of
          ContactFormBlock returns two links and never POSTs an enquiry, so
          `config.site` — which exists only to become the ?site= on that POST —
          has nothing to route. Left visible, it was a control that saved
          perfectly into a branch nothing reads: the author picks 本站, the
          enquiries keep arriving in the group inbox, and there is no error to
          notice. */}
      {display !== "cta" && (
        <Field label={zh ? "詢問送到哪個收件匣" : "Which inbox receives these"}>
          <select
            value={String(c.site ?? "")}
            onChange={(e) => onChange({ ...c, site: e.target.value || undefined })}
          >
            <option value="">{zh ? "預設（站群收件匣）" : "Default (group inbox)"}</option>
            <option value={site.slug}>{zh ? `本站（${site.name || site.slug}）` : `This site (${site.name || site.slug})`}</option>
          </select>
          <p className="hpb-field-hint">
            {zh
              ? "選「本站」後，這個表單送出的詢問會出現在這個站台自己的詢問列表，而不是站群的。"
              : "Pick the site option to have these enquiries land in this site own inbox rather than the group one."}
          </p>
        </Field>
      )}
      <Field label={zh ? "顯示模式" : "Display mode"}>
        <select value={display} onChange={e => onChange({ ...c, display: e.target.value })}>
          <option value="form">{zh ? "完整表單" : "Full form"}</option>
          <option value="cta">{zh ? "預約入口（情緒文案＋按鈕）" : "Booking CTA (copy + buttons)"}</option>
        </select>
      </Field>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={v => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題（選填）" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={v => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      <Field label={zh ? "副標題（選填）" : "Subtitle"}>
        <HeadingInput value={getVal(c, "subtitle", editLocale)} onChange={v => onChange(setVal(c, "subtitle", editLocale, v))} />
      </Field>
      {display === "cta" ? (
        <>
          <Field label={zh ? "左按鈕文字（LINE）" : "Left button label (LINE)"}>
            <input type="text" value={getVal(c, "line_label", editLocale)} onChange={e => onChange(setVal(c, "line_label", editLocale, e.target.value))} placeholder={zh ? "LINE 詢問" : "Enquire on LINE"} />
          </Field>
          <Field label={zh ? "LINE 連結或 ID（留空則用站群設定）" : "LINE URL or ID (blank = site setting)"}>
            <input type="text" value={String(c.line ?? "")} onChange={e => onChange({ ...c, line: e.target.value })} placeholder="@907qphxh" />
          </Field>
          <Field label={zh ? "右按鈕文字（CTA）" : "Right button label (CTA)"}>
            <input type="text" value={getVal(c, "cta_label", editLocale)} onChange={e => onChange(setVal(c, "cta_label", editLocale, e.target.value))} placeholder={zh ? "填寫預約需求" : "Booking request"} />
          </Field>
          <Field label={zh ? "右按鈕連結" : "Right button link"}>
            <input type="text" value={String(c.cta_href ?? "")} onChange={e => onChange({ ...c, cta_href: e.target.value })} placeholder="/stays/hejing/booking" />
          </Field>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            {zh ? "CTA 模式只顯示文案與兩顆按鈕，不顯示表單。LINE 留空會用站群設定的 LINE。" : "CTA mode shows copy + two buttons only (no form). Leave LINE blank to use the site-wide LINE."}
          </p>
        </>
      ) : (
        <>
          <Field label={zh ? "版面" : "Layout"}>
            <select value={String(c.layout ?? "stacked")} onChange={e => onChange({ ...c, layout: e.target.value })}>
              <option value="stacked">{zh ? "標題在上方" : "Heading above the fields"}</option>
              <option value="split">{zh ? "標題在左、欄位在右" : "Heading left, fields right"}</option>
            </select>
          </Field>
          <Field label={zh ? "送出按鈕文字" : "Submit label"}>
            <input type="text" value={getVal(c, "submit_label", editLocale)} onChange={e => onChange(setVal(c, "submit_label", editLocale, e.target.value))} />
          </Field>
          <Field label={zh ? "送出按鈕下方說明（選填）" : "Note under the button (optional)"}>
            <HeadingInput
              value={getVal(c, "footnote", editLocale)}
              onChange={v => onChange(setVal(c, "footnote", editLocale, v))}
              placeholder={zh ? "送出後由客服團隊人工處理可預訂狀態；此表單不會付款。" : "We reply by hand; this form takes no payment."}
            />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={c.show_line !== false}
              onChange={e => onChange({ ...c, show_line: e.target.checked })}
            />
            <span>{zh ? "顯示 LINE ID 欄位" : "Show the LINE ID field"}</span>
          </label>
          <Field label={zh ? "表單類型" : "Form type"}>
            <select value={String(c.form_type ?? "inquiry")} onChange={e => onChange({ ...c, form_type: e.target.value })}>
              <option value="inquiry">{zh ? "一般諮詢" : "General inquiry"}</option>
              <option value="booking">{zh ? "訂房預約" : "Booking request"}</option>
            </select>
          </Field>
          {String(c.form_type ?? "inquiry") !== "booking" && (
            <>
              {/* One code, not a list of pairs. The 諮詢類型 dropdown was removed
                  from the form itself, so nothing shows a 顯示文字 any more and
                  ContactFormBlock reads exactly one value — the FIRST row's code —
                  as the enquiry's source. Every later row and every label was a
                  field that saved and could not be observed anywhere. Existing
                  configs keep their shape: the value is read from and written back
                  to inquiry_types[0].value. */}
              <Field label={zh ? "送出後歸類為" : "File enquiries as"}>
                <select
                  value={String((Array.isArray(c.inquiry_types) ? (c.inquiry_types as Record<string, unknown>[])[0]?.value : "") ?? "")}
                  onChange={(e) => {
                    const rest = Array.isArray(c.inquiry_types) ? (c.inquiry_types as Record<string, unknown>[]).slice(1) : [];
                    onChange({ ...c, inquiry_types: e.target.value ? [{ value: e.target.value }, ...rest] : rest });
                  }}
                >
                  <option value="">{zh ? "預設（其他）" : "Default (other)"}</option>
                  {INQUIRY_SOURCES.map(([value, zhL, enL]) => (
                    <option key={value} value={value}>{zh ? zhL : enL}</option>
                  ))}
                </select>
                <p className="hpb-field-hint">
                  {zh
                    ? "這個表單送出的詢問會歸到這一類，後台收件匣依此篩選與轉派。訪客看不到這個設定 —— 表單上已沒有「諮詢類型」欄位。"
                    : "Every enquiry this form sends is filed under this type, which is what the inbox filters and forwards by. Visitors never see it — the form has no 諮詢類型 field."}
                </p>
              </Field>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Inquiry routing codes the API will accept (the `source` pattern on
 * InquiryCreate). Offered as a picker so an admin cannot save a type that the
 * form would then fail to submit with a 422.
 */
export const INQUIRY_SOURCES: Array<[string, string, string]> = [
  ["booking",    "住宿詢問", "Stay enquiry"],
  ["partnership", "企劃合作", "Partnership"],
  ["pr",         "媒體公關", "Media & PR"],
  ["career",     "人才招募", "Careers"],
  ["franchise",  "民宿加盟", "Franchise"],
  ["website",    "一般諮詢", "General"],
  ["phone",      "電話諮詢", "Phone"],
  ["email",      "Email 諮詢", "Email"],
  ["line",       "LINE 諮詢", "LINE"],
  ["walk-in",    "現場來訪", "Walk-in"],
  ["other",      "其他", "Other"],
];

/* ── Feature Badges config ───────────────────────────────────────── */

/** For a child (property) site, auto-load its linked parent-catalogue stay's
 *  amenities (matched by slug). Returns null while loading, then the raw list. */
export function useParentStayAmenities(site: AdminSite): string[] | null {
  const [am, setAm] = useState<string[] | null>(site.parent_site_id ? null : []);
  useEffect(() => {
    if (!site.parent_site_id) { setAm([]); return; }
    let alive = true;
    fetch(`${API_URL}/stays`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!alive) return;
        const arr = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
        const stay = arr.find((s) => s.slug === site.slug);
        const list = Array.isArray(stay?.amenities) ? (stay!.amenities as unknown[]).map(String) : [];
        setAm(list);
      })
      .catch(() => { if (alive) setAm([]); });
    return () => { alive = false; };
  }, [site.parent_site_id, site.slug]);
  return am;
}

export function FeatureBadgesConfigForm({
  c, zh, editLocale, onChange, site,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void; site: AdminSite }) {
  // Same stale-mirror trap the house rules form had: the heading fields spread
  // `items` and then spread setVal(c, …), which carries c.items and wins, so the
  // amenity tick-boxes and the badge list could disagree about what was saved.
  const items = Array.isArray(c.items) ? (c.items as Record<string, unknown>[]) : [];
  const update = (next: Record<string, unknown>[]) => onChange({ ...c, items: next });

  // A canonical amenity is "on" when a badge with its zh (or en) label exists.
  const labelOf = (it: Record<string, unknown>) => {
    const l = it.label as Record<string, string> | string | undefined;
    if (typeof l === "string") return l;
    return l?.zh || l?.en || "";
  };
  const isOn = (a: { zh: string; en: string }) =>
    items.some((it) => { const v = labelOf(it); return v === a.zh || v === a.en; });
  const toggle = (a: { icon: string; zh: string; en: string }) => {
    if (isOn(a)) {
      update(items.filter((it) => { const v = labelOf(it); return v !== a.zh && v !== a.en; }));
    } else {
      update([...items, { icon: a.icon, label: { zh: a.zh, en: a.en } }]);
    }
  };

  // 母站8：子站自動導入母站該民宿的設施，逐項選擇顯示 / 隱藏。
  const parentAmenitiesRaw = useParentStayAmenities(site);
  const parentAmenities = useMemo(
    () => (parentAmenitiesRaw ?? []).map(splitAmenity).filter((a) => a.zh || a.en),
    [parentAmenitiesRaw],
  );
  const showAllParent = () => {
    const additions = parentAmenities
      .filter((a) => !isOn(a))
      .map((a) => ({ icon: a.icon, label: { zh: a.zh, en: a.en } }));
    if (additions.length) update([...items, ...additions]);
  };

  return (
    <div>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} placeholder={zh ? "設施與服務" : "Facilities & Services"} onChange={v => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} placeholder={zh ? "設施與服務" : "Facilities & Services"} onChange={v => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      {site.parent_site_id ? (
        <div className="amenity-import">
          <div className="amenity-import-head">
            <FieldLabel>{zh ? "母站帶入的設施（勾選顯示 / 取消隱藏）" : "Amenities from parent (check to show)"}</FieldLabel>
            {parentAmenities.length > 0 && (
              <button type="button" className="amenity-import-all" onClick={showAllParent}>
                {zh ? "全部顯示" : "Show all"}
              </button>
            )}
          </div>
          {parentAmenitiesRaw === null ? (
            <p className="amenity-import-hint">{zh ? "載入母站設施中…" : "Loading parent amenities…"}</p>
          ) : parentAmenities.length === 0 ? (
            <p className="amenity-import-hint">{zh ? "母站尚未設定此民宿的設施。" : "No amenities set on the parent stay yet."}</p>
          ) : (
            <div className="amenity-checkgrid">
              {parentAmenities.map((a, i) => {
                const on = isOn(a);
                return (
                  <label key={`${a.zh}-${i}`} className={`amenity-checkbox${on ? " is-on" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(a)} />
                    {a.icon && <span className="amenity-checkbox-icon" aria-hidden="true">{a.icon}</span>}
                    <span>{zh ? a.zh : (a.en || a.zh)}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
      {/* Generic "common amenities" picker is only useful on the root site — a
         child site pulls its real amenities from the parent stay above, so this
         would be redundant clutter there (client feedback). */}
      {!site.parent_site_id && (
        <>
          <FieldLabel>{zh ? "常用設施（勾選即加入）" : "Common amenities (check to add)"}</FieldLabel>
          <div className="amenity-checkgrid">
            {COMMON_AMENITIES.map((a) => {
              const on = isOn(a);
              return (
                <label key={a.zh} className={`amenity-checkbox${on ? " is-on" : ""}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(a)} />
                  <span className="amenity-checkbox-icon" aria-hidden="true">{a.icon}</span>
                  <span>{zh ? a.zh : a.en}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
      <FieldLabel>{zh ? "標籤列表（可自訂）" : "Badge Items (custom)"}</FieldLabel>
      <div style={{ marginTop: 6 }}>
        <ItemsEditor
          items={items}
          fields={[
            { key: "icon", label: zh ? "圖示" : "Icon", type: "icon", bilingual: false, inline: true, inlineWidth: "200px", placeholder: "🏊", summary: false },
            { key: "label", label: zh ? "標籤" : "Label", inline: true },
            { key: "category", label: zh ? "分類" : "Category", inline: true, placeholder: zh ? "亮點設施" : "Highlights" },
          ]}
          zh={zh}
          editLocale={editLocale}
          onChange={update}
          newItem={() => ({ icon: "", label: { zh: "", en: "" }, category: { zh: "", en: "" } })}
          noun={{ zh: "標籤", en: "badge" }}
          addLabel={zh ? "+ 新增標籤" : "+ Add badge"}
        />
      </div>
    </div>
  );
}

/* ── Live content for the Featured Collection preview ──────────────── */

/* ── Social embed (oEmbed) ──────────────────────────────────────── */

export function OembedConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div>
      <Field label="URL">
        <input type="url" placeholder="https://www.instagram.com/p/..." value={String(c.url ?? "")} onChange={(e) => onChange({ ...c, url: e.target.value })} />
      </Field>
      <Field label={zh ? "說明文字" : "Caption"}>
        <input type="text" value={getVal(c, "caption", editLocale)} onChange={(e) => onChange(setVal(c, "caption", editLocale, e.target.value))} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field label={zh ? "最大寬度 (px)" : "Max width (px)"}>
          <input
            type="number" min={240} max={1600} step={20}
            placeholder={zh ? "預設 800（直式影片 460）" : "Default 800 (portrait 460)"}
            value={String(c.embed_width ?? "")}
            onChange={(e) => onChange({ ...c, embed_width: e.target.value === "" ? "" : Number(e.target.value) })}
          />
        </Field>
        <Field label={zh ? "影片比例" : "Aspect ratio"}>
          <select value={String(c.embed_ratio ?? "")} onChange={(e) => onChange({ ...c, embed_ratio: e.target.value })}>
            {/* 「自動判斷」 promised a detection that does not happen: blank sets
                no --embed-ratio at all, so the embed takes the stylesheet's
                16/9 — or the 9/16 the Facebook container declares. Named for
                the detection it does not do, it also read as a synonym of the
                option at the bottom, which is the one that really does follow
                the source. Stored value unchanged (still the empty string). */}
            <option value="">{zh ? "預設（16:9；Facebook 影片 9:16）" : "Default (16:9; 9:16 for Facebook video)"}</option>
            <option value="16:9">16:9{zh ? "（橫式影片）" : " (landscape)"}</option>
            <option value="4:3">4:3</option>
            <option value="1:1">1:1{zh ? "（方形）" : " (square)"}</option>
            <option value="4:5">4:5</option>
            <option value="9:16">9:16{zh ? "（直式／Reels）" : " (portrait / Reels)"}</option>
            {/* 「不限制（依內容高度）」 promised something the web does not
                offer: a cross-origin iframe never reports its content height to
                the page, so the option emitted `aspect-ratio: auto` and every
                embed fell to the browser's 150px replaced-element default —
                460×818 → 460×150 on a Facebook video, 800×450 → 800×150 on a
                YouTube one. It resolves to the size the provider states now,
                which is the only "own height" there is. Stored value unchanged. */}
            <option value="auto">{zh ? "依來源提供的尺寸" : "Match the source's size"}</option>
          </select>
        </Field>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
        {zh
          ? "支援 Instagram、YouTube、TikTok、Facebook、Twitter 等網址。「依來源提供的尺寸」是照嵌入來源自己回報的長寬比；Facebook 影片外掛沒有回報尺寸，這時維持預設比例（直式 9:16）。"
          : "Supports Instagram, YouTube, TikTok, Facebook, Twitter, etc. “Match the source's size” follows the width and height the provider states; Facebook's video plugin states none, so it keeps the default ratio (portrait 9:16)."}
      </p>
    </div>
  );
}

/* -- 八、內容頁版型：三種組合式版型 --------------------------------------
   客戶: 使用者可依需求自由組合，而不是每個頁面都被限制成同一種排列。 */

/** One repeated row, with the add/remove controls every items editor here uses. */
function ItemRows({
  c, zh, onChange, addLabel, render,
}: {
  c: Record<string, unknown>;
  zh: boolean;
  onChange: (c: Record<string, unknown>) => void;
  addLabel: string;
  render: (item: Record<string, unknown>, set: (patch: Record<string, unknown>) => void) => React.ReactNode;
}) {
  const items = Array.isArray(c.items) ? (c.items as Record<string, unknown>[]) : [];
  const put = (next: Record<string, unknown>[]) => onChange({ ...c, items: next });
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="hpb-subtab-row" style={{ gridTemplateColumns: "1fr 32px", alignItems: "start" }}>
          <div>{render(item, (patch) => put(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}</div>
          <button
            type="button"
            onClick={() => put(items.filter((_, j) => j !== i))}
            aria-label={zh ? "移除第 " + (i + 1) + " 項" : "Remove item " + (i + 1)}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => put([...items, {}])}>{addLabel}</button>
    </div>
  );
}

export function VideoTextConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  /* Same default as the renderer: anything that is not an explicit side means
     stacked, so the panel cannot highlight a placement the page will not draw. */
  const raw = String(c.video_position ?? "");
  const position = raw === "left" || raw === "right" ? raw : "top";
  return (
    <div>
      <Field label={zh ? "影片網址" : "Video URL"}>
        <input
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={String(c.url ?? "")}
          onChange={(e) => onChange({ ...c, url: e.target.value })}
        />
      </Field>
      <Field label={zh ? "影片位置" : "Video placement"}>
        <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={zh ? "影片位置" : "Video placement"}>
          {(["top", "left", "right"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={position === v}
              className={"hpb-variant-pick__btn" + (position === v ? " is-active" : "")}
              onClick={() => onChange({ ...c, video_position: v })}
            >
              {v === "top" ? (zh ? "影片在上" : "Video on top")
                : v === "left" ? (zh ? "影片靠左" : "Video left")
                : (zh ? "影片靠右" : "Video right")}
            </button>
          ))}
        </div>
      </Field>
      <Field label={zh ? "影片比例" : "Aspect ratio"}>
        <select value={String(c.embed_ratio ?? "")} onChange={(e) => onChange({ ...c, embed_ratio: e.target.value })}>
          <option value="">{zh ? "預設（16:9）" : "Default (16:9)"}</option>
          <option value="16:9">16:9{zh ? "（橫式）" : " (landscape)"}</option>
          <option value="1:1">1:1{zh ? "（方形）" : " (square)"}</option>
          <option value="9:16">9:16{zh ? "（直式／Reels）" : " (portrait / Reels)"}</option>
          <option value="auto">{zh ? "依來源提供的尺寸" : "Match the source's size"}</option>
        </select>
      </Field>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={(v) => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題（選填）" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={(v) => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      <Field label={zh ? "內文（選填）" : "Body"}>
        <textarea rows={4} value={getVal(c, "body", editLocale)} onChange={(e) => onChange(setVal(c, "body", editLocale, e.target.value))} />
      </Field>
      <Field label={zh ? "按鈕文字（留空則不顯示）" : "CTA label (empty hides button)"}>
        <input type="text" value={getVal(c, "cta_label", editLocale)} onChange={(e) => onChange(setVal(c, "cta_label", editLocale, e.target.value))} />
      </Field>
      <Field label={zh ? "按鈕連結" : "CTA href"}>
        <input type="text" value={String(c.cta_href ?? "")} onChange={(e) => onChange({ ...c, cta_href: e.target.value })} />
      </Field>
    </div>
  );
}

export function FeatureHeroConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div>
      <Field label={zh ? "導言大圖" : "Lead image"}>
        <ImageUploadInput value={String(c.image ?? "")} onChange={(url) => onChange({ ...c, image: url })} />
      </Field>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={(v) => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題（選填）" : "Title"}>
        <HeadingInput value={getVal(c, "title", editLocale)} onChange={(v) => onChange(setVal(c, "title", editLocale, v))} />
      </Field>
      <Field label={zh ? "內文（選填）" : "Body"}>
        <textarea rows={3} value={getVal(c, "body", editLocale)} onChange={(e) => onChange(setVal(c, "body", editLocale, e.target.value))} />
      </Field>
      <Field label={zh ? "下方小項目" : "Items below"}>
        <ItemRows
          c={c}
          zh={zh}
          onChange={onChange}
          addLabel={zh ? "＋ 新增項目" : "+ Add item"}
          render={(item, set) => (
            <>
              <input
                type="text"
                placeholder={zh ? "項目標題" : "Item title"}
                value={getVal(item, "label", editLocale)}
                onChange={(e) => set(setVal(item, "label", editLocale, e.target.value))}
              />
              <textarea
                rows={2}
                placeholder={zh ? "項目說明（選填）" : "Item detail (optional)"}
                value={getVal(item, "detail", editLocale)}
                onChange={(e) => set(setVal(item, "detail", editLocale, e.target.value))}
              />
            </>
          )}
        />
      </Field>
    </div>
  );
}

/* ── 圖文交錯 ─────────────────────────────────────────────────────────
   This block is ABOUT the alternation. Which side a picture falls on is derived
   from the row's position — that is the whole reason it exists instead of a run
   of hand-set 圖文段落 — so the two things an author actually needs are to SEE
   the pattern and to REORDER it. The form gave neither: three rows of identical
   fields with no number, no side, no thumbnail, and no way to move row 3 above
   row 1 except retyping both of them into each other. */

/** The summary line's fallback is the one altRowRenders applies. */
const altRowAnyLocale = anyLocale;

function AlternatingRows({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  const items = useMemo(() => (Array.isArray(c.items) ? (c.items as Record<string, unknown>[]) : []), [c.items]);
  const bleed = c.layout === "bleed";
  const flip = c.flip === true;
  const put = (next: Record<string, unknown>[]) => onChange({ ...c, items: next });

  /* One row open at a time. A new row opens itself — an author who just pressed
     新增一列 wants the fields, not another closed bar to click. */
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  /* The numbers and sides the PAGE will draw, counted the way BlockAlternating
     counts them: over the rows that survive its filter, never over the rows in
     the editor. An empty row between two filled ones shifts everything below it,
     and that is exactly the case an author cannot work out in their head. */
  const shown = new Map<number, number>();
  items.forEach((item, i) => {
    if (altRowRenders(item)) shown.set(i, shown.size);
  });
  const sideOf = (n: number) => (flip ? n % 2 === 0 : n % 2 === 1);

  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    put(next);
    setOpenIdx((prev) => altReindex(prev, from, to));
  };

  const onDragOver = (index: number, e: React.DragEvent) => {
    if (dragIndex === null) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDropIndex(e.clientY - rect.top > rect.height / 2 ? index + 1 : index);
  };
  const onDrop = () => {
    if (dragIndex !== null && dropIndex !== null) {
      // dropIndex is a GAP index, so dropping below yourself is one slot fewer
      // than it reads — the same correction the block list makes.
      moveTo(dragIndex, dropIndex > dragIndex ? dropIndex - 1 : dropIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  const removeAt = (i: number) => {
    if (altRowRenders(items[i]) && !window.confirm(zh ? "刪除這一列？" : "Delete this row?")) return;
    put(items.filter((_, j) => j !== i));
    setOpenIdx((prev) => (prev === null ? null : prev === i ? null : prev > i ? prev - 1 : prev));
  };

  const dropLine = (index: number) => <div className={`hpb-drop${dropIndex === index ? " is-active" : ""}`} />;
  const nameOf = (item: Record<string, unknown>) =>
    getVal(item, "title", editLocale) || altRowAnyLocale(item, "title") || getVal(item, "body", editLocale) || altRowAnyLocale(item, "body");

  return (
    <>
      <Field label={zh ? "預覽（示意）" : "Preview"}>
        {shown.size === 0 ? (
          <p className="hpb-field-hint">
            {zh ? "還沒有任何一列會顯示。填入照片或文字後，這裡會畫出左右交替的樣子。" : "No row renders yet. Add a picture or some words and the alternation appears here."}
          </p>
        ) : (
          <div className={`hpb-altprev${bleed ? " is-bleed" : ""}`}>
            {items.map((item, i) => {
              const n = shown.get(i);
              if (n === undefined) return null;
              const imgLeft = sideOf(n);
              const image = String(item.image ?? "");
              return (
                <button
                  key={i}
                  type="button"
                  className={`hpb-altprev__row${imgLeft ? " is-img-left" : ""}${openIdx === i ? " is-open" : ""}`}
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  aria-label={
                    zh
                      ? `第 ${n + 1} 列，照片在${imgLeft ? "左" : "右"}，點擊編輯`
                      : `Row ${n + 1}, picture on the ${imgLeft ? "left" : "right"}, edit`
                  }
                >
                  <span className="hpb-altprev__copy">
                    {bleed && <span className="hpb-altprev__num">{String(n + 1).padStart(2, "0")}</span>}
                    <span className="hpb-altprev__title">{nameOf(item) || (zh ? "（未填標題）" : "(untitled)")}</span>
                    {(getVal(item, "body", editLocale) || altRowAnyLocale(item, "body")) && <span className="hpb-altprev__bar" />}
                  </span>
                  <span className="hpb-altprev__media">
                    {image ? <img src={image} alt="" /> : <span className="hpb-altprev__nophoto">{zh ? "無照片" : "no photo"}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Field>
      <Field label={zh ? "圖文列（左右自動交替）" : "Rows (sides alternate automatically)"}>
        <div className="hpb-altrows">
          {items.map((item, i) => {
            const n = shown.get(i);
            const renders = n !== undefined;
            const image = String(item.image ?? "");
            const open = openIdx === i;
            return (
              <div key={i}>
                {dropLine(i)}
                <div
                  className={`hpb-altrow${open ? " is-open" : ""}${renders ? "" : " is-empty"}${dragIndex === i ? " is-dragging" : ""}`}
                  onDragOver={(e) => onDragOver(i, e)}
                  onDrop={onDrop}
                >
                  <div className="hpb-altrow__bar">
                    {/* draggable on the grip, never on the row: on the row it
                        swallows every text selection inside the fields. */}
                    <span
                      className="hpb-handle"
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                      title={zh ? "拖曳排序（也可用上移／下移）" : "Drag to reorder (or use move up / down)"}
                      aria-hidden="true"
                    >
                      <GripVertical size={14} />
                    </span>
                    <span
                      className="hpb-altrow__open"
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={() => setOpenIdx(open ? null : i)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        setOpenIdx(open ? null : i);
                      }}
                    >
                      <span className="hpb-altrow__num">{renders ? String((n as number) + 1).padStart(2, "0") : "—"}</span>
                      {image
                        ? <img className="hpb-altrow__thumb" src={image} alt="" />
                        : <span className="hpb-altrow__thumb is-none" aria-hidden="true" />}
                      {/* The bar truncates: a long title, or an English side
                          badge, leaves little room. The full text on hover, so
                          the row is still identifiable without opening it. */}
                      <span className="hpb-altrow__name" title={nameOf(item) || undefined}>
                        {nameOf(item) || <em>{zh ? "（未填標題）" : "(untitled)"}</em>}
                      </span>
                      {renders ? (
                        <span className="hpb-altrow__side">
                          {sideOf(n as number) ? (zh ? "圖左" : "picture left") : (zh ? "圖右" : "picture right")}
                        </span>
                      ) : (
                        /* Not a warning: a half-filled row is a normal state
                           mid-edit. It says what the page will do, because the
                           page silently does it. */
                        <span className="hpb-altrow__side is-muted">{zh ? "空白，不會顯示" : "empty, not shown"}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="hpb-piece__act"
                      onClick={() => moveTo(i, i - 1)}
                      disabled={i === 0}
                      title={zh ? "上移" : "Move up"}
                      aria-label={zh ? `第 ${i + 1} 列上移` : `Move row ${i + 1} up`}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="hpb-piece__act"
                      onClick={() => moveTo(i, i + 1)}
                      disabled={i === items.length - 1}
                      title={zh ? "下移" : "Move down"}
                      aria-label={zh ? `第 ${i + 1} 列下移` : `Move row ${i + 1} down`}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="hpb-piece__act is-danger"
                      onClick={() => removeAt(i)}
                      title={zh ? "刪除這一列" : "Delete row"}
                      aria-label={zh ? `刪除第 ${i + 1} 列` : `Delete row ${i + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {open && (
                    <div className="hpb-altrow__body">
                      <ImageUploadInput
                        value={image}
                        onChange={(url) => put(items.map((x, j) => (j === i ? { ...x, image: url } : x)))}
                      />
                      <input
                        type="text"
                        placeholder={zh ? "小標（選填，如 DESIGN）" : "Row label (optional, e.g. DESIGN)"}
                        value={getVal(item, "eyebrow", editLocale)}
                        onChange={(e) => put(items.map((x, j) => (j === i ? setVal(x, "eyebrow", editLocale, e.target.value) : x)))}
                      />
                      <input
                        type="text"
                        placeholder={zh ? "標題" : "Title"}
                        value={getVal(item, "title", editLocale)}
                        onChange={(e) => put(items.map((x, j) => (j === i ? setVal(x, "title", editLocale, e.target.value) : x)))}
                      />
                      <textarea
                        rows={3}
                        placeholder={zh ? "內文" : "Body"}
                        value={getVal(item, "body", editLocale)}
                        onChange={(e) => put(items.map((x, j) => (j === i ? setVal(x, "body", editLocale, e.target.value) : x)))}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {dropLine(items.length)}
          <button
            type="button"
            className="hpb-altrows__add"
            onClick={() => { put([...items, {}]); setOpenIdx(items.length); }}
          >
            {zh ? "＋ 新增一列" : "+ Add row"}
          </button>
        </div>
      </Field>
    </>
  );
}

export function AlternatingConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  const layout = c.layout === "bleed" ? "bleed" : "framed";
  return (
    <div>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={(v) => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "區塊標題（選填）" : "Section heading"}>
        <HeadingInput value={getVal(c, "heading", editLocale)} onChange={(v) => onChange(setVal(c, "heading", editLocale, v))} />
      </Field>
      <Field label={zh ? "版型" : "Layout"}>
        {/* Two words and a paragraph explaining them, before: 「框內」 and
            「出血」 name a difference you can only see. The diagrams are the
            control now and the words are the label, which is the right way round
            for a choice about where a photograph sits. Same radiogroup roles and
            the same arrow keys the other pickers carry. */}
        <div className="hpb-altpick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={zh ? "版型" : "Layout"}>
          {([
            ["framed", zh ? "框內" : "Framed", zh ? "照片留在版面框內，四角圓潤" : "The picture stays inside the page frame"],
            ["bleed", zh ? "出血" : "Bleed", zh ? "照片延伸到畫面邊緣，並自動編號 01 / 02 / 03" : "The picture runs off the window edge; rows are numbered"],
          ] as [string, string, string][]).map(([v, lbl, hint]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={layout === v}
              className={`hpb-altpick__btn${layout === v ? " is-active" : ""}`}
              onClick={() => onChange({ ...c, layout: v === "bleed" ? "bleed" : undefined })}
            >
              <span className={`hpb-altpick__fig is-${v}`} aria-hidden="true">
                <span className="hpb-altpick__copy"><i /><i /></span>
                <span className="hpb-altpick__photo" />
              </span>
              <span className="hpb-altpick__lbl">{lbl}</span>
              <span className="hpb-altpick__hint">{hint}</span>
            </button>
          ))}
        </div>
      </Field>
      <Field label={zh ? "第一列圖片靠左" : "Start with the picture on the left"}>
        {/* aria-pressed, because a bare button announces nothing about which way
            it is set — and this one decides which side every picture in the
            block lands on. */}
        <button
          type="button"
          className={"hpb-switch" + (c.flip === true ? " is-on" : "")}
          onClick={() => onChange({ ...c, flip: c.flip !== true })}
          aria-pressed={c.flip === true}
          aria-label={zh ? "第一列圖片靠左開關" : "Start on the left toggle"}
        />
      </Field>
      <AlternatingRows c={c} zh={zh} editLocale={editLocale} onChange={onChange} />
    </div>
  );
}
/** Root-site default page keys + labels (mirrors SitePageEditor.ROOT_SITE_DEFAULT_PAGES) */
/** The root site's default pages, in nav order.
 *
 *  One list because there were two, written out by hand, and they had drifted:
 *  選品 and 部落格 were added here but not to the page manager's copy, and the
 *  page manager is what creates a page — so neither could be made, and with no
 *  entry in settings.pages the /curation and /blog routes had nothing to
 *  resolve against either.
 *
 *  It lives in modules/contentTypes now, for the same reason: the public
 *  renderer has to name a category too, and it cannot import this file — a
 *  "use client" module — without dragging every block form onto the homepage.
 *  Re-exported so the importers of this one are unchanged. */
export { ROOT_PAGES, ROOT_PAGE_DEFAULTS, ROOT_SITE_DEFAULT_PAGES } from "../../modules/contentTypes";

/**
 * One row of the 資料來源 picker: [key, zh label, en label, deleted?].
 *
 * The fourth element marks a category whose page has been tombstoned in
 * 頁面管理. Such a row is carried rather than dropped, because deleting the page
 * does not delete its entries and does not edit the blocks naming it as a
 * source — 禾境's homepage is drawing 媒體報導 from a page that is gone.
 * The picker refuses it as a NEW choice and shows it, marked, while a block
 * still holds it; see SourcesPicker.
 */
export type ContentSource = [string, string, string, boolean?];

/** Build content sources from site pages; "stays" (住宿目錄) is always first. */
export function buildContentSources(site: AdminSite): ContentSource[] {
  const categories = siteContentTypesFromConfig(site).map((item): ContentSource => [item.key, item.label.zh, item.label.en]);
  const pages = ((site.settings ?? {}).pages ?? {}) as Record<string, Record<string, unknown>>;
  const deleted = Object.entries(pages).filter(([, cfg]) => cfg.deleted === true).map(([key, cfg]): ContentSource => {
    const label = cfg.label as Record<string, string> | undefined;
    return [key, label?.zh || key, label?.en || key, true];
  });
  return [["stays", "住宿目錄", "Stay catalogue"], ...categories, ...deleted];
}

/* ── Partner brands (合作品牌) ───────────────────────────────────── */

export function PartnersConfigForm({
  c, zh, editLocale, onChange,
}: { c: Record<string, unknown>; zh: boolean; editLocale: string; onChange: (c: Record<string, unknown>) => void }) {
  const layout = c.layout === "logos" ? "logos" : "cards";
  return (
    <div>
      <Field label={zh ? "版面" : "Layout"}>
        <select value={layout} onChange={(e) => onChange({ ...c, layout: e.target.value })}>
          <option value="cards">{zh ? "圖文卡片（照片＋名稱＋說明）" : "Cards (photo + name + copy)"}</option>
          <option value="logos">{zh ? "Logo 牆（只顯示標誌）" : "Logo wall (marks only)"}</option>
        </select>
      </Field>
      <Field label={zh ? "眉批（選填）" : "Eyebrow"}>
        <HeadingInput value={getVal(c, "eyebrow", editLocale)} onChange={(v) => onChange(setVal(c, "eyebrow", editLocale, v))} />
      </Field>
      <Field label={zh ? "標題" : "Heading"}>
        <HeadingInput value={getVal(c, "heading", editLocale)} onChange={(v) => onChange(setVal(c, "heading", editLocale, v))} />
      </Field>
      <Field label={zh ? "說明（選填）" : "Caption (optional)"}>
        <textarea rows={3} value={getVal(c, "caption", editLocale)} onChange={(e) => onChange(setVal(c, "caption", editLocale, e.target.value))} />
      </Field>
      <FieldLabel>{zh ? "合作品牌" : "Partner brands"}</FieldLabel>
      <div style={{ marginTop: 8 }}>
        <ItemsEditor
          items={Array.isArray(c.items) ? (c.items as Record<string, unknown>[]) : []}
          /* 代表照片 and 簡短說明 are offered only on the cards layout, because
             only the cards layout draws them. The logo wall's tile is sized for
             a mark — an 88px body with the logo capped at 44px — so a 4:3 photo
             and a paragraph have nowhere to go, and rendering them anyway would
             make the two layouts draw the same thing and leave the 版面 選項
             nothing to choose between. Both fields accepted input and dropped
             it silently on the wall (客戶: 檢查所有 block 的設置是否生效).
             詳細說明 stays in both: it sits behind 了解更多 and costs the wall
             no space until a reader asks for it. */
          fields={[
            { key: "logo", label: zh ? "Logo" : "Logo", type: "image" },
            ...(layout === "cards"
              ? [{ key: "image", label: zh ? "代表照片（選填）" : "Photo (optional)", type: "image" as const }]
              : []),
            { key: "name", label: zh ? "品牌名稱" : "Brand name" },
            ...(layout === "cards"
              ? [{ key: "desc", label: zh ? "簡短說明（選填）" : "Short copy (optional)", type: "textarea" as const }]
              : []),
            { key: "detail", label: zh ? "展開後的詳細介紹（選填）" : "Expanded detail (optional)", type: "textarea" },
            { key: "href", label: zh ? "官方網站（選填）" : "Website (optional)", type: "url", bilingual: false },
          ]}
          zh={zh}
          editLocale={editLocale}
          onChange={(items) => onChange({ ...c, items })}
          addLabel={zh ? "+ 新增合作品牌" : "+ Add partner"}
        />
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
        {zh
          ? layout === "cards"
            ? "有 Logo 時卡片顯示 Logo，沒有才顯示品牌名稱文字。「代表照片」留空會改用 Logo。官方網站需填完整網址（https://）。"
            : "Logo 牆只顯示標誌，因此不提供「代表照片」與「簡短說明」—— 需要照片與文字請改用「圖文卡片」版面。「展開後的詳細介紹」兩種版面都可用。官方網站需填完整網址（https://）。"
          : layout === "cards"
            ? "A card shows the logo when there is one and the brand name otherwise. Leave the photo blank to reuse the logo. The website needs a full https:// URL."
            : "The logo wall shows marks only, so the photo and short copy fields are not offered — switch to the cards layout for those. The expanded detail works in both. The website needs a full https:// URL."}
      </p>
    </div>
  );
}

export type ThumbItem = { id: number; image: string; title: string; tags: string[] };

/** The entry's tags in the editing locale, falling back to the base list —
 *  same precedence the front end's tagsT() uses, so the tag an editor ticks in
 *  the picker is the one the chip row will show. */
function itemTags(raw: Record<string, unknown>, locale: string): string[] {
  const tr = (raw.translations as Record<string, Record<string, unknown>> | undefined)?.[locale];
  const localised = tr?.tags;
  const list = Array.isArray(localised)
    ? localised
    : typeof localised === "string"
      ? localised.split(",")
      : Array.isArray(raw.tags)
        ? (raw.tags as unknown[])
        : [];
  return list.map((t) => String(t).trim()).filter(Boolean);
}

/** Module-level cache so switching blocks / locales doesn't re-fetch. Keyed by site|source|locale. */
export const _sourceCache = new Map<string, ThumbItem[]>();

export async function fetchSourceItems(source: string, siteSlug: string, locale: string): Promise<ThumbItem[]> {
  const site = encodeURIComponent(siteSlug);
  if (source === "stays") {
    const res = await fetch(`${API_URL}/stays?site=${site}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : []).map((s: Record<string, unknown>) => {
      const imgs = Array.isArray(s.images) ? (s.images as Array<Record<string, unknown>>) : [];
      const tr = (s.translations as Record<string, Record<string, string>> | undefined)?.[locale] ?? {};
      return {
        id: Number(s.id) || 0,
        image: String(s.hero_image_url || imgs[0]?.image_url || ""),
        title: String(tr.name || s.name || ""),
        tags: itemTags(s, locale),
      };
    });
  }
  const res = await fetch(`${API_URL}/cms/pages?content_type=${encodeURIComponent(source)}&site=${site}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((p: Record<string, unknown>) => {
    const tr = (p.translations as Record<string, Record<string, string>> | undefined)?.[locale] ?? {};
    return {
      id: Number(p.id) || 0,
      image: String(p.cover_image_url || ""),
      title: String(tr.title || p.title || ""),
      tags: itemTags(p, locale),
    };
  });
}

/** Returns null while loading, then the fetched items (possibly empty). */
export function useSourceItems(source: string, siteSlug: string, locale: string): ThumbItem[] | null {
  const key = `${siteSlug}|${source}|${locale}`;
  const [items, setItems] = useState<ThumbItem[] | null>(() => _sourceCache.get(key) ?? null);

  useEffect(() => {
    const cached = _sourceCache.get(key);
    if (cached) {
      setItems(cached);
      return;
    }
    setItems(null);
    let cancelled = false;
    fetchSourceItems(source, siteSlug, locale)
      .then((res) => {
        _sourceCache.set(key, res);
        if (!cancelled) setItems(res);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [key, source, siteSlug, locale]);

  return items;
}

/**
 * Every tag carried by the entries of every source a block draws from, in
 * first-seen order and de-duplicated case-insensitively.
 *
 * One hook rather than useSourceItems per source, because the number of sources
 * changes as the editor ticks categories and a hook cannot be called in a loop.
 * Returns null while any source is still loading.
 */
export function useSourcesTags(
  sources: string[],
  siteSlug: string,
  locale: string,
  managedTags: ManagedTagOption[] = [],
): string[] | null {
  // A stable key so the effect does not re-run on a new array with the same
  // contents — the caller rebuilds `sources` on every render.
  const sourcesKey = sources.join(",");
  /* Straight from the cache on the first render when every source is already
     there, the way useSourceItems does it: switching between blocks that share
     a source should not blink through 「載入標籤中…」 on a list that is already
     in memory. */
  const managedKey = JSON.stringify(managedTags);
  const managedSnapshot = useMemo(() => JSON.parse(managedKey) as ManagedTagOption[], [managedKey]);
  const fromCache = cachedSourcesTags(sources, siteSlug, locale);
  const [tags, setTags] = useState<string[] | null>(() =>
    fromCache === null ? null : mergeManagedTagOptions(fromCache, managedTags, locale),
  );

  useEffect(() => {
    const list = sourcesKey.split(",").filter(Boolean);
    const cached = cachedSourcesTags(list, siteSlug, locale);
    if (cached) { setTags(mergeManagedTagOptions(cached, managedSnapshot, locale)); return; }
    setTags(null);
    let cancelled = false;
    Promise.all(list.map((src) => fetchSourceItems(src, siteSlug, locale)
      .then((res) => { _sourceCache.set(`${siteSlug}|${src}|${locale}`, res); return res; })
      // A source that will not load contributes no tags rather than taking the
      // whole picker down with it.
      .catch(() => [] as ThumbItem[])))
      .then((lists) => { if (!cancelled) setTags(mergeManagedTagOptions(tagsOf(lists), managedSnapshot, locale)); });
    return () => { cancelled = true; };
  }, [sourcesKey, siteSlug, locale, managedSnapshot]);

  return tags;
}

/** Every tag in these lists, de-duplicated case-insensitively, first-seen order.
 *  Folded the way BlockStays folds them, so a tag the picker shows once is a tag
 *  the page matches. */
function tagsOf(lists: ThumbItem[][]): string[] {
  const seen = new Map<string, string>();
  for (const items of lists) {
    for (const item of items) {
      for (const tag of item.tags ?? []) {
        const norm = tag.trim().toLowerCase();
        if (norm && !seen.has(norm)) seen.set(norm, tag.trim());
      }
    }
  }
  return Array.from(seen.values());
}

/** The answer from cache, or null if any one source has yet to be fetched. */
function cachedSourcesTags(sources: string[], siteSlug: string, locale: string): string[] | null {
  const lists: ThumbItem[][] = [];
  for (const src of sources) {
    const hit = _sourceCache.get(`${siteSlug}|${src}|${locale}`);
    if (!hit) return null;
    lists.push(hit);
  }
  return tagsOf(lists);
}

/**
 * 內容過濾標籤 — which entries this block collects, chosen from the tags that
 * actually exist rather than typed.
 *
 * This was a free-text box matched exactly (case-folded and trimmed, but exact)
 * against every entry's own tags. A typo matched nothing, so every source came
 * back empty, so `BlockStays` returned null and the whole block disappeared from
 * the page — no empty state, no message, nothing in the panel to say why. The
 * failure was silent at every step.
 *
 * Two things the picker still has to do:
 *   • a value typed by hand before this existed stays selected and stays
 *     applied, even when it matches nothing — dropping it would change what a
 *     live block shows the moment someone opened its panel. It is listed,
 *     marked, so the editor can see it is matching nothing and decide;
 *   • it stays usable when the list is empty (no source has tags yet, or the
 *     fetch failed): the current value is still shown and still clearable.
 */
export function ContentTagFilterPicker({
  sources, siteSlug, locale, zh, managedTags = [], contentTags, value, onChange,
}: {
  /** Every source the block draws from — the filter applies to all of them. */
  sources: string[];
  siteSlug: string;
  locale: string;
  zh: boolean;
  managedTags?: ManagedTagOption[];
  /** Alias used by block editors: these are the site's managed content tags. */
  contentTags?: ManagedTagOption[];
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const catalogue = contentTags ?? managedTags;
  const available = useSourcesTags(sources, siteSlug, locale, catalogue);
  const selected = Array.from(new Set(
    (Array.isArray(value) ? value : [value])
      .map((tag) => String(tag ?? "").trim())
      .filter(Boolean),
  ));
  // BlockStays compares `tag.trim().toLowerCase()`; anything else here would
  // call a value orphaned that the page is matching perfectly well.
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const orphanTags = available === null
    ? []
    : selected.filter((stored) => !available.some((tag) => same(tag, stored)));
  const options = Array.from(new Map(
    [...(available ?? []), ...orphanTags].map((tag) => [tag.trim().toLowerCase(), tag]),
  ).values());
  const orphan = orphanTags.length > 0;
  const onlyOrphans = orphanTags.length === selected.length;
  const selectedTag = (tag: string) => selected.some((stored) => same(tag, stored));
  const toggle = (tag: string) => {
    onChange(selectedTag(tag)
      ? selected.filter((stored) => !same(stored, tag))
      : [...selected, tag]);
  };

  return (
    <PickerModal
      zh={zh}
      label={zh ? "只收錄哪些主題（選填）" : "Collect these topics (optional)"}
      trigger={selected.length
        ? `${selected.join(zh ? "、" : ", ")}${orphan ? (zh ? "（部分標籤目前沒有內容使用）" : " (some tags match nothing)") : ""}`
        : (zh ? "不過濾：收錄全部內容" : "No filter — every entry")}
      title={zh ? "只收錄帶有任一標籤的內容" : "Collect entries carrying any selected tag"}
      clearLabel={selected.length ? (zh ? "清除" : "Clear") : undefined}
      onClear={selected.length ? () => onChange([]) : undefined}
    >
      {available === null ? (
        <p className="hpb-field-hint">{zh ? "載入標籤中…" : "Loading tags…"}</p>
      ) : (
        <>
          <div className="amenity-checkgrid" aria-label={zh ? "內容過濾標籤，可複選" : "Entry filter tags, multi-select"}>
            <label className={`amenity-checkbox${selected.length ? "" : " is-on"}`}>
              <input
                type="checkbox"
                name="bf-filter-tag"
                checked={!selected.length}
                onChange={() => onChange([])}
              />
              <span>{zh ? "不過濾（收錄全部）" : "No filter (collect everything)"}</span>
            </label>
            {options.map((tag) => (
              <label key={tag} className={`amenity-checkbox${selectedTag(tag) ? " is-on" : ""}`}>
                <input
                  type="checkbox"
                  name="bf-filter-tag"
                  checked={selectedTag(tag)}
                  onChange={() => toggle(tag)}
                />
                <span>{tag}</span>
                {orphanTags.some((stored) => same(tag, stored)) && (
                  <DeletedBadge label={zh ? "查無內容" : "No match"} />
                )}
              </label>
            ))}
          </div>
          {!available.length && (
            <p className="hpb-field-hint" style={{ marginTop: 10 }}>
              {zh
                ? "這些來源的內容目前都沒有標籤。先到內容管理替文章加上標籤，這裡就會列出來。"
                : "No entry in these sources carries a tag yet. Add tags in content management and they will appear here."}
            </p>
          )}
          {orphan && (
            <p className="hpb-field-hint" style={{ marginTop: 10 }}>
              {zh
                ? onlyOrphans
                  ? `目前設定的「${orphanTags.join("、")}」在這些來源裡找不到任何內容——這個區塊在前台會整個消失。改選其他標籤，或選「不過濾」。`
                  : `目前設定的「${orphanTags.join("、")}」找不到內容；只要其他已選標籤仍有內容，區塊仍會顯示。`
                : onlyOrphans
                  ? `“${orphanTags.join(", ")}” match no entry in these sources, so this block disappears from the page. Pick another tag, or choose no filter.`
                  : `“${orphanTags.join(", ")}” match no entry in these sources. The block still shows if another selected tag matches.`}
            </p>
          )}
          <p className="hpb-field-hint" style={{ marginTop: 10 }}>
            {zh
              ? "可複選；前台採 OR，只要內容符合任一標籤就會顯示。"
              : "Select more than one; the page uses OR logic, so an entry matching any selected tag is shown."}
          </p>
        </>
      )}
    </PickerModal>
  );
}

/* ── Block schematic thumbnail (the "piece" IS a mini front-end preview) ─ */

/** Render a real photo when a url is present, otherwise a skeleton box. */

/**
 * Pick specific entries, across every source the block draws from.
 *
 * Order is the order they were ticked, so an editor arranges the row by
 * choosing in sequence rather than hunting for a separate sort control. Tabs
 * switch source without leaving the dialog — a block that pulls 最新消息 and
 * 媒體報導 together used to offer only the first one's entries.
 */
export function EntryPicker({
  sources, siteSlug, locale, zh, selected, onChange,
}: {
  /** [value, zh label, en label, deleted?] for each source this block reads. */
  sources: ContentSource[];
  siteSlug: string;
  locale: string;
  zh: boolean;
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [tab, setTab] = useState(sources[0]?.[0] ?? "stays");
  const active = sources.some(([v]) => v === tab) ? tab : (sources[0]?.[0] ?? "stays");
  const items = useSourceItems(active, siteSlug, locale);
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <PickerModal
      zh={zh}
      label={zh ? "挑選文章" : "Pick entries"}
      trigger={selected.length
        ? (zh ? `已選 ${selected.length} 篇 — 點此調整` : `${selected.length} selected — click to edit`)
        : (zh ? "點此選擇文章…" : "Click to pick entries…")}
      title={zh ? `挑選文章（已選 ${selected.length} 篇，依點選順序排列）` : `Pick entries (${selected.length} chosen, in tick order)`}
      clearLabel={selected.length ? (zh ? "清除" : "Clear") : undefined}
      onClear={selected.length ? () => onChange([]) : undefined}
    >
      {sources.length > 1 && (
        <div className="bf-tabs" role="tablist">
          {sources.map(([val, zhL, enL]) => (
            <button
              key={val}
              type="button"
              role="tab"
              aria-selected={val === active}
              className={`bf-tab${val === active ? " is-on" : ""}`}
              onClick={() => setTab(val)}
            >
              {zh ? zhL : enL}
            </button>
          ))}
        </div>
      )}
      {items === null ? (
        <p className="hpb-field-hint">{zh ? "載入內容中…" : "Loading entries…"}</p>
      ) : !items.length ? (
        <p className="hpb-field-hint">{zh ? "這個來源目前沒有已發佈的內容。" : "This source has no published entries yet."}</p>
      ) : (
        <div className="amenity-checkgrid">
          {items.filter((it) => it.id).map((it) => {
            const on = selected.includes(it.id);
            const order = selected.indexOf(it.id) + 1;
            return (
              <label key={it.id} className={`amenity-checkbox${on ? " is-on" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(it.id)} />
                {on && <span className="amenity-checkbox-icon" aria-hidden="true">{order}</span>}
                <span>{it.title || `#${it.id}`}</span>
              </label>
            );
          })}
        </div>
      )}
    </PickerModal>
  );
}

/**
 * Optionally narrow which article/card labels this block keeps.
 *
 * Card-label ownership lives on each article now. This picker is only a
 * block-wide allow-list, which lets an editor keep an internal 待補圖 or a
 * one-off out of one public row without changing the article. Ticking nothing
 * keeps the automatic behaviour; ticking anything narrows the block to that
 * list, in the order chosen.
 *
 * The tag list comes from the same fetch the entry picker uses, so it can only
 * offer tags that actually exist on this source.
 */
/**
 * The shell every block picker shares: a trigger that reads as the current
 * choice, and a dialog with focus handling.
 *
 * Each picker used to carry its own copy of the backdrop, the focus move, the
 * escape key and the tab wrap — the same forty lines three times, which is
 * three places for the focus trap to drift out of step.
 */
export function PickerModal({
  label, trigger, title, clearLabel, onClear, zh, children,
}: {
  label: string;
  /** What the button says — the current selection, not "open the picker". */
  trigger: string;
  title: string;
  clearLabel?: string;
  onClear?: () => void;
  zh: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);

  /* Escape, the Tab trap, the scroll lock and focus restore, all from the one
     hook the rest of the admin uses. `trapFocus` is not optional for a panel
     claiming `aria-modal="true"`.

     What was here was a local copy of half of it, hung off `onKeyDown` on the
     backdrop. That is a React synthetic handler, so it only ran while focus was
     inside the dialog: clicking the dialog's own heading — not a control, so
     focus lands on <body> — left Escape doing nothing and the page behind still
     scrolling. The focus-restore half also fired on mount, when the dialog had
     never been open, pulling focus onto the trigger as the form rendered. */
  useOverlay(open, () => setOpen(false), { trapFocus: modalRef });

  return (
    <div className="amenity-import picker-shell">
      <div className="amenity-import-head">
        <FieldLabel>{label}</FieldLabel>
        {onClear && clearLabel && (
          <button type="button" className="amenity-import-all" onClick={onClear}>{clearLabel}</button>
        )}
      </div>
      <button type="button" className="bf-picker-trigger" onClick={() => setOpen(true)}>
        {trigger}
      </button>
      {open && (
        <div className="bf-modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="bf-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bf-modal-head">
              <FieldLabel id={titleId}>{title}</FieldLabel>
              <button type="button" className="bf-modal-close" aria-label={zh ? "關閉" : "Close"} onClick={() => setOpen(false)}>&times;</button>
            </div>
            <div className="bf-modal-body">{children}</div>
            <div className="bf-modal-foot">
              <button type="button" className="amenity-import-all" onClick={() => setOpen(false)}>
                {zh ? "完成" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { showsVAlign } from "./blockVAlign";

/* ── Per-role text formatting ───────────────────────────────────────────
 *
 * 客戶: 所有 block 的眉眼和標題的對齊是同步的，內容需要另外分開對齊 — and
 * separately, banner 字體需要能單獨改字體、大小、對齊.
 *
 * Both complaints are the same missing thing. `_textAlign` moves the eyebrow,
 * the heading, the paragraph and the button as one, so "centre the heading but
 * keep the paragraph left" was not expressible in the panel at all; the answer
 * had been a per-site CSS edit, which no editor can make. Each text role now
 * carries its own alignment, font, size, weight and colour under `config._type`.
 *
 * The renderer applies **only** the keys that are present — an absent key means
 * "leave whatever the stylesheet already does". That is the whole reason
 * nothing below is ever stored as "": an empty string is a value, and a value
 * overrides the block's own design. Clearing a control removes the key,
 * clearing a role's last key removes the role, and clearing the last role
 * removes `_type` itself, so a block nobody has restyled stores nothing at all.
 *
 * The reducer is deliberately free of JSX and of imports. It is the entire
 * contract with the render side, and tests/roleTypeControls.test.mts lifts this
 * exact region out of this file and runs it, so a UI change cannot quietly
 * change the stored shape. Keep the fences either side of it intact.
 */

/* @roleType-pure:start */
export type RoleName = "eyebrow" | "title" | "body" | "cta";
export type RoleTypeField = "align" | "font" | "size" | "weight" | "color";

/** One role's overrides. Every field optional — see the note above on why an
 *  unset field must be absent rather than empty. */
export type RoleType = {
  align?: string;
  font?: string;
  size?: string;
  weight?: number;
  color?: string;
};

/** The shape of `config._type`. */
export type RoleTypeConfig = Partial<Record<RoleName, RoleType>>;

export const ROLE_NAMES: RoleName[] = ["eyebrow", "title", "body", "cta"];
export const ROLE_TYPE_FIELDS: RoleTypeField[] = ["align", "font", "size", "weight", "color"];

/** Closed sets: a value outside them is dropped rather than written through,
 *  so neither a stale config nor a hand-edited JSON can put an arbitrary CSS
 *  string where the renderer expects one of ours. `size` and `color` are open
 *  (clamp(), var(), rgba()…) and are sanitised on the render side. */
export const ROLE_ALIGNS: string[] = ["left", "center", "right"];

/** "Follow the site's own title / body / UI face." These three WERE the whole
 *  font menu, which is why a banner's 字體 dropdown read 標題／內文／介面 — three
 *  roles — where the client was looking for a typeface (客戶: 字體不是標題、內文，
 *  而是 font 字體). They stay, and stay first: every live banner has one of them
 *  stored, and "follow the site" is an answer no named face can give. */
export const ROLE_FONT_FOLLOWS: string[] = ["title", "body", "ui"];

/** The three above plus every face in TYPE_FACES.
 *
 *  Spelled out rather than imported: this region is lifted out of the file and
 *  compiled on its own by tests/roleTypeControls.test.mts, so an import here
 *  would not resolve at all. tests/siteFontCatalogue.test.mts asserts this list
 *  is exactly the three follows plus every TYPE_FACES key in catalogue order, so
 *  a face added to the catalogue and forgotten here fails loudly rather than
 *  being silently dropped on save. */
export const ROLE_FONTS: string[] = [
  "title", "body", "ui",
  "songti", "heiti", "kai", "dfkai", "mingliu", "songtitc", "lisong",
  "jhenghei", "pingfang", "heititc", "yuanti", "lihei",
  "cormorant", "ebgaramond", "playfair", "fraunces", "marcellus", "pinyon",
  "georgia", "times", "palatino", "baskerville", "garamond", "didot", "hoefler",
  "cambria", "rockwell", "copperplate",
  "helvetica", "arial", "avenir", "futura", "optima", "gillsans", "verdana",
  "tahoma", "trebuchet", "centurygothic", "calibri", "lucida", "segoe", "system",
  "mono",
];
export const ROLE_WEIGHTS: number[] = [300, 400, 500, 600, 700];

/** The one place a stored role is judged. Returns `undefined` — not `{}` — for
 *  a role that sets nothing, which is what collapses the empty levels. */
function normaliseRole(raw: unknown): RoleType | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const src = raw as Record<string, unknown>;
  const out: RoleType = {};

  const align = String(src.align ?? "").trim();
  if (ROLE_ALIGNS.indexOf(align) >= 0) out.align = align;

  const font = String(src.font ?? "").trim();
  if (ROLE_FONTS.indexOf(font) >= 0) out.font = font;

  const size = String(src.size ?? "").trim();
  if (size) out.size = size;

  // Accepts a legacy "600" as well as 600; stored back as a number either way.
  const weight = Number(src.weight);
  if (ROLE_WEIGHTS.indexOf(weight) >= 0) out.weight = weight;

  const color = String(src.color ?? "").trim();
  if (color) out.color = color;

  return Object.keys(out).length ? out : undefined;
}

/** `config._type`, normalised, whatever happens to be stored there. */
export function readRoleTypes(c: Record<string, unknown>): RoleTypeConfig {
  const raw = c ? c._type : undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: RoleTypeConfig = {};
  for (const role of ROLE_NAMES) {
    const kept = normaliseRole(src[role]);
    if (kept) out[role] = kept;
  }
  return out;
}

export function readRoleType(c: Record<string, unknown>, role: RoleName): RoleType {
  return readRoleTypes(c)[role] ?? {};
}

/** What a control shows. "" means "not set", which is also what clears it. */
export function roleTypeValue(c: Record<string, unknown>, role: RoleName, field: RoleTypeField): string {
  const v = (readRoleType(c, role) as Record<string, unknown>)[field];
  return v === undefined || v === null ? "" : String(v);
}

/** Does this role override anything? Drives the "customised" marker on a tab. */
export function hasRoleType(c: Record<string, unknown>, role: RoleName): boolean {
  return Object.keys(readRoleType(c, role)).length > 0;
}

/**
 * Replace one role wholesale, collapsing every level that ends up empty: the
 * role disappears from `_type` when it sets nothing, and `_type` disappears
 * from the config when no role is left. Never mutates the config it is given —
 * it is React state.
 */
export function writeRoleType(
  c: Record<string, unknown>,
  role: RoleName,
  next: RoleType,
): Record<string, unknown> {
  const all = readRoleTypes(c);
  const kept = normaliseRole(next);
  if (kept) all[role] = kept;
  else delete all[role];

  const rest: Record<string, unknown> = { ...c };
  delete rest._type;
  return Object.keys(all).length ? { ...rest, _type: all } : rest;
}

/**
 * Set (or, with an empty value, clear) one field of one role.
 *
 * It only records what the control said. It does not trim, coerce or check —
 * normaliseRole above is the single place a value is judged, and it drops a
 * blank, a whitespace-only box and anything outside the closed sets. So an
 * emptied control clears the field by the same route that rejects a bad one,
 * and there is no second copy of the rule here to drift out of step with it.
 */
export function setRoleTypeField(
  c: Record<string, unknown>,
  role: RoleName,
  field: RoleTypeField,
  value: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...readRoleType(c, role) };
  next[field] = value;
  return writeRoleType(c, role, next as RoleType);
}

/** Drop every override on one role. */
export function clearRoleType(c: Record<string, unknown>, role: RoleName): Record<string, unknown> {
  return writeRoleType(c, role, {});
}
/* @roleType-pure:end */

const ROLE_LABELS: Record<RoleName, [string, string]> = {
  eyebrow: ["眉眼", "Eyebrow"],
  title: ["標題", "Title"],
  body: ["內文", "Body"],
  cta: ["按鈕", "CTA"],
};

const ROLE_HINTS: Record<RoleName, [string, string]> = {
  eyebrow: ["標題上方的小字（如「ABOUT US」）。", "The small line above the heading."],
  title: ["版塊的大標題。", "The block's heading."],
  body: ["段落內文；可與標題分開對齊。", "Paragraph copy; aligns separately from the heading."],
  cta: ["行動按鈕上的文字。", "The text on the action button."],
};

/* Sample text for the live preview, per role. Not one string for all four: the
   four tabs carried four identical control sets and nothing else, so an editor
   could not tell from the panel which role they were on — the preview is what
   makes a tab look like the thing it styles. */
const ROLE_SAMPLES: Record<RoleName, [string, string]> = {
  eyebrow: ["關於我們 ABOUT US", "ABOUT US"],
  title: ["山嵐間的靜謐 Aa 123", "A Quiet Stay Aa 123"],
  body: ["在這裡放慢下來。Slow down here.", "Slow down here. 在這裡放慢下來。"],
  cta: ["立即探索 Explore", "Explore Now"],
};

/**
 * What one role's settings actually look like, drawn with those settings.
 *
 * The size is run through the SAME sanitiser the render side uses, for two
 * reasons. It keeps a typed string out of a style attribute, and — more useful
 * day to day — a size the renderer will reject now visibly does nothing here
 * too, with a line saying so, instead of being accepted by the box and silently
 * dropped on the page.
 *
 * `min(…, 44px)` because the size a banner headline wants is a clamp() that
 * resolves to 60px+ — full size in a 300px sidebar would push the rest of the
 * panel off screen every time the tab is opened.
 */
function RoleTypePreview({
  align, color, font, role, size, weight, zh, uid,
}: {
  align: string;
  color: string;
  font: string;
  role: RoleName;
  size: string;
  weight: string;
  zh: boolean;
  /* So the two warnings below can be POINTED AT by the inputs that cause them.
     They were bare paragraphs after the preview box: a screen reader reached
     them only by wandering past the swatch, and nothing marked either field as
     invalid. The file already does this correctly for the hero colour 2,500
     lines up — aria-invalid on the input, aria-describedby to the message. */
  uid: string;
}) {
  const family = ROLE_FONT_FOLLOWS.indexOf(font) >= 0 ? `var(--font-${font})` : safeFace(font);
  const okSize = safeLength(size);
  const badSize = size.trim() !== "" && !okSize;
  /* The colour gets the same treatment the size already had. It was passed to
     the preview raw, so a typo showed as "the browser ignored it" in here and
     as something else again on the page: an unrecognised value makes the
     declaration invalid at computed-value time, and a custom property that is
     invalid at that point resolves to `inherit` rather than to the fallback the
     rule spells out. Two different wrong colours, neither of them explained. */
  const okColor = safeCssColor(color);
  const badColor = color.trim() !== "" && !okColor;
  return (
    <div>
      <FieldLabel>{zh ? "預覽" : "Preview"}</FieldLabel>
      <div
        style={{
          marginTop: 4,
          padding: "10px 12px",
          border: "1px solid var(--line, #d6d1c5)",
          borderRadius: 8,
          background: "var(--paper, #fff)",
          minHeight: 56,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            width: "100%",
            fontFamily: family || undefined,
            fontSize: okSize ? `min(${okSize}, 44px)` : undefined,
            fontWeight: weight ? Number(weight) : undefined,
            color: okColor || undefined,
            textAlign: (align || "left") as React.CSSProperties["textAlign"],
            lineHeight: 1.35,
            display: "block",
          }}
        >
          {ROLE_SAMPLES[role][zh ? 0 : 1]}
        </span>
      </div>
      {badSize && (
        <p id={`${uid}-size-err`} role="alert" className="hpb-field-hint" style={{ color: "var(--danger, #b3261e)" }}>
          {zh
            ? "這個字級無法辨識，前台會忽略它。請填 18px、1.4rem，或 clamp(16px,2vw,24px)。"
            : "That size is not recognised and the page will ignore it. Use 18px, 1.4rem, or clamp(16px,2vw,24px)."}
        </p>
      )}
      {badColor && (
        <p id={`${uid}-color-err`} role="alert" className="hpb-field-hint" style={{ color: "var(--danger, #b3261e)" }}>
          {zh
            ? "這個顏色無法辨識，前台會改用繼承的顏色。請填 #8b6a43、rgb(139,106,67)，或 red。"
            : "That colour is not recognised; the page will fall back to the inherited colour. Use #8b6a43, rgb(139,106,67), or red."}
        </p>
      )}
    </div>
  );
}

/**
 * The five per-role settings, one role at a time.
 *
 * Twenty controls laid out at once is what this panel cannot afford — it
 * already carries content, alignment, spacing, background and anchor. So the
 * roles are tabs: four short buttons, then the five settings for whichever is
 * open. A tab carries a dot once its role overrides anything, which is the only
 * way to tell from the closed state that a role has been touched.
 *
 * Every write goes through setRoleTypeField / clearRoleType. Writing `_type`
 * from here directly is what would put an "" back into a stored role.
 */
export function RoleTypeControls({
  c,
  zh,
  onChange,
  roles,
}: {
  c: Record<string, unknown>;
  zh: boolean;
  onChange: (next: Record<string, unknown>) => void;
  roles?: RoleName[];
}) {
  const shown = ROLE_NAMES.filter((r) => (roles ? roles.indexOf(r) >= 0 : true));
  const [picked, setPicked] = useState<RoleName>(shown[0] ?? "title");
  const uid = useId();
  if (!shown.length) return null;

  const role: RoleName = shown.indexOf(picked) >= 0 ? picked : shown[0];
  const set = (field: RoleTypeField, value: string) => onChange(setRoleTypeField(c, role, field, value));
  const val = (field: RoleTypeField) => roleTypeValue(c, role, field);
  const name = (r: RoleName) => ROLE_LABELS[r][zh ? 0 : 1];
  const color = val("color");
  /* The same two checks the preview runs, so the field and the message it
     points at can never disagree about whether the value is usable. */
  const badRoleSize = val("size").trim() !== "" && !safeLength(val("size"));
  const badRoleColor = color.trim() !== "" && !safeCssColor(color);

  return (
    <div style={{ marginTop: 4 }}>
      <FieldLabel>{zh ? "各別文字格式" : "Per-role formatting"}</FieldLabel>
      {/* The tabs. tabIndex -1 on the inactive ones keeps the group a single
          Tab stop, which is what a tablist is supposed to be. */}
      {/* Arrow keys, because the roving tabindex below makes every unselected
          tab untabbable — without a key handler 眉眼／標題／內文／按鈕 were
          reachable with a mouse only. This is the other half of the ARIA tabs
          pattern; having one half was worse than having neither. */}
      <div
        className="hpb-variant-pick"
        role="tablist"
        aria-label={zh ? "文字角色" : "Text role"}
        onKeyDown={(e) => {
          const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
          if (!keys.includes(e.key)) return;
          e.preventDefault();
          const at = shown.indexOf(role);
          const to =
            e.key === "Home" ? 0
            : e.key === "End" ? shown.length - 1
            : e.key === "ArrowLeft" ? (at - 1 + shown.length) % shown.length
            : (at + 1) % shown.length;
          setPicked(shown[to]);
          const next = e.currentTarget.querySelectorAll("button")[to] as HTMLButtonElement | undefined;
          next?.focus();
        }}
      >
        {shown.map((r) => {
          const on = r === role;
          const customised = hasRoleType(c, r);
          return (
            <button
              key={r}
              type="button"
              role="tab"
              id={`${uid}-tab-${r}`}
              aria-selected={on}
              aria-controls={`${uid}-panel`}
              tabIndex={on ? 0 : -1}
              aria-label={customised ? `${name(r)}${zh ? "（已設定）" : " (customised)"}` : name(r)}
              className={`hpb-variant-pick__btn${on ? " is-active" : ""}`}
              onClick={() => setPicked(r)}
            >
              {name(r)}
              {customised && <span aria-hidden="true"> •</span>}
            </button>
          );
        })}
      </div>

      <div
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${role}`}
        style={{ marginTop: 10 }}
      >
        <Field label={zh ? `${name(role)}對齊` : `${name(role)} align`}>
          <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={zh ? `${name(role)}對齊` : `${name(role)} align`}>
            {([
              ["", zh ? "預設" : "Default"],
              ["left", zh ? "靠左" : "Left"],
              ["center", zh ? "置中" : "Center"],
              ["right", zh ? "靠右" : "Right"],
            ] as [string, string][]).map(([v, lbl]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={val("align") === v}
                className={`hpb-variant-pick__btn${val("align") === v ? " is-active" : ""}`}
                onClick={() => set("align", v)}
              >
                {lbl}
              </button>
            ))}
          </div>
        </Field>

        {/* Full width, and not inside a Field. It was half a row holding a
            three-option menu; it now carries the whole face catalogue, and it
            brings its own label tied by htmlFor — a Field is itself a label, and
            wrapping one around a control that already has one is the defect
            tests/typeScaleFieldLabels.test.mts exists for. */}
        <div style={{ marginBottom: 10 }}>
          <FontFacePicker
            zh={zh}
            label={zh ? "字體" : "Font"}
            value={val("font")}
            onChange={(v) => set("font", v)}
            blank={{ value: "", label: zh ? "預設（沿用版塊）" : "Default (block's own)" }}
            fallbackStack={ROLE_FONT_FOLLOWS.indexOf(val("font")) >= 0 ? `var(--font-${val("font")})` : ""}
          >
            {/* The three original values, kept and kept FIRST. Every live banner
                has one of them stored, and "follow the site" is an answer no
                named face can give — but they are a group of their own now,
                because presenting them as the whole 字體 menu is what read as
                「字體不是標題、內文」. */}
            <optgroup label={zh ? "跟隨網站" : "Follow the site"}>
              <option value="title" style={{ fontFamily: "var(--font-title)" }}>{zh ? "網站標題字體" : "Site title face"}</option>
              <option value="body" style={{ fontFamily: "var(--font-body)" }}>{zh ? "網站內文字體" : "Site body face"}</option>
              <option value="ui" style={{ fontFamily: "var(--font-ui)" }}>{zh ? "網站介面字體" : "Site UI face"}</option>
            </optgroup>
          </FontFacePicker>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: 10 }}>
          {/* A free text box rather than a preset list: a banner heading has to
              be able to hold a clamp() so it scales, and no fixed list of px
              values can express that (客戶: banner 字體需要能單獨改字體、大小). */}
          <Field label={zh ? "字級" : "Size"}>
            <input
              type="text"
              value={val("size")}
              onChange={(e) => set("size", e.target.value)}
              aria-invalid={badRoleSize || undefined}
              aria-describedby={badRoleSize ? `${uid}-size-err` : undefined}
              placeholder={zh ? "例如 18px 或 clamp(16px,2vw,24px)" : "e.g. 18px or clamp(16px,2vw,24px)"}
              style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
            />
          </Field>
          <Field label={zh ? "字重" : "Weight"}>
            <select value={val("weight")} onChange={(e) => set("weight", e.target.value)}>
              <option value="">{zh ? "預設" : "Default"}</option>
              {ROLE_WEIGHTS.map((w) => (
                <option key={w} value={String(w)}>{String(w)}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* A Field is a <label> and names only its first control, so the two
            halves are named explicitly — same reason as the hero colours. */}
        <Field label={zh ? "顏色" : "Colour"}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="color"
              aria-label={zh ? `${name(role)}顏色（色票）` : `${name(role)} colour (swatch)`}
              value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000"}
              onChange={(e) => set("color", e.target.value)}
              style={{ width: 40, height: 32, border: "1px solid var(--line)", borderRadius: 4, cursor: "pointer" }}
            />
            {/* The swatch has no empty state — clearing the hex box is the only
                way back to "use the block's own colour". */}
            <input
              type="text"
              aria-label={zh ? `${name(role)}顏色（色碼，留空為預設）` : `${name(role)} colour (hex, blank = default)`}
              value={color}
              onChange={(e) => set("color", e.target.value)}
              aria-invalid={badRoleColor || undefined}
              aria-describedby={badRoleColor ? `${uid}-color-err` : undefined}
              placeholder={zh ? "預設" : "Default"}
              style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
            />
          </div>
        </Field>

        <RoleTypePreview
          uid={uid}
          align={val("align")}
          color={color}
          font={val("font")}
          role={role}
          size={val("size")}
          weight={val("weight")}
          zh={zh}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}>
          <p className="hpb-field-hint" style={{ margin: 0 }}>{ROLE_HINTS[role][zh ? 0 : 1]}</p>
          {hasRoleType(c, role) && (
            <button
              type="button"
              className="hpb-variant-pick__btn"
              style={{ flex: "0 0 auto" }}
              onClick={() => onChange(clearRoleType(c, role))}
            >
              {zh ? `清除${name(role)}` : `Reset ${name(role)}`}
            </button>
          )}
        </div>
        <p className="hpb-field-hint">
          {zh
            ? "留空的設定沿用版塊原本的樣式；此處只覆寫有填的項目。上方的「對齊方式」仍是整個版塊的預設值。"
            : "A blank setting keeps the block's own styling — only what you fill in is overridden. The Text Align above stays the block-wide default."}
        </p>
      </div>
    </div>
  );
}

/**
 * 資料來源 — which CMS categories this row draws from.
 *
 * Was a dropdown for the main category plus a grid of tick-boxes for the
 * others: two controls for one decision, and the grid sat open in the panel
 * taking the space three real settings would.
 */
export function SourcesPicker({
  contentSources, zh, source, extra, onChange,
}: {
  contentSources: ContentSource[];
  zh: boolean;
  source: string;
  extra: string[];
  onChange: (source: string, extra: string[]) => void;
}) {
  const [sourceSearch, setSourceSearch] = useState("");
  const chosen = [source, ...extra];
  const labelOf = (val: string) => {
    const found = contentSources.find(([v]) => v === val);
    return found ? (zh ? found[1] : found[2]) : val;
  };

  /* Split, not one grid. The catalogue and the CMS categories obey different
     rules, and a single undivided grid gave no sign of that: building up three
     categories and then ticking 住宿 wiped all three at once with no
     explanation, which reads as the control being broken rather than as a
     rule (客戶: 選擇住宿後無法選其他分類 — measured, the switch does work;
     what does not is holding both at the same time). */
  /* A category whose 頁面管理 page has been deleted is not something to start
     using: its index route 404s and 內容管理 no longer offers it either. But it
     is not simply removed from the list, because a live block can already be
     holding it — 禾境's homepage draws 媒體報導 from exactly such a page,
     and dropping the row silently would have hidden both the fact and the only
     control that can undo it. So: offered only while it is still ticked, and
     marked 已刪除 when it is, so the editor can see why it is there and untick
     it deliberately. (頁面管理, 內容管理's category dropdown and the site nav all
     filter tombstones the same way; this picker was the one that did not.) */
  const offered = contentSources.filter(([val, zhLabel, enLabel, deleted]) => (!deleted || chosen.includes(val)) && [zhLabel, enLabel].some((label) => label.toLocaleLowerCase().includes(sourceSearch.trim().toLocaleLowerCase())));
  const catalogueSources = offered.filter(([val]) => val === "stays");
  const articleSources = offered.filter(([val]) => val !== "stays");
  const deletedChosen = contentSources.filter(([val, , , deleted]) => deleted && chosen.includes(val));

  const toggle = (val: string) => {
    // 住宿目錄 is the stay catalogue, not a CMS category — it cannot be mixed
    // with articles, so picking it replaces the selection and vice versa.
    if (val === "stays" || source === "stays") { onChange(val, []); return; }
    const next = chosen.includes(val) ? chosen.filter((v) => v !== val) : [...chosen, val];
    if (!next.length) return;
    onChange(next[0], next.slice(1));
  };

  return (
    <PickerModal
      zh={zh}
      label={zh ? "從哪些頁面收錄內容" : "Collect content from these pages"}
      trigger={chosen
        .map((val) => (deletedChosen.some(([v]) => v === val)
          ? `${labelOf(val)}${zh ? "（已刪除）" : " (deleted)"}`
          : labelOf(val)))
        .join(zh ? "、" : ", ")}
      title={zh ? "選擇資料來源（可複選）" : "Pick content sources"}
    >
      <input aria-label={zh ? "搜尋顯示頁面" : "Search listing pages"} placeholder={zh ? "搜尋頁面名稱" : "Search page names"} value={sourceSearch} onChange={(e) => setSourceSearch(e.target.value)} />
      <p className="bf-src-group">{zh ? "住宿目錄" : "Stay catalogue"}</p>
      <div className="amenity-checkgrid">
        {catalogueSources.map(([val, zhL, enL]) => (
          <label key={val} className={`amenity-checkbox${chosen.includes(val) ? " is-on" : ""}`}>
            <input type="checkbox" checked={chosen.includes(val)} onChange={() => toggle(val)} />
            <span>{zh ? zhL : enL}</span>
          </label>
        ))}
      </div>
      <p className="bf-src-group" style={{ marginTop: 14 }}>
        {zh ? "文章顯示頁面（可複選）" : "Article listing pages (multiple)"}
      </p>
      <div className="amenity-checkgrid">
        {articleSources.map(([val, zhL, enL, deleted]) => (
          <label key={val} className={`amenity-checkbox${chosen.includes(val) ? " is-on" : ""}`}>
            <input type="checkbox" checked={chosen.includes(val)} onChange={() => toggle(val)} />
            <span>{zh ? zhL : enL}</span>
            {deleted && <DeletedBadge label={zh ? "已刪除" : "Deleted"} />}
          </label>
        ))}
      </div>
      {deletedChosen.length > 0 && (
        <p className="hpb-field-hint" style={{ marginTop: 10 }}>
          {zh
            ? `「${deletedChosen.map(([, zhL]) => zhL).join("、")}」的分類頁已在頁面管理刪除，所以不能再新選；這個區塊還在用它，內容仍會顯示，取消勾選就會移除。`
            : `${deletedChosen.map(([, , enL]) => enL).join(", ")} was deleted in page management, so it can no longer be newly picked. This block still draws it and its entries still appear — untick it to stop.`}
        </p>
      )}
      <p className="hpb-field-hint" style={{ marginTop: 10 }}>
        {zh
          ? "住宿目錄不能和文章分類混用：選了住宿會清掉已選的分類，反之亦然。"
          : "The stay catalogue cannot be mixed with article categories: picking one clears the other."}
      </p>
      <p className="hpb-field-hint" style={{ marginTop: 6 }}>
        {zh
          ? "訪客篩選方式在「版面」設定；卡片文字到文章編輯頁管理。"
          : "Set visitor filters under Layout. Manage card labels in the article editor."}
      </p>
    </PickerModal>
  );
}

