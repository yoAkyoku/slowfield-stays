"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type History,
  canRedo,
  canUndo,
  historyIntent,
  initHistory,
  isTextEntryTarget,
  pushHistory,
  redoHistory,
  resetHistory,
  undoHistory,
} from "./historyStack";

export type UndoableList<T> = {
  value: T;
  /** Same call shape as a useState setter, plus the tag that decides whether
   *  this change folds into the previous one (see historyStack). */
  set: (next: T | ((current: T) => T), tag?: string | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Forget the past, e.g. after a save. */
  reset: (next: T) => void;
};

/**
 * Undoable state plus the Ctrl+Z / Ctrl+Shift+Z (Cmd on Mac) bindings, shared by
 * the article and homepage block editors.
 *
 * The listener is on window rather than on the editor's own element because the
 * editor's toolbar buttons, the palette and the preview overlay are all places
 * an editor can have focus while meaning "undo my last block change", and the
 * overlay is not even inside the same DOM subtree.
 */
export function useUndoableList<T>(
  initial: T | (() => T),
  options: {
    /** Run on every undo and redo, from the buttons and from the keyboard
     *  alike. Editors that address an open form by index need it: a step that
     *  changes the list length would otherwise leave that form open on a
     *  different block. */
    onTravel?: () => void;
  } = {},
): UndoableList<T> {
  const [history, setHistory] = useState<History<T>>(() =>
    initHistory(typeof initial === "function" ? (initial as () => T)() : initial),
  );

  // Held in a ref so a caller passing an inline arrow does not rebuild the undo
  // and redo callbacks (and with them the keydown subscription) every render.
  const onTravelRef = useRef(options.onTravel);
  onTravelRef.current = options.onTravel;

  // The current value, readable from the keydown listener without making the
  // listener depend on it: re-subscribing on every keystroke is how a burst of
  // typing turns into a burst of add/removeEventListener pairs.
  const valueRef = useRef(history.present);
  valueRef.current = history.present;

  const set = useCallback((next: T | ((current: T) => T), tag: string | null = null) => {
    setHistory((cur) => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(cur.present) : next;
      return pushHistory(cur, resolved, { tag });
    });
  }, []);

  const undo = useCallback(() => {
    onTravelRef.current?.();
    setHistory((cur) => undoHistory(cur));
  }, []);
  const redo = useCallback(() => {
    onTravelRef.current?.();
    setHistory((cur) => redoHistory(cur));
  }, []);
  const reset = useCallback((next: T) => setHistory((cur) => resetHistory(cur, next)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const intent = historyIntent(e);
      if (!intent) return;
      // The keystroke belongs to whatever has focus if that is a text field or a
      // rich text editor: those have their own undo stack, and stealing the
      // chord there means a typo correction eats a block instead.
      const target = e.target;
      if (target instanceof HTMLElement && isTextEntryTarget({
        tagName: target.tagName,
        type: (target as HTMLInputElement).type,
        isContentEditable: target.isContentEditable,
      })) {
        return;
      }
      e.preventDefault();
      if (intent === "undo") undo();
      else redo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return useMemo(
    () => ({
      value: history.present,
      set,
      undo,
      redo,
      canUndo: canUndo(history),
      canRedo: canRedo(history),
      reset,
    }),
    [history, set, undo, redo, reset],
  );
}
