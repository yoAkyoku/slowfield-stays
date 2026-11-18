"use client";

/**
 * The style half of a block's inspector: text, anchor, spacing, surface and
 * pairing. The brand homepage editor and the villa page editor each carried
 * a copy of these ~400 lines. The copies had drifted: only one hid spacing
 * controls that could not act (a joined pair column, a full-bleed block), and
 * only the other announced its choice groups as radio groups. This is the
 * union of the two, used by both.
 */
import { Field } from "./blockFields";
import { PAD_PRESETS, isBlockBgColor, paintsOwnBackground } from "../../modules/blockStyle";
import FoldSection from "./FoldSection";
import BlockBackgroundImage from "./BlockBackgroundImage";
import { groupTitle } from "./blockCatalogue";
import { RoleTypeControls, radioGroupKeys, showsVAlign } from "./blockForms";
import { bi, type EditorBlock } from "./blockEditorUtils";

export default function BlockStyleInspector({
  selected,
  zh,
  editLocale,
  updateConfig,
  isPairSecond,
}: {
  selected: EditorBlock;
  zh: boolean;
  editLocale: string;
  updateConfig: (id: string, config: Record<string, unknown>) => void;
  /** The selected block is the second column of a pair. */
  isPairSecond: boolean;
}) {
  return (
    <>
      {/* Text formatting */}
      <FoldSection title={groupTitle("text", zh)}>
        {selected.type === "rich_text" ? (
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 8px" }}>
            {zh ? "字體大小／顏色等請用上方文字工具列（WYSIWYG）的「字級」設定。" : "Use the rich-text toolbar (font size / colour) inside the text block above."}
          </p>
        ) : (
          /* blockStyle reads both and all three renderers apply them, but
             only the site-page editor offered the fields — so a homepage
             block had no way to set a size or a line height that the page
             was perfectly willing to honour. Same two controls as the
             other editor, so a block edited from either place has the
             same panel. */
          <>
        {/* Named for what it does, after it was measured doing something
            else. 「字體大小」 reads as "the size of the text in this block"
            and it is not: the options are 12–32px, an absolute figure,
            and a heading given one would sit at the same size as the
            paragraph under it. So it drives the block's BODY — copy,
            lists, captions, and the sub-headings inside body copy, which
            are 1.15em and scale with it. A title has 標題字級 in the role
            panel below. 行距 is a ratio and cannot flatten anything, so
            that one does cover the headings; saying so here is cheaper
            than leaving an editor to discover the difference. */}
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 8px" }}>
          {zh
            ? "基準字級只動內文（含內文裡的小標，會等比跟著）；區塊標題請用下方「標題」的字級。行距則整塊套用，標題也會跟著。"
            : "The base size drives body copy only (sub-headings scale with it); a block title has its own size under the 標題 role below. Line height applies to the whole block, headings included."}
        </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
            <Field label={zh ? "基準字級" : "Base Size"}>
              <select
                value={String(selected.config._fontSize ?? "")}
                onChange={(e) => updateConfig(selected.id, { ...selected.config, _fontSize: e.target.value || undefined })}
              >
                <option value="">{zh ? "預設" : "Default"}</option>
                {["12px","13px","14px","15px","16px","18px","20px","24px","28px","32px"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label={zh ? "行距" : "Line Height"}>
              <select
                value={String(selected.config._lineHeight ?? "")}
                onChange={(e) => updateConfig(selected.id, { ...selected.config, _lineHeight: e.target.value || undefined })}
              >
                <option value="">{zh ? "預設" : "Default"}</option>
                {["1.2","1.4","1.6","1.8","2.0"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          </>
        )}
        <Field label={zh ? "對齊方式" : "Text Align"}>
          {/* radiogroup, not four loose buttons: the choice is one-of-four
              and "is-active" was a colour with nothing behind it, so a
              screen reader announced four identical buttons. */}
          <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={bi(editLocale, "對齊方式", "Text align")}>
            {([
              ["", zh ? "預設" : "Default"],
              ["left", zh ? "靠左" : "Left"],
              ["center", zh ? "置中" : "Center"],
              ["right", zh ? "靠右" : "Right"],
            ] as [string, string][]).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                role="radio"
                aria-checked={(selected.config._textAlign ?? "") === val}
                className={`hpb-variant-pick__btn${(selected.config._textAlign ?? "") === val ? " is-active" : ""}`}
                onClick={() => updateConfig(selected.id, { ...selected.config, _textAlign: val || undefined })}
              >
                {lbl}
              </button>
            ))}
          </div>
        </Field>
        {/* Only side-by-side layouts have a picture to align against;
            on a full-width block the control would do nothing. */}
        {showsVAlign(selected.type, selected.config) && (
          <Field label={zh ? "文字對齊圖片（垂直）" : "Text against the picture"}>
            <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={bi(editLocale, "文字垂直對齊", "Text vertical align")}>
              {([
                ["", zh ? "從圖頂開始" : "From the top"],
                ["center", zh ? "垂直置中" : "Centred"],
                ["bottom", zh ? "貼齊圖底" : "To the bottom"],
              ] as [string, string][]).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  role="radio"
                  aria-checked={(selected.config._textVAlign ?? "") === val}
                  className={`hpb-variant-pick__btn${(selected.config._textVAlign ?? "") === val ? " is-active" : ""}`}
                  onClick={() => updateConfig(selected.id, { ...selected.config, _textVAlign: val || undefined })}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <p className="hpb-field-hint">
              {zh
                ? "預設讓眉批貼齊圖片上緣。「關於」與加了圖片的「圖文分欄」用同一個設定。"
                : "By default the eyebrow sits on the picture's top edge. 關於 and an 圖文分欄 block with a picture share this one setting."}
            </p>
          </Field>
        )}
        {/* Per-role overrides. Not offered on rich_text: that block's
            copy is styled inline by the WYSIWYG toolbar, so a role
            override here would be a control with nothing to act on. */}
        {selected.type !== "rich_text" && (
          <RoleTypeControls
            c={selected.config}
            zh={zh}
            onChange={(cfg) => updateConfig(selected.id, cfg)}
          />
        )}
      </FoldSection>

      {/* Section tag (anchor id) — nav links can jump here via #tag */}
      <FoldSection title={groupTitle("anchor", zh)}>
        <Field label={zh ? "標記名稱（導覽列可用 #標記 跳到此區塊）" : "Anchor id (nav can link via #tag)"}>
          <input
            type="text"
            value={String(selected.config.anchor ?? "")}
            onChange={(e) => {
              // Keep letters (incl. CJK) & digits; spaces → "-"; drop chars
              // that break an id / URL fragment.
              const raw = e.target.value.trim().replace(/\s+/g, "-").replace(/[#?&/\\%"'<>]/g, "").replace(/^-+|-+$/g, "");
              /* By CHARACTER, not by code unit: `slice(0, 64)` cuts an
                 astral character (CJK Ext, an emoji) in half at the
                 boundary and leaves a lone surrogate, which safeAnchor's
                 negated class happily accepts and which round-trips
                 through UTF-8 as U+FFFD. */
              const v = Array.from(raw).slice(0, 64).join("");
              updateConfig(selected.id, { ...selected.config, anchor: v || undefined });
            }}
            placeholder={zh ? "例如 about、rooms、contact" : "e.g. about, rooms, contact"}
            style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
          />
        </Field>
      </FoldSection>

      {/* Block spacing — one vertical value so top and bottom always match.

          Withheld entirely from a 併入上一組 block: it stacks INSIDE the
          second column of a pair, and blockPairs strips both padding
          keys off every joined block, so both numbers would save and
          neither reach the page. The pair's own two blocks keep theirs:
          the first supplies top and left, the second bottom and right. */}
      {selected.config._pairJoin !== true && (
      <FoldSection title={groupTitle("spacing", zh)}>
        {/* The second column of a pair has no top padding of its own
            (the first column supplies it), only the horizontal one. */}
        {!isPairSecond && (
        <Field label={zh ? "上下留白" : "Vertical"}>
          <div className="a-u-row-center">
            <select className="a-u-grow"
              value={selected.config._padY === undefined ? "" : String(selected.config._padY)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") { const { _padY, ...rest } = selected.config as Record<string, unknown>; void _padY; updateConfig(selected.id, rest); }
                else updateConfig(selected.id, { ...selected.config, _padY: Number(v) });
              }}
            >
              <option value="">{zh ? "預設" : "Default"}</option>
              {PAD_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{(zh ? p.zh : p.en) + " (" + p.value + "px)"}</option>
              ))}
            </select>
            {/* A Field's <label> only names its FIRST control, so in
                every one of these two-control rows the second was
                announced as an unnamed spin button. */}
            <input className="a-u-w-72"
              type="number" min={0} max={400} placeholder="px"
              aria-label={bi(editLocale, "上下留白（px）", "Vertical padding (px)")}
              value={selected.config._padY === undefined ? "" : String(selected.config._padY)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") { const { _padY, ...rest } = selected.config as Record<string, unknown>; void _padY; updateConfig(selected.id, rest); }
                else updateConfig(selected.id, { ...selected.config, _padY: Number(v) });
              }}
            />
          </div>
        </Field>
        )}
        {/* Hidden on a full-bleed block: the section re-bleeds to the
            window there and pads with 0, so a number saved here would
            never reach the page. */}
        {selected.config.full_bleed !== true && (
        <Field label={zh ? "左右留白" : "Horizontal"}>
          <div className="a-u-row-center">
            <select className="a-u-grow"
              value={selected.config._padX === undefined ? "" : String(selected.config._padX)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") { const { _padX, ...rest } = selected.config as Record<string, unknown>; void _padX; updateConfig(selected.id, rest); }
                else updateConfig(selected.id, { ...selected.config, _padX: Number(v) });
              }}
            >
              <option value="">{zh ? "預設" : "Default"}</option>
              {PAD_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{(zh ? p.zh : p.en) + " (" + p.value + "px)"}</option>
              ))}
            </select>
            <input className="a-u-w-72"
              type="number" min={0} max={400} placeholder="px"
              aria-label={bi(editLocale, "左右留白（px）", "Horizontal padding (px)")}
              value={selected.config._padX === undefined ? "" : String(selected.config._padX)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") { const { _padX, ...rest } = selected.config as Record<string, unknown>; void _padX; updateConfig(selected.id, rest); }
                else updateConfig(selected.id, { ...selected.config, _padX: Number(v) });
              }}
            />
          </div>
        </Field>
        )}
      </FoldSection>
      )}

      {/* Background color */}
      <FoldSection title={groupTitle("surface", zh)}>
        {/* Withheld from a block that paints its own background — see
            SELF_PAINTING_BLOCK_TYPES in blockStyle. The newsletter has
            its own 背景顏色 field in its own form, which writes
            `bg_color`; offering the generic `_bgColor` here as well gave
            one block two colour controls that disagreed, and setting
            this one painted the band AND a 100vw wrapper behind it,
            which is also what stopped the block's own 版面寬度 →
            留白置中 from ever being visible. 版面寬度 below stays: that
            one IS this panel's to set. */}
        {!paintsOwnBackground(selected.type) && (
        <Field label={zh ? "背景顏色" : "Background Color"}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="color"
              value={String(selected.config._bgColor ?? "#ffffff")}
              onChange={(e) => updateConfig(selected.id, { ...selected.config, _bgColor: e.target.value })}
              style={{ width: 40, height: 32, cursor: "pointer", border: "1px solid var(--line)", borderRadius: 4 }}
            />
            <input
              type="text"
              value={String(selected.config._bgColor ?? "")}
              onChange={(e) => updateConfig(selected.id, { ...selected.config, _bgColor: e.target.value || undefined })}
              placeholder="#ffffff"
              aria-label={bi(editLocale, "背景顏色代碼", "Background colour hex code")}
              style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
            />
            {typeof selected.config._bgColor === "string" && selected.config._bgColor && (
              <button
                type="button"
                onClick={() => {
                  const { _bgColor, _bgOpacity, ...rest } = selected.config as Record<string, unknown>;
                  updateConfig(selected.id, rest);
                }}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)", fontSize: 12, textDecoration: "underline" }}
              >
                {zh ? "清除" : "Clear"}
              </button>
            )}
          </div>
          {/* The box beside the swatch is free text, and blockStyle
              paints nothing at all for a value hexToRgb rejects — no
              colour, and no full-bleed band either. Measured on the
              preview route: `_bgColor: "red"` renders the block with no
              inline style. Said here, at the point of typing, the same
              way the 官方網站 field already reports an address the card
              will drop. */}
          {typeof selected.config._bgColor === "string"
            && selected.config._bgColor.trim() !== ""
            && !isBlockBgColor(selected.config._bgColor) && (
            <p style={{ color: "#b3261e", fontSize: 11, lineHeight: 1.5, margin: "-6px 0 10px" }}>
              {zh
                ? "色碼要寫成 #ffffff 或 #fff。照現在這樣存檔，這個區塊不會有背景色。"
                : "The code must be written as #ffffff or #fff. Saved as written, this block gets no background at all."}
            </p>
          )}
        </Field>
        )}
        {/* Only where it can do something. blockStyle reads _bgOpacity
            inside the branch that needs a usable colour, so with none
            set the slider moved, saved a number, and changed nothing —
            with no error to notice. And blockStyle now refuses that
            branch outright for a self-painting block, so a legacy
            `_bgColor` left in one of those configs must not bring the
            slider back either. */}
        {!paintsOwnBackground(selected.type) && isBlockBgColor(selected.config._bgColor) && (
        <Field label={zh ? "透明度" : "Opacity"}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="a-u-grow"
              type="range"
              min="0"
              max="100"
              value={Number(selected.config._bgOpacity ?? 100)}
              onChange={(e) => updateConfig(selected.id, { ...selected.config, _bgOpacity: Number(e.target.value) })}
            />
            <span style={{ fontSize: 11, color: "var(--muted)", minWidth: 32, textAlign: "right" }}>
              {Number(selected.config._bgOpacity ?? 100)}%
            </span>
          </div>
        </Field>
        )}
        {/* Withheld on the same terms as the colour: a self-painting
            block draws its own surface, and a picture behind it would
            be covered by the band it paints. */}
        {!paintsOwnBackground(selected.type) && (
          <BlockBackgroundImage
            value={selected.config._bgImage}
            zh={zh}
            onChange={(url) => {
              if (url) { updateConfig(selected.id, { ...selected.config, _bgImage: url }); return; }
              const { _bgImage, ...rest } = selected.config as Record<string, unknown>;
              void _bgImage;
              updateConfig(selected.id, rest);
            }}
          />
        )}
        {/* Folded in with the background rather than kept as a
            collapsible section of its own: it is one switch, and it
            decides how far the background it sits under reaches. Two
            folds for one decision meant an editor could set a colour
            and not see the control that makes it span the window. */}
        <div style={{ marginTop: 14 }}>
          <div className="hpb-insp__row-txt" style={{ marginBottom: 6 }}>
            {zh ? "版面寬度" : "Width"}
          </div>
        <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={bi(editLocale, "滿版", "Full bleed")}>
          {([
            [false, zh ? "留白置中" : "Contained"],
            [true, zh ? "滿版貼邊" : "Full bleed"],
          ] as [boolean, string][]).map(([val, lbl]) => (
            <button
              key={String(val)}
              type="button"
              role="radio"
              aria-checked={(selected.config.full_bleed === true) === val}
              className={`hpb-variant-pick__btn${(selected.config.full_bleed === true) === val ? " is-active" : ""}`}
              onClick={() => updateConfig(selected.id, { ...selected.config, full_bleed: val || undefined })}
            >
              {lbl}
            </button>
          ))}
          </div>
        </div>
      </FoldSection>

      {/* Side-by-side Pair */}
      <FoldSection title={groupTitle("pair", zh)}>
        <div className="hpb-insp__row">
          <div>
            <div className="hpb-insp__row-txt">{zh ? "與下一個區塊並列" : "Pair with next block"}</div>
            <div className="hpb-insp__row-sub">{zh ? "啟用後兩個區塊左右並排" : "Two blocks side by side"}</div>
          </div>
          <button
            type="button"
            className={`hpb-switch${selected.config._pairNext ? " is-on" : ""}`}
            onClick={() => updateConfig(selected.id, { ...selected.config, _pairNext: !selected.config._pairNext || undefined })}
            role="switch"
            aria-checked={!!selected.config._pairNext}
            aria-label={zh ? "並列開關" : "Pair toggle"}
          />
        </div>
        {!!selected.config._pairNext && (
          <>
            <div className="hpb-insp__row">
              <div>
                <div className="hpb-insp__row-txt">{zh ? "排列方向" : "Direction"}</div>
              </div>
              <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={bi(editLocale, "排列方向", "Direction")}>
                {([["row", "左右並排", "Side by side"], ["column", "上下並排", "Stacked"]] as const).map(([val, zhL, enL]) => (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={(selected.config._pairDirection ?? "row") === val}
                    className={`hpb-variant-pick__btn${(selected.config._pairDirection ?? "row") === val ? " is-active" : ""}`}
                    onClick={() => updateConfig(selected.id, { ...selected.config, _pairDirection: val === "row" ? undefined : val })}
                  >
                    {zh ? zhL : enL}
                  </button>
                ))}
              </div>
            </div>
            <div className="hpb-insp__row">
              <div>
                <div className="hpb-insp__row-txt">
                  {zh ? ((selected.config._pairDirection === "column") ? "上下對調" : "左右對調") : (selected.config._pairDirection === "column" ? "Swap top/bottom" : "Swap left/right")}
                </div>
              </div>
              <button
                type="button"
                className={`hpb-switch${selected.config._pairReverse ? " is-on" : ""}`}
                onClick={() => updateConfig(selected.id, { ...selected.config, _pairReverse: !selected.config._pairReverse || undefined })}
                role="switch"
                aria-checked={!!selected.config._pairReverse}
                aria-label={zh ? "對調開關" : "Reverse toggle"}
              />
            </div>
          </>
        )}
        {/* A pair holds two columns; this puts a block into the second
            one rather than leaving it full width below — e.g. a feature
            list belonging under the text it describes. */}
        <div className="hpb-insp__row">
          <div>
            <div className="hpb-insp__row-txt">{zh ? "併入上一組並列" : "Join the pair above"}</div>
            <div className="hpb-insp__row-sub">
              {zh ? "接在上一個區塊下方，共用同一欄" : "Stacks under the previous block, same column"}
            </div>
          </div>
          <button
            type="button"
            className={`hpb-switch${selected.config._pairJoin ? " is-on" : ""}`}
            onClick={() => updateConfig(selected.id, { ...selected.config, _pairJoin: !selected.config._pairJoin || undefined })}
            role="switch"
            aria-checked={!!selected.config._pairJoin}
            aria-label={zh ? "併入開關" : "Join toggle"}
          />
        </div>
      </FoldSection>
    </>
  );
}
