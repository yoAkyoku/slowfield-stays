import DeletedBadge from "../../modules/DeletedBadge";
import StatusBadge from "../../modules/StatusBadge";
import { Badge, Chips } from "../../ui";
import type { CmsIssueKey } from "./cmsConsoleData";

export default function CmsStatusIssueBadges({
  deletedAt,
  deletedLabel,
  issueLabels,
  issues,
  showStatus = true,
  status,
  statusLabels
}: {
  deletedAt?: string | null;
  deletedLabel: string;
  issueLabels: Record<CmsIssueKey, string>;
  issues: CmsIssueKey[];
  showStatus?: boolean;
  status: string;
  statusLabels: Record<string, string>;
}) {
  return (
    <Chips>
      {showStatus ? <StatusBadge labels={statusLabels} status={status} /> : null}
      {deletedAt ? <DeletedBadge label={deletedLabel} /> : null}
      {issues.map((issue) => (
        <Badge key={issue} tone="warning">
          {issueLabels[issue]}
        </Badge>
      ))}
    </Chips>
  );
}
