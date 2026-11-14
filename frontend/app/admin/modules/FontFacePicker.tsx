"use client";

import { useId } from "react";
import {
  TYPE_FACES,
  TYPE_FACE_GROUP_LABELS,
  TYPE_FACE_GROUP_ORDER,
  faceLabel,
  safeFace,
} from "../../modules/fontPresets";

/**
 * The one font control in the admin.
 *
 * Four font menus existed, each with its own list: the site's 標題／內文 ×
 * 中文／英文 selects offered three Chinese faces and two-to-seven Latin ones, the
 * 字級 matrix offered twenty-seven, and a block or banner's 字體 offered three
 * ROLE names and no typeface at all. They all read TYPE_FACES now, through this.
 *
 * Three things a bare <select> of forty options could not do, and the reason
 * this component exists rather than a longer <option> list:
 *
 *   · Grouping. Forty flat options is a scroll; five named <optgroup>s — 中文,
 *     設計, 襯線, 無襯線, 等寬 — is a choice. optgroup is also the one grouping
 *     construct a native picker keeps on iOS and in a screen reader.
 *   · Showing the face. A font picker that draws every name in the same face is
 *     close to useless at this length. Each <option> carries its own
 *     font-family, and so does the closed <select>.
 *   · Showing it where <option> styling does not survive. iOS Safari draws the
 *     open list itself and ignores per-option fonts, so the sample line below
 *     the control is what actually answers "what does this look like" there. It
 *     holds a fixed height and a single non-wrapping line, so switching face
 *     cannot reflow the panel around it.
 *
 * It stays a NATIVE select on purpose. This panel is used on an iPad, where a
 * hand-rolled listbox is a focus trap and a hover affordance waiting to happen
 * (tests/rowActionsAlwaysVisible.test.mts is in this repo because of that class
 * of bug); the platform control is keyboard-reachable, type-ahead searchable and
 * focus-visible for free.
 */

/** 中文 and Latin together, so one line answers both halves of the question. */
export const FACE_SAMPLE = "永和山旅 Aa Bb 123";

export type FaceOption = { value: string; label: string; stack?: string };

export function FontFacePicker({
  ariaLabel,
  blank,
  children,
  compact,
  fallbackStack,
  label,
  name,
  onChange,
  value,
  zh,
}: {
  /** Accessible name when there is no visible label (the 字級 matrix). */
  ariaLabel?: string;
  /** The leading ungrouped option — "use the theme's own", typically value "". */
  blank?: FaceOption;
  /** Non-face choices, written at the call site as <optgroup>/<option> so each
   *  screen owns its own wording: 跟隨網站 on a block, 與中文字體相同 on the
   *  site's Latin menus. Rendered above the catalogue. */
  children?: React.ReactNode;
  /** No sample line: the 字級 matrix is a six-row grid and cannot afford one. */
  compact?: boolean;
  /** What to draw the closed control and the sample in when `value` is one of
   *  those non-face choices and so resolves to no catalogue face. */
  fallbackStack?: string;
  /** Visible label. Tied to the control by id/htmlFor, not by wrapping it. */
  label?: string;
  name?: string;
  onChange: (value: string) => void;
  value: string;
  zh: boolean;
}) {
  const uid = useId();
  const selectId = `${uid}-face`;

  /* What the closed control and the sample are drawn in. A face key resolves
     through the same allow-list the render side uses — never a stored string
     pasted into a style. */
  const chosen = safeFace(value) || fallbackStack || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label ? (
        <label
          htmlFor={selectId}
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        name={name}
        aria-label={label ? undefined : ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={chosen ? { fontFamily: chosen } : undefined}
      >
        {blank ? <option value={blank.value}>{blank.label}</option> : null}
        {children}
        {TYPE_FACE_GROUP_ORDER.map((group) => {
          const faces = TYPE_FACES.filter((f) => f.group === group);
          if (!faces.length) return null;
          return (
            <optgroup key={group} label={TYPE_FACE_GROUP_LABELS[group][zh ? 0 : 1]}>
              {faces.map((f) => (
                <option key={f.key} value={f.key} style={{ fontFamily: f.stack }}>
                  {faceLabel(f, zh)}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      {compact ? null : (
        /* aria-hidden: it repeats the chosen option and nothing else, and a
           screen reader has already read that out of the select. */
        <div
          aria-hidden="true"
          style={{
            fontFamily: chosen || undefined,
            fontSize: 17,
            lineHeight: "24px",
            height: 24,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            color: "var(--ink, #0f0f0d)",
            opacity: chosen ? 0.85 : 0.45,
          }}
        >
          {FACE_SAMPLE}
        </div>
      )}
    </div>
  );
}
