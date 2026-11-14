"use client";

import { useEffect, useRef } from "react";
import { useTransition } from "react";
import type { AdminSite } from "./adminApi";
import { setAdminSiteCookie } from "./adminSiteCookie";

export default function SiteSwitcher({
  current, cookieSlug, label, sites, collapsed = false,
}: { current: string; cookieSlug: string; label: string; sites: AdminSite[]; collapsed?: boolean }) {
  const [, startTransition] = useTransition();
  const selected = sites.some((site) => site.slug === current) ? current : sites[0]?.slug ?? current;
  const cookieFixed = useRef(false);

  // If the cookie names a site the user can't access, fix it once on mount via
  // the server action (which CAN mutate cookies) and hard-reload so every page
  // (incl. client-state editors) re-mounts with the corrected site.
  //
  // Compared against `cookieSlug`, not `current`: the layout already resolves
  // `current` to a slug it knows is valid, so `selected !== current` was never
  // true and this whole effect was dead code. The visible symptom was a sidebar
  // naming one site while every request underneath it still carried the stale
  // slug from the cookie — and, once that slug stopped resolving at all, an
  // admin that could not be recovered without logging in again.
  useEffect(() => {
    if (cookieFixed.current) return;
    if (selected && selected !== cookieSlug && sites.length > 0) {
      cookieFixed.current = true;
      startTransition(async () => {
        await setAdminSiteCookie(selected);
        window.location.reload();
      });
    }
  }, [selected, cookieSlug, sites.length]);

  function changeSite(slug: string) {
    startTransition(async () => {
      await setAdminSiteCookie(slug);
      // Hard reload, not router.refresh(): many admin editors (首頁編輯、
      // 站點編輯…) seed their state from props via useState on mount and
      // ignore later prop changes, so router.refresh() leaves them showing
      // the previous site's data. A full reload re-mounts everything with
      // the new site's cookie.
      window.location.reload();
    });
  }

  const selectedSite = sites.find((site) => site.slug === selected);
  // Collapsed rail: the select still drives everything (so switching keeps
  // working at every width), but it sits invisibly over a one-glyph badge —
  // otherwise the rail has no room for a full-width control and, before this,
  // simply dropped it, hiding both the switcher and which site was in edit.
  // `||`, not `??`: a site saved with a blank name would otherwise render an
  // empty badge rather than falling back to the slug.
  const badge = ((selectedSite?.name || selected) ?? "").trim().charAt(0).toUpperCase();

  return (
    <label className={`admin-site-switcher${collapsed ? " admin-site-switcher--collapsed" : ""}`}>
      {collapsed ? (
        <span className="admin-site-switcher-badge" aria-hidden="true">{badge}</span>
      ) : (
        <span>{label}</span>
      )}
      <select
        value={selected}
        onChange={(event) => changeSite(event.target.value)}
        aria-label={collapsed ? `${label}: ${selectedSite?.name ?? selected}` : undefined}
        title={collapsed ? selectedSite?.name ?? selected : undefined}
      >
        {sites.map((site) => (
          <option key={site.slug} value={site.slug}>
            {site.name}
          </option>
        ))}
      </select>
    </label>
  );
}
