"use client";

import { useActionState, useState } from "react";
import type { AdminArticleCategory } from "../../modules/adminApi";
import CategoryPicker from "./CategoryPicker";
import { createWebsitePage } from "../../modules/categoryActions";
import { Button, Callout, Dialog, DialogActions, Disclosure, Field, FormGrid, FormSection, Input, Select, Stack } from "../../ui";

export default function CreateWebsitePageModal({ categories, initialCategory, zh }: {
  categories: AdminArticleCategory[];
  initialCategory?: string;
  zh: boolean;
}) {
  const initial = categories.find(category => category.key === initialCategory && category.status === "active");
  const [state, action, pending] = useActionState(createWebsitePage, {});
  const [isOpen, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [english, setEnglish] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState(initial ? "listing" : "general");
  const [selected, setSelected] = useState<string[]>(initial ? [initial.key] : []);
  const [showError, setShowError] = useState(false);
  const active = categories.filter(category => category.status === "active");
  const formId = "create-website-page-form";
  const open = () => {
    setName(initial?.label.zh ?? ""); setEnglish(initial?.label.en ?? ""); setSlug("");
    setKind(initial ? "listing" : "general"); setSelected(initial ? [initial.key] : []);
    setShowError(false); setOpen(true);
  };
  return <>
    <Button variant="primary" onClick={open}>{zh ? "新增頁面" : "Add page"}</Button>
    <Dialog
        closeLabel={zh ? "關閉" : "Close"}
      description={zh ? "先選擇頁面用途。頁面建立後可編輯版面，暫時不加入導覽。" : "Choose what this page does. You can edit its layout after creating it; it will not be added to navigation yet."}
      dismissible={false}
      footer={<DialogActions><Button type="submit" form={formId} variant="primary" disabled={pending}>{pending ? (zh ? "建立中…" : "Creating…") : (zh ? "建立頁面" : "Create page")}</Button></DialogActions>}
      onClose={() => setOpen(false)}
      open={isOpen}
      size="xl"
      title={zh ? "新增網站頁面" : "Add website page"}
    >
      <form action={action} id={formId} onSubmit={() => setShowError(true)}>
        <Stack>
          {showError && state.error && <Callout live="alert" tone="danger">{state.error}</Callout>}
          <FormGrid>
            <Field label={zh ? "頁面名稱" : "Page name"} required><Input name="name_zh" required maxLength={120} value={name} onChange={event => setName(event.target.value)}/></Field>
            <Field label={zh ? "英文名稱（選填）" : "English name (optional)"}><Input name="name_en" maxLength={120} value={english} onChange={event => setEnglish(event.target.value)}/></Field>
            <Field label={zh ? "頁面用途" : "Page purpose"} span="full"><Select name="kind" value={kind} onChange={event => setKind(event.target.value)}>
              <option value="general">{zh ? "編輯固定內容：文字、圖片與版面" : "General page: text, images and layout"}</option>
              <option value="listing">{zh ? "展示文章清單：依分類自動收錄" : "Article listing: show articles from categories"}</option>
            </Select></Field>
          </FormGrid>
          {kind === "listing" && <FormSection title={zh ? "收錄哪些文章分類？" : "Which categories should appear?"}>
            <CategoryPicker categories={active} values={selected} onChange={setSelected} zh={zh}/>
          </FormSection>}
          <Disclosure summary={zh ? "網址設定（選填）" : "Page URL (optional)"}><FormGrid cols={1}><Field label={zh ? "網址代碼，留白自動產生" : "URL key, generated if blank"}><Input name="slug" pattern="[a-z][a-z0-9-]{0,119}" maxLength={120} value={slug} onChange={event => setSlug(event.target.value)}/></Field></FormGrid></Disclosure>
        </Stack>
      </form>
    </Dialog>
  </>;
}
