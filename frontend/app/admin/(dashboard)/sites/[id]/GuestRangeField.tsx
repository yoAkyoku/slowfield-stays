"use client";

import { useState } from "react";
import { useSeededRows } from "./useSeededRows";
import { buttonClass } from "../../../ui";

/**
 * 人數級距 — min / max numbers plus the unit word per language, rather than a
 * free-text label the editor has to keep consistent by hand.
 *
 * The stored `value` is the lower bound: the API filters `max_guests >= guests`,
 * so a range is really "this many or more" and only its floor is meaningful.
 * The label is generated ("3–5 人" / "3–5 guests"), and an empty max means
 * open-ended ("13 人以上" / "13+ guests") — which is exactly the shape of the
 * built-in list, now visible and editable instead of being invisible defaults.
 */
export type RangeRow = { min: string; max: string };

const DEFAULT_UNIT = { zh: "人", en: "guests" };

/** Mirrors the server-side validator in siteActions' parseLabelledList call, so
 *  a range the API would silently drop is refused here with a visible reason
 *  instead of disappearing behind a successful save. */
const VALID_MIN = /^[1-9]\d?$/;
export const MAX_MIN_GUESTS = 99;

/** "3–5 人" / "3–5 guests", or "13 人以上" / "13+ guests" when max is blank. */
export function rangeLabel(min: string, max: string, unit: string, isZh: boolean): string {
  const lo = min.trim();
  const hi = max.trim();
  if (!lo) return "";
  if (!hi) return isZh ? `${lo} ${unit}以上` : `${lo}+ ${unit}`;
  return `${lo}–${hi} ${unit}`;
}

export default function GuestRangeField({
  name,
  initial,
  initialUnit,
  defaults,
  zh,
}: {
  name: string;
  initial: unknown;
  /** Saved unit words, if the site has set its own. */
  initialUnit?: unknown;
  defaults: RangeRow[];
  zh: boolean;
}) {
  const [unit, setUnit] = useState(() => {
    const u = (initialUnit ?? {}) as Record<string, unknown>;
    return {
      zh: String(u.zh ?? DEFAULT_UNIT.zh),
      en: String(u.en ?? DEFAULT_UNIT.en),
    };
  });

  const configured = Array.isArray(initial) && initial.length > 0;

  const { rows, touched, edit, update, move, remove } = useSeededRows<RangeRow>(() => {
    if (configured) {
      return (initial as Record<string, unknown>[]).map((raw) => ({
        min: String(raw?.min ?? raw?.value ?? ""),
        max: String(raw?.max ?? ""),
      }));
    }
    return defaults.map((d) => ({ ...d }));
  });

  // A row with no floor has nothing to filter on, so it is not saved. min/max
  // are kept alongside the generated label so reopening the sheet shows the
  // numbers again rather than trying to parse them back out of the text.
  const payload = !configured && !touched
    ? []
    : rows
      .filter((r) => VALID_MIN.test(r.min.trim()))
      .map((r) => ({
        value: r.min.trim(),
        min: r.min.trim(),
        max: r.max.trim(),
        label: {
          zh: rangeLabel(r.min, r.max, unit.zh, true),
          en: rangeLabel(r.min, r.max, unit.en, false),
        },
      }));

  // Rows the server would reject (see parseLabelledList's validator) are called
  // out here rather than vanishing on save with a success message.
  const invalid = rows.some((r) => r.min.trim() && !VALID_MIN.test(r.min.trim()));

  return (
    <div className="so-editor">
      <input type="hidden" name={name} value={JSON.stringify(payload)} />
      <input type="hidden" name={`${name}_unit`} value={JSON.stringify(unit)} />

      <div className="so-units">
        <label>
          <span>{zh ? "中文單位" : "Chinese unit"}</span>
          <input type="text" value={unit.zh} onChange={(e) => setUnit({ ...unit, zh: e.target.value })} placeholder="人" />
        </label>
        <label>
          <span>{zh ? "英文單位" : "English unit"}</span>
          <input type="text" value={unit.en} onChange={(e) => setUnit({ ...unit, en: e.target.value })} placeholder="guests" />
        </label>
      </div>

      {rows.length > 0 && (
        <div className="so-head so-head--range">
          <span>{zh ? "最小" : "Min"}</span>
          <span>{zh ? "最大" : "Max"}</span>
          <span>{zh ? "顯示為" : "Shows as"}</span>
          <span />
        </div>
      )}
      {rows.map((row, i) => (
        <div className="so-row so-row--range" key={i}>
          <input
            type="number"
            min={1}
            max={MAX_MIN_GUESTS}
            className={row.min.trim() && !VALID_MIN.test(row.min.trim()) ? "is-invalid" : undefined}
            value={row.min}
            onChange={(e) => update(i, { min: e.target.value })}
            aria-label={`${zh ? "最小人數" : "Min guests"} ${i + 1}`}
          />
          <input
            type="number"
            min={1}
            value={row.max}
            placeholder={zh ? "不限" : "no cap"}
            onChange={(e) => update(i, { max: e.target.value })}
            aria-label={`${zh ? "最大人數" : "Max guests"} ${i + 1}`}
          />
          <span className="so-preview">{rangeLabel(row.min, row.max, zh ? unit.zh : unit.en, zh) || "—"}</span>
          <div className="so-acts">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={zh ? "上移" : "Move up"}>↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={zh ? "下移" : "Move down"}>↓</button>
            <button
              type="button"
              className="so-del"
              onClick={() => remove(i)}
              aria-label={zh ? "刪除" : "Remove"}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      {invalid && (
        <p className="so-warn" role="alert">
          {zh
            ? `最小人數需為 1–${MAX_MIN_GUESTS} 的整數，超出範圍的級距不會被儲存。`
            : `Min guests must be a whole number from 1 to ${MAX_MIN_GUESTS}; rows outside that range will not be saved.`}
        </p>
      )}
      <div className="so-foot">
        <button type="button" className={buttonClass({ size: "sm" })} onClick={() => edit([...rows, { min: "", max: "" }])}>
          {zh ? "+ 新增級距" : "+ Add range"}
        </button>
        <button type="button" className={buttonClass({ variant: "ghost", size: "sm" })} onClick={() => edit(defaults.map((d) => ({ ...d })))}>
          {zh ? "還原預設" : "Restore defaults"}
        </button>
      </div>
    </div>
  );
}
