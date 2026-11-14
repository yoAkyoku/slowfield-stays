"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";

export type PaginationState = { page: number; pageSize: number };

export function usePagination(initialPageSize = 20) {
  const [state, setState] = useState<PaginationState>({ page: 1, pageSize: initialPageSize });

  const setPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page: Math.max(1, page) }));
  }, []);

  const resetPage = useCallback(() => {
    setState((prev) => ({ ...prev, page: 1 }));
  }, []);

  return { ...state, setPage, resetPage };
}

export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export default function AdminPagination({
  currentPage,
  onPageChange,
  pageSize,
  totalRows,
  labels
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalRows: number;
  labels?: { of?: string; page?: string; prev?: string; next?: string };
}) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  if (totalRows <= pageSize) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRows);
  const ofLabel = labels?.of ?? "of";

  return (
    <div className="admin-pagination">
      <span className="admin-pagination-info">
        {start}–{end} {ofLabel} {totalRows}
      </span>
      <div className="admin-pagination-controls">
        <button
          className="admin-pagination-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
          aria-label={labels?.prev ?? "Previous"}
        >
          <ChevronLeft size={16} />
        </button>
        {totalPages <= 7 ? (
          Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`admin-pagination-btn ${p === currentPage ? "is-active" : ""}`}
              onClick={() => onPageChange(p)}
              type="button"
            >
              {p}
            </button>
          ))
        ) : (
          <CompactPages current={currentPage} total={totalPages} onPageChange={onPageChange} />
        )}
        <button
          className="admin-pagination-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
          aria-label={labels?.next ?? "Next"}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* Compact page numbers: 1 ... 4 5 6 ... 20 */
function CompactPages({
  current,
  total,
  onPageChange
}: {
  current: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const pages: (number | "dots")[] = [];
  pages.push(1);

  if (current > 3) pages.push("dots");

  const rangeStart = Math.max(2, current - 1);
  const rangeEnd = Math.min(total - 1, current + 1);
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);

  if (current < total - 2) pages.push("dots");

  if (total > 1) pages.push(total);

  return (
    <>
      {pages.map((p, i) =>
        p === "dots" ? (
          <span className="admin-pagination-dots" key={`dots-${i}`}>…</span>
        ) : (
          <button
            key={p}
            className={`admin-pagination-btn ${p === current ? "is-active" : ""}`}
            onClick={() => onPageChange(p)}
            type="button"
          >
            {p}
          </button>
        )
      )}
    </>
  );
}
