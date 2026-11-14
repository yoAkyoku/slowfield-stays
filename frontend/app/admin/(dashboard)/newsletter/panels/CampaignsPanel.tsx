"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Badge, Button, Card, Input, RowActions, SearchInput, Select, Stack, TableFrame, Toolbar, buttonClass } from "../../../ui";
import AdminEmptyState from "../../../modules/AdminEmptyState";
import { nlStatusTone } from "../nlStatusTone";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { NewsletterCampaign } from "../../../modules/adminApi";
import AdminPagination, { paginate, usePagination } from "../../../modules/AdminPagination";
import ConfirmSubmitButton from "../../../modules/ConfirmSubmitButton";
import SubmitButton from "../../../modules/SubmitButton";
import { formatDateTime, siteDateKey } from "../../../../modules/datetime";
import { newsletterProgress, newsletterStatusLabel } from "../../../modules/newsletterProgress";

const LIST_RETURN = "/admin/newsletter?tab=campaigns";
const BIN_RETURN = "/admin/newsletter?tab=campaigns&visibility=deleted";

type Copy = Record<string, unknown> & {
  allSubscribers: string;
  noCampaigns: string;
};

export default function CampaignsPanel({
  campaigns,
  binHref,
  canWrite,
  listHref,
  copy,
  deleteCampaignAction,
  inBin,
  purgeCampaignAction,
  restoreCampaignAction,
  statusLabels,
  zh
}: {
  campaigns: NewsletterCampaign[];
  /** Where the 已刪除 option points. */
  binHref: string;
  /** …and the 啟用中 option. */
  listHref: string;
  canWrite: boolean;
  copy: Copy;
  deleteCampaignAction: (id: number, returnTo: string) => Promise<void>;
  /** True while 已刪除 is the open view. */
  inBin: boolean;
  purgeCampaignAction: (id: number, returnTo: string) => Promise<void>;
  restoreCampaignAction: (id: number, returnTo: string) => Promise<void>;
  statusLabels: Record<string, string>;
  zh: boolean;
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [dateField, setDateField] = useState<"created" | "sent">("created");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { page, pageSize, setPage, resetPage } = usePagination(20);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      /* Keyword filter — title + body */
      if (keyword) {
        const q = keyword.toLowerCase();
        const matchSubject = c.subject.toLowerCase().includes(q);
        const matchBody = c.body?.toLowerCase().includes(q);
        if (!matchSubject && !matchBody) return false;
      }
      /* Date range filter */
      if (dateFrom || dateTo) {
        const raw = dateField === "sent" ? (c.sent_at ?? c.scheduled_at) : c.created_at;
        if (!raw) return false;
        const d = siteDateKey(raw); // Same Taiwan date shown in the list.
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });
  }, [campaigns, keyword, dateField, dateFrom, dateTo]);

  useEffect(() => { resetPage(); }, [keyword, dateField, dateFrom, dateTo, resetPage]);

  const paginatedRows = paginate(filtered, page, pageSize);

  const clearFilters = useCallback(() => {
    setKeyword("");
    setDateFrom("");
    setDateTo("");
  }, []);

  const hasFilters = keyword || dateFrom || dateTo;

  function fmtDate(raw?: string) {
    if (!raw) return "—";
    return formatDateTime(raw, zh ? "zh" : "en");
  }

  function groupLabel(c: NewsletterCampaign) {
    return c.target_groups.length > 0
      ? c.target_groups.join(" · ")
      : (copy.allSubscribers as string) ?? "All";
  }

  return (
    <Stack>
      {/* Filter bar */}
      <Toolbar end={<span className="nlx-count">{filtered.length} / {campaigns.length} {zh ? "封電子報" : "campaigns"}</span>}>
        <SearchInput
          icon={<Search />}
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onClear={() => setKeyword("")}
          clearLabel={zh ? "清除搜尋" : "Clear search"}
          placeholder={zh ? "搜尋標題或內文…" : "Search subject or body…"}
        />
        {/* 啟用中 / 已刪除 is a filter over the same list, so it belongs with
            the other filters rather than as a button off to one side. */}
        <Select
          value={inBin ? "deleted" : "active"}
          onChange={(e) => router.push(e.target.value === "deleted" ? binHref : listHref)}
          aria-label={zh ? "狀態" : "Status"}
        >
          <option value="active">{zh ? "啟用中" : "Active"}</option>
          <option value="deleted">{zh ? "已刪除" : "Deleted"}</option>
        </Select>
        <Select
          value={dateField}
          onChange={(e) => setDateField(e.target.value as "created" | "sent")}
        >
          <option value="created">{zh ? "依建立時間" : "By created date"}</option>
          <option value="sent">{zh ? "依發送時間" : "By sent date"}</option>
        </Select>
        <Input
          aria-label={zh ? "起始" : "From"}
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <span className="a-muted">—</span>
        <Input
          aria-label={zh ? "結束" : "To"}
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
        {hasFilters && (
          <Button icon={<X />} onClick={clearFilters} variant="ghost">
            {zh ? "清除篩選" : "Clear filters"}
          </Button>
        )}
      </Toolbar>

      {/* Table */}
      <Card flush>
        <TableFrame>
            <table className="a-table">
              <thead>
                <tr>
                  <th>{zh ? "主旨" : "Subject"}</th>
                  <th>{zh ? "狀態" : "Status"}</th>
                  <th>{zh ? "分群" : "Group"}</th>
                  <th>{zh ? "已寄／收件數" : "Sent / recipients"}</th>
                  <th>{zh ? "建立時間" : "Created"}</th>
                  <th>{zh ? "發送時間" : "Sent"}</th>
                  {canWrite && <th>{zh ? "操作" : "Actions"}</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length > 0 ? (
                  paginatedRows.map((c) => (
                    <tr key={c.id} className={c.deleted_at ? "is-muted" : undefined}>
                      <td>
                        <Link className="nlx-table-link" href={`/admin/newsletter/${c.id}`}>
                          {c.subject}
                        </Link>
                      </td>
                      <td>
                        <Badge dot tone={nlStatusTone(c.status)}>
                          {newsletterStatusLabel(c, zh, statusLabels[c.status] ?? c.status)}
                        </Badge>
                      </td>
                      <td>{groupLabel(c)}</td>
                      <td><span>{newsletterProgress(c, zh).primary}</span>{newsletterProgress(c, zh).detail && <small className="a-muted">{newsletterProgress(c, zh).detail}</small>}</td>
                      <td className="is-shrink">{fmtDate(c.created_at)}</td>
                      <td className="is-shrink">{fmtDate(c.sent_at)}</td>
                      {canWrite && (
                        <td>
                          <RowActions align="start">
                            {c.deleted_at ? (
                              <>
                                <form action={restoreCampaignAction.bind(null, c.id, BIN_RETURN)}>
                                  <SubmitButton className={buttonClass({ size: "sm" })}>
                                    {zh ? "還原" : "Restore"}
                                  </SubmitButton>
                                </form>
                                {/* The second delete. The send log survives it —
                                    the API clears the link rather than dropping
                                    the delivery rows, which also feed the cap. */}
                                <ConfirmSubmitButton
                                  action={purgeCampaignAction.bind(null, c.id, BIN_RETURN)}
                                  body={
                                    zh
                                      ? `確定要永久刪除「${c.subject}」嗎？它會從資料庫中移除，且無法還原（寄送紀錄會保留）。`
                                      : `Permanently delete "${c.subject}"? It is removed from the database and cannot be restored (past sends stay in the log).`
                                  }
                                  cancelLabel={zh ? "取消" : "Cancel"}
                                  className={buttonClass({ size: "sm", variant: "danger" })}
                                  confirmLabel={zh ? "永久刪除" : "Delete permanently"}
                                  title={zh ? "永久刪除" : "Delete permanently"}
                                >
                                  {zh ? "永久刪除" : "Delete permanently"}
                                </ConfirmSubmitButton>
                              </>
                            ) : (
                              /* The first delete, which asks too. It is
                                 recoverable, but it is also a bare 刪除 at the end
                                 of a row of identical buttons in a paginated
                                 table — the click that lands on the wrong row is
                                 the only failure a dialog here can catch, and
                                 naming the subject is what lets it. */
                              <ConfirmSubmitButton
                                action={deleteCampaignAction.bind(null, c.id, LIST_RETURN)}
                                body={
                                  zh
                                    ? `確定要刪除「${c.subject}」嗎？電子報會移到「已刪除」，可在該處還原。`
                                    : `Delete "${c.subject}"? The campaign moves to the deleted list, where it can be restored.`
                                }
                                cancelLabel={zh ? "取消" : "Cancel"}
                                className={buttonClass({ size: "sm", variant: "danger-ghost" })}
                                confirmLabel={zh ? "刪除" : "Delete"}
                                title={zh ? "確認刪除電子報" : "Confirm campaign deletion"}
                              >
                                {zh ? "刪除" : "Delete"}
                              </ConfirmSubmitButton>
                            )}
                          </RowActions>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canWrite ? 7 : 6}>
                      <AdminEmptyState
                        variant="compact"
                        title={
                          hasFilters
                            ? (zh ? "沒有符合篩選條件的電子報" : "No campaigns match your filters")
                            : inBin
                              ? (zh ? "已刪除中沒有電子報" : "Nothing in the deleted list")
                              : copy.noCampaigns
                        }
                        text=""
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </TableFrame>
        <AdminPagination
          currentPage={page}
          onPageChange={setPage}
          pageSize={pageSize}
          totalRows={filtered.length}
        />
      </Card>
    </Stack>
  );
}
