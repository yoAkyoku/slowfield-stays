/** Media type detection, shared by the site renderers and the admin library.
 *
 *  This lived in six places and had drifted three ways: two of the copies
 *  ignored the query string, so a cache-busted hero like hero.mp4?v=2 was
 *  treated as a still image, and the renderers disagreed with the admin about
 *  whether .mov counts as a video — the library would label an upload a video
 *  and the page would then try to paint it as a background image. */

export const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi"] as const;

/** True when a URL points at a video file, so it should play rather than be
 *  shown as a still. Query strings and fragments are ignored. */
export function isVideoUrl(url: unknown): boolean {
  const path = String(url ?? "").toLowerCase().split(/[?#]/)[0];
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(`.${ext}`));
}

/** True when a library asset is a video. The recorded MIME type wins; the file
 *  extension is the fallback for rows uploaded before it was stored. */
export function isVideoAsset(asset: {
  type?: string | null;
  url?: string | null;
  file?: string | null;
}): boolean {
  if ((asset.type ?? "").toLowerCase().startsWith("video/")) return true;
  return isVideoUrl(asset.url || asset.file);
}

/** Prefer the user-visible name retained at upload/rename time. Older rows
 *  fall back to their original alt-text filename and then the stored key. */
export function mediaAssetDisplayName(asset: {
  display_name?: string | null;
  alt_text?: string | null;
  file?: string | null;
  url?: string | null;
}, fallbackUrl?: string): string {
  const savedName = asset.display_name?.trim() || asset.alt_text?.trim();
  if (savedName) return savedName;

  const raw = asset.file || asset.url || fallbackUrl || "";
  const path = raw.split(/[?#]/, 1)[0];
  const name = path.slice(path.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(name) || "Unnamed media";
  } catch {
    return name || "Unnamed media";
  }
}

/** The server stores a versioned JPEG beside each locally uploaded video. */
export function videoPosterUrl(url: unknown): string {
  const raw = String(url ?? "");
  const [path] = raw.split(/[?#]/);
  if (!path.startsWith("/storage/media/") || !isVideoUrl(path)) return "";
  return path.replace(/\.(mp4|webm|mov|avi)$/i, ".poster-v2.jpg");
}

const heroImageLoads = new Map<string, Promise<boolean>>();

/** Resolve only after the requested hero image has loaded and decoded. Failed
 * requests are removed from the cache so a later attempt can retry. */
export function loadHeroImageUrl(url: unknown, priority: "high" | "low" = "low"): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const src = String(url ?? "").trim();
  if (!src) return Promise.resolve(false);

  const existing = heroImageLoads.get(src);
  if (existing) return existing;

  let resolveLoad!: (loaded: boolean) => void;
  const request = new Promise<boolean>((resolve) => { resolveLoad = resolve; });
  let settled = false;
  const finish = (loaded: boolean) => {
    if (settled) return;
    settled = true;
    if (!loaded) heroImageLoads.delete(src);
    resolveLoad(loaded);
  };

  let image: HTMLImageElement;
  try {
    image = new window.Image();
  } catch {
    return Promise.resolve(false);
  }
  image.setAttribute("fetchpriority", priority);
  image.decoding = "async";
  const finishDecodedImage = () => {
    if (image.naturalWidth <= 0) {
      finish(false);
      return;
    }
    if (typeof image.decode === "function") {
      void image.decode().then(() => finish(true), () => finish(image.naturalWidth > 0));
    } else {
      finish(true);
    }
  };
  image.onload = finishDecodedImage;
  image.onerror = () => finish(false);
  heroImageLoads.set(src, request);
  image.src = src;
  if (image.complete) finishDecodedImage();
  return request;
}

/**
 * Warm one hero image in the browser cache without putting every carousel
 * slide in the document as a background image. The active slide is painted by
 * CSS; this is deliberately limited to the next slide. Callers that switch to
 * the image can await loadHeroImageUrl instead of assuming the warmup finished.
 */
export function preloadImageUrl(url: unknown): void {
  const src = String(url ?? "").trim();
  if (!src || typeof window === "undefined") return;

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  void loadHeroImageUrl(src, "low");
}

/**
 * A YouTube watch/share/Shorts URL → its embed URL, or "" for anything else.
 *
 * Shared with the admin block editor's live preview, which had its own answer:
 * `url.includes("youtube")` and then a `<a target="_blank">` tile in every
 * case. So an editor pasting a YouTube link saw a black "YOUTUBE / https://…"
 * card that opens a new tab, while the published page rendered an iframe and
 * played in place. The client's 「不希望每次都跳轉 YouTube」 describes the
 * preview, not the site — the site already did what they were asking for.
 *
 * Returning the URL rather than a boolean is what makes the two agree: the
 * preview cannot say "YouTube" for a link this function cannot turn into a
 * player (a channel page, a playlist, youtube.com/ with no id).
 */
export function youtubeEmbedUrl(rawUrl: unknown): string {
  const id = youtubeId(rawUrl);
  return id ? `https://www.youtube.com/embed/${id}` : "";
}

/**
 * The video id out of a watch / share / Shorts URL, or "".
 *
 * Validated rather than passed through: the id is interpolated into URLs that
 * become an iframe src and an img src, so anything that is not an id must come
 * back empty rather than reaching a page. Every real id is 11 characters of
 * [A-Za-z0-9_-]; the range is loose enough to survive YouTube changing that.
 */
export function youtubeId(rawUrl: unknown): string {
  let id = "";
  try {
    const url = new URL(String(rawUrl ?? ""));
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      id = url.pathname.slice(1);
    } else if (host.endsWith("youtube.com")) {
      id = url.pathname.startsWith("/shorts/")
        ? url.pathname.split("/")[2] ?? ""
        : url.searchParams.get("v") ?? "";
    }
  } catch {
    return "";
  }
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : "";
}

/**
 * The poster frame for a YouTube video, as an ordinary image URL.
 *
 * An email cannot play a video: every major client drops <iframe>, so a
 * newsletter that "embeds" one shows a blank gap. What newsletters do instead
 * is a poster image wrapped in a link, which is only <a> and <img> and
 * therefore renders everywhere. hqdefault, not maxresdefault: the latter is
 * absent for plenty of videos and would 404 into a broken image.
 */
export function youtubePosterUrl(rawUrl: unknown): string {
  const id = youtubeId(rawUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

/** Which platform a video URL belongs to, for the fallback tile's label. Only
 *  YouTube embeds; the rest are shown as a link out, which is why the field
 *  help has to name them honestly. */
export function platformForUrl(rawUrl: unknown): "youtube" | "instagram" | "tiktok" | "unknown" {
  try {
    const host = new URL(String(rawUrl ?? "")).hostname.replace(/^www\./, "");
    if (host.includes("youtube") || host === "youtu.be") return "youtube";
    if (host.includes("instagram")) return "instagram";
    if (host.includes("tiktok")) return "tiktok";
  } catch {
    return "unknown";
  }
  return "unknown";
}
