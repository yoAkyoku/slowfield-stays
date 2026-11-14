"use client";

import { Film, ImagePlus, LayoutGrid, List, Search, Trash2, X } from "lucide-react";
import { Badge, Button, Dialog, DialogActions, Input, SearchInput, Segmented, Toolbar } from "../../ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminMedia } from "../../modules/adminApi";
import AdminEmptyState from "../../modules/AdminEmptyState";
import CopyMediaButton from "./CopyMediaButton";
import DeleteMediaButton from "./DeleteMediaButton";
import RenameMediaButton from "./RenameMediaButton";
import VideoThumbnail from "../../modules/VideoThumbnail";

import { useAdminSiteSlug } from "../../modules/AdminSiteContext";
import { isVideoAsset, videoPosterUrl } from "../../../modules/media";
import { formatDateTime } from "../../../modules/datetime";

function proxyUrl(apiPath: string, site: string) {
  return `/admin/api/proxy?path=${encodeURIComponent(apiPath)}&site=${encodeURIComponent(site)}`;
}

type MediaCopy = {
  mediaSearch: string;
  mediaDate: string;
  mediaDateFrom: string;
  mediaDateTo: string;
  mediaAllDates: string;
  mediaGrid: string;
  mediaList: string;
  mediaGridTitle: string;
  mediaListTitle: string;
  mediaView: string;
  mediaUploaded: string;
  mediaAltReady: string;
  mediaAltMissing: string;
  mediaNoResults: string;
  mediaCopy: string;
  mediaCopied: string;
  mediaDelete: string;
  mediaDeleting: string;
  mediaRename: string;
  mediaRenameSave: string;
  mediaRenameCancel: string;
  mediaRenamePlaceholder: string;
  mediaRenameError: string;
  mediaDeleteConfirm: string;
  adminConfirmCancel: string;
  adminConfirmMediaDeleteAction: string;
  adminConfirmMediaDeleteTitle: string;
  mediaFilterAll: string;
  mediaFilterImages: string;
  mediaFilterVideos: string;
  bulkSelectAll: string;
  bulkSelected: string;
  bulkDeleteSelected: string;
  bulkConfirmTitle: string;
  bulkConfirmText: string;
};

type MediaTypeFilter = "all" | "image" | "video";
const MEDIA_PAGE_SIZE = 48;

function mediaDate(asset: AdminMedia) {
  if (!asset.created_at) return "";
  return asset.created_at.slice(0, 10);
}

function formatUploaded(value: string | undefined) {
  return formatDateTime(value);
}

