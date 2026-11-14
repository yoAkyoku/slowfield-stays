"use client";

import { useState } from "react";
import {
  TYPE_FACES,
  TYPE_FACE_GROUP_LABELS,
  TYPE_FACE_GROUP_ORDER,
  faceLabel,
  safeFace,
} from "../../../../modules/fontPresets";

/**
 * Per-level type scale for the site, in the spirit of a theme's typography
 * panel: say once how big an H2 is, and every block that marks text as an H2
 * follows.
 *
 * Blank means "leave it as the theme has it" — the front-end only emits a CSS
 * variable for a level that was filled in, so an untouched site renders exactly
 * as before. That is why the placeholders show the current values rather than
 * pre-filling them: pre-filling would freeze today's numbers into the config
 * and quietly opt the site out of future theme changes.
 */
const LEVELS: Array<{ key: string; zh: string; en: string; size: string; weight: string; line: string }> = [
  { key: "h1", zh: "主標題 H1", en: "Heading 1", size: "clamp(32px, 5vw, 76px)", weight: "400", line: "1.14" },
  { key: "h2", zh: "區塊標題 H2", en: "Heading 2", size: "clamp(28px, 3.4vw, 44px)", weight: "400", line: "1.15" },
  { key: "h3", zh: "小標 H3", en: "Heading 3", size: "20px", weight: "600", line: "1.35" },
  { key: "h4", zh: "次小標 H4", en: "Heading 4", size: "17px", weight: "600", line: "1.4" },
  { key: "body", zh: "內文", en: "Body", size: "16px", weight: "400", line: "1.7" },
  { key: "small", zh: "註解／小字", en: "Small", size: "13px", weight: "400", line: "1.5" },
];

type Entry = { size?: string; weight?: string; line?: string; font?: string };

export default function TypeScaleField({
  initial,
  zh,
}: {
  initial: unknown;
  zh: boolean;
}) {
  const [scale, setScale] = useState<Record<string, Entry>>(() =>
    initial && typeof initial === "object" && !Array.isArray(initial)
      ? (initial as Record<string, Entry>)
      : {},
  );

  const set = (level: string, field: keyof Entry, value: string) =>
    setScale((prev) => {
      const entry = { ...(prev[level] ?? {}), [field]: value };
      if (!value) delete entry[field];
      const next = { ...prev, [level]: entry };
      if (!Object.keys(entry).length) delete next[level];
      return next;
    });

  return (
    /* A <div>, not a <label>.
       This was one <label> wrapped around the whole matrix — 24 controls. A
       label names exactly one control (its `.control`, the first labellable
       descendant), so the H1 font <select> got the name 「字級設定」 and the
       other 23 — every size, weight and line height, and five of the six font
       pickers — had NO accessible name at all: a screen reader announced two
       dozen identical unlabelled comboboxes and text boxes. Clicking anywhere
       in the table, including the explanatory paragraph at the bottom, also
       forwarded focus to that one H1 select, because that is what a label does.
       The per-row names come from aria-label on each control instead, and the
       column headers stay the visible half of the same information. */
    <div style={{ gridColumn: "1 / -1" }}>
      <span>{zh ? "字級設定（留空 = 沿用主題預設）" : "Type scale (blank = the theme's own)"}</span>
      <input type="hidden" name="type_scale" value={JSON.stringify(scale)} />
      {/* The rows are a five-track grid whose fixed columns alone come to 448px,
          against 235px inside two nested .admin-card paddings at 375px. Nothing
          here sets overflow-x and html is `overflow-x: clip`, so 字重 and 行高
          were painted past the right edge for every level — invisible and
          impossible to tap, rather than merely cramped. Scroll the matrix
          instead, the same way the admin tables do. */}
      <div className="type-scale-scroll">
      {/* 640, not 460. The four fixed columns below total 424px and the gaps add 24
          more, so a 460px floor left the `1fr` font-size column 12px wide — measured
          at 22px on a 1139px window and on a phone, with a `clamp(32px, 5vw, 76px)`
          placeholder inside it. The row scrolls horizontally (.type-scale-scroll),
          so a wider floor costs nothing but a scrollbar on narrow screens. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6, minWidth: 640 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "112px 150px 1fr 84px 78px",
            gap: 6,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          <span>{zh ? "層級" : "Level"}</span>
          <span>{zh ? "字型" : "Font"}</span>
          <span>{zh ? "字級" : "Size"}</span>
          <span>{zh ? "字重" : "Weight"}</span>
          <span>{zh ? "行高" : "Line"}</span>
        </div>
        {LEVELS.map((lv) => {
          const entry = scale[lv.key] ?? {};
          return (
            <div key={lv.key} style={{ display: "grid", gridTemplateColumns: "112px 150px 1fr 84px 78px", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>{zh ? lv.zh : lv.en}</span>
              {/* Every control names the level AND the property, because the
                  column header alone is not read out beside the control: on a
                  grid there is no table semantics to tie them together, and a
                  bare 「字型」 six times over does not say which row it is. */}
              {/* Not the shared FontFacePicker: this is a six-row grid with a
                  fixed 150px font column, and the picker's sample line would add
                  a second row of height to every level. It carries the same two
                  things that matter at forty options — <optgroup>s to navigate by
                  and each name drawn in its own face — with the label staying an
                  aria-label per row, which is what keeps the 24 controls in this
                  matrix distinguishable (tests/typeScaleFieldLabels.test.mts). */}
              <select
                aria-label={zh ? `${lv.zh} 字型` : `${lv.en} font`}
                value={entry.font ?? ""}
                onChange={(e) => set(lv.key, "font", e.target.value)}
                style={safeFace(entry.font) ? { fontFamily: safeFace(entry.font) } : undefined}
              >
                <option value="">{zh ? "沿用主題" : "Theme default"}</option>
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
              <input
                type="text"
                aria-label={zh ? `${lv.zh} 字級` : `${lv.en} size`}
                value={entry.size ?? ""}
                placeholder={lv.size}
                onChange={(e) => set(lv.key, "size", e.target.value)}
              />
              <select
                aria-label={zh ? `${lv.zh} 字重` : `${lv.en} weight`}
                value={entry.weight ?? ""}
                onChange={(e) => set(lv.key, "weight", e.target.value)}
              >
                <option value="">{lv.weight}</option>
                {["300", "400", "500", "600", "700"].map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
              <input
                type="text"
                aria-label={zh ? `${lv.zh} 行高` : `${lv.en} line height`}
                value={entry.line ?? ""}
                placeholder={lv.line}
                onChange={(e) => set(lv.key, "line", e.target.value)}
              />
            </div>
          );
        })}
        <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
          {zh
            ? "每個層級的字型分開設定 —— 標題可以用襯線、內文用黑體，不必整站一種。字級可填 20px、1.4rem，或 clamp(24px, 3vw, 40px) 這種會隨螢幕縮放的寫法（灰字是目前值）。行高填純數字，例如 1.5。中文字型永遠在後備清單裡，選拉丁字型不會讓中文變成亂七八糟的字。導覽列與頁尾不受影響，避免內文設太大時把版頭撐壞。"
            : "Each level takes its own face, so headings can be serif while body text is sans — the whole site no longer has to agree. A size can be 20px, 1.4rem, or a responsive clamp(24px, 3vw, 40px); the grey text shows what is in use now. Line height is a bare number such as 1.5. Every face falls back to the Chinese stack, so picking a Latin face never leaves Chinese text to chance. Navigation and footer are left alone so a large body size cannot blow the header apart."}
        </p>
      </div>
      </div>
    </div>
  );
}
