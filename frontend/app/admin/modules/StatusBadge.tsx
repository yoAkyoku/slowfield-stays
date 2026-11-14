const toneByStatus: Record<string, string> = {
  archived: "neutral",
  closed: "neutral",
  contacted: "info",
  deleted: "neutral",
  draft: "neutral",
  new: "warning",
  published: "success",
  quoted: "success",
  review: "warning"
};

export default function StatusBadge({ labels, status }: { labels?: Record<string, string>; status: string }) {
  const tone = toneByStatus[status] ?? "neutral";
  return <span className={`admin-status admin-status-${tone}`}>{labels?.[status] ?? status}</span>;
}