export default function MediaLibraryView({
  canWrite,
  media: initialMedia,
  totalCount,
  imageCount,
  videoCount,
  copy,
  zh,
}: {
  canWrite: boolean;
  media: AdminMedia[];
  totalCount: number;
  imageCount: number;
  videoCount: number;
  copy: MediaCopy;
  zh: boolean;
}) {
  const router = useRouter();
  const siteSlug = useAdminSiteSlug();
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>("all");
  const [media, setMedia] = useState(initialMedia);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MEDIA_PAGE_SIZE);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMedia(initialMedia), [initialMedia]);

  const fetchMore = useCallback(async (limit = MEDIA_PAGE_SIZE, replace = false) => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const skip = replace ? 0 : media.length;
      const response = await fetch(proxyUrl(`/admin/media?limit=${limit}&skip=${skip}`, siteSlug));
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!response.ok) return;
      const incoming = await response.json() as AdminMedia[];
      setMedia((current) => {
        if (replace) return incoming;
        const seen = new Set(current.map((asset) => asset.id));
        return [...current, ...incoming.filter((asset) => !seen.has(asset.id))];
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, media.length, siteSlug]);

  // A filter must search the whole library. The unfiltered first paint stays
  // small; entering a query or date loads the remaining metadata on demand.
  useEffect(() => {
    if (!(query || dateFrom || dateTo || typeFilter !== "all")) return;
    if (media.length >= totalCount || loadingMore) return;
    void fetchMore(Math.min(totalCount, 5000), true);
  }, [dateFrom, dateTo, fetchMore, loadingMore, media.length, query, totalCount, typeFilter]);

  const filteredMedia = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return media.filter((asset) => {
      const searchable = [asset.display_name, asset.file, asset.alt, asset.alt_text, asset.type, asset.url].filter(Boolean).join(" ");
      const uploadedDate = mediaDate(asset);
      const matchesQuery = !keyword || searchable.toLowerCase().includes(keyword);
      const matchesFrom = !dateFrom || (!!uploadedDate && uploadedDate >= dateFrom);
      const matchesTo = !dateTo || (!!uploadedDate && uploadedDate <= dateTo);
      const matchesDate = matchesFrom && matchesTo;
      if (typeFilter === "video" && !isVideoAsset(asset)) return false;
      if (typeFilter === "image" && isVideoAsset(asset)) return false;
      return matchesQuery && matchesDate;
    });
  }, [dateFrom, dateTo, media, query, typeFilter]);

  useEffect(() => {
    setSelectedIds(new Set());
    setVisibleCount(MEDIA_PAGE_SIZE);
  }, [query, dateFrom, dateTo, typeFilter]);

  const visibleMedia = useMemo(
    () => filteredMedia.slice(0, visibleCount),
    [filteredMedia, visibleCount],
  );

  useEffect(() => {
    if (selectAllRef.current) {
      const total = filteredMedia.length;
      const count = selectedIds.size;
      selectAllRef.current.checked = total > 0 && count === total;
      selectAllRef.current.indeterminate = count > 0 && count < total;
    }
  }, [selectedIds, filteredMedia.length]);

  const toggleId = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredMedia.length) return new Set();
      return new Set(filteredMedia.map((a) => a.id));
    });
  }, [filteredMedia]);

  const bulkDelete = useCallback(async () => {
    setConfirming(false);
    setDeleting(true);
    const site = siteSlug;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const response = await fetch(proxyUrl(`/admin/media/${id}`, site), { method: "DELETE" });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
    }
    setDeleting(false);
    setSelectedIds(new Set());
    router.refresh();
  }, [selectedIds, router, siteSlug]);

  return (
    <>
      <Toolbar
        end={
          <Segmented
            ariaLabel="Media view mode"
            onChange={setMode}
            options={[
              { value: "grid", label: copy.mediaGrid, icon: <LayoutGrid /> },
              { value: "list", label: copy.mediaList, icon: <List /> }
            ]}
            size="sm"
            value={mode}
          />
        }
      >
        <SearchInput icon={<Search />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.mediaSearch} />
        <span className="a-muted">{copy.mediaDateFrom}</span>
        <Input aria-label={copy.mediaDateFrom} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} type="date" />
        <span className="a-muted">{copy.mediaDateTo}</span>
        <Input aria-label={copy.mediaDateTo} value={dateTo} onChange={(event) => setDateTo(event.target.value)} type="date" />
        {(query || dateFrom || dateTo) && (
          <Button
            icon={<X />}
            onClick={() => {
              setQuery("");
              setDateFrom("");
              setDateTo("");
            }}
            variant="ghost"
          >
            {copy.mediaAllDates}
          </Button>
        )}
      </Toolbar>

      <Toolbar>
        <Segmented
          ariaLabel="Media type filter"
          onChange={setTypeFilter}
          options={[
            { value: "all", label: `${copy.mediaFilterAll} (${totalCount})` },
            { value: "image", label: `${copy.mediaFilterImages} (${imageCount})`, icon: <ImagePlus /> },
            { value: "video", label: `${copy.mediaFilterVideos} (${videoCount})`, icon: <Film /> }
          ]}
          size="sm"
          value={typeFilter}
        />
      </Toolbar>

      {canWrite && (
        <div className="ml-bulk">
          <label className="a-check">
            <input ref={selectAllRef} type="checkbox" onChange={toggleAll} />
            <span className="a-check__text"><span>{copy.bulkSelectAll}</span></span>
          </label>
          {selectedIds.size > 0 && (
            <>
              <span className="ml-bulk__count">
                {selectedIds.size} {copy.bulkSelected}
              </span>
              <Button disabled={deleting} icon={<Trash2 />} onClick={() => setConfirming(true)} size="sm" variant="danger">
                {deleting ? copy.mediaDeleting : copy.bulkDeleteSelected}
              </Button>
            </>
          )}
        </div>
      )}

      <section className={mode === "grid" ? "ml-grid" : "ml-list"}>
        {visibleMedia.map((asset) => {
          const assetIsVideo = isVideoAsset(asset);
          return (
            <article className={mode === "grid" ? "ml-card" : "ml-row"} key={asset.id}>
              {canWrite && (
                <input
                  type="checkbox"
                  className="bulk-select-checkbox"
                  aria-label={asset.display_name || asset.file}
                  checked={selectedIds.has(asset.id)}
                  onChange={() => toggleId(asset.id)}
                />
              )}
              {assetIsVideo ? (
                <VideoThumbnail
                  src={asset.url || asset.file}
                  poster={asset.poster_url || videoPosterUrl(asset.url || asset.file)}
                  controls
                  label={asset.display_name || asset.alt || asset.file}
                  style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", background: "#000" }}
                />
              ) : asset.url || asset.file ? (
                <img src={asset.url || asset.file} alt={asset.alt || asset.file} loading="lazy" decoding="async" />
              ) : (
                <div className="ml-empty">
                  <ImagePlus size={24} />
                </div>
              )}
              <div className="ml-meta">
                {assetIsVideo && <div><Badge tone="info">VIDEO</Badge></div>}
                <strong>{asset.display_name || asset.alt || asset.file}</strong>
                <span>
                  {asset.type} · {copy.mediaUploaded}: {formatUploaded(asset.created_at)}
                </span>
                <code title={asset.url ?? asset.file}>{asset.url ?? asset.file}</code>
              </div>
              <div className="ml-actions">
                <CopyMediaButton url={asset.url ?? asset.file} labels={{ copy: copy.mediaCopy, copied: copy.mediaCopied }} />
                {canWrite ? (
                  <>
                    <RenameMediaButton
                      id={asset.id}
                      name={asset.display_name || asset.file}
                      labels={{
                        rename: copy.mediaRename,
                        save: copy.mediaRenameSave,
                        cancel: copy.mediaRenameCancel,
                        placeholder: copy.mediaRenamePlaceholder,
                        error: copy.mediaRenameError,
                      }}
                      onRenamed={(displayName) => setMedia((items) => items.map((item) => item.id === asset.id ? { ...item, display_name: displayName } : item))}
                    />
                    <DeleteMediaButton
                      id={asset.id}
                      labels={{
                        cancel: copy.adminConfirmCancel,
                        delete: copy.mediaDelete,
                        deleting: copy.mediaDeleting,
                        confirm: copy.mediaDeleteConfirm,
                        title: copy.adminConfirmMediaDeleteTitle
                      }}
                      zh={zh}
                    />
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
      {filteredMedia.length === 0 && <AdminEmptyState text={copy.mediaNoResults} title={copy.mediaNoResults} />}

      {(visibleCount < filteredMedia.length || media.length < totalCount) && (
        <div className="ml-more">
          <span>{zh ? `已載入 ${media.length} / ${totalCount}` : `Loaded ${media.length} of ${totalCount}`}</span>
          <Button
            disabled={loadingMore}
            onClick={() => {
              if (visibleCount < filteredMedia.length) setVisibleCount((count) => count + MEDIA_PAGE_SIZE);
              else void fetchMore();
            }}
          >
            {loadingMore ? (zh ? "載入中…" : "Loading…") : (zh ? "載入更多" : "Load more")}
          </Button>
        </div>
      )}

      <Dialog
        closeLabel={zh ? "關閉" : "Close"}
        description={copy.bulkConfirmText.replace("{count}", String(selectedIds.size))}
        footer={
          <DialogActions>
            <Button onClick={() => setConfirming(false)}>{copy.adminConfirmCancel}</Button>
            <Button icon={<Trash2 />} onClick={bulkDelete} variant="danger">
              {copy.bulkDeleteSelected}
            </Button>
          </DialogActions>
        }
        onClose={() => setConfirming(false)}
        open={confirming}
        size="sm"
        title={copy.bulkConfirmTitle}
      />
    </>
  );
}
