"use client";

import ImageUploadInput from "../(dashboard)/homepage/ImageUploadInput";
import { Field } from "./blockFields";

/**
 * 背景圖片 for any block, in the 背景與版寬 panel beside the colour it tints with.
 *
 * One component rather than the same JSX twice: the surface panel exists in
 * both HomepageBlockEditor and PropertyBlockEditor, and every control that has
 * been added to it by copy-and-paste has eventually drifted between the two —
 * 區塊並列 / 並排配對 and the two 版型 selects are the entries in blockCatalogue's
 * own preamble about exactly this.
 *
 * The picture is the second layer and the block's 背景顏色 is the first, so the
 * colour and its 透明度 read as "how much wash over the photo". That is why the
 * hint says so at the point of setting it: with no wash, white copy over a pale
 * sky is invisible, and the editor has no way to guess that the colour control
 * a field away is what fixes it.
 */
export default function BlockBackgroundImage({
  value,
  zh,
  onChange,
}: {
  value: unknown;
  zh: boolean;
  onChange: (url: string | undefined) => void;
}) {
  const url = typeof value === "string" ? value : "";
  return (
    <Field label={zh ? "背景圖片（選填）" : "Background image (optional)"}>
      <ImageUploadInput value={url} onChange={(next) => onChange(next || undefined)} />
      {url && (
        <p className="hpb-field-hint">
          {zh
            ? "圖片會滿版鋪滿整個區塊。上面的「背景顏色」與「透明度」會蓋在圖片上當作遮罩——文字是白色時，記得加一層深色遮罩才看得清楚。"
            : "The picture covers the whole block. The background colour and opacity above sit over it as a mask — with white copy, add a dark one so the text stays readable."}
        </p>
      )}
    </Field>
  );
}
