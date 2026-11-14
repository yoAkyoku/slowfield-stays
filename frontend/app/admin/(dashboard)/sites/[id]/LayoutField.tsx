"use client";

import { useState } from "react";
import { buttonClass } from "../../../ui";

/**
 * Page rhythm: side gutter, gap between blocks, and the size of the interface
 * furniture (icons, footer, small print).
 *
 * All three were fixed in the stylesheet, so every "the gaps are too big" and
 * "the icons are too small" was a code change and a deploy. They are one
 * setting each now, and they drive the same CSS variables the blocks already
 * read, so a block that overrides the gutter still wins over the site value.
 */

type Layout = { gutter?: string; section_gap?: string; ui_scale?: number };

const GUTTERS: Array<[string, string, string]> = [
  ["narrow", "窄", "Narrow"],
  ["normal", "標準", "Normal"],
  ["wide", "寬", "Wide"],
];

const GAPS: Array<[string, string, string]> = [
  ["tight", "緊湊", "Tight"],
  ["normal", "標準", "Normal"],
  ["roomy", "寬鬆", "Roomy"],
];

export default function LayoutField({ initial, zh }: { initial?: unknown; zh: boolean }) {
  const seed = (initial && typeof initial === "object" ? initial : {}) as Layout;
  const [layout, setLayout] = useState<Layout>({
    gutter: seed.gutter ?? "normal",
    section_gap: seed.section_gap ?? "normal",
    ui_scale: typeof seed.ui_scale === "number" ? seed.ui_scale : 1,
  });

  const set = (patch: Partial<Layout>) => setLayout((prev) => ({ ...prev, ...patch }));
  const label: React.CSSProperties = { display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 };
  const row: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };

  const chip = (active: boolean) => buttonClass({ size: "sm", variant: active ? "primary" : "secondary" });

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <input type="hidden" name="layout" value={JSON.stringify(layout)} />

      <div>
        <span style={label}>
          {zh ? "頁面左右留白" : "Side gutter"}
        </span>
        <div style={row}>
          {GUTTERS.map(([value, z, e]) => (
            <button key={value} type="button" className={chip(layout.gutter === value)} aria-pressed={layout.gutter === value} onClick={() => set({ gutter: value })}>
              {zh ? z : e}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.6 }}>
          {zh
            ? "內容距離視窗左右兩側的距離。個別區塊在「左右內距」設定的值會覆蓋這裡，不是相加。"
            : "How far the content sits from the window edges. A block's own side padding replaces this value rather than adding to it."}
        </p>
      </div>

      <div>
        <span style={label}>{zh ? "區塊上下間距" : "Space between blocks"}</span>
        <div style={row}>
          {GAPS.map(([value, z, e]) => (
            <button key={value} type="button" className={chip(layout.section_gap === value)} aria-pressed={layout.section_gap === value} onClick={() => set({ section_gap: value })}>
              {zh ? z : e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span style={label}>
          {zh ? `介面比例 ${layout.ui_scale?.toFixed(2)}×` : `Interface scale ${layout.ui_scale?.toFixed(2)}×`}
        </span>
        <input
          type="range"
          min={0.85}
          max={1.4}
          step={0.05}
          value={layout.ui_scale ?? 1}
          onChange={(e) => set({ ui_scale: Number(e.target.value) })}
          style={{ width: "100%", maxWidth: 320 }}
        />
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.6 }}>
          {zh
            ? "圖示、頁尾與小字的大小。標題與內文的字級在上方「字級」設定。"
            : "The size of icons, the footer and small print. Headings and body text are set under Type Scale above."}
        </p>
      </div>
    </div>
  );
}
