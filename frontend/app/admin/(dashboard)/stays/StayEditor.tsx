"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  Languages,
  Plus,
  Send,
  Trash2,
  X
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useLocaleFields } from "../../modules/useLocaleFields";
import { draftJson, useFormDraft } from "../../modules/useFormDraft";
import type { Stay } from "../../../modules/api";
import HeroImageField from "./HeroImageField";
import ConfirmSubmitButton from "../../modules/ConfirmSubmitButton";
import SeoPreview from "../../modules/SeoPreview";
import SubmitButton from "../../modules/SubmitButton";
import { splitBi, joinBi, setBi, cleanBi } from "../../modules/stayBilingual";
import StatusBadge from "../../modules/StatusBadge";
import { Badge, Button, buttonClass, Callout, Card, Field, FormGrid, InputGroup, Input, Progress, Segmented, Select, Stack, Textarea } from "../../ui";
import "./stays.css";
/* ─── Types ─── */
type RoomType = { name: string; description: string; price: number; capacity: number };
type StayImage = { image_url: string; alt_text: string; sort_order: number };
type StayFormValue = Partial<Stay & { status: string }>;
type TranslationsMap = Record<string, Record<string, string>>;

type Props = {
  action: (formData: FormData) => void;
  copy: Record<string, unknown>;
  deleteAction?: (formData: FormData) => void;
  heroLabels: Record<string, string>;
  isDeleted?: boolean;
  restoreAction?: (formData: FormData) => void;
  returnTo: string;
  siteUrl: string;
  stay?: StayFormValue | null;
  /** 服務設施 options from the site's search settings — the searchable vocabulary. */
  facilityOptions: { value: string; label: string; labels?: { zh: string; en: string } }[];
  /** 慢域體驗 options from the site's search settings. */
  experienceOptions: { value: string; label: string; labels?: { zh: string; en: string } }[];
  statusLabels: Record<string, string>;
  title: string;
  subtitle: string;
  zh: boolean;
  /** The last save came back with an error. Every action here redirects on
   *  failure as well as success, so without this the editor remounts seeded
   *  from the last SAVED stay and the attempt's work is gone. */
  saveFailed?: boolean;
};

/* Preset amenities — bilingual pairs for toggle sync */
const PRESET_AMENITIES: [string, string][] = [
  ["附贈早餐", "Breakfast Included"],
  ["專屬停車位", "Private Parking"],
  ["私人廚房", "Private Kitchen"],
  ["溫泉/浴池", "Hot Spring / Bath"],
  ["寵物友善", "Pet Friendly"],
  ["游泳池", "Swimming Pool"],
  ["健身房", "Gym"],
  ["WiFi", "WiFi"],
  ["洗衣機", "Washer"],
  ["烤肉區", "BBQ Area"]
];

/* County suggestions. `region` is the county and `destination` the district;
   the public search and stayLocations.ts use the same meanings. */
const COUNTIES = ["宜蘭縣", "花蓮縣", "臺東縣", "屏東縣", "臺中市", "南投縣", "苗栗縣"];

