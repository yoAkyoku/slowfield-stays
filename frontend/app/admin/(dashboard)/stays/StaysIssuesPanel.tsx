import { CircleAlert, CircleCheck } from "lucide-react";
import AdminEmptyState from "../../modules/AdminEmptyState";
import StatusBadge from "../../modules/StatusBadge";
import { Badge, ButtonLink, Card, Grid, ListRow, ListRows, StatCard, Stack } from "../../ui";
import type { StayIssueRow } from "./staysConsoleData";

export default function StaysIssuesPanel({
  alertText,
  alertTitle,
  deletedBadgeLabel,
  emptyText,
  emptyTitle,
  fixLabel,
  issueLabels,
  rows,
  stats,
  statusLabels
}: {
  alertText: string;
  alertTitle: string;
  deletedBadgeLabel: string;
  emptyText: string;
  emptyTitle: string;
  fixLabel: string;
  issueLabels: Record<string, string>;
  rows: StayIssueRow[];
  stats: { key: string; label: string; value: number }[];
  statusLabels: Record<string, string>;
}) {
  return (
    <Stack>
      <Grid cols={4}>
        {stats.map((stat) => (
          <StatCard
            icon={stat.value > 0 ? <CircleAlert /> : <CircleCheck />}
            key={stat.key}
            label={stat.label}
            tone={stat.value > 0 ? "warning" : "success"}
            value={stat.value}
          />
        ))}
      </Grid>
      {rows.length ? (
        <Card description={alertText} flush title={alertTitle}>
          <ListRows>
            {rows.map((row) => (
              <ListRow
                aside={
                  <ButtonLink href={row.href} size="sm">
                    {fixLabel}
                  </ButtonLink>
                }
                key={row.id}
                meta={
                  <>
                    <span>{row.region || row.destination}</span>
                    <StatusBadge labels={statusLabels} status={row.status} />
                    {row.deleted_at ? <Badge tone="danger">{deletedBadgeLabel}</Badge> : null}
                    {row.issues.map((issue) => (
                      <Badge key={`${row.id}-${issue}`} tone="warning">
                        {issueLabels[issue] ?? issue}
                      </Badge>
                    ))}
                  </>
                }
                title={row.name}
              />
            ))}
          </ListRows>
        </Card>
      ) : (
        <AdminEmptyState text={emptyText} title={emptyTitle} />
      )}
    </Stack>
  );
}
