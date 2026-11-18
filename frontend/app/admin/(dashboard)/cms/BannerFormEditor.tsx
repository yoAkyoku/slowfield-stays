"use client";

import { useState } from "react";
import { useLocaleFields } from "../../modules/useLocaleFields";
import type { Banner } from "../../../modules/api";
import { resolveHeroScrollLabel } from "../../../modules/heroScrollLabel";
import ConfirmSubmitButton from "../../modules/ConfirmSubmitButton";
import SafeForm from "../../modules/SafeForm";
import SubmitButton from "../../modules/SubmitButton";
import HeroImageField from "../stays/HeroImageField";
import { HeadingInput } from "../../modules/blockFields";
import { RoleTypeControls, readRoleTypes } from "../../modules/blockForms";
import { Callout, Field, FormGrid, FormSection, Input, Select, Textarea, Segmented, buttonClass } from "../../ui";

type TranslationsMap = Record<string, Record<string, string>>;

/* ── What gets saved in the `translations` column ────────────────────────
 *
 * Two presentation keys ride alongside the per-locale copy, and they are not
 * alternatives to each other:
 *
 *   _style — the whole-hero setting. One title size, one alignment for the
 *            slide, and where the copy sits vertically. Read by
 *            HomeHeroCarousel; every existing banner has one.
 *   _type  — the per-role overrides (eyebrow / title / body / cta), the same
 *            shape a block's `config._type` carries and written by the same
 *            reducer, so a centred title no longer drags the subtitle with it
 *            (客戶: banner 字體需要能單獨改字體、大小、對齊).
 *
 * `_type` is written only when a role actually overrides something. An empty
 * `{}` would be a stored value where the render side reads the absence of one,
 * and it would also make every untouched banner look customised in the panel.
 *
 * The builder is kept free of JSX and of imports so tests/bannerRoleType.test.mts
 * can lift this exact region out of the file the editor ships and run it — the
 * `_style`/`_type` payload is a contract with the renderer, not a detail of the
 * form. Keep the fences either side of it intact.
 */

/* @bannerTranslations-pure:start */
export function buildBannerTranslations(
  fields: Record<string, Record<string, string>>,
  style: {
    size: string;
    align: string;
    valign: string;
    textShadow?: string;
    textBg?: string;
    textBgOpacity?: string;
  },
  roleTypes: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...fields,
    // Unconditional: HomeHeroCarousel reads _style on every slide, and the
    // three controls always hold a value (align/valign default rather than
    // being blank), so there is no "unset" state to collapse here.
    _style: {
      size: style.size,
      align: style.align,
      valign: style.valign,
      ...(style.textShadow ? { textShadow: style.textShadow } : {}),
      ...(style.textBg ? { textBg: style.textBg } : {}),
      ...(style.textBg ? { textBgOpacity: style.textBgOpacity || "35" } : {}),
    },
  };
  if (roleTypes && Object.keys(roleTypes).length) out._type = roleTypes;
  return out;
}
/* @bannerTranslations-pure:end */

