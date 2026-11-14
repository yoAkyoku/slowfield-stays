"use client";

import { Redo2, Undo2 } from "lucide-react";

/** Mac spells the modifier ⌘ and everyone else spells it Ctrl; the tooltip is
 *  wrong on one platform or the other unless it asks. Guarded for the server
 *  render, where there is no navigator, and defaulting to the Ctrl spelling
 *  that the majority of these admins are on. */
function chordPrefix(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
}

/**
 * Undo / redo pair for a block editor toolbar.
 *
 * Shared rather than written twice: the two editors already disagreed about the
 * wording of their delete dialogs, and a control whose label depends on which
 * page you are on is the same problem one step earlier.
 *
 * Named, not icon-only: the arrows alone announce as "undo2" from the icon set,
 * and the shortcut is in the tooltip because nothing else on the page says the
 * feature exists.
 */
export default function UndoRedoButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  editLocale,
  size = 15,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  editLocale: string;
  size?: number;
}) {
  const zh = editLocale === "zh";
  const mod = chordPrefix();
  const undoName = zh ? "復原" : "Undo";
  const redoName = zh ? "重做" : "Redo";
  return (
    <div className="pbe-history" role="group" aria-label={zh ? "復原與重做" : "Undo and redo"}>
      <button
        type="button"
        className="pbe-history__btn"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label={undoName}
        title={`${undoName} (${mod}+Z)`}
      >
        <Undo2 size={size} />
        <span className="pbe-history__label">{undoName}</span>
      </button>
      <button
        type="button"
        className="pbe-history__btn"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label={redoName}
        title={`${redoName} (${mod}+Shift+Z)`}
      >
        <Redo2 size={size} />
        <span className="pbe-history__label">{redoName}</span>
      </button>
    </div>
  );
}
