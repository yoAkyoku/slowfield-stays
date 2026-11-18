import type { ComponentProps } from "react";
import Image from "next/image";
import Link from "next/link";
import StatusActions, { rowStatusActions, type RowStatusActions } from "../../modules/StatusActions";
import AdminEmptyState from "../../modules/AdminEmptyState";
import { Badge, CellTitle, TableFrame } from "../../ui";
import type { CmsBannerRow, CmsIssueKey } from "./cmsConsoleData";
import CmsStatusIssueBadges from "./CmsStatusIssueBadges";
import type { Locale } from "../../../modules/i18n";
import { trs } from "../../../modules/tr";
import { isVideoUrl, videoPosterUrl } from "../../../modules/media";
import VideoThumbnail from "../../modules/VideoThumbnail";

export default function CmsBannersTable({
  actions,
  canWrite = true,
  locale,
  banners,
  ctaLabel,
  emptyText,
  emptyTitle,
  issueLabels,
  labels,
  showCheckbox,
  statusActionLabels,
  statusLabels
}: {
  actions: RowStatusActions;
  /** Passed straight to StatusActions — see the note there. */
  canWrite?: boolean;
  /** The admin's chosen language, so the row reads in it. */
  locale: Locale;
  banners: CmsBannerRow[];
  ctaLabel: (href: string) => string;
  emptyText: string;
  emptyTitle: string;
  /* Every issue key, not just the banner ones: the labels object is shared with
     the page tables, and CmsStatusIssueBadges indexes it by CmsIssueKey. */
  issueLabels: Record<CmsIssueKey, string>;
  labels: {
    actions: string;
    deletedLabel: string;
    issues: string;
    order: string;
    status: string;
    thumbnail: string;
    title: string;
  };
  showCheckbox?: boolean;
  statusActionLabels: ComponentProps<typeof StatusActions>["labels"];
  statusLabels: Record<string, string>;
}) {
  if (!banners.length) {
    return <AdminEmptyState text={emptyText} title={emptyTitle} />;
  }

  return (
    <TableFrame>
        <table className="a-table cms-table">
          <thead>
            <tr>
              {showCheckbox && <th className="is-shrink" />}
              <th>{labels.thumbnail}</th>
              <th>{labels.title}</th>
              <th>CTA</th>
              <th className="is-num">{labels.order}</th>
              <th>{labels.status}</th>
              <th>{labels.issues}</th>
              <th>{labels.actions}</th>
            </tr>
          </thead>
          <tbody>
            {banners.map((banner) => {
              const video = isVideoUrl(banner.image_url);
              const poster = video ? videoPosterUrl(banner.image_url) : "";
              return (
              <tr key={banner.id}>
                {showCheckbox && <td className="is-shrink"><input type="checkbox" name="ids" value={banner.id} /></td>}
                <td>
                  {banner.image_url ? (
                    <div className="cms-thumb">
                      {video ? (
                        <VideoThumbnail
                          src={banner.image_url}
                          poster={poster || undefined}
                          label={trs(banner, "title", locale)}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <Image alt={trs(banner, "title", locale)} fill sizes="112px" src={banner.image_url} unoptimized />
                      )}
                    </div>
                  ) : (
                    <div className="cms-thumb">
                      <span>Missing</span>
                    </div>
                  )}
                </td>
                <td>
                  <CellTitle
                    sub={banner.subtitle || undefined}
                    title={<Link href={`/admin/cms/banners/${banner.id}/edit`}>{trs(banner, "title", locale)}</Link>}
                  />
                </td>
                <td>
                  <Badge tone="brand">{ctaLabel(banner.cta_href)}</Badge>
                </td>
                <td className="is-num">{banner.sort_order}</td>
                <td>
                  <CmsStatusIssueBadges
                    deletedAt={banner.deleted_at}
                    deletedLabel={labels.deletedLabel}
                    issueLabels={issueLabels}
                    issues={[]}
                    status={banner.status}
                    statusLabels={statusLabels}
                  />
                </td>
                <td>
                  <CmsStatusIssueBadges
                    deletedAt={null}
                    deletedLabel={labels.deletedLabel}
                    issueLabels={issueLabels}
                    issues={banner.computedIssues}
                    showStatus={false}
                    status={banner.status}
                    statusLabels={{}}
                  />
                </td>
                <td>
                  <StatusActions
                    canWrite={canWrite}
                    actions={rowStatusActions(actions, banner.id)}
                    /* Named per row — see the note in StatusActions. A banner is
                       identified by its headline; two banners on one site look
                       alike in a list otherwise. */
                    confirmDeleteBody={
                      locale === "zh"
                        ? `確定要刪除橫幅「${trs(banner, "title", locale)}」嗎？它會移到「已刪除」，可在該處還原。`
                        : `Delete the banner "${trs(banner, "title", locale)}"? It moves to the deleted list, where it can be restored.`
                    }
                    confirmPurgeBody={
                      locale === "zh"
                        ? `確定要永久刪除橫幅「${trs(banner, "title", locale)}」嗎？它會從資料庫中移除，且無法還原。`
                        : `Permanently delete the banner "${trs(banner, "title", locale)}"? It will be removed from the database and cannot be restored.`
                    }
                    deletedAt={banner.deleted_at}
                    editHref={`/admin/cms/banners/${banner.id}/edit`}
                    labels={statusActionLabels}
                    previewHref={`/admin/preview/banners/${banner.id}`}
                    status={banner.status}
                  />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
    </TableFrame>
  );
}