export default function BannerFormEditor({
  action,
  banner,
  deleteAction,
  isDeleted,
  locale,
  restoreAction,
  returnTo,
  submitLabel,
  title,
  copy,
  canWrite = true,
}: {
  action: (formData: FormData) => void;
  banner?: Partial<Banner> | null;
  deleteAction?: (formData: FormData) => void;
  isDeleted?: boolean;
  locale: string;
  restoreAction?: (formData: FormData) => void;
  returnTo: string;
  submitLabel?: string;
  title: string;
  copy: ReturnType<typeof import("../../../modules/i18n").t>;
  canWrite?: boolean;
}) {
  const placeholders = copy.admin.placeholders;
  const defaultLocale = locale === "zh" ? "zh" : "en";
  const [editLocale, setEditLocale] = useState<"zh" | "en">(defaultLocale);

  const buildInitialFields = (): TranslationsMap => {
    const existing = banner?.translations ?? {};
    const result: TranslationsMap = { zh: { ...(existing.zh ?? {}) }, en: { ...(existing.en ?? {}) } };
    if (banner) {
      const primary = defaultLocale;
      if (!result[primary].title && banner.title) result[primary].title = banner.title;
      if (!result[primary].subtitle && banner.subtitle) result[primary].subtitle = banner.subtitle;
      if (!result[primary].cta_label && (banner as any).cta_label) result[primary].cta_label = (banner as any).cta_label;
    }
    return result;
  };

  const [i18nFields, setI18nFields] = useState<TranslationsMap>(buildInitialFields);

  // Hero title presentation (applies to the homepage hero), saved in translations._style
  const initialStyle = ((banner?.translations as Record<string, unknown> | undefined)?._style ?? {}) as {
    size?: string;
    align?: string;
    valign?: string;
    textShadow?: string;
    textBg?: string;
    textBgOpacity?: string;
  };
  const [titleSize, setTitleSize] = useState<string>(initialStyle.size ?? "");
  const [titleAlign, setTitleAlign] = useState<string>(initialStyle.align ?? "center");
  const [titleVAlign, setTitleVAlign] = useState<string>(initialStyle.valign ?? "center");
  const [textShadow, setTextShadow] = useState<string>(initialStyle.textShadow ?? "");
  const [textBg, setTextBg] = useState<string>(initialStyle.textBg ?? "");
  const [textBgOpacity, setTextBgOpacity] = useState<string>(initialStyle.textBgOpacity ?? "35");

  /* Per-role type, saved in translations._type. Held as a config object rather
     than as the bare roles map because that is what RoleTypeControls reads and
     writes — the same reducer the block editors use, so a banner cannot end up
     with a shape the renderer does not know. Normalised on the way in: a role
     hand-edited into the JSON, or one left over from an older shape, is dropped
     here instead of being handed straight back to the form. */
  const [typeConfig, setTypeConfig] = useState<Record<string, unknown>>(() => {
    const kept = readRoleTypes({ _type: (banner?.translations as Record<string, unknown> | undefined)?._type });
    return Object.keys(kept).length ? { _type: kept } : {};
  });
  const zh = locale === "zh";

  const { getField, setField } = useLocaleFields(i18nFields, setI18nFields, editLocale);

  const primaryTitle = i18nFields[defaultLocale]?.title ?? "";
  const primarySubtitle = i18nFields[defaultLocale]?.subtitle ?? "";
  /* The CTA label needs the same mirror as the two above. Its input carries no
     `name`, so it never reached FormData, and the action reads
     `formData.get("cta_label") ?? "Explore"` — every save wrote the literal
     word "Explore" into the column, whatever the editor had typed. Reopening
     the form then seeded that back into translations, so the damage compounded
     one save at a time and the hero button read "Explore" in whichever language
     had no translation of its own. */
  const primaryCtaLabel = i18nFields[defaultLocale]?.cta_label ?? "";

  /* Name the banner in the delete dialog. Same reasoning as the page and stay
     editors: an unnamed prompt is one an editor stops reading, and a banner's
     title is the only thing that tells two slides apart in this sidebar. */
  const deletedName = (primaryTitle || banner?.title || "").trim();
  const deleteConfirmBody =
    locale === "zh"
      ? `確定要刪除${deletedName ? `「${deletedName}」` : "這個橫幅"}嗎？橫幅會從首頁輪播移除並移到「已刪除」，可在該處還原。`
      : `Delete ${deletedName ? `"${deletedName}"` : "this banner"}? It leaves the homepage rotation and moves to the deleted list, where it can be restored.`;

  return (
    <>
      <Segmented
        onChange={setEditLocale}
        options={[{ value: "zh", label: "中文", title: "繁體中文" }, { value: "en", label: "English", title: "English" }]}
        size="sm"
        value={editLocale}
      />
      <SafeForm className="cms-editor-grid" action={action} noValidate>
        <input type="hidden" name="return_to" value={returnTo} />
        <input type="hidden" name="title" value={primaryTitle} />
        <input type="hidden" name="subtitle" value={primarySubtitle} />
        <input type="hidden" name="cta_label" value={primaryCtaLabel} />
        <input
          type="hidden"
          name="translations"
          value={JSON.stringify(
            buildBannerTranslations(
              i18nFields,
              { size: titleSize, align: titleAlign, valign: titleVAlign, textShadow, textBg, textBgOpacity },
              readRoleTypes(typeConfig),
            ),
          )}
        />
        <section className="admin-card admin-compact-form">
        <fieldset className="admin-edit-fields" disabled={!canWrite}>
        <Callout tone="neutral" title={copy.admin.adminBannerDesignTitle}>
          {copy.admin.adminBannerDesignText}
        </Callout>
        <FormSection title={zh ? "基本文案" : "Basic copy"} description={zh ? "輸入訪客會看到的標題與副標題。" : "Write the title and subtitle visitors will see."}>
          <Field label={copy.admin.adminTitle} required>
            {/* Textarea, not an input: the hero renders the title with
                white-space: pre-line, so pressing Enter here is how the line
                is broken where you want it (客戶：hero title 自定義換行). */}
            <Textarea
              rows={2}
              value={getField("title")}
              onChange={(e) => setField("title", e.target.value)}
              aria-required="true"
              placeholder={placeholders.bannerTitle}
            />
          </Field>
          <Field label={copy.admin.adminSubtitle}>
            {/* The title beside it is already a textarea, so a banner headline
                could break where the editor wanted and its subtitle could not —
                an <input> holds no newline at all (客戶: banner 的副標也要能換
                行). Same auto-growing field the hero subtitle uses. */}
            <HeadingInput
              value={getField("subtitle")}
              onChange={(v) => setField("subtitle", v)}
              placeholder={placeholders.bannerSubtitle}
            />
          </Field>
        </FormSection>
        <FormSection title={zh ? "圖片與按鈕" : "Image and buttons"} description={zh ? "選擇主視覺圖片與訪客點擊後的連結。" : "Choose the hero image and where each button leads."}>
          <FormGrid>
          <Field label={editLocale === "zh" ? "主要按鈕文字" : "Primary button label"}>
            <Input
              value={getField("cta_label")}
              onChange={(e) => setField("cta_label", e.target.value)}
              placeholder={editLocale === "zh" ? "立即探索" : "Explore Now"}
            />
          </Field>
          {/* The hero CTA belongs to the banner it sits on — the button was
              hardcoded to /stays, so a banner could name its own call to action
              and still send everyone to the same page. Not per-locale: a link
              target is the same in both languages. */}
          <Field label={editLocale === "zh" ? "主要按鈕連結" : "Primary button link"}>
            <Input
              name="cta_href"
              defaultValue={banner?.cta_href ?? ""}
              placeholder="/stays"
            />
          </Field>
          <Field label={editLocale === "zh" ? "次要按鈕文字" : "Secondary button label"}>
            <Input
              value={getField("story_cta_label")}
              onChange={(e) => setField("story_cta_label", e.target.value)}
              placeholder={editLocale === "zh" ? "品牌故事" : "Our story"}
            />
          </Field>
          <Field label={editLocale === "zh" ? "次要按鈕連結" : "Secondary button link"}>
            <Input
              value={getField("story_cta_href")}
              onChange={(e) => setField("story_cta_href", e.target.value)}
              placeholder="/brand"
            />
          </Field>
          <Field label={editLocale === "zh" ? "向下探索文字" : "Scroll cue text"}>
            <Input
              value={resolveHeroScrollLabel(i18nFields[editLocale]?.scroll_label, editLocale)}
              onChange={(e) => setField("scroll_label", e.target.value)}
              placeholder={editLocale === "zh" ? "向下探索" : "Scroll to explore"}
            />
          </Field>
          </FormGrid>
        </FormSection>
        <FormSection title={<>{copy.admin.adminImageUrl}<span className="a-field__req" aria-hidden="true">*</span></>}>
          <HeroImageField
            defaultValue={banner?.image_url ?? ""}
            fieldName="image_url"
            mediaKind="hero"
            labels={{
              added: copy.admin.adminAddedToMedia,
              failed: copy.admin.adminUploadFailed,
              imageUrl: copy.admin.adminImageUrl,
              loadingLibrary: copy.admin.adminLoadingLibrary,
              noLibraryImages: copy.admin.adminNoLibraryImages,
              selectFromLibrary: copy.admin.adminSelectFromLibrary,
              useThisImage: copy.admin.adminUseThisImage,
              upload: copy.admin.adminUploadFromComputer,
              uploading: copy.admin.adminUploading
            }}
          />
        </FormSection>
        </fieldset>
      </section>
      <aside className="admin-card stay-preview-card cms-preview-card">
        {banner?.id && (
          <div className="cms-iframe-preview">
            <p className="a-eyebrow">{locale === "zh" ? "已儲存版本預覽" : "Saved version preview"}</p>
            <p>{zh ? "修改後先儲存草稿，再確認預覽與發布。" : "Save changes as a draft, check the preview, then publish."}</p>
            <iframe
              src={`/admin/preview/banners/${banner.id}`}
              title={locale === "zh" ? "已儲存橫幅預覽" : "Saved banner preview"}
            />
          </div>
        )}
        <fieldset className="admin-edit-fields" disabled={!canWrite}>
        <details className="page-form-section admin-advanced-style">
          <summary>{zh ? "顯示設定（排序與發布狀態）" : "Display settings (order and status)"}</summary>
          <p>{zh ? "新橫幅預設為草稿。先儲存取得預覽，再選擇發布狀態。" : "New banners start as drafts. Check the preview, then choose the publishing status here."}</p>
          <FormGrid>
            <Field label={copy.admin.adminOrder}>
              <Input name="sort_order" type="number" defaultValue={banner?.sort_order ?? 0} placeholder="0" />
            </Field>
            <Field label={copy.admin.adminStatus}>
              <Select name="status" defaultValue={banner?.status ?? "draft"}>
                <option value="draft">{copy.admin.statusLabels.draft}</option>
                <option value="review">{copy.admin.statusLabels.review}</option>
                <option value="published">{copy.admin.statusLabels.published}</option>
                <option value="archived">{copy.admin.statusLabels.archived}</option>
              </Select>
            </Field>
          </FormGrid>
        </details>
        <details className="page-form-section admin-advanced-style">
          <summary>{zh ? "進階樣式（字體、位置與文字覆寫）" : "Advanced style (type, placement and overrides)"}</summary>
          <div className="page-form-section-heading">
            <span>{zh ? "首頁文字樣式" : "Hero text style"}</span>
            <p>{zh ? "控制此 Banner 在首頁的文字大小、字體與對齊。" : "Controls this banner's homepage text size, font and alignment."}</p>
          </div>
          <div className="form-grid compact">
            <label>
              <span>{zh ? "標題字體大小" : "Title size"}</span>
              <select value={titleSize} onChange={(e) => setTitleSize(e.target.value)}>
                <option value="">{zh ? "預設" : "Default"}</option>
                <option value="sm">{zh ? "小" : "Small"}</option>
                <option value="md">{zh ? "中" : "Medium"}</option>
                <option value="lg">{zh ? "大" : "Large"}</option>
                <option value="xl">{zh ? "特大" : "Extra large"}</option>
              </select>
            </label>
            <label>
              <span>{zh ? "文字對齊" : "Text align"}</span>
              <select value={titleAlign} onChange={(e) => setTitleAlign(e.target.value)}>
                <option value="left">{zh ? "靠左" : "Left"}</option>
                <option value="center">{zh ? "置中" : "Center"}</option>
                <option value="right">{zh ? "靠右" : "Right"}</option>
              </select>
            </label>
            <label>
              <span>{zh ? "垂直位置" : "Vertical position"}</span>
              <select value={titleVAlign} onChange={(e) => setTitleVAlign(e.target.value)}>
                <option value="center">{zh ? "垂直置中" : "Middle"}</option>
                <option value="top">{zh ? "靠上" : "Top"}</option>
                <option value="bottom">{zh ? "靠下" : "Bottom"}</option>
              </select>
            </label>
            <label>
              <span>{zh ? "文字陰影" : "Text shadow"}</span>
              <select value={textShadow} onChange={(e) => setTextShadow(e.target.value)}>
                <option value="">{zh ? "無" : "None"}</option>
                <option value="soft">{zh ? "柔和" : "Soft"}</option>
                <option value="strong">{zh ? "明顯" : "Strong"}</option>
              </select>
            </label>
            <label>
              <span>{zh ? "文字底色（留空為無）" : "Text background (blank for none)"}</span>
              <input
                value={textBg}
                onChange={(e) => setTextBg(e.target.value)}
                placeholder="#000000"
              />
            </label>
            <label>
              <span>{zh ? `底色透明度 ${textBgOpacity}%` : `Background opacity ${textBgOpacity}%`}</span>
              <input
                type="range"
                min="0"
                max="80"
                step="5"
                value={textBgOpacity}
                onChange={(e) => setTextBgOpacity(e.target.value)}
                disabled={!textBg.trim()}
              />
            </label>
          </div>
          {/* Says which of the two settings wins before the editor finds out by
              saving. The three above move the whole slide; the panel below is
              the exception to them, one text role at a time. */}
          <p className="hpb-field-hint">
            {zh
              ? "以上三項是整張 Banner 的整體設定（一個標題大小、一個對齊、垂直位置）。下面可針對單一文字再細調，有填的項目會蓋過上面的整體設定，留空則沿用。"
              : "The three settings above apply to the whole banner — one title size, one alignment, the vertical position. Below you can adjust a single piece of text: anything you fill in overrides the banner-wide setting, anything left blank follows it."}
          </p>
          {/* The block editors' control, not a second copy of it: the banner's
              roles are the same four the hero renders, and every write goes
              through the same reducer, so what a banner stores and what a block
              stores stay one shape (客戶: banner 字體需要能單獨改字體、大小、對齊). */}
          <RoleTypeControls
            c={typeConfig}
            zh={zh}
            onChange={(cfg) => setTypeConfig(cfg)}
          />
          {/* The role names are the block vocabulary; on a banner they land on
              differently-named fields, and 內文 → 副標 is the one nobody guesses. */}
          <p className="hpb-field-hint">
            {zh
              ? "對應關係：「標題」是主標，「內文」是副標，「按鈕」是 CTA 文字，「眉眼」是標題上方的小字。"
              : "On a banner: Title is the headline, Body is the subtitle, CTA is the button label, and Eyebrow is the small line above the headline."}
          </p>
        </details>
        </fieldset>
        {canWrite && <SubmitButton className={buttonClass({ variant: "primary", size: "lg", block: true })}>
          {submitLabel ?? title}
        </SubmitButton>}
        {/* Asks first, like the same delete on the banner list. */}
        {!isDeleted && deleteAction ? (
          <ConfirmSubmitButton
            action={deleteAction}
            body={deleteConfirmBody}
            cancelLabel={zh ? "取消" : "Cancel"}
            className={buttonClass({ variant: "danger-ghost", block: true })}
            confirmLabel={zh ? "刪除橫幅" : "Delete banner"}
            title={zh ? "確認刪除橫幅" : "Confirm banner deletion"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            {locale === "zh" ? "刪除橫幅" : "Delete Banner"}
          </ConfirmSubmitButton>
        ) : null}
        {isDeleted && restoreAction ? (
          <SubmitButton className={buttonClass({ block: true })} formAction={restoreAction}>
            {locale === "zh" ? "還原橫幅" : "Restore Banner"}
          </SubmitButton>
        ) : null}
      </aside>
    </SafeForm>
    </>
  );
}
