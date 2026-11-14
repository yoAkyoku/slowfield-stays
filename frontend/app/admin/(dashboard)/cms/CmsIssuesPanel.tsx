import Link from "next/link";
import AdminEmptyState from "../../modules/AdminEmptyState";
import { ButtonLink, Callout, Grid, Stack, StatCard, CellTitle, TableFrame } from "../../ui";
import CmsStatusIssueBadges from "./CmsStatusIssueBadges";
import type { CmsIssueKey, CmsIssueRow } from "./cmsConsoleData";

export default function CmsIssuesPanel({
  categoryLabel,
  issueLabels,
  issueRows,
  issueStats,
  labels,
  statusLabels
}: {
  categoryLabel: (contentType?: string) => string;
  issueLabels: Record<CmsIssueKey, string>;
  issueRows: CmsIssueRow[];
  issueStats: Array<{ key: string; label: string; value: number }>;
  labels: {
    bannerType: string;
    deletedLabel: string;
    emptyText: string;
    emptyTitle: string;
    fixAction: string;
    issueText: string;
    issueTitle: string;
    issues: string;
    status: string;
    title: string;
    type: string;
  };
  statusLabels: Record<string, string>;
}) {
  return (
    <Stack gap="lg">
      <Callout title={labels.issueTitle} tone="warning">
        {labels.issueText}
      </Callout>

      <Grid cols={4}>
        {issueStats.map((stat) => (
          <StatCard key={stat.key} label={stat.label} tone={stat.value ? "warning" : "neutral"} value={stat.value} />
        ))}
      </Grid>

      {issueRows.length ? (
        <TableFrame>
            <table className="a-table cms-table">
              <thead>
                <tr>
                  <th>{labels.title}</th>
                  <th>{labels.type}</th>
                  <th>{labels.status}</th>
                  <th>{labels.issues}</th>
                  <th>{labels.fixAction}</th>
                </tr>
              </thead>
              <tbody>
                {issueRows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`}>
                    <td>
                      <CellTitle
                        sub={row.kind === "page" ? row.href.replace("/admin/cms/pages/", "Page #").replace("/edit", "") : row.href.replace("/admin/cms/banners/", "Banner #").replace("/edit", "")}
                        title={<Link href={row.href}>{row.title}</Link>}
                      />
                    </td>
                    <td>{row.kind === "page" ? categoryLabel(row.content_type) : labels.bannerType}</td>
                    <td>
                      <CmsStatusIssueBadges
                        deletedAt={row.deleted_at}
                        deletedLabel={labels.deletedLabel}
                        issueLabels={issueLabels}
                        issues={[]}
                        status={row.status}
                        statusLabels={statusLabels}
                      />
                    </td>
                    <td>
                      <CmsStatusIssueBadges
                        deletedAt={null}
                        deletedLabel={labels.deletedLabel}
                        issueLabels={issueLabels}
                        issues={row.issues}
                        showStatus={false}
                        status={row.status}
                        statusLabels={{}}
                      />
                    </td>
                    <td>
                      <ButtonLink href={row.href} size="sm" variant="primary">
                        {labels.fixAction}
                      </ButtonLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </TableFrame>
      ) : (
        <AdminEmptyState text={labels.emptyText} title={labels.emptyTitle} />
      )}
    </Stack>
  );
}
