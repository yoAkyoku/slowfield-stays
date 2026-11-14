/**
 * Undo / redo over a block list, as plain data.
 *
 * Kept out of the React hook so it can be tested without a DOM (tests/
 * historyStack.test.mts), and shared: both block editors held their list in a
 * bare useState with nothing behind it, so a reorder, a duplicate, a hide or a
 * removed column had no way back at all. Two copies of a history stack is
 * exactly the duplication that put a delete-confirm dialog in one editor and a
 * different one in the other.
 */

/** How many past states a session may accumulate.
 *
 *  A measured 19-block homepage serialises to ~16KB, so 60 snapshots is under
 *  1MB held live in a tab that is already running an iframe per block. Chosen
 *  over "unbounded" because an editor left open all afternoon pushes a step per
 *  typing pause, and over something small like 20 because the whole point is to
 *  survive a run of experiments the editor then wants to walk back. */
export const HISTORY_LIMIT = 60;

/** How long a run of same-tagged edits keeps folding into one step.
 *
 *  Typing writes state on every keystroke; without this, one undo stepped back
 *  one character. A pause longer than this ends the run, so undo lands on
 *  "before that sentence" rather than "before that letter". */
export const COALESCE_MS = 700;

export type History<T> = {
  /** Oldest first. Trimmed from the front once it passes `limit`. */
  past: T[];
  present: T;
  /** Nearest-first: redo pops index 0. */
  future: T[];
  limit: number;
  /** Tag of the change that produced `present`, or null when it was structural
   *  (structural changes never fold into the next one). */
  tag: string | null;
  /** Timestamp of that change, for the coalescing window. */
  at: number;
};

export function initHistory<T>(present: T, limit: number = HISTORY_LIMIT): History<T> {
  return { past: [], present, future: [], limit, tag: null, at: 0 };
}

export type PushOptions = {
  /** Non-null groups consecutive changes: same tag inside the window replaces
   *  the present instead of pushing a step. Structural actions pass null. */
  tag?: string | null;
  at?: number;
  coalesceMs?: number;
};

/**
 * Record a new state.
 *
 * A push always clears the redo stack: once the editor has changed something
 * after undoing, the branch it undid away is no longer reachable, and offering
 * a redo that replays a different history is worse than offering none.
 */
export function pushHistory<T>(history: History<T>, next: T, options: PushOptions = {}): History<T> {
  const { tag = null, at = Date.now(), coalesceMs = COALESCE_MS } = options;
  if (Object.is(next, history.present)) return history;

  const folds = tag !== null && tag === history.tag && at - history.at <= coalesceMs;
  if (folds) {
    // Same run of typing: overwrite where it landed, keep the step boundary
    // that opened the run, and keep `at` moving so a continuous burst does not
    // split at the window boundary.
    return { ...history, present: next, future: [], at };
  }

  const past = [...history.past, history.present];
  return {
    ...history,
    // Drop from the oldest end: the steps an editor reaches for are the recent
    // ones, and the alternative (refusing to record) silently stops undo
    // working after the cap without saying so.
    past: past.length > history.limit ? past.slice(past.length - history.limit) : past,
    present: next,
    future: [],
    tag,
    at,
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history;
  const past = [...history.past];
  const present = past.pop() as T;
  return {
    ...history,
    past,
    present,
    future: [history.present, ...history.future],
    // Cleared so the next edit cannot fold into the run that was just undone,
    // which would make one undo appear to do nothing.
    tag: null,
    at: 0,
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history;
  const [present, ...future] = history.future;
  return { ...history, past: [...history.past, history.present], present, future, tag: null, at: 0 };
}

/** Replace the value and forget everything, for a load or a save that makes the
 *  earlier states meaningless. */
export function resetHistory<T>(history: History<T>, present: T): History<T> {
  return { ...initHistory(present, history.limit) };
}

/** The parts of a focused element that decide whether a keystroke is text
 *  editing. Split out from the DOM so the rule can be tested directly. */
export type FocusDescriptor = {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
};

/** Input types that carry no text cursor, so the browser has no text undo of
 *  its own to protect. Everything else (text, search, url, email, number, date,
 *  password) is treated as text entry. */
const NON_TEXT_INPUT_TYPES = new Set([
  "button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit",
]);

/**
 * Whether Ctrl+Z belongs to the field rather than to the block list.
 *
 * Without this, undo inside a paragraph fought the browser's own text undo and
 * whichever won was a coin toss: the editor typed a word, pressed Ctrl+Z to take
 * it back, and lost a block instead. The rich text editor is a contenteditable,
 * not an input, which is why the element's own flag is checked too.
 */
export function isTextEntryTarget(target: FocusDescriptor | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toUpperCase();
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") return !NON_TEXT_INPUT_TYPES.has((target.type ?? "text").toLowerCase());
  return false;
}

/** Which history action a keydown asks for, or null.
 *
 *  Ctrl+Y is included because Windows editors bind redo there and pressing it
 *  otherwise does nothing at all. Cmd is the Mac spelling of the same chord. */
export function historyIntent(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey?: boolean;
}): "undo" | "redo" | null {
  if (e.altKey) return null;
  if (!(e.ctrlKey || e.metaKey)) return null;
  const key = e.key.toLowerCase();
  if (key === "z") return e.shiftKey ? "redo" : "undo";
  if (key === "y" && !e.shiftKey && !e.metaKey) return "redo";
  return null;
}
