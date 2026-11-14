"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { isVideoAsset, mediaAssetDisplayName, videoPosterUrl } from "../../modules/media";
import VideoThumbnail from "./VideoThumbnail";

export type MediaPickerAsset = {
  id: number;
  url?: string;
  file?: string;
  display_name?: string;
  alt?: string;
  alt_text?: string;
  type?: string;
  poster_url?: string;
};

export default function MediaPickerThumbnail({
  asset,
  assetUrl,
  selected,
  onSelect,
}: {
  asset: MediaPickerAsset;
  assetUrl: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const [posterIndex, setPosterIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const video = isVideoAsset(asset);
  const name = mediaAssetDisplayName(asset, assetUrl);
  // Prefer the current versioned poster URL so an existing row cannot keep
  // showing an older black frame while its database value is being refreshed.
  const posterUrls = [videoPosterUrl(assetUrl), asset.poster_url]
    .filter((poster): poster is string => Boolean(poster))
    .filter((poster, index, all) => all.indexOf(poster) === index);
  const posterUrl = posterUrls[posterIndex];

  return (
    <button
      type="button"
      className={`media-inline-thumb${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      aria-label={`Use ${name}`}
      title={name}
    >
      {video ? (
        posterUrl ? (
          <img src={posterUrl} alt="" loading="lazy" onError={() => setPosterIndex((index) => index + 1)} />
        ) : (
          <VideoThumbnail src={assetUrl} label={name} />
        )
      ) : (
        imageFailed ? (
          <span className="media-inline-thumb__fallback" aria-hidden="true"><ImageOff size={26} /></span>
        ) : (
          <img src={assetUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        )
      )}
      <span className="media-inline-thumb__name" title={name}>{name}</span>
    </button>
  );
}
