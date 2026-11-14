export default function AdminEmptyState({
  action,
  text = "No records match the current view.",
  title = "No records yet",
  variant = "panel"
}: {
  action?: React.ReactNode;
  text?: string;
  title?: string;
  variant?: "compact" | "panel";
}) {
  return (
    <div className={`admin-empty-state admin-empty-state-${variant}`}>
      <span className="admin-empty-state-mark" aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
        {action ? <div className="admin-empty-state-action">{action}</div> : null}
      </div>
    </div>
  );
}
