/** Slice an array for the current page — use in server pages before passing to AdminTable */
export function getPageSlice<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
