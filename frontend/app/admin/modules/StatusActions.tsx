import { ButtonLink, RowActions, buttonClass } from "../ui";
import ConfirmSubmitButton from "./ConfirmSubmitButton";

type FormAction = (formData: FormData) => void;

/** The server actions one row's controls submit to. */
export type StatusActionSet = {
  archive: FormAction;
  deleteItem?: FormAction;
  purgeItem?: FormAction;
  draft: FormAction;
  publish: FormAction;
  restoreItem?: FormAction;
  review: FormAction;
};

/** The same set as a table receives it: one factory per action, given the row id. */
export type RowStatusActions = { [K in keyof StatusActionSet]: (id: number) => FormAction };

/** Bind a table's action factories to one row. The banner and article tables
 *  each spelled this out key by key. */
export function rowStatusActions(actions: RowStatusActions, id: number): StatusActionSet {
  return {
    archive: actions.archive(id),
    deleteItem: actions.deleteItem?.(id),
    purgeItem: actions.purgeItem?.(id),
    draft: actions.draft(id),
    publish: actions.publish(id),
    restoreItem: actions.restoreItem?.(id),
    review: actions.review(id),
  };
}

export default function StatusActions({
  actions,
  canWrite = true,
  confirmDeleteBody,
  confirmPurgeBody,
  deletedAt,
  editHref,
  labels,
  previewHref,
  status
}: {
  actions: StatusActionSet;
  /**
   * False for a reader. Every control below the two links performs a write the
   * API will refuse with a 403, so showing them offers a dead end — and one of
   * them is the irreversible 永久刪除. Defaults true so an existing caller that
   * has already gated itself is unaffected.
   */
  canWrite?: boolean;
  /**
   * What the two delete dialogs call THIS row, already localised.
   *
   * `labels` is one object shared by every row in the table, so the sentence it
   * carries asks about no record in particular — the same words on all 24 rows.
   * A dialog that names nothing cannot be used to check the aim, which is the
   * whole reason for asking, and it is the one people learn to dismiss without
   * reading. The caller builds these because it is the one that has both the
   * row and the language; the shared label stays as the fallback so a caller
   * that has no name to give still gets a dialog rather than none.
   */
  confirmDeleteBody?: string;
  confirmPurgeBody?: string;
  deletedAt?: string | null;
  editHref: string;
  labels: {
    archive: string;
    confirmDelete?: string;
    edit: string;
    preview: string;
    publish: string;
    restoreDeleted?: string;
    purge?: string;
    confirmPurge?: string;
    confirmPurgeTitle?: string;
    restoreDraft: string;
    submitReview: string;
    deleteLabel?: string;
    confirmArchive: string;
    confirmCancel: string;
    confirmRestoreDeleted?: string;
    confirmDraft: string;
    confirmPublish: string;
    confirmReview: string;
    confirmTitle: string;
  };
  previewHref: string;
  status: string;
}) {
  return (
    <RowActions align="start">
      <ButtonLink href={editHref} size="sm">{labels.edit}</ButtonLink>
      <ButtonLink href={previewHref} size="sm" variant="ghost">{labels.preview}</ButtonLink>
      {canWrite && deletedAt ? (
        <ConfirmSubmitButton
          action={actions.restoreItem}
          body={labels.confirmRestoreDeleted ?? labels.confirmDraft}
          cancelLabel={labels.confirmCancel}
          className={buttonClass({ size: "sm" })}
          confirmLabel={labels.restoreDeleted ?? labels.restoreDraft}
          title={labels.confirmTitle}
        >
          {labels.restoreDeleted ?? labels.restoreDraft}
        </ConfirmSubmitButton>
      ) : null}
      {/* The second delete. Deleting a live row moves it here; deleting it again
          from here is permanent, so this button exists only in the 已刪除 view
          and the API refuses the same call on a row that is not in the bin. */}
      {canWrite && deletedAt && actions.purgeItem && labels.purge ? (
        <ConfirmSubmitButton
          action={actions.purgeItem}
          body={confirmPurgeBody ?? labels.confirmPurge ?? labels.purge}
          cancelLabel={labels.confirmCancel}
          className={buttonClass({ size: "sm", variant: "danger" })}
          confirmLabel={labels.purge}
          title={labels.confirmPurgeTitle ?? labels.confirmTitle}
        >
          {labels.purge}
        </ConfirmSubmitButton>
      ) : null}
      {canWrite && !deletedAt ? (
        <ConfirmSubmitButton
          action={actions.deleteItem}
          body={confirmDeleteBody ?? labels.confirmDelete ?? labels.confirmArchive}
          cancelLabel={labels.confirmCancel}
          className={buttonClass({ size: "sm", variant: "danger-ghost" })}
          confirmLabel={labels.deleteLabel ?? labels.archive}
          title={labels.confirmTitle}
        >
          {labels.deleteLabel ?? labels.archive}
        </ConfirmSubmitButton>
      ) : null}
      {canWrite && !deletedAt && status === "draft" ? (
        <ConfirmSubmitButton
          action={actions.review}
          body={labels.confirmReview}
          cancelLabel={labels.confirmCancel}
          className={buttonClass({ size: "sm" })}
          confirmLabel={labels.submitReview}
          title={labels.confirmTitle}
        >
          {labels.submitReview}
        </ConfirmSubmitButton>
      ) : null}
      {canWrite && !deletedAt && status === "review" ? (
        <ConfirmSubmitButton
          action={actions.publish}
          body={labels.confirmPublish}
          cancelLabel={labels.confirmCancel}
          className={buttonClass({ size: "sm" })}
          confirmLabel={labels.publish}
          title={labels.confirmTitle}
        >
          {labels.publish}
        </ConfirmSubmitButton>
      ) : null}
      {canWrite && !deletedAt && status === "published" ? (
        <ConfirmSubmitButton
          action={actions.archive}
          body={labels.confirmArchive}
          cancelLabel={labels.confirmCancel}
          className={buttonClass({ size: "sm" })}
          confirmLabel={labels.archive}
          title={labels.confirmTitle}
        >
          {labels.archive}
        </ConfirmSubmitButton>
      ) : null}
      {canWrite && !deletedAt && status === "archived" ? (
        <ConfirmSubmitButton
          action={actions.draft}
          body={labels.confirmDraft}
          cancelLabel={labels.confirmCancel}
          className={buttonClass({ size: "sm" })}
          confirmLabel={labels.restoreDraft}
          title={labels.confirmTitle}
        >
          {labels.restoreDraft}
        </ConfirmSubmitButton>
      ) : null}
    </RowActions>
  );
}
