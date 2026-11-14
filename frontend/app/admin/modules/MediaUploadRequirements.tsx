export default function MediaUploadRequirements({
  className = "media-upload-requirements",
  kind = "media",
}: {
  className?: string;
  kind?: "media" | "logo" | "hero";
}) {
  if (kind === "logo") {
    return (
      <small className={className}>
        Logo：1200 × 320 px、透明背景｜PNG／SVG｜上限 100 MB
      </small>
    );
  }

  if (kind === "hero") {
    return (
      <small className={className}>
        Banner：1920 × 1080（16:9）｜H.264 MP4／WebM｜建議 20 MB 內，單檔上限 100 MB
      </small>
    );
  }

  return (
    <small className={className}>
      圖片 Images：1920 × 1080 px｜JPG／PNG／WebP／AVIF／GIF／SVG　影片 Video：16:9｜MP4／WebM　單檔 Max：100 MB
    </small>
  );
}
