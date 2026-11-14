"use client";

import { useState } from "react";
import { buttonClass } from "../../../ui";

/**
 * 服務設施 / 民宿類型 — a two-column list (中文 / 英文) with an internal,
 * stable machine value.
 *
 * The generic BilingualListField asked for a third "value" column, but for
 * these two lists the value is not a free choice: the filter matches against
 * the zh tag stored on each villa, so any value other than the zh label
 * produces a control that silently matches nothing. Deriving it removes the
 * column and the class of mistake with it.
 *
 * Unconfigured sites start from the built-in list rather than an empty sheet,
 * so the defaults are visible and editable instead of being invisible
 * behaviour you can only discover by clearing the field.
 */
export type OptionRow = { value?: string; zh: string; en: string };

function configuredRow(raw: Record<string, unknown>, defaults: OptionRow[]): OptionRow {
  const label = raw?.label;
  const localized = (typeof label === "object" && label ? label : {}) as Record<string, string>;
  const value = String(raw?.value ?? (typeof label === "string" ? label : localized.zh ?? ""));
  const builtIn = defaults.find((item) => item.value === value || item.zh === value);
  if (typeof label === "string") {
    return {
      value,
      zh: label,
      en: builtIn && builtIn.en !== label ? builtIn.en : label,
    };
  }
  const zhLabel = String(localized.zh ?? raw?.value ?? "");
  const storedEn = String(localized.en ?? "");
  // An older save path copied Chinese into a blank English field. Repair only
  // canonical built-ins; custom vocabulary remains exactly what staff entered.
  const enLabel = builtIn && (!storedEn || storedEn === zhLabel) ? builtIn.en : storedEn;
  return { value, zh: zhLabel, en: enLabel };
}

export default function SearchOptionsField({
  name,
  initial,
  defaults,
  zh,
  zhPlaceholder,
  enPlaceholder,
  addLabel,
}: {
  /** Form field name; posts as a JSON string of [{label:{zh,en}, value}]. */
  name: string;
  initial: unknown;
  /** Built-in list, seeded when nothing is configured yet. */
  defaults: OptionRow[];
  zh: boolean;
  zhPlaceholder?: string;
  enPlaceholder?: string;
  addLabel?: string;
}) {
  const configured = Array.isArray(initial) && initial.length > 0;

  const [rows, setRows] = useState<OptionRow[]>(() => {
    if (configured) {
      return (initial as Record<string, unknown>[]).map((raw) => configuredRow(raw, defaults));
    }
    return defaults.map((d) => ({ ...d }));
  });

  // Seeding the built-ins is a display convenience, not a decision to adopt
  // them. This whole form posts every tab at once (the panels are hidden, not
  // unmounted), so without this an admin who saves an unrelated tab would
  // freeze a copy of today's defaults into the site and stop tracking future
  // changes to the bundled list.
  const [touched, setTouched] = useState(false);
  const edit = (next: OptionRow[]) => { setTouched(true); setRows(next); };

  const update = (i: number, patch: Partial<OptionRow>) =>
    edit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    edit(next);
  };

  // Existing values stay stable when either display label is renamed. New rows
  // receive their initial Chinese label as the value only when first saved.
  const payload = !configured && !touched
    ? []
    : rows
      .filter((r) => r.zh.trim())
      .map((r) => ({
        label: { zh: r.zh.trim(), en: r.en.trim() },
        value: r.value?.trim() || r.zh.trim(),
      }));

  return (
    <div className="so-editor">
      <input type="hidden" name={name} value={JSON.stringify(payload)} />
      {rows.length > 0 && (
        <>
          <p className="so-language-hint">
            {zh
              ? "中文與英文為獨立顯示名稱；請分別填寫。英文留空時，英文頁會暫時顯示中文。"
              : "Chinese and English are separate display labels. If English is blank, the English site temporarily falls back to Chinese."}
          </p>
          <div className="so-head">
            <span>{zh ? "中文顯示名稱" : "Chinese label"}</span>
            <span>{zh ? "英文顯示名稱" : "English label"}</span>
            <span />
          </div>
        </>
      )}
      {rows.map((row, i) => (
        <div className="so-row" key={i}>
          <input
            type="text"
            value={row.zh}
            placeholder={zhPlaceholder}
            onChange={(e) => update(i, { zh: e.target.value })}
            aria-label={`${zh ? "中文" : "Chinese"} ${i + 1}`}
          />
          <input
            type="text"
            value={row.en}
            placeholder={enPlaceholder}
            onChange={(e) => update(i, { en: e.target.value })}
            aria-label={`${zh ? "英文" : "English"} ${i + 1}`}
          />
          <div className="so-acts">
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label={zh ? "上移" : "Move up"}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === rows.length - 1}
              aria-label={zh ? "下移" : "Move down"}
            >
              ↓
            </button>
            <button
              type="button"
              className="so-del"
              onClick={() => edit(rows.filter((_, j) => j !== i))}
              aria-label={zh ? "刪除" : "Remove"}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <div className="so-foot">
        <button type="button" className={buttonClass({ size: "sm" })} onClick={() => edit([...rows, { zh: "", en: "" }])}>
          {addLabel ?? (zh ? "+ 新增一項" : "+ Add row")}
        </button>
        {/* Clearing every row is how a site says "no options here"; this puts
            the built-in list back without needing to remember what it was. */}
        <button type="button" className={buttonClass({ variant: "ghost", size: "sm" })} onClick={() => edit(defaults.map((d) => ({ ...d })))}>
          {zh ? "還原預設" : "Restore defaults"}
        </button>
      </div>
    </div>
  );
}
