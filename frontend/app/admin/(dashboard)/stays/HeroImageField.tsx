"use client";

import { ImagePlus, Images, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAdminSiteSlug, useAdminPermission } from "../../modules/AdminSiteContext";
import MediaUploadRequirements from "../../modules/MediaUploadRequirements";
import VideoThumbnail from "../../modules/VideoThumbnail";
import { videoPosterUrl } from "../../../modules/media";
import MediaPickerThumbnail, { type MediaPickerAsset } from "../../modules/MediaPickerThumbnail";
import { Button, buttonClass, Dialog, Field, Input, SearchInput, Stack } from "../../ui";
import "./stays.css";

type MediaAsset = MediaPickerAsset;

function proxyUrl(apiPath: string, site: string) {
  return `/admin/api/proxy?path=${encodeURIComponent(apiPath)}&site=${encodeURIComponent(site)}`;
}

export default function HeroImageField({
  defaultValue,
  fieldName = "hero_image_url",
  mediaKind = "media",
  labels,
  onChange
}: {
  defaultValue: string;
  fieldName?: string;
  mediaKind?: "media" | "logo" | "hero";
  labels: {
    added: string;
    failed: string;
    imageUrl: string;
    upload: string;
    uploading: string;
    selectFromLibrary: string;
    loadingLibrary: string;
    noLibraryImages: string;
    useThisImage: string;
    searchPlaceholder?: string;
  };
  onChange?: (url: string) => void;
}) {
  const siteSlug = useAdminSiteSlug();
  const canUpload = useAdminPermission("media:write");
  const canBrowse = useAdminPermission("media:read");
  const [url, _setUrl] = useState(defaultValue);
  const setUrl = (v: string) => { _setUrl(v); onChange?.(v); };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [mediaQuery, setMediaQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredAssets = assets.filter((a) => {
    if (!mediaQuery.trim()) return true;
    const q = mediaQuery.toLowerCase();
    const name = [a.display_name, a.alt, a.alt_text, a.url, a.file].filter(Boolean).join(" ").toLowerCase();
    return name.includes(q);
  });

  useEffect(() => {
    if (!showLibrary) return;
    const controller = new AbortController();
    const site = siteSlug;
    setLoadingLibrary(true);
    setError("");
    fetch(proxyUrl("/admin/media", site), { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as MediaAsset[];
      })
      .then((result) => { if (!controller.signal.aborted) setAssets(result); })
      .catch(() => { if (!controller.signal.aborted) setError(labels.failed); })
      .finally(() => { if (!controller.signal.aborted) setLoadingLibrary(false); });
    return () => controller.abort();
  }, [labels.failed, showLibrary, siteSlug]);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("alt_text", file.name);
    const site = siteSlug;
    const response = await fetch(proxyUrl("/admin/media", site), {
      method: "POST",
      body: formData
    });
    setBusy(false);
    if (response.status === 401) {
      window.location.href = "/admin/login";
      setError(labels.failed);
      return;
    }
    if (!response.ok) {
      setError(labels.failed);
      return;
    }
    const asset = (await response.json()) as { id?: number; url: string; file?: string; display_name?: string; alt?: string; alt_text?: string; poster_url?: string };
    setUrl(asset.url);
    setAssets((current) => [{ id: asset.id ?? Date.now(), url: asset.url, file: asset.file, display_name: asset.display_name, alt: asset.alt, alt_text: asset.alt_text, poster_url: asset.poster_url }, ...current]);
    setShowLibrary(true);
  }

  return (
    <div className="hero-image-field">
      {url ? (
        /\.(mp4|webm)$/i.test(url) ? (
          <VideoThumbnail src={url} poster={videoPosterUrl(url)} label="Banner video cover" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", background: "#000" }} />
        ) : (
          <img src={url} alt="" />
        )
      ) : <div className="hero-image-placeholder" />}
      <input type="hidden" name={fieldName} value={url} />
      <Field className="hero-image-field-url" label={labels.imageUrl}>
        <Input value={url} onChange={(event) => setUrl(event.target.value)} />
      </Field>
      <div className="hero-image-field-buttons">
        {canUpload && (
          <label className={buttonClass({ size: "sm" })} aria-busy={busy || undefined}>
            <ImagePlus />
            <span>{busy ? labels.uploading : labels.upload}</span>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept={mediaKind === "logo" ? ".png,.svg,image/png,image/svg+xml" : "image/*,video/mp4,video/webm"}
              onChange={upload}
            />
          </label>
        )}
        {canBrowse && (
          <Button icon={<Images />} onClick={() => setShowLibrary(true)} size="sm">
            {labels.selectFromLibrary}
          </Button>
        )}
      </div>
      <MediaUploadRequirements kind={mediaKind} />
      <Dialog onClose={() => setShowLibrary(false)} open={showLibrary} size="lg" title={labels.selectFromLibrary}>
        <Stack>
          {!loadingLibrary && assets.length > 0 && (
            <SearchInput
              autoFocus
              icon={<Search />}
              placeholder={labels.searchPlaceholder ?? "Search..."}
              value={mediaQuery}
              onChange={(e) => setMediaQuery(e.target.value)}
            />
          )}
          {loadingLibrary ? <p className="meta">{labels.loadingLibrary}</p> : null}
          {!loadingLibrary && assets.length === 0 ? <p className="meta">{labels.noLibraryImages}</p> : null}
          {!loadingLibrary && filteredAssets.length ? (
            <div className="media-inline-library-grid">
              {filteredAssets.map((asset) => {
                const assetUrl = asset.url ?? asset.file ?? "";
                if (!assetUrl) return null;
                return (
                  <MediaPickerThumbnail
                    key={asset.id}
                    asset={asset}
                    assetUrl={assetUrl}
                    selected={url === assetUrl}
                    onSelect={() => { setUrl(assetUrl); setShowLibrary(false); }}
                  />
                );
              })}
            </div>
          ) : null}
          {!loadingLibrary && assets.length > 0 && filteredAssets.length === 0 && (
            <p className="meta" style={{ textAlign: "center", padding: "24px 0" }}>
              {labels.noLibraryImages}
            </p>
          )}
        </Stack>
      </Dialog>
      {error && <p className="meta">{error}</p>}
    </div>
  );
}
