"use client";

import { useEffect, useRef } from "react";
import { isSafeUrl } from "../../safeHtml";
import { cssUrl } from "../../safeCss";
import "leaflet/dist/leaflet.css";

export type MapMarker = { name: string; lat: number; lng: number; desc?: string; image?: string; link?: string };

function esc(s: string) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/**
 * Free multi-pin map (Leaflet + OpenStreetMap) — no API key, no Google account.
 * Markers are admin-managed { name, lat, lng, desc }. Auto-fits to all markers.
 */
export default function LeafletMap({ markers, height = 460, locale = "zh" }: { markers: MapMarker[]; height?: number; locale?: string }) {
  // The popup CTA used to be a hardcoded Chinese string, so the English site
  // sent its visitors a 查看民宿 link. Resolved out here rather than inside the
  // effect: the effect's dependency list stays exactly as it shipped, and the
  // language toggle navigates rather than re-rendering in place, so a locale
  // change remounts this component anyway.
  const ctaLabel = locale === "en" ? "View the villa →" : "查看民宿 →";
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    // Hover opens a marker's card and it stays open while the pointer is on the
    // pin OR on the card — the gap between the two would otherwise close it
    // before anyone could reach the link. One timer for the whole map, so
    // sliding from one pin to the next swaps cards without a flicker.
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelClose = () => { if (closeTimer) { clearTimeout(closeTimer); closeTimer = undefined; } };
    // Assigned once the map exists; declared here so the cleanup below can
    // detach the pane listeners even if the effect is torn down mid-load.
    let detachPane: (() => void) | undefined;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;
      const valid = (markers || []).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

      const map = L.map(ref.current, { scrollWheelZoom: false });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Kept alive while the pointer is on the card, not just on the pin — the
      // card carries the villa's link, so closing it on the way there would
      // make the link unreachable by pointer.
      //
      // The listeners go on the popup pane, which the map creates once, rather
      // than on each popup as it opens: a per-popup listener attached in
      // `popupopen` did not hold in practice (measured — the card still closed
      // when the pointer reached it), and the pane is one stable element that
      // exists before any popup does. mouseover/mouseout bubble, so moving
      // between the image, the title and the button inside the card schedules a
      // close and cancels it in the same tick, well inside the grace window.
      const scheduleClose = () => {
        cancelClose();
        closeTimer = setTimeout(() => map.closePopup(), 140);
      };
      const popupPane = map.getPane("popupPane");
      if (popupPane) {
        popupPane.addEventListener("mouseover", cancelClose);
        popupPane.addEventListener("mouseout", scheduleClose);
        detachPane = () => {
          popupPane.removeEventListener("mouseover", cancelClose);
          popupPane.removeEventListener("mouseout", scheduleClose);
        };
      }

      /* One icon per marker, carrying the place name beside the dot. A map of
         several places with identical unlabelled dots made the visitor hover
         each one to find out which was which; the name is escaped like every
         other string that reaches this markup. */
      const pinIcon = (name: string) => L.divIcon({
        className: "leaflet-pin",
        html: `<span></span>${name ? `<b class="leaflet-pin-label">${esc(name)}</b>` : ""}`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -12],
      });

      const pts: [number, number][] = [];
      for (const m of valid) {
        const mk = L.marker([m.lat, m.lng], { icon: pinIcon(m.name || "") }).addTo(map);
        // The divIcon marker is a focusable role="button" with no text, so it
        // reached the keyboard as an unnamed control. Name it after the place.
        const markerEl = mk.getElement();
        if (markerEl && m.name) {
          const label = locale === "en" ? `Map marker: ${m.name}` : `地圖標記：${m.name}`;
          markerEl.setAttribute("aria-label", label);
          markerEl.setAttribute("title", m.name);
        }
        const safeLink = m.link && isSafeUrl(m.link) ? m.link : "";
        const safeImg = m.image && isSafeUrl(m.image) ? m.image : "";
        // esc() leaves "'" alone, so an apostrophe in the URL closed the quoted
        // url() and let the rest of the value become further declarations.
        const bgImg = cssUrl(safeImg);
        if (m.name || m.desc || safeImg) {
          const inner =
            `${bgImg ? `<span class="map-popup-img" style="background-image:${esc(bgImg)}"></span>` : ""}` +
            `<span class="map-popup-body"><strong>${esc(m.name)}</strong>${m.desc ? `<span class="map-popup-desc">${esc(m.desc)}</span>` : ""}` +
            `${safeLink ? `<span class="map-popup-cta">${esc(ctaLabel)}</span>` : ""}</span>`;
          const html = safeLink
            ? `<a class="map-popup" href="${esc(safeLink)}">${inner}</a>`
            : `<div class="map-popup">${inner}</div>`;
          // autoPan off: panning to fit the card slides the pin out from under
          // the cursor, which fires mouseout and closes the card that was just
          // opened. No close button — the pointer leaving is the way out, and a
          // tap elsewhere still closes it on touch.
          mk.bindPopup(html, { minWidth: 200, maxWidth: 240, autoPan: false, closeButton: false });

          // Click still opens it: hover does not exist on touch, and it is the
          // only way in from the keyboard.
          mk.on("mouseover", () => { cancelClose(); mk.openPopup(); });
          mk.on("mouseout", scheduleClose);
        }
        pts.push([m.lat, m.lng]);
      }

      if (pts.length === 1) map.setView(pts[0], 14);
      // Extra room on the right: each pin's name label hangs off that side.
      else if (pts.length > 1) map.fitBounds(pts, { paddingTopLeft: [42, 42], paddingBottomRight: [190, 42] });
      else map.setView([24.65, 121.78], 11); // Yilan fallback

      // Plain wheel scrolls the page; Ctrl/⌘ + wheel zooms the map (cursor-centred).
      map.getContainer().addEventListener("wheel", (e: any) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        const dir = e.deltaY < 0 ? 1 : -1;
        map.setZoomAround(map.mouseEventToLatLng(e), map.getZoom() + dir);
      }, { passive: false });
    })();

    return () => {
      cancelled = true;
      cancelClose();
      detachPane?.();
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [markers, ctaLabel, locale]);

  return (
    <div className="property-map-leaflet-wrap" style={{ height }}>
      <div ref={ref} className="property-map-leaflet" style={{ height: "100%" }} aria-label="Map" />
      <span className="leaflet-zoom-hint">{locale === "zh" ? "按住 Ctrl 捲動以縮放" : "Hold Ctrl + scroll to zoom"}</span>
    </div>
  );
}
