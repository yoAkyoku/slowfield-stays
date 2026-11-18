"use client";

import { Search, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useAdminPermission } from "../../modules/AdminSiteContext";
import useMediaLibrary from "../../modules/useMediaLibrary";
import { isVideoUrl, videoPosterUrl } from "../../../modules/media";
import MediaUploadRequirements from "../../modules/MediaUploadRequirements";
import VideoThumbnail from "../../modules/VideoThumbnail";
import { MediaPickerGrid } from "../../modules/MediaPickerThumbnail";
import { Button, buttonClass, Dialog, Field, Input, SearchInput, Stack } from "../../ui";

export default function ImageUploadInput({
  value,
  onChange,
  placeholder = "https://…",
  uploadLabel,
  libraryLabel,
  hideRemove = false
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  uploadLabel?: string;
  libraryLabel?: string;
  hideRemove?: boolean;
}) {
  const canUpload = useAdminPermission("media:write");
  const canBrowse = useAdminPermission("media:read");
  const fileRef = useRef<HTMLInputElement>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const urlId = useId();
  /* The library, its search and the upload (shared with the stay hero field).
     The picker itself is the kit Dialog: focus moves in, Tab stays inside,
     Escape closes it and the page behind holds still. */
  const {
    assets, filtered: filteredAssets, loading: loadingLibrary, uploading, error,
    query: mediaQuery, setQuery: setMediaQuery, upload: uploadFile,
  } = useMediaLibrary(showLibrary, { loadFailed: "媒體庫載入失敗 Failed to load library", uploadFailed: "上傳失敗 Upload failed" });

  async function upload(file: File) {
    const url = await uploadFile(file);
    if (url) onChange(url);
  }

  const isVideo = isVideoUrl(value);

  return (
    <div className="img-pick">
      {value ? (
        <div className="img-pick__preview">
          {isVideo ? (
            <VideoThumbnail src={value} poster={videoPosterUrl(value)} label="Video preview" />
          ) : (
            <img src={value} alt="" />
          )}
          {!hideRemove && (
            <button
              type="button"
              className="img-pick__remove"
              onClick={() => onChange("")}
              aria-label="移除圖片 Remove image"
              title="移除圖片 Remove image"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : canUpload ? (
        <label className="img-pick__drop">
          <Upload size={18} />
          <span>{uploading ? "…" : (uploadLabel || "上傳圖片 Upload")}</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/mp4,video/webm"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
        </label>
      ) : null}

      <div className="img-pick__bar">
        {value && canUpload && (
          <label className={buttonClass({ size: "sm" })}>
            <Upload />
            <span>{uploading ? "…" : (uploadLabel || "更換 Replace")}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm"
              style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }}
            />
          </label>
        )}
        {canBrowse && (
          <Button icon={<Search />} onClick={() => setShowLibrary(true)} size="sm">
            {libraryLabel || "媒體庫 Media"}
          </Button>
        )}
      </div>
      <MediaUploadRequirements />

      {/* Unlabelled, this box read as a required field: an author who had just
          uploaded a photo saw an address they were apparently meant to fill in.
          Naming it says what it is, an alternative to the two buttons above. */}
      {/* .meta is the admin's existing small-label style, so the field reads
          like the rest of the form instead of needing a class of its own. */}
      <Field error={error || undefined} htmlFor={urlId} label={"或貼上網址 Or paste a URL"}>
        <Input
          id={urlId}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
        />
      </Field>

      <Dialog closeLabel="關閉 Close" onClose={() => setShowLibrary(false)} open={showLibrary} size="lg" title={libraryLabel || "媒體庫 Media Library"}>
        <Stack>
          {!loadingLibrary && assets.length > 0 && (
            <SearchInput
              aria-label="搜尋媒體 Search media"
              autoFocus
              icon={<Search />}
              placeholder="搜尋… Search…"
              value={mediaQuery}
              onChange={(e) => setMediaQuery(e.target.value)}
            />
          )}
          {loadingLibrary && <p className="meta" style={{ padding: "24px 0", textAlign: "center" }}>{"載入中… Loading…"}</p>}
          {!loadingLibrary && assets.length === 0 && <p className="meta" style={{ padding: "24px 0", textAlign: "center" }}>{"沒有圖片 No images found"}</p>}
          {!loadingLibrary && filteredAssets.length > 0 && (
            <MediaPickerGrid assets={filteredAssets} selectedUrl={value} onPick={(assetUrl) => { onChange(assetUrl); setShowLibrary(false); }} />
          )}
          {!loadingLibrary && assets.length > 0 && filteredAssets.length === 0 && (
            <p className="meta" style={{ textAlign: "center", padding: "24px 0" }}>
              {"沒有符合的圖片 No matching images"}
            </p>
          )}
        </Stack>
      </Dialog>
    </div>
  );
}
