"use client";

import { ImagePlus, Images, Search } from "lucide-react";
import { useRef, useState } from "react";
import { useAdminPermission } from "../../modules/AdminSiteContext";
import useMediaLibrary from "../../modules/useMediaLibrary";
import MediaUploadRequirements from "../../modules/MediaUploadRequirements";
import VideoThumbnail from "../../modules/VideoThumbnail";
import { videoPosterUrl } from "../../../modules/media";
import { MediaPickerGrid } from "../../modules/MediaPickerThumbnail";
import { Button, buttonClass, Dialog, Field, Input, SearchInput, Stack } from "../../ui";
import "./stays.css";

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
  const canUpload = useAdminPermission("media:write");
  const canBrowse = useAdminPermission("media:read");
  const [url, _setUrl] = useState(defaultValue);
  const setUrl = (v: string) => { _setUrl(v); onChange?.(v); };
  const [showLibrary, setShowLibrary] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // The library, its search and the upload (shared with the block image field).
  const {
    assets, filtered: filteredAssets, loading: loadingLibrary, uploading: busy, error,
    query: mediaQuery, setQuery: setMediaQuery, upload: uploadFile,
  } = useMediaLibrary(showLibrary, { loadFailed: labels.failed, uploadFailed: labels.failed });

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const uploaded = await uploadFile(file);
    if (!uploaded) return;
    setUrl(uploaded);
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
            <MediaPickerGrid assets={filteredAssets} selectedUrl={url} onPick={(assetUrl) => { setUrl(assetUrl); setShowLibrary(false); }} />
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
