import { Badge } from "../ui";

/** Marks an entry that is in the bin. */
export default function DeletedBadge({ label }: { label: string }) {
  return <Badge tone="neutral" className="is-deleted-badge">{label}</Badge>;
}
