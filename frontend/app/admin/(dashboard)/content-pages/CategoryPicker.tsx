"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import type { AdminArticleCategory } from "../../modules/adminApi";
import { Badge, Button, Callout, Check, Chips, Disclosure, SearchInput, Segmented, Stack, Toolbar } from "../../ui";

export default function CategoryPicker({ categories, values, onChange, zh }: {
  categories: AdminArticleCategory[]; values: string[]; onChange: (values: string[]) => void; zh: boolean;
}) {
  const [query, setQuery] = useState("");
  const [cleared, setCleared] = useState<string[] | null>(null);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const chosen = categories.filter(category => values.includes(category.key));
  const visible = categories.filter(category => !selectedOnly || values.includes(category.key)).filter(category => `${category.label.zh} ${category.label.en || ""} ${category.key}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section aria-label={zh ? "選擇文章分類" : "Choose article categories"}>
    <Stack gap="sm">
    <Toolbar end={<Button size="sm" disabled={!values.length} onClick={() => { setCleared([...values]); onChange([]); }}>{zh ? "全部取消" : "Clear selection"}</Button>}>
      <SearchInput aria-label={zh ? "搜尋分類" : "Search categories"} icon={<Search/>} value={query} onChange={event => setQuery(event.target.value)} placeholder={zh ? "輸入分類名稱" : "Category name"}/>
      <span className="a-field__hint" role="status">{zh ? `已選 ${values.length} ／共 ${categories.length} 個分類` : `${values.length} selected / ${categories.length} categories`}</span>
    </Toolbar>
    {cleared && values.length === 0 && <div role="status"><Callout tone="neutral" actions={<Button size="sm" variant="ghost" onClick={() => { onChange(cleared); setCleared(null); }}>{zh ? "撤銷" : "Undo"}</Button>}>
      {zh ? `已取消 ${cleared.length} 個分類` : `Cleared ${cleared.length} categories`}
    </Callout></div>}
    <Toolbar>
      <Segmented
        ariaLabel={zh ? "分類顯示範圍" : "Category view"}
        onChange={value => setSelectedOnly(value === "selected")}
        options={[
          { value: "all", label: zh ? `全部 (${categories.length})` : `All (${categories.length})` },
          { value: "selected", label: zh ? `已選 (${values.length})` : `Selected (${values.length})` }
        ]}
        size="sm"
        value={selectedOnly ? "selected" : "all"}
      />
      <span className="a-field__hint" role="status">{zh ? `目前顯示 ${visible.length} 個分類` : `${visible.length} categories shown`}</span>
    </Toolbar>
    {values.map(value => <input key={value} type="hidden" name="categories" value={value}/>)}
    <div className="cms-pick-list">
      {visible.map(category => <Check
        checked={values.includes(category.key)}
        key={category.key}
        label={<>{category.label[zh ? "zh" : "en"] || category.label.zh}{category.status === "archived" && <> <Badge>{zh ? "已封存" : "Archived"}</Badge></>}</>}
        onChange={event => onChange(event.target.checked ? [...values, category.key] : values.filter(value => value !== category.key))}
      />)}
      {!visible.length && <p className="a-field__hint">{zh ? (selectedOnly && !values.length ? "尚未選擇分類，切換「全部」以選擇。" : categories.length ? "找不到符合的分類，請更換搜尋文字或切換「全部」。" : "尚無可選分類，請先新增文章分類。") : "No matching categories."}</p>}
    </div>
    <Disclosure summary={zh ? `確認收錄分類 (${values.length})` : `Review included categories (${values.length})`}>
      {chosen.length ? <Chips>{chosen.map(category => <Button
        aria-label={zh ? `取消收錄 ${category.label.zh}` : `Remove ${category.label.en || category.label.zh}`}
        icon={<X/>}
        key={category.key}
        onClick={() => onChange(values.filter(value => value !== category.key))}
        size="sm"
      >{category.label[zh ? "zh" : "en"] || category.label.zh}</Button>)}</Chips> : <p className="a-field__hint">{zh ? "未收錄任何分類，此頁只顯示版面內容。" : "No categories selected. Only layout content will appear."}</p>}
    </Disclosure>
    </Stack>
  </section>;
}
