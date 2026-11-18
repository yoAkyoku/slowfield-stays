import AdminEmptyState from "./AdminEmptyState";
import { TableFrame } from "../ui";

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

export default function AdminTable<T extends Record<string, unknown>>({
  columns,
  emptyAction,
  emptyText = "No records match the current view.",
  emptyTitle = "No records yet",
  maxRows,
  moreHref,
  moreLabel = "View all",
  rowKey,
  rows
}: {
  columns: Column<T>[];
  emptyAction?: React.ReactNode;
  emptyText?: string;
  emptyTitle?: string;
  maxRows?: number;
  moreHref?: string;
  moreLabel?: string;
  /** What makes a row itself, for lists where the id does not.
   *
   *  Every other list here is one table's rows, and an id is unique in its own
   *  table. 表單聯絡 merges two — `inquiries` and `booking_requests`, each with
   *  its own sequence starting at 1 — so React was handed the key "3" twice on
   *  one page. Its documented answer to a repeated key is that children "may be
   *  duplicated and/or omitted", and measured in a production build that is what
   *  it did: the next time the list re-rendered in place — which every action on
   *  that page causes, since they all redirect back to it — a five-row list came
   *  back as eight, holding a ghost of the row just deleted (still 新建, still
   *  offering 已聯繫) and two other rows drawn twice.
   *
   *  That is what a control that does nothing looks like from the desk. 已聯繫
   *  pressed on the ghost filed a record that had already left the list, and the
   *  row on screen did not change; the buttons that kept working are 刪除 and
   *  永久刪除, whose action is a ConfirmSubmitButton prop React refreshes on every
   *  render rather than markup left over from an earlier one. */
  rowKey?: (row: T, index: number) => string;
  rows: T[];
}) {
  if (rows.length === 0) {
    return <AdminEmptyState action={emptyAction} text={emptyText} title={emptyTitle} />;
  }
  const visibleRows = maxRows ? rows.slice(0, maxRows) : rows;
  const hiddenCount = Math.max(rows.length - visibleRows.length, 0);

  /* Built on the kit's TableFrame and .a-table, so a page that lists with this
     looks like every other admin list. It used to draw its own legacy
     .admin-table frame, which only these three pages still had. */
  return (
    <TableFrame
      footer={hiddenCount > 0 ? (
        <>
          <span>{hiddenCount} more records</span>
          {moreHref ? <a href={moreHref}>{moreLabel}</a> : null}
        </>
      ) : undefined}
    >
      <table className="a-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => (
            <tr key={rowKey ? rowKey(row, index) : String(row.id ?? index)}>
              {columns.map((column) => (
                <td key={String(column.key)} data-label={column.label}>
                  {column.render ? column.render(row) : String(row[column.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
