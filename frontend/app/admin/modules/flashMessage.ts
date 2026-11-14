/** Translate known action notices; preserve unknown API details verbatim. */
export function flashMessage(message: string, zh: boolean): string {
  const copy: Record<string,[string,string]> = {
    "This email already exists. Edit or restore the existing subscriber.":["此 Email 已存在，請編輯原訂閱者；若已刪除，請到已刪除清單復原。","This email already exists. Edit or restore the existing subscriber."],
    "Another subscriber already uses this email":["此 Email 已由其他訂閱者使用，請確認後再儲存。","Another subscriber already uses this email"],
    "scheduled_at must be in the future":["請選擇未來的發送日期與時間。","Choose a future send date and time."],
    "SMTP host is empty":["尚未設定 SMTP 主機，請先填寫寄送設定並儲存。","SMTP host is empty"],
    OK:["變更已完成。","Changes completed."],
    Saved:["內容已儲存。","Content saved."],
    "Tag created":["標籤已新增。","Tag created."],
    "Tag saved":["標籤已儲存，使用位置已同步。","Tag saved and references updated."],
    "Tag archived":["標籤已封存，既有文章內容會保留。","Tag archived. Existing article content is preserved."],
    "Tag restored":["標籤已恢復使用。","Tag restored."],
  };
  return copy[message]?.[zh ? 0 : 1] ?? message;
}
