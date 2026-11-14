"use client";
import { contentTypeCatalogue } from "../../../modules/contentTypes";
import { articleListingLocations } from "../../modules/articlePlacement";

import { Eye } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminContentTag, AdminPage, AdminSite } from "../../modules/adminApi";
import { articleCollectionPlacements } from "../../modules/articlePlacement";
import ConfirmSubmitButton from "../../modules/ConfirmSubmitButton";
import SafeForm from "../../modules/SafeForm";
import SubmitButton from "../../modules/SubmitButton";
import SeoPreview from "../../modules/SeoPreview";
import { buildContentHref } from "../../../modules/contentRoutes";
import HeroImageField from "../stays/HeroImageField";
import PageBlockEditor from "./PageBlockEditor";
import PagePreviewPanel from "./PagePreviewPanel";
import RelatedStaysPicker from "./RelatedStaysPicker";
import { PickerModal } from "../../modules/blockForms";
import { contentVocabulary } from "../../modules/contentVocabulary";
import { Button, Callout, Field, FormGrid, FormSection, Input, Select, Textarea, Segmented, buttonClass } from "../../ui";

type TranslationsMap = Record<string, Record<string, string>>;

export default function PageFormEditor({
  action,
  deleteAction,
  isDeleted,
  locale,
  page,
  restoreAction,
  returnTo,
  stays,
  submitLabel,
  title,
  copy,
  ui,
  copyZh,
  copyEn,
  uiZh,
  uiEn,
  siteContentTypes,
  siteDefaultLocale,
  contentTags,
  saveFailed,
  site,
  allPages = [],
  canWrite = true,
}: {
  action: (formData: FormData) => void;
  deleteAction?: (formData: FormData) => void;
  isDeleted?: boolean;
  locale: string;
  page?: AdminPage | null;
  restoreAction?: (formData: FormData) => void;
  returnTo: string;
  stays?: { id: number; name: string; destination: string; hero_image_url: string }[];
  submitLabel?: string;
  title: string;
  /** Site-derived content_type categories (key + bilingual label). Merged with static defaults. */
  siteContentTypes?: Array<{ key: string; label: { zh: string; en: string } }>;
  /** The site's own `default_locale` — the language its canonical page columns
   *  are written in. Not the admin's UI language; see `defaultLocale` below. */
  siteDefaultLocale?: string;
  /** Site-scoped bilingual tag catalogue used by the multi-select picker. */
  contentTags?: AdminContentTag[];
  /** The last save came back with an error. Every save path here redirects on
   *  failure as well as success, so the editor remounts holding the last SAVED
   *  content: without this, a rejected save silently threw away everything
   *  written since the page was opened. */
  saveFailed?: boolean;
  site?: AdminSite;
  allPages?: AdminPage[];
  canWrite?: boolean;
  copy: ReturnType<typeof import("../../../modules/i18n").t>;
  ui: ReturnType<typeof import("../../../modules/i18n").adminUiText>;
  copyZh: ReturnType<typeof import("../../../modules/i18n").t>;
  copyEn: ReturnType<typeof import("../../../modules/i18n").t>;
  uiZh: ReturnType<typeof import("../../../modules/i18n").adminUiText>;
  uiEn: ReturnType<typeof import("../../../modules/i18n").adminUiText>;
}) {
  const seo = page?.seo ?? {};
  const selectedSlug = page?.slug ?? "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  /**
   * Which language the page's canonical columns hold.
   *
   * This is the SITE's language, not the viewer's. It used to be read off the
   * admin's own `site-locale` cookie, which quietly made the answer depend on
   * who had the page open: a Chinese site edited by someone browsing the admin
   * in English seeded `translations.en` from the canonical Chinese `title` and
   * `body`, and the next ordinary save wrote that Chinese into the English
   * slot for good. Nothing looked wrong in the editor — the English tab showed
   * the English blocks — and English readers got Chinese body text.
   */
  const defaultLocale: "zh" | "en" = siteDefaultLocale === "en" ? "en" : "zh";

  // Which tab opens is still a matter of who is looking, and stays that way.
  const [editLocale, setEditLocale] = useState<"zh" | "en">(locale === "zh" ? "zh" : "en");
  const [primaryCategory, setPrimaryCategory] = useState(page?.content_type ?? siteContentTypes?.[0]?.key ?? "page");
  const [additionalCategories, setAdditionalCategories] = useState<Set<string>>(
    () => new Set((page?.categories ?? []).filter((value) => value !== (page?.content_type ?? "page"))),
  );
  const selectedCategories = [primaryCategory, ...Array.from(additionalCategories)];

  const toggleCategory = (key: string) => {
    const current = selectedCategories;
    if (current.includes(key)) {
      // Every article needs one category because the first selection owns its
      // public URL. Removing the current first choice promotes the next one.
      if (current.length === 1) return;
      const next = current.filter((value) => value !== key);
      setPrimaryCategory(next[0]);
      setAdditionalCategories(new Set(next.slice(1)));
      return;
    }
    setAdditionalCategories((values) => new Set([...Array.from(values), key]));
  };
  // Live-preview modal open state — the trigger button sits under "儲存內容頁",
  // the modal itself is rendered by PageBlockEditor.
  const [showPreview, setShowPreview] = useState(false);

  // Build initial i18n fields from page data + translations
  const buildInitialFields = (): TranslationsMap => {
    const existing = page?.translations ?? {};
    const result: TranslationsMap = { zh: { ...(existing.zh ?? {}) }, en: { ...(existing.en ?? {}) } };
    // Populate primary locale from main page fields if not already in translations
    if (page) {
      const primary = defaultLocale;
      if (!result[primary].title && page.title) result[primary].title = page.title;
      if (!result[primary].summary && page.summary) result[primary].summary = page.summary;
      /* `body` is deliberately NOT seeded. This editor has no body field — the
         text is derived from the blocks on every save and submitted as the
         page's own `body`. Seeding it here put a snapshot into `translations`,
         and `trs()` reads translations before the column, so the first save
         froze the article body and the SEO description at whatever the page
         said that day; every block edit afterwards changed the column and
         nothing on the page. Left absent, `trs` falls through to the column the
         block editor keeps current.

         Existing rows that already carry a frozen copy are not stripped here:
         nothing in this form can author a per-locale body, but something else
         might have, and silently deleting it on the next save would be worse
         than the staleness. */
      // Tags live on the page as a plain list in its own language; seed the
      // primary locale from it so switching to the other language starts from
      // an empty field rather than repeating the untranslated tags.
      if (!result[primary].tags && page.tags?.length) result[primary].tags = page.tags.join(", ");
      const seoData = page.seo ?? {};
      if (!result[primary].seo_title && seoData.title) result[primary].seo_title = seoData.title;
      if (!result[primary].seo_description && seoData.description) result[primary].seo_description = seoData.description;
    }
    return result;
  };

  const [i18nFields, setI18nFields] = useState<TranslationsMap>(buildInitialFields);

  const splitTagText = useCallback((value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  }, []);

  const storedTagLabels = [
    ...(page?.tags ?? []),
    ...splitTagText(page?.translations?.zh?.tags),
    ...splitTagText(page?.translations?.en?.tags),
  ];
  const tagKey = (value: string) => value.trim().toLocaleLowerCase();
  const matchingTag = (tag: AdminContentTag, label: string) => {
    const key = tagKey(label);
    return [tag.slug, tag.name_zh, tag.name_en].filter(Boolean).some((value) => tagKey(value) === key);
  };
  const initialSelectedTagSlugs = (contentTags ?? [])
    .filter((tag) => storedTagLabels.some((label) => matchingTag(tag, String(label))))
    .map((tag) => tag.slug);
  const initialKnownLabels = new Set(
    (contentTags ?? []).flatMap((tag) => [tag.slug, tag.name_zh, tag.name_en].filter(Boolean).map(tagKey)),
  );
  const initialCustomTags = (localeKey: "zh" | "en") => {
    const raw = localeKey === defaultLocale
      ? (page?.translations?.[localeKey]?.tags ?? page?.tags ?? [])
      : (page?.translations?.[localeKey]?.tags ?? []);
    return splitTagText(raw).filter((label) => !initialKnownLabels.has(tagKey(label)));
  };
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<string[]>(initialSelectedTagSlugs);
  const [customTags, setCustomTags] = useState<Record<"zh" | "en", string[]>>(() => ({
    zh: initialCustomTags("zh"),
    en: initialCustomTags("en"),
  }));
  const [customTagDraft, setCustomTagDraft] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const [cardSearch, setCardSearch] = useState("");

  /*
   * Card labels are an article-level presentation choice, separate from the
   * article's searchable taxonomy. They are kept in each locale's existing
   * translations object so this can be added without a destructive migration.
   * Rows created before this field existed have no `card_tags` key and start
   * with their current article tags as the visible fallback.
   */
  const initialCardTags = (localeKey: "zh" | "en") => {
    const localeFields = page?.translations?.[localeKey];
    if (localeFields && Object.prototype.hasOwnProperty.call(localeFields, "card_tags")) {
      return splitTagText(localeFields.card_tags);
    }
    const raw = localeKey === defaultLocale
      ? (localeFields?.tags ?? page?.tags ?? [])
      : (localeFields?.tags ?? page?.tags ?? []);
    const labels = splitTagText(raw);
    // When a translation has no own tag text yet, use the managed vocabulary's
    // translated labels rather than copying Chinese into the English picker.
    // Free-text labels still fall back to the value that exists, matching the
    // public tag resolver's compatibility behaviour.
    const managedLabels = initialSelectedTagSlugs
      .map((slug) => contentTags?.find((tag) => tag.slug === slug))
      .map((tag) => (localeKey === "zh" ? tag?.name_zh : tag?.name_en) || tag?.name_zh || tag?.slug || "")
      .filter(Boolean) as string[];
    const customLabels = labels.filter((label) => !initialKnownLabels.has(tagKey(label)));
    return Array.from(new Map([...managedLabels, ...customLabels].map((label) => [tagKey(label), label])).values());
  };
  const [cardTags, setCardTags] = useState<Record<"zh" | "en", string[]>>(() => ({
    zh: initialCardTags("zh"),
    en: initialCardTags("en"),
  }));

  const selectedTagsFor = useCallback((localeKey: "zh" | "en") => {
    const labels = selectedTagSlugs
      .map((slug) => contentTags?.find((tag) => tag.slug === slug))
      .map((tag) => (localeKey === "zh" ? tag?.name_zh : tag?.name_en) || tag?.name_zh || tag?.slug || "")
      .filter(Boolean) as string[];
    return Array.from(new Map([...labels, ...(customTags[localeKey] ?? [])].map((label) => [tagKey(label), label])).values());
  }, [contentTags, customTags, selectedTagSlugs]);

  const cardTagsFor = useCallback((localeKey: "zh" | "en") => {
    return Array.from(new Map((cardTags[localeKey] ?? []).map((label) => [tagKey(label), label])).values());
  }, [cardTags]);

  const cardTagOptionsFor = useCallback((localeKey: "zh" | "en") => {
    return Array.from(new Map([
      ...selectedTagsFor(localeKey),
      ...cardTagsFor(localeKey),
    ].map((label) => [tagKey(label), label])).values());
  }, [cardTagsFor, selectedTagsFor]);

  const submissionFields = useMemo<TranslationsMap>(() => ({
    ...i18nFields,
    // An empty string is intentional: it lets an editor hide labels on this
    // article, while the absence of this key keeps legacy articles on the
    // ordinary-tags fallback until they are edited.
    zh: { ...(i18nFields.zh ?? {}), tags: selectedTagsFor("zh").join(", "), card_tags: cardTagsFor("zh").join(", ") },
    en: { ...(i18nFields.en ?? {}), tags: selectedTagsFor("en").join(", "), card_tags: cardTagsFor("en").join(", ") },
  }), [cardTagsFor, i18nFields, selectedTagsFor]);

  const toggleContentTag = useCallback((slug: string) => {
    setSelectedTagSlugs((current) => current.includes(slug)
      ? current.filter((value) => value !== slug)
      : [...current, slug]);
  }, []);

  const addCustomTag = useCallback(() => {
    const value = customTagDraft.trim();
    if (!value) return;
    setCustomTags((current) => ({
      ...current,
      [editLocale]: Array.from(new Map([...current[editLocale], value].map((label) => [tagKey(label), label])).values()),
    }));
    setCustomTagDraft("");
  }, [customTagDraft, editLocale]);

  const removeCustomTag = useCallback((value: string) => {
    setCustomTags((current) => ({
      ...current,
      [editLocale]: current[editLocale].filter((label) => tagKey(label) !== tagKey(value)),
    }));
  }, [editLocale]);

  const toggleCardTag = useCallback((label: string) => {
    setCardTags((current) => {
      const values = current[editLocale] ?? [];
      const key = tagKey(label);
      return {
        ...current,
        [editLocale]: values.some((value) => tagKey(value) === key)
          ? values.filter((value) => tagKey(value) !== key)
          : [...values, label],
      };
    });
  }, [editLocale]);

  /**
   * Draft recovery.
   *
   * Every save path here redirects whether it succeeded or failed, so a
   * rejected save re-navigates to this same URL, the page re-fetches, and this
   * editor remounts seeded from the last SAVED content. Twenty minutes of
   * restructuring disappeared with nothing but `?error=` in the address bar to
   * show for it, and there is no undo.
   *
   * So the form writes itself down on the way out and reads itself back if it
   * lands here with an error. sessionStorage rather than localStorage: a draft
   * belongs to the tab that was typing, and should not outlive it.
   *
   * Restoring happens in an effect, not during render, because this component
   * is server-rendered first and sessionStorage does not exist there. The
   * blocks arrive through a keyed remount below, since the block editor seeds
   * its own state once from props.
   */
  const draftKey = `cms-draft:${page?.id ?? "new"}`;
  const [recovered, setRecovered] = useState<{ blocks: unknown[]; fields: TranslationsMap } | null>(null);
  const [recoveredNotice, setRecoveredNotice] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!saveFailed) {
        // The save landed. Anything kept from an earlier attempt is stale now.
        if (raw) sessionStorage.removeItem(draftKey);
        return;
      }
      if (!raw) return;
      const draft = JSON.parse(raw) as { blocks?: unknown[]; fields?: TranslationsMap };
      if (!draft?.fields) return;
      setRecovered({ blocks: Array.isArray(draft.blocks) ? draft.blocks : [], fields: draft.fields });
      setI18nFields(draft.fields);
      // Card-label selections travel with the translation draft as well. Keep
      // the saved fallback for an old draft that predates this field.
      setCardTags((current) => ({
        zh: Object.prototype.hasOwnProperty.call(draft.fields?.zh ?? {}, "card_tags")
          ? splitTagText(draft.fields?.zh?.card_tags)
          : current.zh,
        en: Object.prototype.hasOwnProperty.call(draft.fields?.en ?? {}, "card_tags")
          ? splitTagText(draft.fields?.en?.card_tags)
          : current.en,
      }));
      setRecoveredNotice(true);
    } catch {
      // A quota error or private-mode block is not worth failing the editor for.
    }
  }, [draftKey, saveFailed, splitTagText]);

  // Primary locale values for form submission
  const otherLocale: "zh" | "en" = defaultLocale === "zh" ? "en" : "zh";
  const canonicalTitle = i18nFields[defaultLocale]?.title ?? "";
  /**
   * The title the row is saved under.
   *
   * The visible box edits `i18nFields[editLocale]` while the column takes
   * `defaultLocale`, and on a zh site those stop being the same slot the moment
   * the English tab is open: everything typed there went to `translations.en`
   * and left `title` empty — the one field the API requires. So a page could
   * not be created from the English tab at all, and the guard below cancelled
   * the submit before anything could say why.
   *
   * Borrowing the other locale when the canonical slot is blank is the rule
   * `trs()` already reads by — an empty base column takes the other language
   * rather than showing nothing — applied on the way in. A filled canonical
   * slot still wins, so an English title can never overwrite the Chinese one.
   * Only the title needs the rescue: the rest of these are optional columns
   * that nothing rejects for being empty and that `trs()` resolves on the way
   * back out.
   */
  const primaryTitle = canonicalTitle.trim() ? canonicalTitle : (i18nFields[otherLocale]?.title ?? "");
  const primarySummary = i18nFields[defaultLocale]?.summary ?? "";
  const primarySeoTitle = i18nFields[defaultLocale]?.seo_title ?? "";
  const primarySeoDescription = i18nFields[defaultLocale]?.seo_description ?? "";

  /**
   * The title is submitted through a hidden field, the form is `noValidate` and
   * neither action nor API requires it, so an empty one saved happily and left
   * a nameless row in the CMS list with no way to tell which entry it was.
   *
   * Cancelling the submit used to be the whole of the check. There is nothing
   * for the browser to mark on a hidden input, so pressing 儲存 with no title
   * anywhere produced no message, no marked field and no request — which reads
   * as the button being dead, not as the form refusing. Say it instead.
   */
  const [titleMissing, setTitleMissing] = useState(false);
  const guardSubmit = useCallback((form: HTMLFormElement) => {
    if (!primaryTitle.trim()) {
      setTitleMissing(true);
      const field = form.querySelector<HTMLInputElement>('input[aria-required="true"]');
      field?.focus();
      return false;
    }
    setTitleMissing(false);
    return true;
  }, [primaryTitle]);

  const stashDraft = useCallback((form: HTMLFormElement) => {
    try {
      const blocksField = form.querySelector<HTMLInputElement>('[name="body_blocks"]');
      sessionStorage.setItem(draftKey, JSON.stringify({
        blocks: blocksField ? JSON.parse(blocksField.value || "[]") : [],
        fields: submissionFields,
      }));
    } catch {
      // Same: losing the safety net is better than blocking the save.
    }
  }, [draftKey, submissionFields]);

  const getField = useCallback(
    (field: string) => i18nFields[editLocale]?.[field] ?? "",
    [i18nFields, editLocale],
  );

  const setField = useCallback(
    (field: string, value: string) => {
      setI18nFields((prev) => ({
        ...prev,
        [editLocale]: { ...(prev[editLocale] ?? {}), [field]: value },
      }));
    },
    [editLocale],
  );

  // Select the appropriate copy and ui based on editLocale
  const currentCopy = editLocale === "zh" ? copyZh : copyEn;
  const currentUi = editLocale === "zh" ? uiZh : uiEn;
  const placeholders = currentCopy.admin.placeholders;
  const categoryOptions = (() => {
    const merged = new Map<string, string>();
    for (const contentType of siteContentTypes ?? []) {
      const label = editLocale === "zh" ? contentType.label.zh : contentType.label.en;
      if (label) merged.set(contentType.key, label);
    }
    // Keep an existing legacy category selectable while it is being cleaned
    // up, but do not expose its raw internal key as a normal option.
    for (const key of [page?.content_type, ...(page?.categories ?? [])]) {
      const normalized = (key ?? "").trim();
      if (!normalized || merged.has(normalized)) continue;
      merged.set(
        normalized,
        contentTypeCatalogue(site, editLocale).get(normalized)?.label ??
        (currentUi.cms.contentTypeLabels as Record<string, string>)[normalized] ??
          (editLocale === "zh" ? "其他分類" : "Other category"),
      );
    }
    return Array.from(merged.entries());
  })();

  /* Cleared the moment a title exists in either language, so the message
     tracks the problem rather than the last attempt. */
  const showTitleMissing = titleMissing && !primaryTitle.trim();
  const selectedTagLabels = selectedTagsFor(editLocale);
  const selectedCardTagLabels = cardTagsFor(editLocale);
  const previewArticle = { ...page, id: page?.id ?? Number.MAX_SAFE_INTEGER, title: getField("title"), content_type: primaryCategory, categories: selectedCategories, tags: selectedTagsFor(defaultLocale), translations: submissionFields } as AdminPage;
  const listingPlacements = articleListingLocations(site, selectedCategories, editLocale === "zh");
  const collectionPlacements = articleCollectionPlacements(previewArticle, allPages, site, editLocale === "zh");
  const cardTagOptions = cardTagOptionsFor(editLocale);

  /* Name the page in the delete dialog, and say where it goes.
     A dialog that only asks "確定嗎？" is the one an editor learns to dismiss
     without reading, so it stops catching the mis-aimed click it exists for.
     The wording says 已刪除 rather than "cannot be undone" because this delete
     is the recoverable one — claiming otherwise would train the same reflex
     from the other side, and then the 永久刪除 dialog would read as routine. */
  const deletedName = (primaryTitle || page?.title || "").trim();
  const deleteConfirmBody =
    locale === "zh"
      ? `確定要刪除${deletedName ? `「${deletedName}」` : "這個內容頁"}嗎？頁面會從前台下架並移到「已刪除」，可在該處還原。`
      : `Delete ${deletedName ? `"${deletedName}"` : "this page"}? It comes off the public site and moves to the deleted list, where it can be restored.`;

  return (
    <>
      <Segmented
        onChange={setEditLocale}
        options={[{ value: "zh", label: "中文", title: "繁體中文" }, { value: "en", label: "English", title: "English" }]}
        size="sm"
        value={editLocale}
      />
      {/* Only on the tab that is not the site's own language, which is the one
          place a save does something other than what it looks like: it writes a
          translation and leaves the page's primary copy where it was. Saying so
          costs a line; not saying it cost an editor a round of "I saved it and
          the site did not change". */}
      {editLocale !== defaultLocale && (
        <Callout className="cms-locale-hint" tone="info">
          {editLocale === "zh"
            ? "正在編輯中文翻譯；英文版本仍是這個頁面的主要標題與內容。"
            : "You are editing the English translation; the Chinese version stays this page's primary title and content."}
        </Callout>
      )}
      {recoveredNotice && (
        <div role="status">
          <Callout tone="warning">
            {editLocale === "zh"
              ? "上次儲存沒有成功，已經把你當時的內容找回來了。修正上方的錯誤後再儲存一次。"
              : "The last save did not go through. What you had written has been restored; fix the error above and save again."}
          </Callout>
        </div>
      )}
      <SafeForm className="cms-editor-grid" action={action} noValidate onBeforeSubmit={(form) => guardSubmit(form) && (stashDraft(form), true)}>
        <input type="hidden" name="return_to" value={returnTo} />
        {/* Submit primary locale values as main fields */}
        <input type="hidden" name="title" value={primaryTitle} />
        <input type="hidden" name="summary" value={primarySummary} />
        {/* `body` is submitted by the block editor below, which derives it from
            the blocks. There used to be a second field with the same name here,
            carrying the value the page was loaded with; FormData.get returns the
            first, so the derived text was thrown away and the stored body could
            never change once a page had one. */}
        <input type="hidden" name="translations" value={JSON.stringify(submissionFields)} />
        <section className="admin-card admin-compact-form page-editor-main">
        <fieldset className="admin-edit-fields" disabled={!canWrite}>
        <Callout tone="neutral" title={currentCopy.admin.adminPageDesignTitle}>
          {currentCopy.admin.adminPageDesignText}
        </Callout>
        <FormSection title={currentUi.cms.pageSections.identity[0]} description={currentUi.cms.pageSections.identity[1]}>
          <FormGrid>
            <Field label={currentCopy.admin.adminTitle} required>
              {/* On the other language's tab the canonical title becomes the
                  placeholder, not the value. An empty English box beside a
                  Chinese page reads as "nothing here yet" whichever way it is
                  filled, and the thing that has to be unmistakable is which of
                  the two the box is holding: grey text is the page's own title
                  showing through, black text is an English one being written. */}
              <Input
                value={getField("title")}
                onChange={(e) => setField("title", e.target.value)}
                aria-required="true"
                aria-invalid={showTitleMissing}
                aria-describedby={showTitleMissing ? "cms-page-title-error" : undefined}
                placeholder={editLocale === defaultLocale ? placeholders.pageTitle : (canonicalTitle || placeholders.pageTitle)}
              />
              {showTitleMissing && (
                <small className="cms-field-error" id="cms-page-title-error" role="alert">
                  {editLocale === "zh"
                    ? "請先填寫標題再儲存，兩種語言都空白的話這個頁面存不起來。"
                    : "Enter a title before saving. With both languages blank there is nothing to save the page under."}
                </small>
              )}
            </Field>
            <details className="cms-url-settings">
              <summary>{editLocale === "zh" ? "文章網址（選填）" : "Article URL (optional)"}</summary>
              <Field label={editLocale === "zh" ? "網址名稱" : "URL name"}>
                <Input name="slug" defaultValue={selectedSlug} placeholder="journal-yilan-weekend" />
              </Field>
              <small>{editLocale === "zh" ? "留空使用文章編號；修改已發布文章的網址前，請確認原連結。" : "Leave blank to use the article ID. Check existing links before changing a published URL."}</small>
            </details>
            <div className="cms-category-picker">
              <PickerModal
                zh={editLocale === "zh"}
                label={contentVocabulary[editLocale].category}
                trigger={selectedCategories
                  .map((key) => categoryOptions.find(([value]) => value === key)?.[1] ?? key)
                  .join(editLocale === "zh" ? "、" : ", ")}
                title={editLocale === "zh" ? "選擇文章分類" : "Choose article categories"}
              >
                <div className="amenity-checkgrid">
                  {categoryOptions.map(([key, label]) => {
                    const selected = primaryCategory === key || additionalCategories.has(key);
                    return (
                      <label key={key} className={`amenity-checkbox${selected ? " is-on" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCategory(key)}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
                <small>
                  {editLocale === "zh"
                    ? "可選一個或多個分類。主分類是第一個選取的分類，會作為文章網址；其他分類也會顯示這篇文章。"
                    : "Choose one or more categories. The primary category is the first selection and owns the article URL; additional categories also show this article."}
                </small>
              </PickerModal>
              <input type="hidden" name="content_type" value={primaryCategory} />
              {selectedCategories.map((key) => <input key={key} type="hidden" name="categories" value={key} />)}
            </div>
            <input type="hidden" name="layout" value={page?.layout ?? "page"} />
            <Field label={currentCopy.admin.adminOrder}>
              <Input name="sort_order" type="number" defaultValue={page?.sort_order ?? 0} />
            </Field>
          </FormGrid>
        </FormSection>
        <FormSection title={currentUi.cms.pageSections.discovery[0]} description={currentUi.cms.pageSections.discovery[1]}>
          <HeroImageField
            defaultValue={page?.cover_image_url ?? ""}
            fieldName="cover_image_url"
            labels={{
              added: currentCopy.admin.adminAddedToMedia,
              failed: currentCopy.admin.adminUploadFailed,
              imageUrl: currentUi.cms.coverImage,
              loadingLibrary: currentCopy.admin.adminLoadingLibrary,
              noLibraryImages: currentCopy.admin.adminNoLibraryImages,
              selectFromLibrary: currentCopy.admin.adminSelectFromLibrary,
              useThisImage: currentCopy.admin.adminUseThisImage,
              upload: currentCopy.admin.adminUploadFromComputer,
              uploading: currentCopy.admin.adminUploading
            }}
          />
          <PickerModal
            zh={editLocale === "zh"}
            label={contentVocabulary[editLocale].topic}
            trigger={selectedTagLabels.join(editLocale === "zh" ? "、" : ", ") || (editLocale === "zh" ? "尚未選擇標籤" : "No tags selected")}
            title={editLocale === "zh" ? "選擇文章標籤" : "Choose article tags"}
            onClear={selectedTagLabels.length > 0 ? () => {
              setSelectedTagSlugs([]);
              setCustomTags((current) => ({ ...current, [editLocale]: [] }));
            } : undefined}
            clearLabel={selectedTagLabels.length > 0 ? (editLocale === "zh" ? "清除" : "Clear") : undefined}
          >
            <input aria-label={editLocale === "zh" ? "搜尋主題標籤" : "Search topic tags"} placeholder={editLocale === "zh" ? "搜尋中文、英文或代碼" : "Search Chinese, English or key"} value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} />
            <div className="amenity-checkgrid" aria-label={editLocale === "zh" ? "文章標籤，可複選" : "Article tags, multi-select"}>
              {(contentTags ?? []).filter((tag) => [tag.name_zh, tag.name_en, tag.slug].some((name) => name.toLocaleLowerCase().includes(topicSearch.trim().toLocaleLowerCase()))).map((tag) => {
                const selected = selectedTagSlugs.includes(tag.slug);
                const label = (editLocale === "zh" ? tag.name_zh : tag.name_en) || tag.name_zh || tag.slug;
                return (
                  <label key={tag.slug} className={`amenity-checkbox${selected ? " is-on" : ""}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleContentTag(tag.slug)} />
                    <span>{label}</span>
                    {tag.status === "archived" && <small>{editLocale === "zh" ? "（已封存）" : "(archived)"}</small>}
                  </label>
                );
              })}
            </div>
            <div className="content-tag-custom-row">
              <input
                value={customTagDraft}
                onChange={(event) => setCustomTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomTag();
                  }
                }}
                placeholder={editLocale === "zh" ? "新增自訂標籤" : "Add a custom tag"}
              />
              <Button size="sm" onClick={addCustomTag}>
                {editLocale === "zh" ? "加入" : "Add"}
              </Button>
            </div>
            {customTags[editLocale].length > 0 && (
              <div className="content-tag-custom-list">
                {customTags[editLocale].map((tag) => (
                  <button type="button" className="content-tag-chip" key={tag} onClick={() => removeCustomTag(tag)}>
                    {tag} ×
                  </button>
                ))}
              </div>
            )}
            <small>
              {editLocale === "zh"
                ? "可複選目錄標籤；也可暫時加入自訂標籤。管理頁建立的中英文標籤會在兩種語言自動對應。"
                : "Select several managed tags, or add a one-off label. Managed bilingual labels stay paired across both languages."}
            </small>
          </PickerModal>
          <PickerModal
            zh={editLocale === "zh"}
            label={contentVocabulary[editLocale].card}
            trigger={selectedCardTagLabels.join(editLocale === "zh" ? "、" : ", ") || (editLocale === "zh" ? "不顯示卡片標籤" : "Hide card labels")}
            title={editLocale === "zh" ? "選擇要顯示在卡片上的標籤" : "Choose labels shown on cards"}
            onClear={selectedCardTagLabels.length > 0 ? () => {
              setCardTags((current) => ({ ...current, [editLocale]: [] }));
            } : undefined}
            clearLabel={selectedCardTagLabels.length > 0 ? (editLocale === "zh" ? "清除" : "Clear") : undefined}
          >
            <input aria-label={editLocale === "zh" ? "搜尋卡片標籤" : "Search card labels"} placeholder={editLocale === "zh" ? "搜尋文章已選的標籤" : "Search the article's selected tags"} value={cardSearch} onChange={(e) => setCardSearch(e.target.value)} />
            {cardTagOptions.length > 0 ? (
              <div className="amenity-checkgrid" aria-label={editLocale === "zh" ? "卡片顯示標籤，可複選" : "Card labels, multi-select"}>
                {cardTagOptions.filter((tag) => tag.toLocaleLowerCase().includes(cardSearch.trim().toLocaleLowerCase())).map((tag) => {
                  const selected = selectedCardTagLabels.some((value) => tagKey(value) === tagKey(tag));
                  return (
                    <label key={tag} className={`amenity-checkbox${selected ? " is-on" : ""}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleCardTag(tag)} />
                      <span>{tag}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="hpb-field-hint">
                {editLocale === "zh"
                  ? "請先在上方文章標籤加入標籤，這裡再選擇要顯示在卡片上的項目。"
                  : "Add article tags above first, then choose which ones appear on cards."}
              </p>
            )}
            <small>
              {editLocale === "zh"
                ? "這裡只控制卡片標籤。取消全部勾選並儲存後，卡片不顯示標籤，文章主題與分類不受影響。舊文章尚未設定時，會先帶入原有標籤供你確認。"
                : "This controls card labels only. Clear every selection and save to hide them. Article topics and categories stay the same. Older articles start with their existing labels for you to review."}
            </small>
          </PickerModal>
          <input type="hidden" name="tags" value={selectedTagsFor(defaultLocale).join(", ")} />
          <section className="article-placement-preview" aria-label={editLocale === "zh" ? "文章顯示預覽" : "Article placement preview"}>
            <h3>{editLocale === "zh" ? "這篇文章會顯示在哪裡？" : "Where will this article appear?"}</h3>
            <p>{contentVocabulary[editLocale].categoryHelp}</p>
            <div className="tags">{listingPlacements.map((label) => <span className="tag" key={label}>{label}</span>)}</div>
            <p>{listingPlacements.length ? (editLocale === "zh" ? "發布後會出現在以上列表頁；首頁內容集合依區塊收錄條件顯示。" : "After publishing, the article appears on these listing pages. Collections use their own selection rules.") : (editLocale === "zh" ? "尚未有列表頁收錄此分類；請到網站頁面設定收錄分類。" : "No listing page includes these categories yet. Configure included categories in website pages.")}</p>
            <h3>{editLocale === "zh" ? "發布後會被這些區塊收錄" : "Collections after publishing"}</h3>
            {collectionPlacements.length ? <ul>{collectionPlacements.map(location => <li key={location.key}>{location.label}</li>)}</ul> : <p>{editLocale === "zh" ? "目前沒有內容集合收錄這篇文章。" : "No collection currently includes this article."}</p>}
            <small>{editLocale === "zh" ? "依目前來源、主題、手動選擇與數量推算；其他文章或區塊變更後結果可能改變。尚未發布的文章不會出現在前台。" : "Based on current sources, topics, manual picks and limits. Other edits can change the result. Drafts are not public."}</small>
            <h3>{editLocale === "zh" ? "卡片文字預覽" : "Card copy preview"}</h3>
            <div className="tags">{selectedCardTagLabels.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
            <strong>{getField("title") || (editLocale === "zh" ? "文章標題" : "Article title")}</strong>
            {!selectedCardTagLabels.length && <small>{editLocale === "zh" ? "卡片不顯示標籤" : "Cards show no labels"}</small>}
          </section>
          <RelatedStaysPicker
            defaultValue={page?.related_stay_ids ?? []}
            label={currentUi.cms.relatedStays}
            stays={stays ?? []}
            zh={editLocale === "zh"}
          />
        </FormSection>
        <FormSection title={currentUi.cms.pageSections.editorial[0]} description={currentUi.cms.pageSections.editorial[1]}>
          <Field label={currentCopy.admin.adminSummary}>
            <Textarea
              rows={3}
              value={getField("summary")}
              onChange={(e) => setField("summary", e.target.value)}
              placeholder={placeholders.pageSummary}
            />
          </Field>
          {/* Keyed so a recovered draft actually reaches the editor: it seeds
              its block list once from props, so handing it different blocks
              without a remount would change nothing. */}
          <PageBlockEditor
            canWrite={canWrite}
            key={recovered ? "recovered" : "saved"}
            body={recovered ? "" : page?.body}
            blocks={(recovered?.blocks as NonNullable<typeof page>["body_blocks"]) ?? page?.body_blocks}
            editLocale={editLocale}
            canonicalLocale={defaultLocale}
            previewUrl={page ? `/admin/preview/content/${page.id}` : undefined}
            showPreview={showPreview}
            onClosePreview={() => setShowPreview(false)}
            copy={{
              addBlock: currentUi.cms.blockEditor.addBlock,
              blockType: currentUi.cms.blockEditor.blockType,
              fields: currentUi.cms.blockEditor.fields,
              moveDown: currentUi.cms.blockEditor.moveDown,
              moveUp: currentUi.cms.blockEditor.moveUp,
              remove: currentUi.cms.blockEditor.remove,
              text: currentUi.cms.blockEditor.text,
              title: currentUi.cms.blockEditor.title,
              types: currentUi.cms.blockEditor.types,
              videoNote: currentUi.cms.blockEditor.videoNote
            }}
          />
        </FormSection>
        <FormSection>
          <Field label={currentCopy.admin.adminStatus}>
            <Select name="status" defaultValue={page?.status ?? "draft"}>
              <option value="draft">{currentCopy.admin.statusLabels.draft}</option>
              <option value="review">{currentCopy.admin.statusLabels.review}</option>
              <option value="published">{currentCopy.admin.statusLabels.published}</option>
              <option value="archived">{currentCopy.admin.statusLabels.archived}</option>
            </Select>
          </Field>
        </FormSection>
        <details className="page-form-section admin-advanced-style">
          <summary>{editLocale === "zh" ? "搜尋與分享設定（進階）" : "Search and sharing settings (advanced)"}</summary>
          <div className="page-form-section-heading">
            <span>{currentUi.cms.pageSections.seo[0]}</span>
            <p>{currentUi.cms.pageSections.seo[1]}</p>
          </div>
          <input type="hidden" name="seo_title" value={primarySeoTitle} />
          <input type="hidden" name="seo_description" value={primarySeoDescription} />
          <FormGrid cols={1}>
            <Field label={currentCopy.admin.adminMetaTitle}>
              <Input
                value={getField("seo_title")}
                onChange={(e) => setField("seo_title", e.target.value)}
                placeholder={placeholders.metaTitle}
              />
            </Field>
            <Field label={currentCopy.admin.adminMetaDescription}>
              <Textarea
                rows={2}
                value={getField("seo_description")}
                onChange={(e) => setField("seo_description", e.target.value)}
                placeholder={placeholders.metaDescription}
              />
            </Field>
            <Field label={currentCopy.admin.adminCanonical} hint={currentCopy.admin.adminCanonicalHelp}>
              <Input name="seo_canonical" defaultValue={seo.canonical ?? ""} placeholder={placeholders.canonical} />
            </Field>
          </FormGrid>
          {/* Share image. Without a field here the page could only ever offer
              its cover to LINE / Facebook, and a cover cropped for a card is
              rarely the crop you want at 1200×630. Blank keeps the cover. */}
          <HeroImageField
            defaultValue={typeof seo.og_image === "string" ? seo.og_image : ""}
            fieldName="seo_og_image"
            labels={{
              added: currentCopy.admin.adminAddedToMedia,
              failed: currentCopy.admin.adminUploadFailed,
              imageUrl: editLocale === "zh" ? "分享縮圖（選填，留白用封面圖）" : "Share image (optional, falls back to the cover)",
              loadingLibrary: currentCopy.admin.adminLoadingLibrary,
              noLibraryImages: currentCopy.admin.adminNoLibraryImages,
              selectFromLibrary: currentCopy.admin.adminSelectFromLibrary,
              useThisImage: currentCopy.admin.adminUseThisImage,
              upload: currentCopy.admin.adminUploadFromComputer,
              uploading: currentCopy.admin.adminUploading
            }}
          />
        </details>
        </fieldset>
      </section>
      <aside className="admin-card stay-preview-card cms-preview-card">
        <PagePreviewPanel
          pageId={page?.id}
          labels={{
            preview: locale === "zh" ? "即時預覽" : "Live Preview",
            seo: locale === "zh" ? "SEO 預覽" : "SEO Preview"
          }}
        >
          <SeoPreview
            defaults={{
              description: seo.description?.trim() || primarySummary || placeholders.metaDescription,
              image: seo.og_image || page?.cover_image_url || "",
              title: seo.title?.trim() || primaryTitle || placeholders.metaTitle,
              url: page ? `${siteUrl}${buildContentHref(page)}` : `${siteUrl}/page/draft-id`
            }}
            labels={{
              description: currentCopy.admin.adminMetaDescription,
              imageMissing: currentCopy.admin.seoPreviewImageMissing,
              searchPreview: currentCopy.admin.seoSearchPreview,
              sharePreview: currentCopy.admin.seoSharePreview
            }}
            siteUrl={siteUrl}
            slugMode="page"
            pageId={page?.id}
          />
        </PagePreviewPanel>
        {canWrite && <SubmitButton className={buttonClass({ variant: "primary", size: "lg", block: true })}>
          {submitLabel ?? title}
        </SubmitButton>}
        <Button block icon={<Eye />} onClick={() => setShowPreview(true)}>
          {locale === "zh" ? "即時預覽" : "Live Preview"}
        </Button>
        {/* The themed confirm, like the same delete on the list. This one
            submitted on the first click, two rows under 儲存 and with the same
            width and weight: a press aimed at 儲存 that landed one control low
            took the page off the site with nothing in between. */}
        {!isDeleted && deleteAction ? (
          <ConfirmSubmitButton
            action={deleteAction}
            body={deleteConfirmBody}
            cancelLabel={currentCopy.admin.adminConfirmCancel}
            className={buttonClass({ variant: "danger-ghost", block: true })}
            confirmLabel={locale === "zh" ? "刪除文章" : "Delete article"}
            title={locale === "zh" ? "確認刪除文章" : "Confirm article deletion"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            {locale === "zh" ? "刪除內容頁" : "Delete Page"}
          </ConfirmSubmitButton>
        ) : null}
        {isDeleted && restoreAction ? (
          <SubmitButton className={buttonClass({ block: true })} formAction={restoreAction}>
            {locale === "zh" ? "還原內容頁" : "Restore Page"}
          </SubmitButton>
        ) : null}
      </aside>
    </SafeForm>
    </>
  );
}
