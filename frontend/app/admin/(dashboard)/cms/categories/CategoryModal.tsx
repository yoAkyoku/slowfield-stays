"use client";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import type { AdminArticleCategory } from "../../../modules/adminApi";
import { saveArticleCategory } from "../../../modules/categoryActions";
import { Button, Callout, Dialog, DialogActions, Disclosure, Field, FormGrid, Input, Select, Stack } from "../../../ui";

export default function CategoryModal({category, zh}: {category?: AdminArticleCategory; zh: boolean}) {
  const [state, action, pending] = useActionState(saveArticleCategory, {});
  const [name, setName] = useState(category?.label.zh ?? "");
  const [english, setEnglish] = useState(category?.label.en ?? "");
  const [key, setKey] = useState(category?.key ?? "");
  const [status, setStatus] = useState(category?.status ?? "active");
  const [showError, setShowError] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const formId = `category-${category?.key ?? "new"}-form`;
  const open = () => {
    setName(category?.label.zh ?? ""); setEnglish(category?.label.en ?? "");
    setKey(category?.key ?? ""); setStatus(category?.status ?? "active");
    setShowError(false); setOpen(true);
  };
  return <>
    {category
      ? <Button size="sm" onClick={open}>{zh ? "編輯分類" : "Edit category"}</Button>
      : <Button variant="primary" icon={<Plus/>} onClick={open}>{zh ? "新增分類" : "Add category"}</Button>}
    <Dialog
        closeLabel={zh ? "關閉" : "Close"}
      description={zh ? "建立分類後，可將文章加入分類；要讓訪客看到文章列表，再到網站頁面設定入口。" : "Create a category, add articles to it, then set up a public entry point on a website page."}
      dismissible={false}
      footer={<DialogActions><Button disabled={pending} form={formId} type="submit" variant="primary">{pending ? (zh ? "儲存中…" : "Saving…") : (zh ? "儲存分類" : "Save category")}</Button></DialogActions>}
      onClose={() => setOpen(false)}
      open={isOpen}
      title={category ? (zh ? "編輯分類" : "Edit category") : (zh ? "新增文章分類" : "Add article category")}
    >
      <form action={action} id={formId} onSubmit={() => setShowError(true)}>
        <Stack>
          {showError && state.error && <Callout live="alert" tone="danger">{state.error}</Callout>}
          <input type="hidden" name="editing" value={category ? "1" : "0"}/>
          <FormGrid>
            <Field label={zh ? "中文名稱" : "Chinese name"} required><Input name="name_zh" required maxLength={120} value={name} onChange={event => setName(event.target.value)}/></Field>
            <Field label={zh ? "英文名稱（選填）" : "English name (optional)"}><Input name="name_en" maxLength={120} value={english} onChange={event => setEnglish(event.target.value)}/></Field>
            <Field label={zh ? "狀態" : "Status"}><Select name="status" value={status} onChange={event => setStatus(event.target.value as "active" | "archived")}><option value="active">{zh ? "使用中" : "Active"}</option><option value="archived">{zh ? "已封存" : "Archived"}</option></Select></Field>
          </FormGrid>
          <Disclosure summary={zh ? "進階設定" : "Advanced settings"}><FormGrid cols={1}><Field label={zh ? "網址代碼（留白自動產生）" : "URL key (generated if blank)"}><Input name="key" pattern="[a-z][a-z0-9_-]{0,39}" maxLength={40} readOnly={Boolean(category)} value={key} onChange={event => setKey(event.target.value)}/></Field></FormGrid></Disclosure>
          <p className="a-field__hint">{zh ? "封存後不供新增選擇，既有文章與列表頁仍保留。" : "Archiving prevents new selection; existing articles and listings remain."}</p>
        </Stack>
      </form>
    </Dialog>
  </>;
}
