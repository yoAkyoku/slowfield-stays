"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import type { AdminContentTag } from "../../../modules/adminApi";

import { saveTagModal } from "../../../modules/tagModalActions";
import { Button, Callout, DescriptionList, Dialog, DialogActions, Disclosure, Field, FormGrid, Input, Select, Stack } from "../../../ui";

type CreateContentTagAction = (formData: FormData) => Promise<void>;

/** Eyebrow + title inside the Dialog heading. */
function ModalTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <>
      <span className="a-eyebrow">{kicker}</span>
      <span>{title}</span>
    </>
  );
}

export function ContentTagCreateModal({ closeLabel, zh }: { action: CreateContentTagAction; closeLabel: string; zh: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, save, pending] = useActionState(saveTagModal.bind(null, null), {});
  const [fields, setFields] = useState({name_zh:"",name_en:"",slug:"",sort_order:"0",status:"active"});
  const [showError, setShowError] = useState(false);
  const change = (key: keyof typeof fields, value: string) => setFields(previous => ({...previous,[key]:value}));
  const formId = "content-tag-create-form";

  return (
    <>
      <Button icon={<Plus />} onClick={() => setOpen(true)} variant="primary">
        {zh ? "新增標籤" : "Add tag"}
      </Button>
      <Dialog
        closeLabel={closeLabel}
        description={zh ? "中文名稱必填；英文名稱供英文後台與前台顯示。Slug 留白會自動產生。" : "Chinese is required. English is used by the English editor and public site; leave slug blank to generate one."}
        dismissible={false}
        footer={<DialogActions><Button disabled={pending} form={formId} type="submit" variant="primary">{pending ? (zh ? "新增中…" : "Creating…") : (zh ? "新增標籤" : "Add tag")}</Button></DialogActions>}
        onClose={() => setOpen(false)}
        open={open}
        title={<ModalTitle kicker={zh ? "建立共用詞彙" : "Build the vocabulary"} title={zh ? "新增標籤" : "Add a tag"} />}
      >
        <form action={save} id={formId} onSubmit={() => setShowError(true)}>
          <Stack>
            {showError && state.error && <Callout tone="danger">{state.error}</Callout>}
            <input name="return_to" type="hidden" value="/admin/cms/tags" />
            <FormGrid>
              <Field label={zh ? "中文名稱" : "Chinese label"} required>
                <Input autoFocus name="name_zh" value={fields.name_zh} onChange={event => change("name_zh", event.target.value)} maxLength={120} placeholder={zh ? "例如：在地" : "e.g. 在地"} required />
              </Field>
              <Field label={zh ? "英文名稱" : "English label"}>
                <Input name="name_en" value={fields.name_en} onChange={event => change("name_en", event.target.value)} maxLength={120} placeholder={zh ? "例如：Local" : "e.g. Local"} />
              </Field>
            </FormGrid>
            <Disclosure summary={zh ? "網址代碼與排序（進階）" : "Key and order (advanced)"}><FormGrid>
              <Field label="Slug">
                <Input name="slug" value={fields.slug} onChange={event => change("slug", event.target.value)} pattern="[a-z0-9][a-z0-9_-]{0,119}" placeholder="local" />
              </Field>
              <Field label={zh ? "排序" : "Order"}>
                <Input name="sort_order" value={fields.sort_order} onChange={event => change("sort_order", event.target.value)} type="number" />
              </Field></FormGrid></Disclosure>
          </Stack>
        </form>
      </Dialog>
    </>
  );
}

export function ContentTagEditModal({
  canWrite,
  closeLabel,
  tag,
  usageCount,
  zh
}: {
  canWrite: boolean;
  closeLabel: string;
  tag: AdminContentTag;
  usageCount: number;
  zh: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, save, pending] = useActionState(saveTagModal.bind(null, tag.id), {});
  const [fields, setFields] = useState({name_zh:tag.name_zh,name_en:tag.name_en,slug:tag.slug,sort_order:String(tag.sort_order),status:tag.status});
  const [showError, setShowError] = useState(false);
  const change = (key: keyof typeof fields, value: string) => setFields(previous => ({...previous,[key]:value}));
  const formId = `content-tag-edit-form-${tag.id}`;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {canWrite ? (zh ? "編輯" : "Edit") : (zh ? "檢視" : "View")}
      </Button>
      <Dialog
        closeLabel={closeLabel}
        description={canWrite ? (zh ? "更新後會同步到文章與首頁內容集合；同名詞彙請先檢查使用位置。" : "Changes stay available to articles and homepage collections. Slugs use lowercase letters, numbers, underscores, or hyphens.") : (zh ? "查看標籤名稱、狀態與文章使用量；此帳號只有檢視權限。" : "View tag labels, status and article usage. This account has view-only access.")}
        dismissible={!canWrite}
        footer={canWrite ? <DialogActions><Button disabled={pending} form={formId} type="submit" variant="primary">{pending ? (zh ? "儲存中…" : "Saving…") : (zh ? "儲存標籤" : "Save tag")}</Button></DialogActions> : undefined}
        onClose={() => setOpen(false)}
        open={open}
        title={<ModalTitle kicker={zh ? "共用詞彙" : "Shared vocabulary"} title={canWrite ? (zh ? `編輯「${tag.name_zh}」` : `Edit “${tag.name_en || tag.name_zh}”`) : (zh ? `檢視「${tag.name_zh}」` : `View “${tag.name_en || tag.name_zh}”`)} />}
      >
        <form action={canWrite ? save : undefined} id={formId} onSubmit={() => setShowError(true)}>
          <Stack>
            {showError && state.error && <Callout tone="danger">{state.error}</Callout>}
            <input name="return_to" type="hidden" value="/admin/cms/tags" />
            <FormGrid>
              <Field label={zh ? "中文名稱" : "Chinese label"} required>
                <Input autoFocus={canWrite} maxLength={120} name="name_zh" value={fields.name_zh} onChange={event => change("name_zh", event.target.value)} readOnly={!canWrite} required />
              </Field>
              <Field label={zh ? "英文名稱" : "English label"}>
                <Input maxLength={120} name="name_en" value={fields.name_en} onChange={event => change("name_en", event.target.value)} readOnly={!canWrite} />
              </Field>
              <Field label={zh ? "狀態" : "Status"}>
                <Select value={fields.status} onChange={event => change("status", event.target.value)} disabled={!canWrite} name="status">
                  <option value="active">{zh ? "使用中" : "Active"}</option>
                  <option value="archived">{zh ? "已封存" : "Archived"}</option>
                </Select>
              </Field>
            </FormGrid>
            <Disclosure summary={zh ? "網址代碼與排序（進階）" : "Key and order (advanced)"}><FormGrid>
              <Field label="Slug">
                <Input name="slug" value={fields.slug} onChange={event => change("slug", event.target.value)} pattern="[a-z0-9][a-z0-9_-]{0,119}" readOnly={!canWrite} />
              </Field>
              <Field label={zh ? "排序" : "Order"}>
                <Input name="sort_order" value={fields.sort_order} onChange={event => change("sort_order", event.target.value)} readOnly={!canWrite} type="number" />
              </Field></FormGrid></Disclosure>
            <DescriptionList columns={1} items={[{ label: zh ? "目前使用量" : "Current usage", value: <strong>{usageCount} {zh ? "篇文章" : "pages"}</strong> }]} />
            {!canWrite && <Callout tone="neutral">{zh ? "你目前只有檢視權限；如需修改，請聯絡此站點管理員。" : "You have view-only access. Contact a site administrator to change this tag."}</Callout>}
          </Stack>
        </form>
      </Dialog>
    </>
  );
}
