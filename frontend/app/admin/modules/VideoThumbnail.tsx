"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export default function VideoThumbnail({
  src,
  controls = false,
  className,
  style,
  label,
  poster,
}: {
  src: string;
  controls?: boolean;
  className?: string;
  style?: CSSProperties;
  label?: string;
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [capturedPoster, setCapturedPoster] = useState("");

  useEffect(() => {
    setPosterFailed(false);
    setCapturedPoster("");
  }, [poster, src]);

  const seekToFirstFrame = useCallback((video: HTMLVideoElement) => {
    if (poster && !posterFailed) return;
    if (video.readyState < 1 || !Number.isFinite(video.duration) || video.duration <= 0 || video.currentTime > 0) return;
    video.currentTime = Math.min(0.1, video.duration / 2);
  }, [poster, posterFailed]);

  const captureFirstFrame = useCallback((video: HTMLVideoElement) => {
    if ((poster && !posterFailed) || !video.videoWidth || !video.videoHeight) return;
    if (video.duration > 0 && video.currentTime <= 0) return;

    const scale = Math.min(1, 640 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    try {
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedPoster(canvas.toDataURL("image/jpeg", 0.78));
    } catch {
      // Cross-origin or unsupported sources cannot be captured; the video
      // element itself remains available for playback.
    }
  }, [poster, posterFailed]);

  useEffect(() => {
    if (poster && !posterFailed) return;
    const video = videoRef.current;
    if (video) seekToFirstFrame(video);
  }, [poster, posterFailed, seekToFirstFrame, src]);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        controls={controls}
        muted
        playsInline
        preload="metadata"
        poster={poster && !posterFailed ? poster : capturedPoster || undefined}
        className={className}
        style={style}
        aria-label={label}
        onLoadedMetadata={(event) => seekToFirstFrame(event.currentTarget)}
        onLoadedData={(event) => captureFirstFrame(event.currentTarget)}
        onSeeked={(event) => captureFirstFrame(event.currentTarget)}
      />
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
          onError={() => setPosterFailed(true)}
        />
      )}
    </>
  );
}
