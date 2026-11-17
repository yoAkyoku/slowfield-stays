"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog, DialogActions } from "./Dialog";

/**
 * "Are you sure?" and "something is wrong" in the back office's own dialog.
 *
 * The editors used `window.confirm` and `window.alert`: a browser box in the
 * system font, with the page's own name as its title, that blocks the tab and
 * ignores the admin's language for its buttons. `ask` and `tell` show the kit
 * Dialog instead and resolve when the person answers.
 *
 *   const { ask, tell } = useConfirm();
 *   if (!(await ask({ title: "刪除這一列？", tone: "danger" }))) return;
 *   await tell({ title: "請選擇一位使用者" });
 *
 * Without a ConfirmProvider above it (a test, a page outside the admin shell)
 * it falls back to the browser's own boxes, so a caller never has to check.
 */

export type AskOptions = {
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for deletes: the confirm button is red. */
  tone?: "default" | "danger";
};

type Pending = AskOptions & { kind: "ask" | "tell"; resolve: (ok: boolean) => void };
type Api = { ask: (o: AskOptions) => Promise<boolean>; tell: (o: AskOptions) => Promise<void> };

const ConfirmContext = createContext<Api | null>(null);

const plain = (node: ReactNode) => (typeof node === "string" ? node : "");
const fallback: Api = {
  ask: async (o) => (typeof window === "undefined" ? false : window.confirm([plain(o.title), plain(o.body)].filter(Boolean).join("\n\n"))),
  tell: async (o) => { if (typeof window !== "undefined") window.alert([plain(o.title), plain(o.body)].filter(Boolean).join("\n\n")); },
};

export function useConfirm(): Api {
  return useContext(ConfirmContext) ?? fallback;
}

export function ConfirmProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const zh = locale === "zh";
  const [pending, setPending] = useState<Pending | null>(null);
  const queue = useRef<Pending[]>([]);

  const show = useCallback((p: Pending) => {
    setPending((current) => {
      if (current) { queue.current.push(p); return current; }
      return p;
    });
  }, []);

  const api = useRef<Api>({
    ask: (o) => new Promise<boolean>((resolve) => show({ ...o, kind: "ask", resolve })),
    tell: (o) => new Promise<void>((resolve) => show({ ...o, kind: "tell", resolve: () => resolve() })),
  }).current;

  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(queue.current.shift() ?? null);
  };

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Dialog
        open={pending !== null}
        onClose={() => answer(false)}
        title={pending?.title ?? ""}
        size="sm"
        className="a-confirm"
        closeLabel={zh ? "關閉" : "Close"}
        footer={
          <DialogActions>
            {pending?.kind === "ask" && (
              <Button variant="ghost" onClick={() => answer(false)}>{pending.cancelLabel ?? (zh ? "取消" : "Cancel")}</Button>
            )}
            <Button
              variant={pending?.tone === "danger" ? "danger" : "primary"}
              onClick={() => answer(true)}
              autoFocus
            >
              {pending?.confirmLabel ?? (pending?.kind === "tell" ? (zh ? "知道了" : "OK") : (zh ? "確定" : "Confirm"))}
            </Button>
          </DialogActions>
        }
      >
        {pending?.body}
      </Dialog>
    </ConfirmContext.Provider>
  );
}
