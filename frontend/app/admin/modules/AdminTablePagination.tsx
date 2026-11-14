"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminPagination from "./AdminPagination";

/**
 * URL-based pagination for server-rendered AdminTable.
 * Reads `?page=N` from searchParams and pushes a new URL on page change.
 */
export default function AdminTablePagination({
  labels,
  pageSize = 20,
  totalRows
}: {
  labels?: { of?: string; prev?: string; next?: string };
  pageSize?: number;
  totalRows: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);

  function onPageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <AdminPagination
      currentPage={currentPage}
      labels={labels}
      onPageChange={onPageChange}
      pageSize={pageSize}
      totalRows={totalRows}
    />
  );
}
