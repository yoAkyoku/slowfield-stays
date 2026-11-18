"use client";

import { useState } from "react";
import { useLocaleFields } from "../../../modules/useLocaleFields";
import { ArrowLeft } from "lucide-react";
import AdminFlash from "../../../modules/AdminFlash";
import { createSiteAction } from "../../../modules/siteActions";
import { Button, ButtonLink, Card, Field, FormActions, FormGrid, Input, Page, PageHeader, Select, Textarea } from "../../../ui";

interface NewSiteFormProps {
  searchParams: { error?: string };
  copyZh: any;
  copyEn: any;
  sites: any[];
  initialLocale: string;
}

type I18nFields = Record<string, Record<string, string>>;

export default function NewSiteForm({
  searchParams,
  copyZh,
  copyEn,
  sites,
  initialLocale,
}: NewSiteFormProps) {
  const defaultLocale = initialLocale === "zh" ? "zh" : "en";
  const [editLocale, setEditLocale] = useState<"zh" | "en">(defaultLocale as "zh" | "en");

  const [i18nFields, setI18nFields] = useState<I18nFields>({ zh: {}, en: {} });
  const [status, setStatus] = useState("active");
  const [defaultLang, setDefaultLang] = useState("zh");
  const [seoOgImage, setSeoOgImage] = useState("");
  // Which existing site the new one copies its pages, blocks and rooms from.
  // Blank means the parent, which is what the backend already did — this only
  // makes the choice visible and lets it be a sibling villa instead.
  const [templateSiteId, setTemplateSiteId] = useState("");

  const currentCopy = editLocale === "zh" ? copyZh : copyEn;
  const isZh = editLocale === "zh";

  const { getField, setField } = useLocaleFields(i18nFields, setI18nFields, editLocale);

  // Auto-detect root site so child sites are linked correctly
  const rootSite = sites.find((s: any) => !s.parent_site_id);
  // Anything already set up is fair game to copy — a sibling villa most of all,
  // which is the case the client actually has.
  const templateChoices = (sites ?? []).filter((s: any) => s.id !== rootSite?.id);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("return_to", "/admin/sites");

    // Primary locale values
    const primaryName = i18nFields[defaultLang]?.name || i18nFields[defaultLocale]?.name || i18nFields.zh?.name || i18nFields.en?.name || "";
    const primarySlug = i18nFields[defaultLang]?.slug || i18nFields[defaultLocale]?.slug || i18nFields.zh?.slug || i18nFields.en?.slug || "";
    const bilingualValue = (field: string) => {
      const zh = String(i18nFields.zh?.[field] ?? "").trim();
      const en = String(i18nFields.en?.[field] ?? "").trim();
      return zh || en ? JSON.stringify({ zh, en }) : "";
    };
    formData.set("name", primaryName);
    formData.set("slug", primarySlug);
    formData.set("status", status);
    formData.set("default_locale", defaultLang);
    formData.set("_name_translations_json", JSON.stringify({
      zh: String(i18nFields.zh?.name ?? "").trim(),
      en: String(i18nFields.en?.name ?? "").trim(),
    }));
    formData.set("seo_title", bilingualValue("seo_title"));
    formData.set("seo_description", bilingualValue("seo_description"));
    formData.set("seo_og_image", seoOgImage.trim());

    // Link to root site as parent — this page only creates child sites
    if (rootSite) {
      formData.set("parent_site_id", String(rootSite.id));
    }
    if (templateSiteId) formData.set("template_site_id", templateSiteId);

    // English variants
    if (i18nFields.en?.name) formData.set("name_en", i18nFields.en.name);
    if (i18nFields.en?.slug) formData.set("slug_en", i18nFields.en.slug);

    createSiteAction(formData as any);
  };

  const defaultUI = {
    steps: ["1. Identity", "2. Configuration"],
    identityText: isZh ? "站點名稱、網址與語言" : "Site name, URL identity, and language",
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Site network"
        title={currentCopy.admin.adminCreateSite}
        description={
          isZh
            ? "建立一個新的子站，將自動隸屬於目前母站之下。"
            : "Create a new child site under the root site."
        }
        actions={
          <>
            <div className="a-toolbar__end" role="group" aria-label={isZh ? "編輯語言" : "Editing language"}>
              <Button size="sm" variant={editLocale === "zh" ? "secondary" : "ghost"} aria-pressed={editLocale === "zh"} onClick={() => setEditLocale("zh")} title="繁體中文">
                中文
              </Button>
              <Button size="sm" variant={editLocale === "en" ? "secondary" : "ghost"} aria-pressed={editLocale === "en"} onClick={() => setEditLocale("en")} title="English">
                English
              </Button>
            </div>
            <ButtonLink href="/admin/sites" icon={<ArrowLeft />} variant="ghost">
              {currentCopy.admin.adminBackToSites}
            </ButtonLink>
          </>
        }
      />

      <AdminFlash
        closeLabel={currentCopy.admin.adminFlashClose}
        message={searchParams.error}
        title={currentCopy.admin.adminFlashError}
        tone="error"
      />

      <form className="a-stack a-stack--md" onSubmit={handleSubmit}>
        <Card title={defaultUI.steps[0]} description={defaultUI.identityText}>
          <FormGrid>
            <Field label={currentCopy.admin.adminSiteName} required>
              <Input
                value={getField("name")}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Select Yilan"
                required
              />
            </Field>
            <Field label={currentCopy.admin.adminSlug} required>
              <Input
                value={getField("slug")}
                onChange={(e) => setField("slug", e.target.value)}
                placeholder="select-yilan"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </Field>
            <Field label={currentCopy.admin.adminStatus}>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">{currentCopy.admin.statusLabels.active}</option>
                <option value="draft">{currentCopy.admin.statusLabels.draft}</option>
                <option value="archived">{currentCopy.admin.statusLabels.archived}</option>
              </Select>
            </Field>
            <Field label={currentCopy.admin.adminDefaultLocale}>
              <Select value={defaultLang} onChange={(e) => setDefaultLang(e.target.value)}>
                <option value="zh">{isZh ? "中文" : "Chinese"}</option>
                <option value="en">English</option>
              </Select>
            </Field>
            <Field
              span="full"
              label={isZh ? "以哪個站台為模板" : "Copy from"}
              hint={
                isZh
                  ? "新站會複製這個站台的頁面、內容塊、房型與設施，建立後再自行修改文字與照片。挑一間現有民宿當模板，比從母站開始少改很多。"
                  : "The new site copies that site's pages, blocks, rooms and amenities; you then change the words and photos. Starting from an existing villa usually means far less to change than starting from the parent."
              }
            >
              <Select value={templateSiteId} onChange={(e) => setTemplateSiteId(e.target.value)}>
                <option value="">{isZh ? "母站（預設）" : "The parent site (default)"}</option>
                {templateChoices.map((s: any) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}{s.is_template ? (isZh ? "（模板）" : " (template)") : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </FormGrid>
        </Card>
        <Card
          title={isZh ? "SEO 與分享" : "SEO & Sharing"}
          description={isZh ? "中文與英文分開設定；切換上方語言編輯另一版本。" : "Set Chinese and English separately using the language switch above."}
        >
          <FormGrid cols={1}>
            <Field label={isZh ? "SEO 標題" : "Meta title"}>
              <Input
                value={getField("seo_title")}
                onChange={(e) => setField("seo_title", e.target.value)}
                placeholder={isZh ? "例如：思選旅宿｜宜蘭精品包棟" : "e.g. Slowfield Stays | Yilan Private Villas"}
              />
            </Field>
            <Field label={isZh ? "SEO 描述" : "Meta description"}>
              <Textarea
                value={getField("seo_description")}
                onChange={(e) => setField("seo_description", e.target.value)}
                placeholder={isZh ? "建議 120–160 字，說明站點與主要服務。" : "Aim for 120–160 characters describing the site and its main offering."}
                rows={3}
              />
            </Field>
            <Field
              label={isZh ? "預設分享圖片（OG Image）" : "Default share image (OG Image)"}
              hint={isZh ? "Canonical URL 會依各頁網址自動產生。" : "Canonical URLs are generated automatically from each page URL."}
            >
              <Input
                value={seoOgImage}
                onChange={(e) => setSeoOgImage(e.target.value)}
                placeholder="https://… or /storage/media/… (1200×630)"
              />
            </Field>
          </FormGrid>
          <FormActions sticky>
            <Button type="submit" variant="primary">
              {currentCopy.admin.adminCreateSite}
            </Button>
          </FormActions>
        </Card>
      </form>
    </Page>
  );
}
