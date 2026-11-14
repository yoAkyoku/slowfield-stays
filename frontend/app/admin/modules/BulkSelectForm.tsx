"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Dialog, DialogActions, buttonClass } from "../ui";

type BulkSelectLabels = {
  selectAll: string;
  deleteSelected: string;
  selected: string;
  confirmTitle: string;
  confirmText: string;
  cancel: string;
};

function BulkSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={buttonClass({ variant: "danger" })} disabled={pending}>
      {pending ? <span className="admin-spinner" /> : <Trash2 size={14} />}
      {label}
    </button>
  );
}

export default function BulkSelectForm({
  action,
  children,
  labels,
  purge = false,
  returnTo
}: {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  labels: BulkSelectLabels;
  /**
   * True while the 已刪除 view is open. These rows have already been deleted
   * once, so the only delete left is the permanent one — the wording changes
   * with it, and the server action reads the same flag off the form.
   */
  purge?: boolean;
  returnTo?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [confirming, setConfirming] = useState(false);
  /* Every 批次刪除 in the admin comes through here, including the 永久刪除 in
     已刪除. The kit Dialog gives it Escape, a Tab trap and scroll lock; it is
     rendered inside the form so its submit button posts the checked ids. */

  const sync = useCallback(() => {
    if (!formRef.current) return;
    const boxes = formRef.current.querySelectorAll<HTMLInputElement>('input[name="ids"]');
    const checked = Array.from(boxes).filter((b) => b.checked).length;
    setCount(checked);
    setTotal(boxes.length);
    if (selectAllRef.current) {
      selectAllRef.current.checked = boxes.length > 0 && checked === boxes.length;
      selectAllRef.current.indeterminate = checked > 0 && checked < boxes.length;
    }
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    sync();
    form.addEventListener("change", sync);
    return () => form.removeEventListener("change", sync);
  }, [sync]);

  const toggleAll = useCallback(() => {
    if (!formRef.current) return;
    const boxes = Array.from(formRef.current.querySelectorAll<HTMLInputElement>('input[name="ids"]'));
    const allChecked = boxes.length > 0 && boxes.every((b) => b.checked);
    for (const box of boxes) box.checked = !allChecked;
    sync();
  }, [sync]);

  return (
    <form ref={formRef} action={action} className="bulk-select-form">
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      {purge && <input type="hidden" name="purge" value="1" />}
      <div className="bulk-select-bar">
        <label className="bulk-select-toggle">
          <input ref={selectAllRef} type="checkbox" onChange={toggleAll} />
          <span>{labels.selectAll}</span>
        </label>
        {count > 0 && (
          <>
            <span className="bulk-select-count">
              {count} {labels.selected}
            </span>
            <button
              type="button"
              className={`bulk-delete-trigger${purge ? " bulk-delete-trigger--purge" : ""}`}
              onClick={() => setConfirming(true)}
            >
              <Trash2 size={14} />
              {labels.deleteSelected}
            </button>
          </>
        )}
      </div>
      {children}
      <Dialog
        closeLabel={labels.cancel}
        description={labels.confirmText.replace("{count}", String(count))}
        footer={
          <DialogActions>
            <Button onClick={() => setConfirming(false)}>{labels.cancel}</Button>
            <BulkSubmitButton label={labels.deleteSelected} />
          </DialogActions>
        }
        onClose={() => setConfirming(false)}
        open={confirming}
        size="sm"
        title={labels.confirmTitle}
      />
    </form>
  );
}
