"use client";

import { useState, type ReactNode } from "react";
import { Badge, Button, Dialog } from "../../../ui";

export default function TagUsageModal({
  articleCount,
  children,
  tagLabel,
  zh,
}: {
  articleCount: number;
  children: ReactNode;
  tagId: number;
  tagLabel: string;
  zh: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        size="sm"
        variant="ghost"
      >
        {zh ? "查看使用情況" : "View usage"}{" "}
        <span aria-label={zh ? `${articleCount} 篇關聯文章` : `${articleCount} related articles`}><Badge>{articleCount}</Badge></span>
      </Button>
      <Dialog
        closeLabel={zh ? "關閉" : "Close"}
        onClose={() => setOpen(false)}
        open={open}
        size="lg"
        title={<><span className="a-eyebrow">{zh ? "標籤使用情況" : "Tag usage"}</span><span>{zh ? `「${tagLabel}」` : `“${tagLabel}”`}</span></>}
      >
        {children}
      </Dialog>
    </>
  );
}
