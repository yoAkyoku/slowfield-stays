"use client";
import { useActionState, useState } from "react";
import type { AdminArticleCategory } from "../../modules/adminApi";
import CategoryPicker from "./CategoryPicker";
import { saveListingCategories } from "../../modules/categoryActions";
import { Button, Callout, Dialog, DialogActions, Stack } from "../../ui";

export default function ListingCategoriesModal({pageKey, label, selected, categories, zh}: {
  pageKey: string; label: string; selected: string[]; categories: AdminArticleCategory[]; zh: boolean;
}) {
  const [state, action, pending] = useActionState(saveListingCategories, {});
  const [isOpen, setOpen] = useState(false);
  const [values, setValues] = useState(selected);
  const [showError, setShowError] = useState(false);
  const formId = `listing-${pageKey}-form`;
  const available = categories.filter(category => category.status !== "archived" || selected.includes(category.key));
  const open = () => { setValues(selected); setShowError(false); setOpen(true); };
  return <>
    <Button size="sm" onClick={open}>{zh ? "設定收錄分類" : "Choose categories"}</Button>
    <Dialog
        closeLabel={zh ? "關閉" : "Close"}
      description={zh ? "勾選此頁要顯示的文章分類，可複選。全部取消時，只顯示頁面版面內容。" : "Choose the categories to display. With none selected, only layout content appears."}
      dismissible={false}
      footer={<DialogActions><Button disabled={pending} form={formId} variant="primary" type="submit">{pending ? (zh ? "儲存中…" : "Saving…") : (zh ? "儲存收錄分類" : "Save categories")}</Button></DialogActions>}
      onClose={() => setOpen(false)}
      open={isOpen}
      size="xl"
      title={<>{label}：{zh ? "收錄分類" : "Included categories"}</>}
    >
      <form action={action} id={formId} onSubmit={() => setShowError(true)}>
        <Stack>
          {showError && state.error && <Callout live="alert" tone="danger">{state.error}</Callout>}
          <input name="page_key" type="hidden" value={pageKey}/>
          <CategoryPicker categories={available} values={values} onChange={setValues} zh={zh}/>
        </Stack>
      </form>
    </Dialog>
  </>;
}
