"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keep an admin form's work when the save is rejected.
 *
 * Every server action in this admin redirects on failure as well as on success
 * (`adminUtils.actionRedirect`). A rejected save therefore re-navigates to the
 * same URL, the page re-fetches, and the editor remounts seeded from the last
 * SAVED content — an hour of work gone, with `?error=` in the address bar to
 * show for it, and no undo. A 422 from a publish guard or a 409 on a slug is
 * enough to trigger it, so this is an ordinary Tuesday, not an edge case.
 *
 * The CMS page editor grew its own recovery for exactly this. Every other
 * editor — the site editor with its seven tabs, the stay editor, the villa page
 * editor — had none. This is that idea with the page-specific parts removed, so
 * a form opts in with one hook instead of a copy.
 *
 * A form's state is its FormData, so that is what gets written down: every
 * named field, including the hidden inputs that carry serialised block JSON.
 * Files are skipped — they cannot be revived from storage and the user has to
 * pick them again regardless.
 *
 * sessionStorage, not localStorage: a draft belongs to the tab that was typing
 * and should not outlive it, or a stale recovery ambushes the next editor.
 */

type Draft = Record<string, string>;

function readDraft(key: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Draft;
  } catch {
    // Private mode, a quota error, or something else wrote nonsense under this
    // key. Losing a draft is bad; refusing to open the editor is worse.
    return null;
  }
}

export function useFormDraft(
  key: string,
  saveFailed: boolean | undefined,
  options?: {
    /** Called with the recovered values when a draft is restored, for state the
     *  DOM cannot hold (React-controlled editors seeded once from props). */
    onRestore?: (draft: Draft) => void;
  },
) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [recovered, setRecovered] = useState(false);
  const onRestore = useRef(options?.onRestore);
  onRestore.current = options?.onRestore;

  const stash = useCallback((form: HTMLFormElement) => {
    formRef.current = form;
    try {
      const draft: Draft = {};
      new FormData(form).forEach((value, name) => {
        if (typeof value === "string") draft[name] = value;
      });
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // Storage being unavailable must not stop the save itself.
    }
  }, [key]);

  useEffect(() => {
    const draft = readDraft(key);
    if (!saveFailed) {
      // The save landed. Anything kept from an earlier attempt is stale, and a
      // stale draft is worse than none — it would overwrite what was just saved.
      if (draft) {
        try { sessionStorage.removeItem(key); } catch { /* nothing to clean up */ }
      }
      return;
    }
    if (!draft) return;

    const form = formRef.current;
    if (form) {
      for (const [name, value] of Object.entries(draft)) {
        const field = form.elements.namedItem(name);
        // A RadioNodeList (repeated names) has no single value to restore and
        // is left to the caller's onRestore, which knows what the group means.
        if (
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement ||
          field instanceof HTMLSelectElement
        ) {
          if (field instanceof HTMLInputElement && (field.type === "file" || field.type === "submit")) continue;
          if (field instanceof HTMLInputElement && field.type === "checkbox") {
            field.checked = value === "on" || value === "true";
            continue;
          }
          field.value = value;
        }
      }
    }
    onRestore.current?.(draft);
    setRecovered(true);
  }, [key, saveFailed]);

  /** Attach to the form so restoration can find its fields. */
  const registerForm = useCallback((form: HTMLFormElement | null) => {
    formRef.current = form;
  }, []);

  return { stash, recovered, registerForm };
}

/** A JSON field from a restored draft, or `fallback` if it is missing or will
 *  not parse — a half-written draft must not throw the restore away. */
export function draftJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
