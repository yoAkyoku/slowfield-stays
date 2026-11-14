"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Banner } from "../api";
import type { Locale } from "../i18n";
import { cfgT, trs } from "../tr";
import { isVideoUrl, loadHeroImageUrl, preloadImageUrl, videoPosterUrl } from "../media";
import { cssUrl } from "../safeCss";
import { safeCssColor } from "../fontPresets";
import { roleTypeVars } from "../blockStyle";
import { safeLinkHref } from "../safeHtml";
import { slideMs } from "../slideTiming";
import { swipeDirection, swipePoint, type SwipePoint } from "../swipe";
import { resolveHeroScrollLabel } from "../heroScrollLabel";

// Per-banner title size tokens → responsive font-size. Empty = CSS default.
const TITLE_SIZE_MAP: Record<string, string> = {
  sm: "clamp(30px, 4.2vw, 56px)",
  md: "clamp(40px, 6vw, 92px)",
  lg: "clamp(48px, 7.5vw, 116px)",
  xl: "clamp(56px, 9vw, 140px)",
};

const VIDEO_FIRST_FRAME_TIMEOUT_MS = 30_000;

export default function HomeHeroCarousel({
  banners,
  eyebrow,
  fallbackTitle,
  fallbackSubtitle,
  config,
  locale = "en"
}: {
  banners: Banner[];
  /** When the hero is placed as a block, its own images and copy win over the
      CMS banners — otherwise every field on the block's form did nothing. */
  config?: Record<string, unknown>;
  eyebrow: string;
  fallbackTitle: string;
  fallbackSubtitle: string;
  locale?: Locale;
}) {
  // Images set on the block replace the banners entirely; a block with none
  // falls back to them, which is what an untouched hero block does.
  const slides = useMemo(() => {
    const own = Array.isArray(config?.images) ? (config!.images as Array<unknown>) : [];
    const fromBlock = own
      .map((raw) => (typeof raw === "string" ? { url: raw } : (raw as Record<string, unknown>)))
      .map((o, i) => ({
        id: -(i + 1),
        image_url: String(o?.url ?? o?.image_url ?? ""),
        title: String(o?.title ?? ""),
        subtitle: String(o?.subtitle ?? ""),
        translations: (o?.translations ?? {}) as Record<string, unknown>,
      }))
      .filter((b) => b.image_url);
    if (fromBlock.length) return fromBlock as unknown as Banner[];
    return banners.filter((banner) => banner.image_url);
  }, [banners, config]);
  /* The hero block's own settings. The editor offers 高度, 標題（顯示於第一張）,
     副標 and two colour pickers, and this component read none of them — only
     `images` — so five controls saved and did nothing. A per-banner value
     still wins where one exists; these are the block-level defaults. */
  const blockHeight = ["small", "medium", "large", "full"].includes(String(config?.height ?? ""))
    ? String(config?.height)
    : "";
  const blockTitle = cfgT(config ?? {}, "title", locale ?? "zh");
  const blockSubtitle = cfgT(config ?? {}, "subtitle", locale ?? "zh");
  const blockScrollLabel = resolveHeroScrollLabel(config?.scroll_label, locale ?? "zh");
  const blockTitleColor = safeCssColor(config?.titleColor);
  const blockSubtitleColor = safeCssColor(config?.subtitleColor);
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const autoplayPaused = focused || hovered || manuallyPaused;
  const activeVideoRef = useRef<HTMLVideoElement>(null);
  const [readyVideoUrls, setReadyVideoUrls] = useState<Set<string>>(() => new Set());
  const previousIndexRef = useRef<number | null>(null);
  const failedVideoIndexes = useRef(new Set<number>());
  const active = slides[index] ?? slides[0];
  const ctaLabel = (active ? trs(active, "cta_label", locale) : "")
    || (locale === "zh" ? "預約入住" : "Reserve a stay");
  const ctaHref = safeLinkHref(active?.cta_href) || "/stays";
  const storyCtaLabel = (active ? trs(active, "story_cta_label", locale) : "")
    || (locale === "zh" ? "品牌故事" : "Our story");
  const storyCtaHref = safeLinkHref(active ? trs(active, "story_cta_href", locale) : "") || "/brand";
  const scrollLabel = resolveHeroScrollLabel(
    active?.translations?.[locale]?.scroll_label ?? active?.scroll_label,
    locale,
    blockScrollLabel,
  );

  // Per-banner hero style (title size + alignment), stored in translations._style.
  const heroStyle = ((active?.translations as Record<string, unknown> | undefined)?._style ?? {}) as {
    size?: string;
    align?: string;
    valign?: string;
    textShadow?: string;
    textBg?: string;
    textBgOpacity?: string;
  };
  const titleSize =
    heroStyle.size && Object.prototype.hasOwnProperty.call(TITLE_SIZE_MAP, heroStyle.size)
      ? TITLE_SIZE_MAP[heroStyle.size]
      : undefined;
  /* The banner's own choice, or nothing. It used to collapse "unset" into
     "center" and then write that inline on .hero-content — an inline
     declaration outranks everything, so a hero block set to 靠左 in the
     inspector was overridden by a centre nobody had chosen (客戶: 檢查所有
     block 的設置是否生效). The centre default now lives in the stylesheet,
     where the block-level setting can outrank it. */
  const bannerAlign = heroStyle.align === "left" || heroStyle.align === "right" || heroStyle.align === "center"
    ? heroStyle.align
    : "";
  const align = bannerAlign || "center";
  // Vertical placement of the hero copy. Centred unless a banner says otherwise,
  // which is what every existing banner does.
  const valign = heroStyle.valign === "top" || heroStyle.valign === "bottom" ? heroStyle.valign : "center";
  const textShadow = heroStyle.textShadow === "soft" || heroStyle.textShadow === "strong"
    ? heroStyle.textShadow
    : "";
  const textBg = safeCssColor(heroStyle.textBg);
  const parsedTextBgOpacity = Number(heroStyle.textBgOpacity);
  const textBgOpacity = Number.isFinite(parsedTextBgOpacity)
    ? Math.min(80, Math.max(0, parsedTextBgOpacity))
    : 35;
  /* Per-role type for this banner, in the same shape and through the same
     sanitisers as a block's. `_style` above stays: it is the whole-hero
     setting (one size, one alignment, vertical placement), and these are the
     per-role overrides that sit on top of it — the eyebrow, title, subtitle
     and button each read their own variable in globals.css, so a centred title
     no longer drags the subtitle with it. Read from the ACTIVE slide, so a
     carousel can style each banner differently. */
  const roleVars = roleTypeVars((active?.translations as Record<string, unknown> | undefined) ?? {});

  const selectSlide = useCallback((nextIndex: number) => {
    setIndex((current) => {
      previousIndexRef.current = current;
      return (nextIndex + slides.length) % slides.length;
    });
    setCycle((value) => value + 1);
  }, [slides.length]);

  const goTo = useCallback((nextIndex: number) => {
    if (!slides.length) return;
    const targetIndex = (nextIndex + slides.length) % slides.length;
    const target = slides[targetIndex];
    const showTarget = () => selectSlide(targetIndex);
    if (target && !isVideoUrl(target.image_url)) {
      void loadHeroImageUrl(target.image_url, "high").then(showTarget);
    } else {
      showTarget();
    }
  }, [selectSlide, slides]);

  useEffect(() => {
    if (slides.length <= 1) return;
    if (autoplayPaused) return;
    // Images use the configured dwell time. A video owns its duration and
    // advances through onEnded below, so a 15-second clip is never cut off by
    // the default 6.5-second image timer.
    if (isVideoUrl(active?.image_url)) return;
    let cancelled = false;
    let timer: number | undefined;
    void loadHeroImageUrl(active.image_url, "high").then(() => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        const nextIndex = (index + 1) % slides.length;
        const next = slides[nextIndex];
        const showNext = () => {
          if (cancelled) return;
          selectSlide(nextIndex);
        };
        if (next && !isVideoUrl(next.image_url)) {
          void loadHeroImageUrl(next.image_url, "high").then(showNext);
        } else {
          showNext();
        }
      }, slideMs((active as unknown as Record<string, unknown>)?.slide_seconds ?? config?.slide_seconds));
    });
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
    /* `active` and the block's slide_seconds are read above and belong here.
       Leaving them out happened to work — the effect re-runs on every `cycle`,
       and `cycle` advances with every slide, so the banner's own duration was
       never more than one slide stale. The block-level setting was: changing
       輪播秒數 in the editor did not take effect until the carousel moved on
       by itself. Both are stable references (`active` comes from a memoised
       list), so naming them re-runs the effect no more often than before. */
  }, [cycle, index, slides, active, config?.slide_seconds, autoplayPaused, selectSlide]);

  const skipBrokenVideo = useCallback((brokenIndex: number) => {
    failedVideoIndexes.current.add(brokenIndex);
    for (let offset = 1; offset < slides.length; offset += 1) {
      const candidate = (brokenIndex + offset) % slides.length;
      if (!isVideoUrl(slides[candidate]?.image_url) || !failedVideoIndexes.current.has(candidate)) {
        goTo(candidate);
        return;
      }
    }
    // Every video failed and there is no image fallback. Stay put instead of
    // repeatedly mounting the same broken videos in a tight error loop.
  }, [goTo, slides]);

  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video || !isVideoUrl(active?.image_url)) return;
    if (autoplayPaused) video.pause();
    else if (video.ended && slides.length > 1) goTo(index + 1);
    else void video.play().catch(() => skipBrokenVideo(index));
  }, [active, autoplayPaused, goTo, index, skipBrokenVideo, slides.length]);

  useEffect(() => {
    const activeVideo = slides[index];
    if (!activeVideo || !isVideoUrl(activeVideo.image_url) || readyVideoUrls.has(activeVideo.image_url)) return;

    // Some failed media requests never dispatch `error` or `loadeddata`.
    // Keep the server poster visible while loading, then move on only if no
    // frame was decoded. Once a frame arrives, the video owns its full duration
    // and advances through `onEnded` below.
    const timer = window.setTimeout(() => skipBrokenVideo(index), VIDEO_FIRST_FRAME_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [index, readyVideoUrls, skipBrokenVideo, slides]);

  /* Only the active slide (and the previous one during its fade-out) gets a
     CSS background below. Warming the next still after the first paint keeps
     the handoff smooth without making mobile browsers fetch every hero image at
     once. Video slides warm their poster, not the full video file. */
  useEffect(() => {
    if (slides.length < 2) return;
    const next = slides[(index + 1) % slides.length];
    const nextUrl = next
      ? (isVideoUrl(next.image_url) ? videoPosterUrl(next.image_url) : next.image_url)
      : "";
    if (!nextUrl) return;
    const timer = window.setTimeout(() => preloadImageUrl(nextUrl), 800);
    return () => window.clearTimeout(timer);
  }, [index, slides]);

  /* Swipe. The dots were the only way to move this by hand, and on a phone they
     are four 24px targets at the foot of a full-screen photo — 客戶: 手機版沒有
     滑動功能. Bumping `cycle` through goTo also restarts the auto-advance timer,
     so the slide someone just pulled in gets its full turn rather than the
     remainder of the previous one's. */
  const touchRef = useRef<SwipePoint | null>(null);
  /* A swipe ends with the browser synthesising a click, and this hero is full of
     links — the two CTAs. Without this, dragging the photo sideways with a thumb
     that happened to start on 預約入住 would navigate. Cleared on the next
     touchstart rather than after use, so a real tap that follows a swipe still
     goes through, and a mouse (which never sets it) is untouched. */
  const swipedRef = useRef(false);

  return (
    <section
      className={`hero hero-carousel hero--v-${valign}${blockHeight ? ` hero--h-${blockHeight}` : ""}`}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") setHovered(false); }}
      onTouchStart={(e) => {
        swipedRef.current = false;
        touchRef.current = slides.length > 1 ? swipePoint(e.touches[0]) : null;
      }}
      onTouchEnd={(e) => {
        if (!touchRef.current) return;
        const direction = swipeDirection(touchRef.current, swipePoint(e.changedTouches[0]));
        touchRef.current = null;
        if (!direction) return;
        swipedRef.current = true;
        goTo(index + direction);
      }}
      /* Capture, so the click is stopped before it reaches the link that would
         act on it. */
      onClickCapture={(e) => {
        if (!swipedRef.current) return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {slides.map((banner, slideIndex) => {
        const videoSlide = isVideoUrl(banner.image_url);
        const posterUrl = videoSlide ? videoPosterUrl(banner.image_url) : "";
        const videoReady = videoSlide && readyVideoUrls.has(banner.image_url);
        return (
          <div
            aria-hidden={slideIndex !== index}
            className={`hero-slide${slideIndex === index ? " is-active" : ""}${videoSlide ? ` hero-slide--video ${videoReady ? "is-video-ready" : "is-video-loading"}` : ""}`}
            key={banner.id}
            style={(slideIndex === index || slideIndex === previousIndexRef.current)
              ? { backgroundImage: cssUrl(videoSlide ? posterUrl : banner.image_url) }
              : undefined}
          >
          {videoSlide && slideIndex === index && (
            /* Muted and inline so it can autoplay at all — a browser blocks a
               hero video with sound, and a hero that will not start is worse
               than a still. */
            <video
              ref={activeVideoRef}
              src={banner.image_url}
              poster={posterUrl || undefined}
              autoPlay={!autoplayPaused}
              muted
              loop={slides.length <= 1}
              playsInline
              preload="auto"
              onCanPlay={(event) => {
                if (autoplayPaused) event.currentTarget.pause();
                else void event.currentTarget.play().catch(() => skipBrokenVideo(slideIndex));
              }}
              onLoadedData={() => setReadyVideoUrls((current) => {
                if (current.has(banner.image_url)) return current;
                const next = new Set(current);
                next.add(banner.image_url);
                return next;
              })}
              onEnded={() => !autoplayPaused && slides.length > 1 && goTo(index + 1)}
              onError={() => slides.length > 1 && skipBrokenVideo(slideIndex)}
            />
          )}
          </div>
        );
      })}
      <div
        /* Remounted per slide so the copy's entrance animation (site-refresh.css)
           plays for each banner, not only the first. */
        key={active?.id ?? index}
        className={`hero-content${textShadow ? ` hero-copy--shadow-${textShadow}` : ""}${textBg ? " hero-copy--background" : ""}`}
        style={{
          /* Only written when this banner chose one, so an unset banner leaves
             the block-level 對齊方式 free to apply. */
          ...(bannerAlign ? { textAlign: bannerAlign as "left" | "center" | "right" } : {}),
          ...(bannerAlign === "center" ? { marginLeft: "auto", marginRight: "auto" } : {}),
          ...(bannerAlign === "right" ? { marginLeft: "auto", marginRight: "0" } : {}),
          ...(bannerAlign === "left" ? { marginLeft: "0", marginRight: "auto" } : {}),
          ...(titleSize ? ({ "--hero-title-size": titleSize } as React.CSSProperties) : {}),
          ...(textBg ? ({
            "--hero-copy-bg": textBg,
            "--hero-copy-bg-opacity": `${textBgOpacity}%`,
          } as React.CSSProperties) : {}),
          ...(roleVars as React.CSSProperties),
        }}
      >
        <div className="eyebrow">{eyebrow}</div>
        {/* An inline colour beats a variable, so the block-level colour is only
            written when this banner's title role has not set one of its own —
            otherwise the more specific choice would be the one ignored. */}
        <h1 style={blockTitleColor && !roleVars["--r-title-color"] ? { color: blockTitleColor } : undefined}>
          {(active ? trs(active, "title", locale) : "") || blockTitle || fallbackTitle}
        </h1>
        <p
          style={{
            /* The auto margins centre the subtitle with the whole hero. A
               subtitle given its own alignment has to be free of them, or the
               block would keep pulling it back to the middle. */
            ...(align === "center" && !roleVars["--r-body-align"] ? { marginLeft: "auto", marginRight: "auto" } : {}),
            ...(blockSubtitleColor && !roleVars["--r-body-color"] ? { color: blockSubtitleColor } : {}),
          }}
        >
          {(active ? trs(active, "subtitle", locale) : "") || blockSubtitle || fallbackSubtitle}
        </p>
        {/* --r-cta-self carries the button role's own alignment already mapped
            to the flex keywords; it wins over the hero-wide one when set. */}
        <div
          className="hero-ctas"
          style={{
            justifyContent:
              roleVars["--r-cta-self"]
              ?? (align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start"),
          }}
        >
          {/* The banner's own call to action. Both fields existed on every
              banner and neither was read: the label was editable in the admin
              and thrown away, and the button always went to /stays however the
              banner was worded. The href is checked before use — it is admin
              text that becomes a link. */}
          <Link className="hero-cta hero-cta--primary" href={ctaHref}>
            {ctaLabel}
          </Link>
          <Link className="hero-cta hero-cta--ghost" href={storyCtaHref}>
            {storyCtaLabel}
          </Link>
        </div>
      </div>
      <div className="hero-scroll" aria-hidden="true">
        <span>{scrollLabel}</span>
        <span className="hero-scroll-line" />
      </div>
      {slides.length > 1 ? (
        <div className="hero-carousel-controls" aria-label="Banner carousel controls">
          <div className="hero-dots">
            {slides.map((banner, slideIndex) => (
              <button
                aria-label={`Show banner ${slideIndex + 1}`}
                className={slideIndex === index ? "is-active" : ""}
                key={banner.id}
                type="button"
                onClick={() => goTo(slideIndex)}
              >
                <span
                  key={`${slideIndex === index ? cycle : "idle"}-${autoplayPaused}`}
                  style={{
                    animationDuration: `${slideMs((active as unknown as Record<string, unknown>)?.slide_seconds ?? config?.slide_seconds)}ms`,
                    ...(autoplayPaused ? { animation: "none", transform: "scaleX(1)" } : {}),
                  }}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="hero-pause"
            aria-label={manuallyPaused ? (locale === "zh" ? "繼續輪播" : "Resume carousel") : (locale === "zh" ? "暫停輪播" : "Pause carousel")}
            aria-pressed={manuallyPaused}
            onClick={() => {
              setManuallyPaused(value => !value);
              // Explicit resume wins over focus/hover on this stable control.
              // Focusing a CTA or entering again still pauses the next cycle.
              setFocused(false);
              setHovered(false);
            }}
          >
            {manuallyPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          </button>
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            Banner {index + 1} of {slides.length}
          </div>
        </div>
      ) : null}
    </section>
  );
}
