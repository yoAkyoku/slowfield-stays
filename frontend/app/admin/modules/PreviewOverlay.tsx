"use client";

import { createPortal } from "react-dom";
import type { ReactNode, Ref } from "react";
import { Monitor, Smartphone, Tablet, X } from "lucide-react";
import { radioGroupKeys } from "./blockForms";

export type PreviewDevice = "desktop" | "tablet" | "mobile";
export type PreviewSource = "draft" | "saved";

/** Width modifier for the preview frame (`hpb-overlay__frame`). */
export function previewDeviceClass(device: PreviewDevice): string {
  return device === "mobile" ? " is-mobile" : device === "tablet" ? " is-tablet" : "";
}

/**
 * Full-screen live preview shared by the homepage, article and site-page
 * editors: a title, an optional draft/saved switch, the device switch and a
 * close button over a stage the caller fills. Escape / focus handling stays
 * with each editor (they pass their refs in), so behaviour is unchanged.
 */
export default function PreviewOverlay({
  zh,
  title,
  titleId,
  onClose,
  device,
  onDevice,
  source,
  onSource,
  panelRef,
  firstControlRef,
  closeRef,
  children
}: {
  zh: boolean;
  title: ReactNode;
  titleId?: string;
  onClose: () => void;
  device: PreviewDevice;
  onDevice: (device: PreviewDevice) => void;
  /** Omit to hide the draft/saved switch (nothing saved to compare against). */
  source?: PreviewSource;
  onSource?: (source: PreviewSource) => void;
  panelRef?: Ref<HTMLDivElement>;
  firstControlRef?: Ref<HTMLButtonElement>;
  closeRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  if (typeof document === "undefined") return null;
  const t = (zhText: string, enText: string) => (zh ? zhText : enText);
  const sources: Array<[PreviewSource, string]> = [
    ["draft", t("編輯中（未儲存）", "Editing (unsaved)")],
    ["saved", t("已儲存的頁面", "Saved page")]
  ];
  const devices: Array<[PreviewDevice, string, typeof Monitor]> = [
    ["desktop", t("電腦", "Desktop"), Monitor],
    ["tablet", t("平板", "Tablet"), Tablet],
    ["mobile", t("手機", "Mobile"), Smartphone]
  ];
  return createPortal(
    <div className="hpb-overlay" onClick={onClose}>
      <div
        aria-label={titleId ? undefined : typeof title === "string" ? title : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="hpb-overlay__panel"
        onClick={(e) => e.stopPropagation()}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="hpb-overlay__bar">
          <span className="hpb-overlay__title" id={titleId}>{title}</span>
          {source && onSource ? (
            <div aria-label={t("預覽版本", "Preview version")} className="hpb-device" onKeyDown={radioGroupKeys} role="radiogroup">
              {sources.map(([key, name]) => (
                <button aria-checked={source === key} className={source === key ? "is-active" : ""} key={key} onClick={() => onSource(key)} role="radio" title={name} type="button">
                  <span className="hpb-overlay__srcname">{name}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div aria-label={t("預覽裝置", "Preview device")} className="hpb-device" onKeyDown={radioGroupKeys} role="radiogroup">
            {devices.map(([key, name, Icon], i) => (
              <button
                aria-checked={device === key}
                aria-label={name}
                className={device === key ? "is-active" : ""}
                key={key}
                onClick={() => onDevice(key)}
                ref={i === 0 ? firstControlRef : undefined}
                role="radio"
                title={name}
                type="button"
              >
                <Icon />
              </button>
            ))}
          </div>
          <button
            aria-label={t("關閉預覽", "Close preview")}
            className="hpb-insp__close"
            onClick={onClose}
            ref={closeRef}
            title={t("關閉預覽（Esc）", "Close preview (Esc)")}
            type="button"
          >
            <X />
          </button>
        </div>
        <div className="hpb-overlay__stage">{children}</div>
      </div>
    </div>,
    document.body
  );
}
