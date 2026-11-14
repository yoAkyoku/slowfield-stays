import type { ComponentProps } from "react";
import Link from "next/link";
import StatusActions from "../../modules/StatusActions";
import AdminEmptyState from "../../modules/AdminEmptyState";
import { Badge, CellTitle, Chips, TableFrame } from "../../ui";
import type { CmsPageIssueKey, CmsPageRow } from "./cmsConsoleData";
import CmsStatusIssueBadges from "./CmsStatusIssueBadges";
import type { Locale } from "../../../modules/i18n";
import { trs, tagsT, cardTagsT } from "../../../modules/tr";

export default function CmsPagesTable({
  actions,
  canWrite = true,
  locale,
  categoryLabel,
  emptyText,
  emptyTitle,
  issueLabels,
  labels,
  pages,
  pageTypeLabel,
  showCheckbox,
  statusActionLabels,
  statusLabels
}: {
  actions: {
    archive: (id: number) => (formData: FormData) => void;
    deleteItem: (id: number) => (formData: FormData) => void;
    purgeItem?: (id: number) => (formData: FormData) => void;
    draft: (id: number) => (formData: FormData) => void;
    publish: (id: number) => (formData: FormData) => void;
    restoreItem: (id: number) => (formData: FormData) => void;
    review: (id: number) => (formData: FormData) => void;
  };
  /** Passed straight to StatusActions — see the note there. */
  canWrite?: boolean;
  /** The admin's chosen language, so the row reads in it. */
  locale: Locale;
  categoryLabel: string;
  emptyText: string;
  emptyTitle: string;
  issueLabels: Record<CmsPageIssueKey | "missing_image", string>;
  labels: {
    actions: string;
    deletedLabel: string;
    issues: string;
    slug: string;
    status: string;
    title: string;
  };
  pages: CmsPageRow[];
  pageTypeLabel: (contentType?: string) => string;
  showCheckbox?: boolean;
  statusActionLabels: ComponentProps<typeof StatusActions>["labels"];
  statusLabels: Record<string, string>;
}) {
  if (!pages.length) {
    return <AdminEmptyState text={emptyText} title={emptyTitle} />;
  }

  const topicsLabel = locale === "zh" ? "主題／卡片標籤" : "Topics / card labels";
  const checksLabel = locale === "zh" ? "內容檢查" : "Content checks";

  return (
    <TableFrame stack>
        <table className="a-table cms-table">
          <thead>
            <tr>
              {showCheckbox && <th className="is-shrink" />}
              <th>{labels.title}</th>
              <th>{categoryLabel}</th>
              <th>{topicsLabel}</th>
              <th>{labels.status}</th>
              <th>{checksLabel}</th>
              <th>{labels.actions}</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id}>
                {showCheckbox && <td className="is-shrink"><input type="checkbox" aria-label={`${locale === "zh" ? "選取" : "Select"} ${trs(page, "title", locale)}`} name="ids" value={page.id} /></td>}
                <td>
                  <CellTitle
                    sub={trs(page, "summary", locale) || undefined}
                    title={<Link href={`/admin/cms/pages/${page.id}/edit`}>{trs(page, "title", locale)}</Link>}
                  />
                </td>
                <td data-label={categoryLabel}>
                  <Chips>
                    {Array.from(new Set([page.content_type, ...(page.categories ?? [])])).filter(Boolean).map((key) => <Badge key={key} tone="brand">{pageTypeLabel(key)}</Badge>)}
                  </Chips>
                </td>
                <td data-label={topicsLabel}>
                  <Chips>{tagsT(page, locale).map((tag) => <Badge key={tag}>{tag}</Badge>)}</Chips>
                  <small className="a-field__hint">{locale === "zh" ? "卡片：" : "Card: "}{cardTagsT(page, locale).join(locale === "zh" ? "、" : ", ") || (locale === "zh" ? "不顯示" : "Hidden")}</small>
                </td>
                <td data-label={labels.status}>
                  <CmsStatusIssueBadges
                    deletedAt={page.deleted_at}
                    deletedLabel={labels.deletedLabel}
                    issueLabels={issueLabels}
                    issues={[]}
                    status={page.status}
                    statusLabels={statusLabels}
                  />
                </td>
                <td data-label={checksLabel}>
                  {page.computedIssues.length ? (
                    <details className="cms-checks"><summary>{locale === "zh" ? `${page.computedIssues.length} 項建議` : `${page.computedIssues.length} suggestions`}</summary>
                    <CmsStatusIssueBadges
                      deletedAt={null}
                      deletedLabel={labels.deletedLabel}
                      issueLabels={issueLabels}
                      issues={page.computedIssues}
                      showStatus={false}
                      status={page.status}
                      statusLabels={{}}
                    />
                    </details>
                  ) : (
                    <Badge tone="success">{locale === "zh" ? "已完成" : "Complete"}</Badge>
                  )}
                </td>
                <td>
                  <StatusActions
                    canWrite={canWrite}
                    actions={{
                      archive: actions.archive(page.id),
                      deleteItem: actions.deleteItem(page.id),
                      purgeItem: actions.purgeItem?.(page.id),
                      draft: actions.draft(page.id),
                      publish: actions.publish(page.id),
                      restoreItem: actions.restoreItem(page.id),
                      review: actions.review(page.id)
                    }}
                    /* Named per row. `statusActionLabels` is one object for the
                       whole table, so the sentence it carries is the same on
                       every line and names nothing — see the note in
                       StatusActions. */
                    confirmDeleteBody={
                      locale === "zh"
                        ? `確定要刪除文章「${trs(page, "title", locale)}」嗎？它會移到「已刪除」，可在該處還原。`
                        : `Delete the article "${trs(page, "title", locale)}"? It moves to the deleted list, where it can be restored.`
                    }
                    confirmPurgeBody={
                      locale === "zh"
                        ? `確定要永久刪除內容頁「${trs(page, "title", locale)}」嗎？它會從資料庫中移除，且無法還原。`
                        : `Permanently delete the page "${trs(page, "title", locale)}"? It will be removed from the database and cannot be restored.`
                    }
                    deletedAt={page.deleted_at}
                    editHref={`/admin/cms/pages/${page.id}/edit`}
                    labels={{...statusActionLabels, edit: canWrite ? statusActionLabels.edit : (locale === "zh" ? "檢視" : "View")}}
                    previewHref={`/admin/preview/content/${page.id}`}
                    status={page.status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </TableFrame>
  );
}
