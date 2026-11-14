"use client";

/**
 * Side card for the content-page editor. The live page preview now lives in the
 * block editor's full-screen modal (opened from a button under "儲存內容頁"), so
 * this panel only renders the SEO / share preview passed as children.
 */
export default function PagePreviewPanel({
  children
}: {
  // pageId / labels are still accepted by callers but no longer used here.
  pageId?: number;
  labels?: { preview: string; seo: string };
  children: React.ReactNode;
}) {
  return <div className="page-preview-panel">{children}</div>;
}
