import { Badge, Card, Grid, ListRow, ListRows, StatCard, Stack } from "../../ui";
import StatusBadge from "../../modules/StatusBadge";
import type { AdminStayRecord } from "./staysConsoleData";

export default function StaysOverviewPanel({
  deletedBadgeLabel,
  emptyLabel,
  items,
  kicker,
  stats,
  statusLabels
}: {
  deletedBadgeLabel: string;
  emptyLabel: string;
  items: (AdminStayRecord & { issueCount: number })[];
  kicker: string;
  stats: { label: string; note: string; value: number }[];
  statusLabels: Record<string, string>;
}) {
  return (
    <Stack>
      <Grid cols={4}>
        {stats.map((stat) => (
          <StatCard hint={stat.note} key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </Grid>
      <Card description={items.length ? undefined : emptyLabel} flush title={kicker}>
        {items.length ? (
          <ListRows>
            {items.map((stay) => (
              <ListRow
                aside={
                  <>
                    <StatusBadge labels={statusLabels} status={stay.status} />
                    {stay.deleted_at ? <Badge tone="danger">{deletedBadgeLabel}</Badge> : null}
                    {stay.issueCount ? <Badge tone="warning">{stay.issueCount}</Badge> : null}
                  </>
                }
                href={`/admin/stays/${stay.id}/edit`}
                key={stay.id}
                meta={stay.region || stay.destination}
                title={stay.name}
              />
            ))}
          </ListRows>
        ) : null}
      </Card>
    </Stack>
  );
}
