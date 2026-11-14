"use client";

import { X } from "lucide-react";
import { useCallback, useState } from "react";
import { Dialog } from "../../ui";
import { useAdminPermission } from "../../modules/AdminSiteContext";

type StayOption = { id: number; name: string; destination: string; hero_image_url: string };

export default function RelatedStaysPicker({
  defaultValue,
  label,
  stays,
  zh
}: {
  defaultValue: number[];
  label: string;
  stays: StayOption[];
  zh: boolean;
}) {
  const [selected, setSelected] = useState<number[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const canBrowse = useAdminPermission("stays:read");

  const toggle = useCallback((id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const remove = useCallback((id: number) => {
    setSelected((prev) => prev.filter((x) => x !== id));
  }, []);

  // The picker is the kit Dialog: Escape, focus trap, scroll lock and focus
  // restore — a keyboard user must not tab into the form behind it.

  const selectedStays = stays.filter((s) => selected.includes(s.id));

  return (
    <div className="rsp-root">
      <input type="hidden" name="related_stay_ids" value={selected.join(", ")} />
      <span className="rsp-label">{label}</span>

      {/* Selected chips */}
      <div className="rsp-chips">
        {selectedStays.map((s) => (
          <span className="rsp-chip" key={s.id}>
            {s.hero_image_url && <img src={s.hero_image_url} alt="" className="rsp-chip-img" />}
            <span>{s.name}</span>
            <button type="button" onClick={() => remove(s.id)} className="rsp-chip-x"><X size={12} /></button>
          </span>
        ))}
        {canBrowse && <button type="button" className="rsp-open-btn" onClick={() => setOpen(true)}>
          + {zh ? "選擇住宿" : "Select stays"}
        </button>}
        {!canBrowse && <small>{zh ? "關聯設定已保留；查看住宿需住宿檢視權限。" : "Existing links are preserved. Browsing stays requires stay read access."}</small>}
      </div>

      {/* Modal */}
      <Dialog closeLabel={zh ? "關閉" : "Close"} onClose={() => setOpen(false)} open={open} size="lg" title={zh ? "選擇關聯住宿" : "Select Related Stays"}>
            <div className="rsp-grid">
              {stays.map((stay) => {
                const isOn = selected.includes(stay.id);
                return (
                  <button
                    key={stay.id}
                    type="button"
                    className={`rsp-card ${isOn ? "rsp-card--on" : ""}`}
                    onClick={() => toggle(stay.id)}
                  >
                    {stay.hero_image_url ? (
                      <img src={stay.hero_image_url} alt="" className="rsp-card-img" />
                    ) : (
                      <div className="rsp-card-placeholder" />
                    )}
                    <div className="rsp-card-info">
                      <strong>{stay.name}</strong>
                      <small>{stay.destination}</small>
                    </div>
                    {isOn && <span className="rsp-card-check">✓</span>}
                  </button>
                );
              })}
              {stays.length === 0 && (
                <p className="meta">{zh ? "尚無已發布的住宿" : "No published stays"}</p>
              )}
            </div>
      </Dialog>
    </div>
  );
}