/* ─── Component ─── */
export default function StayEditor({
  action,
  copy,
  deleteAction,
  heroLabels,
  isDeleted,
  restoreAction,
  returnTo,
  siteUrl,
  stay,
  facilityOptions,
  experienceOptions,
  statusLabels,
  title,
  subtitle,
  zh,
  saveFailed
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  /* ── Tab state ── */
  const [tab, setTab] = useState(0);

  /* ── Language toggle ── */
  const defaultLocale: "zh" | "en" = zh ? "zh" : "en";
  const [editLocale, setEditLocale] = useState<"zh" | "en">(defaultLocale);

  /* ── Bilingual fields stored per-locale ── */
  const [i18nFields, setI18nFields] = useState<Record<string, Record<string, string>>>(() => {
    const tr = (stay?.translations ?? {}) as TranslationsMap;
    return {
      zh: {
        name: tr.zh?.name || (zh ? stay?.name ?? "" : ""),
        summary: tr.zh?.summary || (zh ? stay?.summary ?? "" : ""),
        story: tr.zh?.story || (zh ? stay?.story ?? "" : ""),
        destination: tr.zh?.destination || (zh ? stay?.destination ?? "" : ""),
        region: tr.zh?.region || (zh ? stay?.region ?? "" : ""),
      },
      en: {
        name: tr.en?.name || (!zh ? stay?.name ?? "" : ""),
        summary: tr.en?.summary || (!zh ? stay?.summary ?? "" : ""),
        story: tr.en?.story || (!zh ? stay?.story ?? "" : ""),
        destination: tr.en?.destination || (!zh ? stay?.destination ?? "" : ""),
        region: tr.en?.region || (!zh ? stay?.region ?? "" : ""),
      },
    };
  });

  const { getField, setField } = useLocaleFields(i18nFields, setI18nFields, editLocale);

  /* ── Primary values (default locale, used for hidden inputs) ── */
  const name = i18nFields[defaultLocale]?.name ?? "";
  const summary = i18nFields[defaultLocale]?.summary ?? "";
  const story = i18nFields[defaultLocale]?.story ?? "";
  const destination = i18nFields[defaultLocale]?.destination ?? "";
  const region = i18nFields[defaultLocale]?.region ?? "";

  /* ── Tab 1: Identity & Copy ── */
  const [slug, setSlug] = useState(stay?.slug ?? "");

  /* ── Tab 2: Amenities & Room Types ── */
  const [amenities, setAmenities] = useState<string[]>(() => {
    const raw = stay?.amenities;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === "string") return (raw as string).split("\n").map((s) => s.trim()).filter(Boolean);
    return [];
  });
  /* Search facilities — canonical values ticked from the site's filter list.
     Separate from `amenities`, which is the copy shown on the villa page. */
  const [facilities, setFacilities] = useState<string[]>(() => {
    const raw = (stay as { facilities?: unknown } | null | undefined)?.facilities;
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === "string") return raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    return [];
  });
  const facilitiesValue = facilities.join("\n");
  const toggleFacility = useCallback((value: string) => {
    setFacilities((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  }, []);
  const [experiences, setExperiences] = useState<string[]>(() => {
    const raw = (stay as { experiences?: unknown } | null | undefined)?.experiences;
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === "string") return raw.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    return [];
  });
  const experiencesValue = experiences.join("\n");
  const toggleExperience = useCallback((value: string) => {
    setExperiences((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  }, []);

  const [customAmenity, setCustomAmenity] = useState("");
  const [customAmenityEn, setCustomAmenityEn] = useState("");
  const [roomTypes, setRoomTypes] = useState<RoomType[]>(
    stay?.room_types?.length ? stay.room_types : []
  );

  /* ── Tab 2 addition: Tags ── */
  const [tags, setTags] = useState<string[]>(() => {
    const raw = stay?.tags;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === "string") return (raw as string).split("\n").map((s) => s.trim()).filter(Boolean);
    return [];
  });
  const [newTag, setNewTag] = useState("");
  const [newTagEn, setNewTagEn] = useState("");

  /* ── Tab 3: Details & Location (NEW) ── */
  type FaqItem = { question: string; answer: string };
  const [faq, setFaq] = useState<FaqItem[]>(
    stay?.faq?.length ? stay.faq.map((f) => ({ question: f.question ?? "", answer: f.answer ?? "" })) : []
  );
  const [houseRules, setHouseRules] = useState<string[]>(() => {
    const raw = stay?.house_rules;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === "string") return (raw as string).split("\n").map((s) => s.trim()).filter(Boolean);
    return [];
  });
  const [newRule, setNewRule] = useState("");
  const [newRuleEn, setNewRuleEn] = useState("");
  const loc = (stay?.location_config ?? {}) as Record<string, string>;
  const social = (stay?.social_links ?? {}) as Record<string, string>;
  const [locationAddress, setLocationAddress] = useState<string>(loc.address ?? "");
  const [locationMapUrl, setLocationMapUrl] = useState<string>(loc.map_url ?? "");
  const [locationMapEmbed, setLocationMapEmbed] = useState<string>(loc.map_embed ?? "");
  // Coordinates let the map block pull this stay in as a pin. They live in
  // location_config beside the address, so no schema change was needed.
  const [locationLat, setLocationLat] = useState<string>(String(loc.lat ?? ""));
  const [locationLng, setLocationLng] = useState<string>(String(loc.lng ?? ""));
  const [socialLine, setSocialLine] = useState<string>(social.line ?? "");
  const [socialFb, setSocialFb] = useState<string>(social.facebook ?? "");
  const [socialIg, setSocialIg] = useState<string>(social.instagram ?? "");

  /* ── Tab 4: Visuals ── */
  const [heroUrl, setHeroUrl] = useState(stay?.hero_image_url ?? "");
  const [images, setImages] = useState<StayImage[]>(
    stay?.images?.length ? stay.images : []
  );
  /* ── Tab 5: SEO ── */
  const seo = stay?.seo ?? {};
  const [seoTitle, setSeoTitle] = useState((seo as Record<string, string>).title ?? stay?.name ?? "");
  const [seoDesc, setSeoDesc] = useState((seo as Record<string, string>).description ?? stay?.summary ?? "");
  const [seoCanonical, setSeoCanonical] = useState((seo as Record<string, string>).canonical ?? "");
  const [seoOgImage, setSeoOgImage] = useState((seo as Record<string, string>).og_image ?? "");

  /* ── Sidebar ── */
  const [status, setStatus] = useState(stay?.status ?? "draft");
  const [basePrice, setBasePrice] = useState(stay?.base_price ?? 9800);
  const [maxGuests, setMaxGuests] = useState(stay?.max_guests ?? 2);
  const [bookingUrl, setBookingUrl] = useState(stay?.booking_url ?? "");
  const [sortOrder, setSortOrder] = useState(stay?.sort_order ?? 0);

  /* Name the stay in the delete dialog, and say where it goes. An unnamed
     "確定嗎？" is the prompt everyone dismisses without reading, which is the
     one thing a confirmation must not become — see the same wording on the
     block editors. 已刪除 rather than "cannot be undone": this delete IS
     recoverable, and overstating it would leave nothing left to say on the
     永久刪除 that is not. */
  const deletedName = (name || stay?.name || "").trim();
  const deleteConfirmBody =
    defaultLocale === "zh"
      ? `確定要刪除${deletedName ? `「${deletedName}」` : "這個住宿"}嗎？住宿會從前台下架並移到「已刪除」，可在該處還原。`
      : `Delete ${deletedName ? `"${deletedName}"` : "this stay"}? It comes off the public site and moves to the deleted list, where it can be restored.`;

  /* ── Completeness checks ── */
  const checks = useMemo(() => {
    const items = [
      {
        label: defaultLocale === "zh" ? "基礎資訊與文案" : "Identity & Copy",
        desc: defaultLocale === "zh" ? "名稱、地區與故事已填寫。" : "Name, region, and story are filled.",
        ok: Boolean(name && region && destination && summary)
      },
      {
        label: defaultLocale === "zh" ? "房型與價格設定" : "Room Types & Pricing",
        desc: defaultLocale === "zh" ? "至少包含一種房型。" : "At least one room type added.",
        ok: roomTypes.length > 0
      },
      {
        label: defaultLocale === "zh" ? "詳細資訊" : "Details & Location",
        desc: defaultLocale === "zh" ? "FAQ 或入住須知已填寫。" : "FAQ or house rules filled.",
        ok: faq.length > 0 || houseRules.length > 0
      },
      {
        label: defaultLocale === "zh" ? "主視覺與圖庫" : "Hero & Gallery",
        desc: defaultLocale === "zh" ? "主圖已設定，圖庫至少 3 張。" : "Hero set and gallery has 3+ images.",
        ok: Boolean(heroUrl) && images.length >= 3
      },
      {
        label: defaultLocale === "zh" ? "SEO 設置" : "SEO Setup",
        desc: defaultLocale === "zh" ? "搜尋引擎標題與描述已填寫。" : "Search title and description filled.",
        ok: Boolean(seoTitle && seoDesc)
      }
    ];
    const doneCount = items.filter((i) => i.ok).length;
    return { items, doneCount, pct: Math.round((doneCount / items.length) * 100) };
  }, [name, region, destination, summary, roomTypes.length, heroUrl, images.length, faq.length, houseRules.length, seoTitle, seoDesc, defaultLocale]);

  /* SEO tab warning */
  const seoWarning = !seoTitle || !seoDesc;

  /* ── Serialization for hidden inputs ── */
  /* Draft recovery. Everything here lives in React state and is serialised into
     hidden inputs on submit, so restoring the DOM alone would be overwritten on
     the next render — the recovered values have to go back into state. */
  const { stash: stashDraft, recovered: draftRecovered, registerForm } = useFormDraft(
    `stay-draft:${stay?.id ?? "new"}`,
    saveFailed,
    {
      onRestore: (d) => {
        const json = draftJson;
        const lines_ = (v: string | undefined) => (v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
        // `translations` carries name / summary / story / destination / region.
        if (d.translations) setI18nFields(json(d.translations, {} as Record<string, Record<string, string>>));
        if (d.slug !== undefined) setSlug(d.slug);
        if (d.hero_image_url !== undefined) setHeroUrl(d.hero_image_url);
        if (d.booking_url !== undefined) setBookingUrl(d.booking_url);
        if (d.status !== undefined) setStatus(d.status);
        if (d.sort_order !== undefined) setSortOrder(Number(d.sort_order) || 0);
        if (d.base_price !== undefined) setBasePrice(Number(d.base_price) || 0);
        if (d.max_guests !== undefined) setMaxGuests(Number(d.max_guests) || 1);
        if (d.amenities !== undefined) setAmenities(lines_(d.amenities));
        if (d.facilities !== undefined) setFacilities(lines_(d.facilities));
        if (d.experiences !== undefined) setExperiences(lines_(d.experiences));
        if (d.tags !== undefined) setTags(lines_(d.tags));
        if (d.house_rules !== undefined) setHouseRules(lines_(d.house_rules));
        if (d.faq !== undefined) setFaq(json(d.faq, []));
        if (d.location_address !== undefined) setLocationAddress(d.location_address);
        if (d.seo_title !== undefined) setSeoTitle(d.seo_title);
        if (d.social_line !== undefined) setSocialLine(d.social_line);
      },
    },
  );

  const amenitiesValue = amenities.join("\n");
  const roomTypesValue = roomTypes
    .map((r) => `${cleanBi(r.name)} | ${cleanBi(r.description)} | ${r.price} | ${r.capacity}`)
    .join("\n");
  const imagesValue = images
    .map((img) => `${img.image_url} | ${img.alt_text} | ${img.sort_order}`)
    .join("\n");
  const faqValue = JSON.stringify(
    faq
      .map((f) => ({ question: cleanBi(f.question), answer: cleanBi(f.answer) }))
      .filter((f) => f.question || f.answer)
  );

  /* ── Amenity toggles (bilingual: stored as "中文 · English") ── */
  const isAmenityOn = useCallback((zhName: string, enName: string) => {
    const combined = joinBi(zhName, enName);
    return amenities.some((x) => x === combined || x === zhName || x === enName);
  }, [amenities]);

  const togglePresetAmenity = useCallback((zhName: string, enName: string) => {
    const combined = joinBi(zhName, enName);
    setAmenities((prev) => {
      if (prev.some((x) => x === combined || x === zhName || x === enName)) {
        return prev.filter((x) => x !== combined && x !== zhName && x !== enName);
      }
      return [...prev, combined];
    });
  }, []);

  const addCustomAmenity = useCallback(() => {
    const val = joinBi(customAmenity, customAmenityEn);
    if (val && !amenities.includes(val)) {
      setAmenities((prev) => [...prev, val]);
      setCustomAmenity("");
      setCustomAmenityEn("");
    }
  }, [customAmenity, customAmenityEn, amenities]);

  const removeCustomAmenity = useCallback((a: string) => {
    setAmenities((prev) => prev.filter((x) => x !== a));
  }, []);

  /* Get all custom amenities (not in preset, in any stored form) */
  const customAmenities = useMemo(() => {
    const presetSet = new Set(PRESET_AMENITIES.flatMap(([z, e]) => [z, e, joinBi(z, e)]));
    return amenities.filter((a) => !presetSet.has(a));
  }, [amenities]);

  /* ── Room type management ── */
  const addRoom = useCallback(() => {
    setRoomTypes((prev) => [...prev, { name: "", description: "", price: 0, capacity: 2 }]);
  }, []);

  const updateRoom = useCallback((index: number, field: keyof RoomType, value: string | number) => {
    setRoomTypes((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }, []);

  const removeRoom = useCallback((index: number) => {
    setRoomTypes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ── Image management ── */
  /* An editing index was kept here and never read; the gallery cards edit in
     place, so there is nothing to track. */
  const addImage = useCallback(() => {
    setImages((prev) => [...prev, { image_url: "", alt_text: "", sort_order: prev.length }]);
  }, []);

  const updateImage = useCallback((index: number, field: keyof StayImage, value: string | number) => {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, [field]: value } : img)));
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ── Tab labels ── */
  const tabs = [
    { label: zh ? "基礎與文案" : "Identity & Copy", num: 1 },
    { label: zh ? "房型與設施" : "Rooms & Amenities", num: 2 },
    { label: zh ? "詳細資訊" : "Details & Location", num: 3 },
    { label: zh ? "視覺與圖庫" : "Visuals & Gallery", num: 4 },
    { label: zh ? "SEO 設置" : "SEO Settings", num: 5, warn: seoWarning }
  ];

  const localeBar = (
    <Callout
      actions={
        <Segmented
          ariaLabel={zh ? "編輯語言" : "Editing language"}
          onChange={setEditLocale}
          options={[{ value: "zh", label: "中文" }, { value: "en", label: "English" }]}
          size="sm"
          value={editLocale}
        />
      }
      icon={<Languages />}
      tone="neutral"
    >
      {zh ? "切換編輯語言，所有內容將自動儲存為多語言版本。" : "Switch editing language. All content is saved in multiple languages automatically."}
    </Callout>
  );

  return (
    <form
      ref={(el) => { (formRef as React.MutableRefObject<HTMLFormElement | null>).current = el; registerForm(el); }}
      className="se-shell stay-editor"
      action={action}
      onSubmit={(e) => stashDraft(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "submit") e.preventDefault();
      }}
    >
      {/* Silent recovery would look exactly like the save having worked, which
          is the one thing that must not be ambiguous after a failure. */}
      {draftRecovered && (
        <div className="stay-editor-notice" role="status">
          <Callout tone="success">
            {zh
              ? "儲存失敗，已還原你未儲存的修改。請修正上方錯誤後再存一次。"
              : "The save failed. Your unsaved changes have been restored — fix the error above and save again."}
          </Callout>
        </div>
      )}

      {/* Hidden serialized fields */}
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="destination" value={destination} />
      <input type="hidden" name="region" value={region} />
      <input type="hidden" name="summary" value={summary} />
      <input type="hidden" name="story" value={story} />
      <input type="hidden" name="translations" value={JSON.stringify(i18nFields)} />
      <input type="hidden" name="hero_image_url" value={heroUrl} />
      <input type="hidden" name="booking_url" value={bookingUrl} />
      <input type="hidden" name="sort_order" value={sortOrder} />
      <input type="hidden" name="base_price" value={basePrice} />
      <input type="hidden" name="max_guests" value={maxGuests} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="amenities" value={amenitiesValue} />
      <input type="hidden" name="facilities" value={facilitiesValue} />
      <input type="hidden" name="experiences" value={experiencesValue} />
      <input type="hidden" name="room_types" value={roomTypesValue} />
      <input type="hidden" name="images" value={imagesValue} />
      <input type="hidden" name="tags" value={tags.join("\n")} />
      <input type="hidden" name="faq" value={faqValue} />
      <input type="hidden" name="house_rules" value={houseRules.join("\n")} />
      <input type="hidden" name="location_address" value={cleanBi(locationAddress)} />
      <input type="hidden" name="location_map_url" value={locationMapUrl} />
      <input type="hidden" name="location_map_embed" value={locationMapEmbed} />
      <input type="hidden" name="location_lat" value={locationLat} />
      <input type="hidden" name="location_lng" value={locationLng} />
      <input type="hidden" name="social_line" value={socialLine} />
      <input type="hidden" name="social_fb" value={socialFb} />
      <input type="hidden" name="social_ig" value={socialIg} />
      <input type="hidden" name="seo_title" value={cleanBi(seoTitle)} />
      <input type="hidden" name="seo_description" value={cleanBi(seoDesc)} />
      <input type="hidden" name="seo_canonical" value={seoCanonical} />
      <input type="hidden" name="seo_og_image" value={seoOgImage} />
      {/* No editor UI yet, but the PUT is a full replace: carry the saved values
          through so an ordinary edit does not blank the related-content strip
          (related_content_ids is read live by the villa detail page). */}
      <input type="hidden" name="related_content_ids" value={JSON.stringify(stay?.related_content_ids ?? [])} />
      <input type="hidden" name="detail_config" value={JSON.stringify(stay?.detail_config ?? {})} />

      {/* ─── Main Content ─── */}
      <div className="se-main">
        {/* Tab Bar — in-form state, not URLs, so it cannot be the link-based <Tabs>. */}
        <Segmented
          ariaLabel={zh ? "編輯步驟" : "Editor steps"}
          className="stay-steps"
          onChange={(value) => setTab(Number(value))}
          options={tabs.map((t, i) => ({
            value: String(i),
            label: `${t.num}. ${t.label}`,
            icon: t.warn ? <AlertCircle className="a-icon--warning" /> : undefined
          }))}
          size="tabs"
          value={String(tab)}
        />

        {/* ─── Tab 1: Identity & Copy ─── */}
        {tab === 0 && (
          <Stack className="se-panel">
            {localeBar}
            <Card title={editLocale === "zh" ? "住宿基本資料" : "Stay Identity"}>
              <FormGrid>
                <Field label={editLocale === "zh" ? "名稱" : "Name"} required={editLocale === defaultLocale}>
                  <Input value={getField("name")} onChange={(e) => setField("name", e.target.value)} placeholder={editLocale === "zh" ? "輸入住宿名稱" : "Stay name"} required={editLocale === defaultLocale} />
                </Field>
                <Field label={editLocale === "zh" ? "網址代碼" : "Slug"} required>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="cloud-villa-yilan" required />
                </Field>
                <Field label={editLocale === "zh" ? "縣市" : "County"} required={editLocale === defaultLocale}>
                  <Input
                    value={getField("region")}
                    onChange={(e) => setField("region", e.target.value)}
                    placeholder={editLocale === "zh" ? "宜蘭縣、花蓮縣、臺東縣..." : "Yilan, Hualien, Taitung..."}
                    list="se-counties"
                    required={editLocale === defaultLocale}
                  />
                  <datalist id="se-counties">
                    {COUNTIES.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </Field>
                <Field label={editLocale === "zh" ? "鄉鎮／區域" : "District / Area"} required={editLocale === defaultLocale}>
                  <Input
                    value={getField("destination")}
                    onChange={(e) => setField("destination", e.target.value)}
                    placeholder={editLocale === "zh" ? "冬山鄉、礁溪鄉、頭城鎮..." : "Dongshan, Jiaoxi, Toucheng..."}
                    required={editLocale === defaultLocale}
                  />
                </Field>
              </FormGrid>
            </Card>

            <Card title={editLocale === "zh" ? "內容文案" : "Editorial Copy"}>
              <Stack>
                <Field
                  hint={editLocale === "zh" ? `建議 50-80 字，用於列表卡片展示` : `Recommended 50-80 chars for card display`}
                  label={editLocale === "zh" ? "短摘要" : "Summary"}
                  required={editLocale === defaultLocale}
                >
                  <Textarea
                    value={getField("summary")}
                    onChange={(e) => setField("summary", e.target.value)}
                    rows={3}
                    placeholder={editLocale === "zh" ? "輸入吸引人的簡短介紹..." : "Enter a compelling short description..."}
                    required={editLocale === defaultLocale}
                  />
                </Field>
                <Field label={editLocale === "zh" ? "品牌故事與詳情" : "Story"}>
                  <Textarea
                    value={getField("story")}
                    onChange={(e) => setField("story", e.target.value)}
                    rows={8}
                    placeholder={editLocale === "zh" ? "撰寫詳細的住宿體驗、建築特色與服務介紹..." : "Write about the stay experience, architecture, and services..."}
                  />
                </Field>
              </Stack>
            </Card>
          </Stack>
        )}

        {/* ─── Tab 2: Rooms & Amenities ─── */}
        {tab === 1 && (
          <Stack className="se-panel">
            {localeBar}
            {/* Search facilities first: this is the list the front-end filter
                actually queries, and it is a fixed vocabulary. The free-text
                amenities below are display copy — keeping them in one section
                is what left every facility filter returning nothing. */}
            <Card
              description={
                editLocale === "zh"
                  ? "勾選這間民宿具備的條件，訪客用搜尋列篩選時才找得到。選項在「站點設定 → 搜尋設定」管理。"
                  : "Tick what this villa offers so the search bar can find it. The options are managed in Site Settings → Search."
              }
              title={editLocale === "zh" ? "服務設施（搜尋條件）" : "Facilities (search filters)"}
            >
              <div className="se-amenity-grid">
                {facilityOptions.length === 0 ? (
                  <p className="a-field__hint">
                    {editLocale === "zh" ? "尚未設定搜尋條件。" : "No search filters configured yet."}
                  </p>
                ) : facilityOptions.map((opt) => {
                  const checked = facilities.includes(opt.value);
                  const label = opt.labels?.[editLocale] || opt.label;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`se-amenity-chip ${checked ? "se-amenity-chip--on" : ""}`}
                      aria-pressed={checked}
                      onClick={() => toggleFacility(opt.value)}
                    >
                      {checked ? <Check size={14} /> : null}
                      {label}
                    </button>
                  );
                })}
              </div>
            </Card>
            <Card
              description={
                editLocale === "zh"
                  ? "勾選這間民宿提供的慢域體驗。選項在「站點設定 → 搜尋設定」新增、修改或刪除。"
                  : "Tick the curated experiences offered by this stay. Manage the options in Site Settings → Search."
              }
              title={editLocale === "zh" ? "慢域體驗（搜尋條件）" : "Select Experiences (search filters)"}
            >
              <div className="se-amenity-grid">
                {experienceOptions.length === 0 ? (
                  <p className="a-field__hint">
                    {editLocale === "zh" ? "尚未設定慢域體驗。" : "No experiences configured yet."}
                  </p>
                ) : experienceOptions.map((opt) => {
                  const checked = experiences.includes(opt.value);
                  const label = opt.labels?.[editLocale] || opt.label;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`se-amenity-chip ${checked ? "se-amenity-chip--on" : ""}`}
                      aria-pressed={checked}
                      onClick={() => toggleExperience(opt.value)}
                    >
                      {checked ? <Check size={14} /> : null}
                      {label}
                    </button>
                  );
                })}
              </div>
            </Card>
            <Card
              actions={
                <Button
                  icon={<Plus />}
                  onClick={() => {
                    const input = document.getElementById("se-custom-amenity") as HTMLInputElement;
                    input?.focus();
                  }}
                  size="sm"
                  variant="ghost"
                >
                  {editLocale === "zh" ? "新增自訂設施" : "Add custom"}
                </Button>
              }
              title={editLocale === "zh" ? "住宿設施" : "Amenities"}
            >
              <Stack>
                <div className="se-amenity-grid">
                  {PRESET_AMENITIES.map(([zhName, enName]) => {
                    const checked = isAmenityOn(zhName, enName);
                    const label = editLocale === "zh" ? zhName : enName;
                    return (
                      <button
                        key={zhName}
                        type="button"
                        className={`se-amenity-chip ${checked ? "se-amenity-chip--on" : ""}`}
                        aria-pressed={checked}
                        onClick={() => togglePresetAmenity(zhName, enName)}
                      >
                        {checked ? <Check size={14} /> : null}
                        {label}
                      </button>
                    );
                  })}
                  {/* Custom amenities — show the current language's half */}
                  {customAmenities.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="se-amenity-chip se-amenity-chip--on se-amenity-chip--custom"
                      onClick={() => removeCustomAmenity(a)}
                    >
                      <Check size={14} />
                      {splitBi(a)[editLocale] || a}
                      <X size={12} />
                    </button>
                  ))}
                </div>
                <InputGroup>
                  <Input
                    id="se-custom-amenity"
                    value={customAmenity}
                    onChange={(e) => setCustomAmenity(e.target.value)}
                    placeholder={editLocale === "zh" ? "中文（例：戲水池）" : "中文（例：戲水池）"}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomAmenity(); } }}
                  />
                  <Input
                    value={customAmenityEn}
                    onChange={(e) => setCustomAmenityEn(e.target.value)}
                    placeholder={editLocale === "zh" ? "English (e.g. Pool)" : "English (e.g. Pool)"}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomAmenity(); } }}
                  />
                  <Button icon={<Plus />} iconOnly onClick={addCustomAmenity} disabled={!customAmenity.trim() && !customAmenityEn.trim()}>
                    {editLocale === "zh" ? "加入自訂設施" : "Add custom amenity"}
                  </Button>
                </InputGroup>
              </Stack>
            </Card>

            <Card
              actions={
                <Button icon={<Plus />} onClick={addRoom} size="sm" variant="ghost">
                  {editLocale === "zh" ? "新增房型" : "Add room type"}
                </Button>
              }
              title={editLocale === "zh" ? "房型設定" : "Room Types"}
            >
              <Stack>
                {roomTypes.map((room, i) => (
                  <Card
                    actions={
                      <Button icon={<Trash2 />} iconOnly onClick={() => removeRoom(i)} size="sm" variant="danger-ghost">
                        {editLocale === "zh" ? `移除房型 ${i + 1}` : `Remove room ${i + 1}`}
                      </Button>
                    }
                    as="div"
                    className="stay-sub-card"
                    key={i}
                    title={(splitBi(room.name)[editLocale] || "").trim() || `${editLocale === "zh" ? "房型" : "Room"} ${i + 1}`}
                  >
                    <FormGrid>
                      <Field label={editLocale === "zh" ? "房型名稱" : "Name"}>
                        <Input value={splitBi(room.name)[editLocale]} onChange={(e) => updateRoom(i, "name", setBi(room.name, editLocale, e.target.value))} placeholder={editLocale === "zh" ? "雙人房" : "Double Room"} />
                      </Field>
                      <Field label={editLocale === "zh" ? "簡述" : "Description"}>
                        <Input value={splitBi(room.description)[editLocale]} onChange={(e) => updateRoom(i, "description", setBi(room.description, editLocale, e.target.value))} placeholder={editLocale === "zh" ? "每棟 2 間，舒適雙人配置" : "Two per building, comfortable for couples"} />
                      </Field>
                      <Field label={editLocale === "zh" ? "每晚價格" : "Price per night"}>
                        <div className="se-price-input">
                          <span>NT$</span>
                          <input type="text" inputMode="numeric" value={room.price || ""} onChange={(e) => updateRoom(i, "price", Number(e.target.value.replace(/\D/g, "")))} placeholder="0" />
                        </div>
                      </Field>
                      <Field label={editLocale === "zh" ? "最多人數" : "Max guests"}>
                        <div className="se-capacity-input">
                          <span>Max:</span>
                          <input type="text" inputMode="numeric" value={room.capacity || ""} onChange={(e) => updateRoom(i, "capacity", Number(e.target.value.replace(/\D/g, "")) || 1)} placeholder="2" />
                          <span>{editLocale === "zh" ? "人" : "guests"}</span>
                        </div>
                      </Field>
                    </FormGrid>
                  </Card>
                ))}
                {roomTypes.length === 0 && (
                  <Button block icon={<Plus />} onClick={addRoom} size="lg">
                    {editLocale === "zh" ? "點擊新增另一種房型" : "Click to add a room type"}
                  </Button>
                )}
              </Stack>
            </Card>
            {/* Tags section */}
            <Card title={editLocale === "zh" ? "標籤" : "Tags"}>
              <Stack>
                {tags.length ? (
                  <div className="se-amenity-grid">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="se-amenity-chip se-amenity-chip--on se-amenity-chip--custom"
                        onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                      >
                        {splitBi(tag)[editLocale] || tag}
                        <X size={12} />
                      </button>
                    ))}
                  </div>
                ) : null}
                <InputGroup>
                  {(() => {
                    const addTag = () => {
                      const val = joinBi(newTag, newTagEn);
                      if (val && !tags.includes(val)) { setTags((prev) => [...prev, val]); setNewTag(""); setNewTagEn(""); }
                    };
                    return (
                      <>
                        <Input
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder={editLocale === "zh" ? "中文（例：包棟）" : "中文（例：包棟）"}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                        />
                        <Input
                          value={newTagEn}
                          onChange={(e) => setNewTagEn(e.target.value)}
                          placeholder="English (e.g. Whole Villa)"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                        />
                        <Button icon={<Plus />} iconOnly disabled={!newTag.trim() && !newTagEn.trim()} onClick={addTag}>
                          {editLocale === "zh" ? "加入標籤" : "Add tag"}
                        </Button>
                      </>
                    );
                  })()}
                </InputGroup>
              </Stack>
            </Card>
          </Stack>
        )}

        {/* ─── Tab 3: Details & Location (NEW) ─── */}
        {tab === 2 && (
          <Stack className="se-panel">
            {localeBar}
            {/* FAQ Editor */}
            <Card
              actions={
                <Button icon={<Plus />} onClick={() => setFaq((prev) => [...prev, { question: "", answer: "" }])} size="sm" variant="ghost">
                  {editLocale === "zh" ? "新增問題" : "Add FAQ"}
                </Button>
              }
              title={editLocale === "zh" ? "常見問題" : "FAQ"}
            >
              <Stack>
                {faq.map((item, i) => (
                  <Card
                    actions={
                      <Button icon={<Trash2 />} iconOnly onClick={() => setFaq((prev) => prev.filter((_, idx) => idx !== i))} size="sm" variant="danger-ghost">
                        {editLocale === "zh" ? `移除問題 ${i + 1}` : `Remove FAQ ${i + 1}`}
                      </Button>
                    }
                    as="div"
                    className="stay-sub-card"
                    key={i}
                    title={(splitBi(item.question)[editLocale] || "").trim() || `Q${i + 1}`}
                  >
                    <Stack>
                      <Field label={editLocale === "zh" ? "問題" : "Question"}>
                        <Input
                          value={splitBi(item.question)[editLocale]}
                          onChange={(e) =>
                            setFaq((prev) =>
                              prev.map((f, idx) => (idx === i ? { ...f, question: setBi(f.question, editLocale, e.target.value) } : f))
                            )
                          }
                          placeholder={editLocale === "zh" ? "輸入問題..." : "Enter question..."}
                        />
                      </Field>
                      <Field label={editLocale === "zh" ? "回答" : "Answer"}>
                        <Textarea
                          value={splitBi(item.answer)[editLocale]}
                          onChange={(e) =>
                            setFaq((prev) =>
                              prev.map((f, idx) => (idx === i ? { ...f, answer: setBi(f.answer, editLocale, e.target.value) } : f))
                            )
                          }
                          rows={3}
                          placeholder={editLocale === "zh" ? "輸入回答..." : "Enter answer..."}
                        />
                      </Field>
                    </Stack>
                  </Card>
                ))}
                {faq.length === 0 && (
                  <Button block icon={<Plus />} onClick={() => setFaq([{ question: "", answer: "" }])} size="lg">
                    {editLocale === "zh" ? "點擊新增常見問題" : "Click to add a FAQ item"}
                  </Button>
                )}
              </Stack>
            </Card>

            {/* House Rules */}
            <Card title={editLocale === "zh" ? "住宿須知 / 入住規定" : "House Rules"}>
              <Stack>
                {houseRules.length ? (
                  <div className="se-amenity-grid">
                    {houseRules.map((rule) => (
                      <button
                        key={rule}
                        type="button"
                        className="se-amenity-chip se-amenity-chip--on se-amenity-chip--custom"
                        onClick={() => setHouseRules((prev) => prev.filter((r) => r !== rule))}
                      >
                        {splitBi(rule)[editLocale] || rule}
                        <X size={12} />
                      </button>
                    ))}
                  </div>
                ) : null}
                <InputGroup>
                  {(() => {
                    const addRule = () => {
                      const val = joinBi(newRule, newRuleEn);
                      if (val && !houseRules.includes(val)) { setHouseRules((prev) => [...prev, val]); setNewRule(""); setNewRuleEn(""); }
                    };
                    return (
                      <>
                        <Input
                          value={newRule}
                          onChange={(e) => setNewRule(e.target.value)}
                          placeholder="中文（例：禁止寵物、禁止吸菸）"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRule(); } }}
                        />
                        <Input
                          value={newRuleEn}
                          onChange={(e) => setNewRuleEn(e.target.value)}
                          placeholder="English (e.g. No pets, No smoking)"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRule(); } }}
                        />
                        <Button icon={<Plus />} iconOnly disabled={!newRule.trim() && !newRuleEn.trim()} onClick={addRule}>
                          {editLocale === "zh" ? "加入規定" : "Add rule"}
                        </Button>
                      </>
                    );
                  })()}
                </InputGroup>
              </Stack>
            </Card>

            {/* Location */}
            <Card title={editLocale === "zh" ? "交通位置" : "Location"}>
              <Stack>
                <Field label={editLocale === "zh" ? "地址" : "Address"}>
                  <Input
                    value={splitBi(locationAddress)[editLocale]}
                    onChange={(e) => setLocationAddress(setBi(locationAddress, editLocale, e.target.value))}
                    placeholder={editLocale === "zh" ? "完整地址" : "Full address"}
                  />
                </Field>
                <Field label={editLocale === "zh" ? "Google Maps 連結" : "Google Maps URL"}>
                  <Input
                    value={locationMapUrl}
                    onChange={(e) => setLocationMapUrl(e.target.value)}
                    placeholder="https://maps.google.com/..."
                  />
                </Field>
                <Field
                  hint={
                    editLocale === "zh"
                      ? "填了座標，地圖區塊才能用「帶入民宿」把這間標到地圖上。在 Google 地圖對該點按右鍵，第一列就是「緯度, 經度」，可直接複製貼上。"
                      : "With coordinates set, the map block can place this stay via “Import stays”. Right-click the spot in Google Maps and the first row is “lat, lng” — copy it straight in."
                  }
                  htmlFor="se-location-lat"
                  label={editLocale === "zh" ? "座標（緯度 / 經度）" : "Coordinates (lat / lng)"}
                >
                  <FormGrid>
                    <Input
                      id="se-location-lat"
                      value={locationLat}
                      onChange={(e) => setLocationLat(e.target.value)}
                      placeholder={editLocale === "zh" ? "緯度 24.6510" : "Latitude 24.6510"}
                      inputMode="decimal"
                    />
                    <Input
                      aria-label={editLocale === "zh" ? "經度" : "Longitude"}
                      value={locationLng}
                      onChange={(e) => setLocationLng(e.target.value)}
                      placeholder={editLocale === "zh" ? "經度 121.7800" : "Longitude 121.7800"}
                      inputMode="decimal"
                    />
                  </FormGrid>
                </Field>
                <Field label={editLocale === "zh" ? "地圖嵌入碼" : "Map Embed Code"}>
                  <Textarea
                    value={locationMapEmbed}
                    onChange={(e) => setLocationMapEmbed(e.target.value)}
                    rows={3}
                    placeholder={editLocale === "zh" ? "貼上 Google Maps iframe 嵌入碼" : "Paste Google Maps iframe embed code"}
                  />
                </Field>
              </Stack>
            </Card>

            {/* Social Links */}
            <Card title={editLocale === "zh" ? "社群連結" : "Social Links"}>
              <FormGrid>
                <Field label="LINE">
                  <Input
                    value={socialLine}
                    onChange={(e) => setSocialLine(e.target.value)}
                    placeholder="https://line.me/..."
                  />
                </Field>
                <Field label="Facebook">
                  <Input
                    value={socialFb}
                    onChange={(e) => setSocialFb(e.target.value)}
                    placeholder="https://facebook.com/..."
                  />
                </Field>
                <Field label="Instagram" span="full">
                  <Input
                    value={socialIg}
                    onChange={(e) => setSocialIg(e.target.value)}
                    placeholder="https://instagram.com/..."
                  />
                </Field>
              </FormGrid>
            </Card>
          </Stack>
        )}

        {/* ─── Tab 4: Visuals & Gallery ─── */}
        {tab === 3 && (
          <Stack className="se-panel">
            <Card
              description={editLocale === "zh" ? "前台住宿列表封面，以及詳情頁第一視覺。" : "Cover for listing cards and detail page hero."}
              title={editLocale === "zh" ? "主視覺圖片" : "Hero Image"}
            >
              <HeroImageField
                defaultValue={heroUrl}
                fieldName="__hero_image_ignore"
                labels={heroLabels as Parameters<typeof HeroImageField>[0]["labels"]}
                onChange={setHeroUrl}
              />
            </Card>

            <Card
              actions={
                <Button icon={<Plus />} onClick={addImage} size="sm" variant="ghost">
                  {editLocale === "zh" ? "新增圖片" : "Add Image"}
                </Button>
              }
              title={editLocale === "zh" ? "圖片集" : "Gallery"}
            >
              {images.length === 0 ? (
                <Callout icon={<ImageIcon />} tone="neutral">
                  {editLocale === "zh" ? "尚未新增圖片，點擊上方按鈕開始" : "No images yet. Click Add Image above."}
                </Callout>
              ) : (
                <Stack>
                  {images.map((img, i) => (
                    <Card
                      actions={
                        <Button icon={<X />} iconOnly onClick={() => removeImage(i)} size="sm" variant="danger-ghost">
                          {editLocale === "zh" ? `移除圖片 ${i + 1}` : `Remove image ${i + 1}`}
                        </Button>
                      }
                      as="div"
                      className="stay-sub-card"
                      key={i}
                      title={editLocale === "zh" ? `圖片 ${i + 1}` : `Image ${i + 1}`}
                    >
                      <Stack>
                        <HeroImageField
                          defaultValue={img.image_url}
                          fieldName={`__gallery_${i}_ignore`}
                          labels={heroLabels as Parameters<typeof HeroImageField>[0]["labels"]}
                          onChange={(url) => updateImage(i, "image_url", url)}
                        />
                        <Field label={editLocale === "zh" ? "圖片說明" : "Alt Text"}>
                          <Input
                            value={img.alt_text}
                            onChange={(e) => updateImage(i, "alt_text", e.target.value)}
                            placeholder={editLocale === "zh" ? "圖片說明" : "Describe the image"}
                          />
                        </Field>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </Card>
          </Stack>
        )}

        {/* ─── Tab 5: SEO ─── */}
        {tab === 4 && (
          <Stack className="se-panel">
            {localeBar}
            <Card title={editLocale === "zh" ? "搜尋引擎最佳化" : "Search Engine Optimization"}>
              <FormGrid>
                <Field label={editLocale === "zh" ? "SEO 標題" : "Meta Title"}>
                  <Input value={splitBi(seoTitle)[editLocale]} onChange={(e) => setSeoTitle(setBi(seoTitle, editLocale, e.target.value))} placeholder={name || "Stay name"} />
                </Field>
                <Field label={editLocale === "zh" ? "Canonical URL" : "Canonical URL"}>
                  <Input value={seoCanonical} onChange={(e) => setSeoCanonical(e.target.value)} placeholder={`${siteUrl}/stays/${slug}`} />
                </Field>
                <Field label={editLocale === "zh" ? "Meta 描述" : "Meta Description"} span="full">
                  <Textarea value={splitBi(seoDesc)[editLocale]} onChange={(e) => setSeoDesc(setBi(seoDesc, editLocale, e.target.value))} rows={3} placeholder={summary || (zh ? "搜尋引擎摘要" : "Search engine description")} />
                </Field>
                <Field label={editLocale === "zh" ? "OG 圖片 URL" : "OG Image URL"} span="full">
                  <Input value={seoOgImage} onChange={(e) => setSeoOgImage(e.target.value)} placeholder={heroUrl || "https://..."} />
                </Field>
              </FormGrid>
            </Card>

            <Card title={editLocale === "zh" ? "SEO 預覽" : "SEO Preview"}>
              <SeoPreview
                defaults={{
                  description: splitBi(seoDesc)[editLocale] || summary || "",
                  image: seoOgImage || heroUrl || "",
                  title: splitBi(seoTitle)[editLocale] || name || "",
                  url: `${siteUrl}/stays/${slug || "stay-slug"}`
                }}
                labels={{
                  description: editLocale === "zh" ? "Meta 描述" : "Meta Description",
                  imageMissing: editLocale === "zh" ? "缺少 OG 圖片" : "Missing OG image",
                  searchPreview: editLocale === "zh" ? "搜尋結果預覽" : "Search Preview",
                  sharePreview: editLocale === "zh" ? "社群分享預覽" : "Share Preview"
                }}
                siteUrl={siteUrl}
                slugMode="stay"
              />
            </Card>
          </Stack>
        )}
      </div>

      {/* ─── Sidebar ─── */}
      <aside className="se-sidebar">
        {/* Publish Card */}
        <Card
          actions={<StatusBadge labels={statusLabels} status={status} />}
          title={
            <><Send /> {defaultLocale === "zh" ? "發布設定" : "Publishing"}</>
          }
        >
          <Stack>
            <Field label={defaultLocale === "zh" ? "當前狀態" : "Status"}>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">{statusLabels.draft ?? "Draft"}</option>
                <option value="review">{statusLabels.review ?? "Review"}</option>
                <option value="published">{statusLabels.published ?? "Published"}</option>
                <option value="archived">{statusLabels.archived ?? "Archived"}</option>
              </Select>
            </Field>

            <FormGrid>
              <Field label={defaultLocale === "zh" ? "起點價格" : "Base Price"} required>
                <div className="se-price-input">
                  <span>NT$</span>
                  <input type="text" inputMode="numeric" value={basePrice || ""} onChange={(e) => setBasePrice(Number(e.target.value.replace(/\D/g, "")))} required />
                </div>
              </Field>
              <Field label={defaultLocale === "zh" ? "基準人數" : "Guests"} required>
                <div className="se-capacity-input">
                  <input type="text" inputMode="numeric" value={maxGuests || ""} onChange={(e) => setMaxGuests(Number(e.target.value.replace(/\D/g, "")) || 1)} required />
                  <span>{defaultLocale === "zh" ? "人" : ""}</span>
                </div>
              </Field>
            </FormGrid>

            <Field
              hint={defaultLocale === "zh" ? "留空則「立即訂房」改為詢問表單。" : "Leave empty to fall back to the inquiry form."}
              label={defaultLocale === "zh" ? "訂房網址（立即訂房按鈕）" : "Booking URL (Book-now button)"}
            >
              <Input
                type="url"
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field
              hint={defaultLocale === "zh" ? "首頁精選住宿與住宿列表依此排序。" : "Orders the homepage featured stays and the stays list."}
              label={defaultLocale === "zh" ? "排序（數字小者在前）" : "Sort order (lower shows first)"}
            >
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value.replace(/[^\d-]/g, "")) || 0)}
              />
            </Field>

            <Stack gap="sm">
              <SubmitButton className={buttonClass({ variant: "primary", size: "lg", block: true })}>
                {defaultLocale === "zh" ? "儲存住宿" : "Save Stay"}
              </SubmitButton>

              {/* Delete/Restore inside publish card. The delete asks first, like the
                  same delete on the stays list — it sat directly under 儲存住宿 in
                  the same card and took the stay off the site on one press. */}
              {!isDeleted && deleteAction ? (
                <ConfirmSubmitButton
                  action={deleteAction}
                  body={deleteConfirmBody}
                  cancelLabel={defaultLocale === "zh" ? "取消" : "Cancel"}
                  className={buttonClass({ variant: "danger-ghost", block: true })}
                  confirmLabel={defaultLocale === "zh" ? "刪除住宿" : "Delete stay"}
                  title={defaultLocale === "zh" ? "確認刪除住宿" : "Confirm stay deletion"}
                >
                  <Trash2 size={14} />
                  {defaultLocale === "zh" ? "刪除住宿" : "Delete Stay"}
                </ConfirmSubmitButton>
              ) : null}
              {isDeleted && restoreAction ? (
                <SubmitButton className={buttonClass({ block: true })} formAction={restoreAction}>
                  {defaultLocale === "zh" ? "還原住宿" : "Restore Stay"}
                </SubmitButton>
              ) : null}
            </Stack>
          </Stack>
        </Card>

        {/* Progress Card */}
        <Card
          actions={<Badge tone={checks.pct === 100 ? "success" : "warning"}>{checks.pct}%</Badge>}
          title={defaultLocale === "zh" ? "資料完成度" : "Completeness"}
        >
          <Stack>
            <Progress tone={checks.pct === 100 ? "success" : "brand"} value={checks.pct} />
            <div className="se-check-list">
              {checks.items.map((c) => (
                <div className={`se-check ${c.ok ? "se-check--ok" : "se-check--warn"}`} key={c.label}>
                  {c.ok ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  <div>
                    <strong>{c.label}</strong>
                    <small>{c.desc}</small>
                  </div>
                </div>
              ))}
            </div>
          </Stack>
        </Card>
      </aside>
    </form>
  );
}
