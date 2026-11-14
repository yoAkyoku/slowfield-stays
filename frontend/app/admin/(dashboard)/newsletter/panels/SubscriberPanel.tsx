"use client";

import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, X } from "lucide-react";
import { Badge, Button, Callout, Card, Chips, Dialog, DialogActions, Field, FormActions, FormGrid, Input, RowActions, SearchInput, Select, Stack, TableFrame, Toolbar, buttonClass } from "../../../ui";
import AdminEmptyState from "../../../modules/AdminEmptyState";
import { nlStatusTone } from "../nlStatusTone";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { NewsletterSubscriber } from "../../../modules/adminApi";
import AdminPagination, { paginate, usePagination } from "../../../modules/AdminPagination";
import ConfirmSubmitButton from "../../../modules/ConfirmSubmitButton";
import SubmitButton from "../../../modules/SubmitButton";
import type { AdminResult } from "../../../modules/adminRequest";
import { flashMessage } from "../../../modules/flashMessage";

type Copy = Record<string, unknown> & {
  subscribers: string;
  addSubscriber: string;
  saveSubscriber: string;
  email: string;
  name: string;
  status: string;
  groups: string;
  groupsPlaceholder: string;
  actions: string;
};

/** The list rendered the raw enum — an English SUBSCRIBED sitting in a
 *  Chinese table — while the edit dialog two hundred lines below already had
 *  the translated wording. One map now, so they cannot disagree again. */
