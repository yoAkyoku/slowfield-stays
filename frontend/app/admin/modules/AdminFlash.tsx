import { Toast } from "../ui/Toast";

/** The kit Toast, under the name every admin page imports it by. */
export { Toast as default } from "../ui/Toast";

export type FlashCopy = { adminFlashClose: string; adminFlashSuccess: string; adminFlashError: string };

/**
 * The pair every admin page puts under its header: the ?notice= of a save that
 * worked and the ?error= of one that did not. Each page wrote both toasts out
 * in full, the same four props twice. `copy` is the page's `copy.admin`; a page
 * with its own wording passes an object of the same three keys.
 */
export function AdminFlashes({ notice, error, copy }: { notice?: string; error?: string; copy: FlashCopy }) {
  return (
    <>
      <Toast closeLabel={copy.adminFlashClose} message={notice} title={copy.adminFlashSuccess} tone="success" />
      <Toast closeLabel={copy.adminFlashClose} message={error} title={copy.adminFlashError} tone="error" />
    </>
  );
}
