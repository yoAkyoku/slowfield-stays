import { Badge, Card, ListRow, ListRows, Stack } from "../../ui";

export type PermGroup = { label: string; permissions: { key: string; label: string; desc: string }[] };

/** Read-only permission list shown in the account and user permission dialogs. */
export default function PermissionGroups({ groups }: { groups: PermGroup[] }) {
  return (
    <Stack>
      {groups.map((g) => (
        <Card flush key={g.label} title={g.label}>
          <ListRows>
            {g.permissions.map((p) => {
              const read = p.key.endsWith(":read");
              return (
                <ListRow
                  aside={<Badge tone={read ? "info" : "warning"}>{read ? "R" : "W"}</Badge>}
                  key={p.key}
                  meta={p.desc || undefined}
                  title={p.label}
                />
              );
            })}
          </ListRows>
        </Card>
      ))}
    </Stack>
  );
}
