import AdminEmptyState from "../../modules/AdminEmptyState";
import { Card, Grid, ListRow, ListRows, Stack, StatCard } from "../../ui";
import CmsStatusIssueBadges from "./CmsStatusIssueBadges";
import type { CmsPageIssueKey } from "./cmsConsoleData";

type OverviewPage = {
  id: number;
  title: string;
  content_type?: string;
  status: string;
  deleted_at?: string | null;
  computedIssues?: CmsPageIssueKey[];
};

export default function CmsOverviewPanel({
  copy,
  latestPages,
  stats,
  statusLabels,
  pageTypeLabel = (value) => value ?? "page"
}: {
  copy: {
    deletedLabel: string;
    issueLabels: {
      missing_body: string;
      missing_cover: string;
      missing_description: string;
      missing_title: string;
    };
    latestEmpty: string;
    latestKicker: string;
    latestTitle: string;
    overviewTitle: string;
    workflowHeading: string;
  };
  latestPages: OverviewPage[];
  stats: Array<{ label: string; note: string; value: number }>;
  statusLabels: Record<string, string>;
  pageTypeLabel?: (value?: string) => string;
}) {
  return (
    <Stack gap="lg">
      <Grid cols={4}>
        {stats.map((stat) => (
          <StatCard hint={stat.note} key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </Grid>

      <Card flush title={copy.latestKicker}>
        {latestPages.length ? (
          <ListRows>
            {latestPages.map((page) => (
              <ListRow
                aside={
                  <CmsStatusIssueBadges
                    deletedAt={page.deleted_at}
                    deletedLabel={copy.deletedLabel}
                    issueLabels={{ ...copy.issueLabels, missing_image: "" }}
                    issues={page.computedIssues ?? []}
                    status={page.status}
                    statusLabels={statusLabels}
                  />
                }
                href={`/admin/cms/pages/${page.id}/edit`}
                key={page.id}
                meta={pageTypeLabel(page.content_type)}
                title={page.title}
              />
            ))}
          </ListRows>
        ) : (
          <AdminEmptyState text={copy.latestEmpty} title={copy.latestTitle} variant="compact" />
        )}
      </Card>
    </Stack>
  );
}