function subscriberStatusLabel(status: string, zh: boolean) {
  if (status === "subscribed") return zh ? "已訂閱" : "Subscribed";
  if (status === "unsubscribed") return zh ? "已退訂" : "Unsubscribed";
  return status;
}
export default function SubscriberPanel({
  copy,
  canWrite,
  inBin,
  createSubscriberAction,
  deleteSubscriberAction,
  purgeSubscriberAction,
  restoreSubscriberAction,
  subscribers,
  updateSubscriberAction,
  zh
}: {
  copy: Copy;
  canWrite: boolean;
  inBin: boolean;
  createSubscriberAction: (fd: FormData) => Promise<AdminResult>;
  deleteSubscriberAction: (id: number, returnTo: string) => Promise<void>;
  purgeSubscriberAction: (id: number, returnTo: string) => Promise<void>;
  restoreSubscriberAction: (id: number, returnTo: string) => Promise<void>;
  subscribers: NewsletterSubscriber[];
  updateSubscriberAction: (id: number, fd: FormData) => Promise<AdminResult>;
  zh: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addError, setAddError] = useState("");
  const [editError, setEditError] = useState("");
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();
  const { page, pageSize, setPage, resetPage } = usePagination(15);

  /* Edit modal state */
  const [editSub, setEditSub] = useState<NewsletterSubscriber | null>(null);

  const openEdit = useCallback((s: NewsletterSubscriber) => {
    setEditError("");
    setNotice("");
    setEditSub(s);
  }, []);

  const closeEdit = useCallback(() => {
    setEditSub(null);
  }, []);

  const handleEdit = useCallback(
    (fd: FormData) => {
      if (!editSub) return;
      setEditError("");
      startTransition(async () => {
        const result = await updateSubscriberAction(editSub.id, fd);
        if (!result.ok) { setEditError(flashMessage(result.message, zh)); return; }
        closeEdit();
        setNotice(zh ? "訂閱者已更新。" : "Subscriber updated.");
        router.refresh();
      });
    },
    [editSub, updateSubscriberAction, closeEdit, router, zh]
  );

  /* Collect all unique groups */
  const allGroups = useMemo(() => {
    const set = new Set<string>();
    subscribers.forEach((s) => s.groups.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [subscribers]);

  const filtered = useMemo(() => {
    return subscribers.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch = !q || s.email.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      const matchGroup = !groupFilter || s.groups.includes(groupFilter);
      return matchSearch && matchGroup;
    });
  }, [subscribers, search, groupFilter]);

  /* Reset page on filter change */
  useEffect(() => {
    resetPage();
  }, [search, groupFilter, resetPage]);

  const paginatedSubs = paginate(filtered, page, pageSize);

  const handleAdd = useCallback(
    (fd: FormData) => {
      setAddError("");
      setNotice("");
      startTransition(async () => {
        const result = await createSubscriberAction(fd);
        if (!result.ok) { setAddError(flashMessage(result.message, zh)); return; }
        setShowAddForm(false);
        setNotice(zh ? "訂閱者已新增。" : "Subscriber added.");
        router.refresh();
      });
    },
    [createSubscriberAction, router, zh]
  );

  return (
    <Stack>
      {/* Toolbar */}
      <Toolbar
        end={canWrite && !inBin ? (
          <Button icon={<Plus />} onClick={() => { setShowAddForm((p) => !p); setAddError(""); setNotice(""); }} variant="primary">
            {copy.addSubscriber}
          </Button>
        ) : null}
      >
        <SearchInput
          icon={<Search />}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          clearLabel={zh ? "清除搜尋" : "Clear search"}
          placeholder={zh ? "搜尋 email 或姓名…" : "Search email or name…"}
        />
        <Select
          aria-label={zh ? "顯示範圍" : "Visibility"}
          value={inBin ? "deleted" : "active"}
          onChange={(e) => router.push(e.target.value === "deleted" ? "/admin/newsletter?tab=subscribers&visibility=deleted" : "/admin/newsletter?tab=subscribers")}
        >
          <option value="active">{zh ? "使用中" : "Active"}</option>
          <option value="deleted">{zh ? "已刪除" : "Deleted"}</option>
        </Select>
        <Select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="">{zh ? "全部分群" : "All Groups"}</option>
          {allGroups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </Toolbar>
      {notice && <Callout tone="success"><span role="status">{notice}</span></Callout>}

      {/* Inline add form */}
      {canWrite && !inBin && showAddForm && (
        <form onSubmit={(event) => { event.preventDefault(); handleAdd(new FormData(event.currentTarget)); }}>
          <Card
            title={copy.addSubscriber}
            actions={
              <Button icon={<X />} iconOnly onClick={() => setShowAddForm(false)} size="sm" variant="ghost">
                {zh ? "關閉新增訂閱者" : "Close add subscriber"}
              </Button>
            }
          >
            <Stack>
              <FormGrid cols={3}>
                <Field label={copy.email} required>
                  <Input name="email" type="email" required placeholder="user@example.com" />
                </Field>
                <Field label={copy.name}>
                  <Input name="name" placeholder={zh ? "姓名（選填）" : "Name (optional)"} />
                </Field>
                <Field label={copy.groups}>
                  <Input name="groups" placeholder={copy.groupsPlaceholder} />
                </Field>
              </FormGrid>
              {addError && <Callout tone="danger">{addError}</Callout>}
              <FormActions>
                <Button disabled={isPending} icon={isPending ? <span className="admin-spinner" /> : <Plus />} type="submit" variant="primary">
                  {copy.saveSubscriber}
                </Button>
              </FormActions>
            </Stack>
          </Card>
        </form>
      )}

      {/* Table card */}
      <Card
        title={copy.subscribers}
        actions={<span className="nlx-count">{filtered.length} / {subscribers.length} {copy.subscribers.toLowerCase()}</span>}
        flush
      >
        <TableFrame>
          <div role="region" aria-label={zh ? "訂閱者清單（可橫向捲動）" : "Subscribers (scroll horizontally)"} tabIndex={0}>
            <table className="a-table">
              <thead>
                <tr>
                  <th>{copy.email}</th>
                  <th>{copy.name}</th>
                  <th>{copy.status}</th>
                  <th>{copy.groups}</th>
                  <th>{copy.actions}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSubs.length > 0 ? (
                  paginatedSubs.map((s) => (
                    <tr key={s.id} className={s.deleted_at ? "is-muted" : undefined}>
                      <td><strong>{s.email}</strong></td>
                      <td>{s.name || "—"}</td>
                      <td>
                        <Chips>
                          <Badge dot tone={nlStatusTone(s.status)}>{subscriberStatusLabel(s.status, zh)}</Badge>
                          {s.deleted_at && <Badge tone="danger">{zh ? "已刪除" : "Deleted"}</Badge>}
                        </Chips>
                      </td>
                      <td>
                        <Chips>
                          {s.groups.length > 0
                            ? s.groups.map((g) => (
                                <Badge key={g}>{g}</Badge>
                              ))
                            : <span className="a-muted">—</span>}
                        </Chips>
                      </td>
                      <td>
                        {canWrite && <RowActions align="start">
                          {!s.deleted_at && (
                            <Button
                              onClick={() => openEdit(s)}
                              size="sm"
                              title={zh ? "編輯訂閱者" : "Edit subscriber"}
                            >
                              {zh ? "編輯" : "Edit"}
                            </Button>
                          )}
                          {!s.deleted_at ? (
                            /* The first delete, which asks too — it sits one
                               button away from 編輯 on every row of a paginated
                               list, and naming the address is the only way the
                               dialog can catch a click on the wrong row. */
                            <ConfirmSubmitButton
                              action={deleteSubscriberAction.bind(null, s.id, "/admin/newsletter?tab=subscribers")}
                              body={
                                zh
                                  ? `確定要刪除「${s.email}」嗎？訂閱者會移到「已刪除」，可在該處還原。`
                                  : `Delete "${s.email}"? The subscriber moves to the deleted list, where they can be restored.`
                              }
                              cancelLabel={zh ? "取消" : "Cancel"}
                              className={buttonClass({ size: "sm", variant: "danger-ghost" })}
                              confirmLabel={zh ? "刪除" : "Delete"}
                              title={zh ? "確認刪除訂閱者" : "Confirm subscriber deletion"}
                            >
                              {zh ? "刪除" : "Delete"}
                            </ConfirmSubmitButton>
                          ) : (
                            <>
                              <form action={restoreSubscriberAction.bind(null, s.id, "/admin/newsletter?tab=subscribers&visibility=deleted")}>
                                <SubmitButton className={buttonClass({ size: "sm" })}>
                                  {zh ? "還原" : "Restore"}
                                </SubmitButton>
                              </form>
                              {/* The second delete. Past sends stay in the log;
                                  only the subscriber row goes. */}
                              <ConfirmSubmitButton
                                action={purgeSubscriberAction.bind(null, s.id, "/admin/newsletter?tab=subscribers&visibility=deleted")}
                                body={
                                  zh
                                    ? `確定要永久刪除「${s.email}」嗎？資料會從資料庫中移除，且無法還原（寄送紀錄會保留）。`
                                    : `Permanently delete "${s.email}"? The row is removed from the database and cannot be restored (past sends stay in the log).`
                                }
                                cancelLabel={zh ? "取消" : "Cancel"}
                                className={buttonClass({ size: "sm", variant: "danger" })}
                                confirmLabel={zh ? "永久刪除" : "Delete permanently"}
                                title={zh ? "永久刪除" : "Delete permanently"}
                              >
                                {zh ? "永久刪除" : "Delete permanently"}
                              </ConfirmSubmitButton>
                            </>
                          )}
                        </RowActions>}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <AdminEmptyState variant="compact" title={zh ? "沒有符合的訂閱者" : "No matching subscribers"} text="" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TableFrame>
        <AdminPagination
          currentPage={page}
          onPageChange={setPage}
          pageSize={pageSize}
          totalRows={filtered.length}
        />
      </Card>

      {/* Edit subscriber modal */}
      <Dialog
        closeLabel={zh ? "關閉" : "Close"}
        dismissible={false}
        footer={
          <DialogActions>
            <Button onClick={closeEdit} variant="ghost">
              {zh ? "取消" : "Cancel"}
            </Button>
            <Button disabled={isPending} form="subscriber-edit-form" icon={isPending ? <span className="admin-spinner" /> : <Pencil />} type="submit" variant="primary">
              {zh ? "儲存變更" : "Save changes"}
            </Button>
          </DialogActions>
        }
        onClose={closeEdit}
        open={Boolean(editSub)}
        size="sm"
        title={zh ? "編輯訂閱者" : "Edit subscriber"}
      >
        {editSub && (
          <form id="subscriber-edit-form" onSubmit={(event) => { event.preventDefault(); handleEdit(new FormData(event.currentTarget)); }}>
            <Stack gap="md">
              {editError && <Callout tone="danger">{editError}</Callout>}
              <Field label={copy.email} required>
                <Input name="email" type="email" required defaultValue={editSub.email} />
              </Field>
              <Field label={copy.name}>
                <Input name="name" defaultValue={editSub.name} />
              </Field>
              <Field label={copy.status}>
                <Select name="status" defaultValue={editSub.status}>
                  <option value="subscribed">{subscriberStatusLabel("subscribed", zh)}</option>
                  <option value="unsubscribed">{subscriberStatusLabel("unsubscribed", zh)}</option>
                </Select>
              </Field>
              <Field label={copy.groups}>
                <Input
                  name="groups"
                  defaultValue={editSub.groups.join(", ")}
                  placeholder={copy.groupsPlaceholder}
                />
              </Field>
            </Stack>
          </form>
        )}
      </Dialog>
    </Stack>
  );
}
