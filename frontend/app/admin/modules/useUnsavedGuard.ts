"use client";

import { useEffect, useRef } from "react";

/**
 * Warn before a closed tab or a reload throws away unsaved editor work.
 *
 * Nothing in this admin had one. Every block editor holds its work in React
 * state and writes it to the server only when 儲存 is pressed, so Cmd+W, F5, a
 * mistyped URL or the browser's own restore-session all discarded an afternoon
 * of blocks with no prompt at all — and two of these editors put a link to
 * /admin/media on screen, i.e. offered the exit themselves.
 *
 * `beforeunload` covers the browser-level exits and nothing else: a Next
 * <Link> is a client-side navigation, which fires no unload event, so links
 * that leave an editor are given `target="_blank"` at the call site rather than
 * being guarded here. There is no supported way to intercept the App Router's
 * own navigation, and a guard that only half works is worse than one whose
 * boundary is written down.
 *
 * `dirty` must be "what is on screen differs from what was loaded", not "has
 * anyone touched a control". An editor that types a word and deletes it again
 * has nothing to lose, and a prompt that appears anyway is the prompt everyone
 * learns to dismiss without reading — at which point the real one is gone too.
 * Each caller therefore compares two serialisations of the same shape.
 *
 * The predicate form exists for the one editor whose fields are uncontrolled
 * (`SitePageEditor`, seven tabs of `defaultValue` inputs): there is no React
 * state to diff, so the comparison reads the form's own FormData, and it can
 * only do that at the moment the question is asked. Evaluating at unload also
 * means the listener never has to re-subscribe.
 */
export function useUnsavedGuard(dirty: boolean | (() => boolean)): void {
  // Read through a ref so the subscription is made once. Re-subscribing on
  // every keystroke (which is what a `dirty` dependency amounts to in an editor
  // that re-renders per character) is a add/removeEventListener pair per key.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const current = dirtyRef.current;
      if (!(typeof current === "function" ? current() : current)) return;
      e.preventDefault();
      // Chrome and Edge before 119 ignore preventDefault here and read this
      // instead. The browser picks the wording either way — a custom string
      // has not been shown since 2016.
      e.returnValue = true;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}

/**
 * Everything a form would submit, as one comparable string.
 *
 * For the editor that cannot answer "am I dirty?" from React state. Built from
 * FormData rather than by walking `form.elements` so it sees exactly what the
 * server action would receive: hidden inputs carrying serialised JSON included,
 * disabled fieldsets excluded, unchecked boxes absent.
 *
 * A chosen file is reduced to its name and size. It cannot be compared by
 * content and it cannot be restored, but picking one is unsaved work and a
 * snapshot that ignored it would say the form was clean.
 *
 * Serialised as name/value PAIRS rather than as joined text, so no value can
 * be written that makes two different forms compare equal by swallowing a
 * separator — and so a renamed field counts as a change.
 */
export function formSnapshot(form: HTMLFormElement | null | undefined): string {
  if (!form) return "";
  const parts: Array<[string, string]> = [];
  new FormData(form).forEach((value, name) => {
    parts.push([name, typeof value === "string" ? value : `file:${value.name}:${value.size}`]);
  });
  return JSON.stringify(parts);
}
