"use client";

import { useEffect, useState } from "react";
import { useAdminSiteSlug } from "./AdminSiteContext";
import { adminProxyUrl } from "../../modules/apiBase";
import type { MediaPickerAsset } from "./MediaPickerThumbnail";

type UploadedAsset = { id?: number; url: string; file?: string; display_name?: string; alt?: string; alt_text?: string; poster_url?: string };

/** A signed-out admin is sent to the login page rather than shown a failure. */
function toLoginIf401(response: Response): boolean {
  if (response.status !== 401) return false;
  window.location.href = "/admin/login";
  return true;
}

/**
 * The media library behind an image field: load it when the picker opens,
 * filter it by a search box, and upload a new file into it.
 *
 * The block editors' image field and the stay editor's hero field each had
 * their own copy of the fetch, the 401 hand-off, the upload and the search
 * filter. The library is reloaded each time the picker opens, so a file
 * deleted or renamed elsewhere is not offered from a stale list.
 */
export default function useMediaLibrary(open: boolean, messages: { loadFailed: string; uploadFailed: string }) {
  const siteSlug = useAdminSiteSlug();
  const [assets, setAssets] = useState<MediaPickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(adminProxyUrl("/admin/media", siteSlug), { signal: controller.signal })
      .then(async (response) => {
        if (toLoginIf401(response)) throw new Error("unauthorized");
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as MediaPickerAsset[];
      })
      .then((result) => { if (!controller.signal.aborted) setAssets(result); })
      .catch(() => { if (!controller.signal.aborted) setError(messages.loadFailed); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, siteSlug, messages.loadFailed]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? assets.filter((a) => [a.display_name, a.alt, a.alt_text, a.url, a.file].filter(Boolean).join(" ").toLowerCase().includes(q))
    : assets;

  /** Upload a file; resolves to its URL, or null (with `error` set) if it failed. */
  async function upload(file: File): Promise<string | null> {
    setUploading(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("alt_text", file.name);
    try {
      const response = await fetch(adminProxyUrl("/admin/media", siteSlug), { method: "POST", body: form });
      if (toLoginIf401(response) || !response.ok) {
        setError(messages.uploadFailed);
        return null;
      }
      const asset = (await response.json()) as UploadedAsset;
      setAssets((current) => [{ id: asset.id ?? Date.now(), url: asset.url, file: asset.file, display_name: asset.display_name, alt: asset.alt, alt_text: asset.alt_text, poster_url: asset.poster_url }, ...current]);
      return asset.url;
    } catch {
      setError(messages.uploadFailed);
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { assets, filtered, loading, uploading, error, setError, query, setQuery, upload };
}
