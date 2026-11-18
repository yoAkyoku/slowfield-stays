import { Badge } from "../ui";
import { statusTone } from "./statusTone";

/** A record's status as a kit Badge, coloured by statusTone. */
export default function StatusBadge({ labels, status }: { labels?: Record<string, string>; status: string }) {
  return <Badge tone={statusTone(status)}>{labels?.[status] ?? status}</Badge>;
}
