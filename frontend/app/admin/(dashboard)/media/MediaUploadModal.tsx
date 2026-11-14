"use client";

import { CheckCircle, AlertCircle, UploadCloud, X, Minimize2, Maximize2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminSiteSlug } from "../../modules/AdminSiteContext";
import MediaUploadRequirements from "../../modules/MediaUploadRequirements";
import { Button, Dialog, DialogActions, Progress, Stack } from "../../ui";
import "./media.css";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const OVERSIZED_FILE_ERROR = "檔案超過 100 MB 上限 / File exceeds the 100 MB limit";

type FileEntry = {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

type UploadCopy = {
  mediaUploadTitle: string;
  mediaUploadText: string;
  mediaUploadAction: string;
  mediaUploadStart: string;
  mediaUploading: string;
  mediaUploadProgress: string;
  mediaUploadDone: string;
  mediaUploadError: string;
  mediaUploadDragHint: string;
  mediaUploadMinimized: string;
};

export default function MediaUploadModal({ copy }: { copy: UploadCopy }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const siteSlug = useAdminSiteSlug();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<Map<string, XMLHttpRequest | AbortController>>(new Map());

  const doneCount = entries.filter((e) => e.status === "done").length;
  const errorCount = entries.filter((e) => e.status === "error").length;
  const allFinished = entries.length > 0 && doneCount + errorCount === entries.length;

  const addFiles = useCallback((files: FileList | File[]) => {
    const newEntries: FileEntry[] = Array.from(files).map((file) => {
      const oversized = file.size > MAX_UPLOAD_BYTES;
      return {
        file,
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        progress: 0,
        status: oversized ? "error" : "pending",
        ...(oversized ? { error: OVERSIZED_FILE_ERROR } : {}),
      };
    });
    setEntries((prev) => [...prev, ...newEntries]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    const ctrl = abortRef.current.get(id);
    if (ctrl) { ctrl.abort(); abortRef.current.delete(id); }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<FileEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const uploadOne = useCallback(
    async (entry: FileEntry) => {
      const site = siteSlug;
      const fd = new FormData();
      fd.append("file", entry.file);

      const controller = new AbortController();
      abortRef.current.set(entry.id, controller as unknown as XMLHttpRequest);
      updateEntry(entry.id, { status: "uploading", progress: 10 });

      try {
        const response = await fetch("/api/v1/admin/media", {
          method: "POST",
          credentials: "same-origin",
          headers: { "X-Site-Slug": site },
          body: fd,
          signal: controller.signal,
        });
        abortRef.current.delete(entry.id);
        if (response.status === 401) {
          window.location.href = "/admin/login";
          updateEntry(entry.id, { status: "error", error: "Not authenticated" });
          return;
        }
        if (response.ok) {
          updateEntry(entry.id, { status: "done", progress: 100 });
        } else {
          let msg = `HTTP ${response.status}`;
          try {
            const payload: unknown = await response.json();
            const detail = payload && typeof payload === "object" && "detail" in payload
              ? (payload as { detail?: unknown }).detail
              : undefined;
            if (typeof detail === "string") msg = detail;
            else if (detail !== undefined) msg = JSON.stringify(detail);
          } catch {}
          updateEntry(entry.id, { status: "error", error: msg });
        }
      } catch (err) {
        abortRef.current.delete(entry.id);
        if ((err as Error).name !== "AbortError") {
          updateEntry(entry.id, { status: "error", error: "Network error" });
        }
      }
    },
    [siteSlug, updateEntry]
  );

  const startUpload = useCallback(async () => {
    if (uploading) return;
    setUploading(true);
    const pending = entries.filter(
      (e) => (e.status === "pending" || e.status === "error") && e.file.size <= MAX_UPLOAD_BYTES
    );
    // A single file can be 100 MB. Upload sequentially to avoid doubling the
    // proxy/backend memory and disk pressure when two large videos are queued.
    const queue = [...pending];
    const concurrency = 1;
    const run = async () => {
      while (queue.length > 0) {
        const batch = queue.splice(0, concurrency);
        await Promise.all(batch.map(uploadOne));
      }
    };
    await run();
    setUploading(false);
    router.refresh();
  }, [entries, uploadOne, uploading, router]);

  // When the modal is closed and all uploads are done, reset state
  const handleClose = useCallback(() => {
    if (allFinished || !uploading) {
      // Cleanup
      Array.from(abortRef.current.values()).forEach((ctrl) => ctrl.abort());
      abortRef.current.clear();
      setEntries([]);
      setUploading(false);
      setMinimized(false);
    } else {
      // Minimize instead of close during upload
      setMinimized(true);
    }
    setOpen(false);
  }, [allFinished, uploading]);

  /* Dialog handles Escape, scroll lock, focus restore and the Tab trap.
     handleClose minimises rather than closing while an upload is in flight,
     so Escape cannot cancel one by accident. */

  // Re-open from minimized state
  const handleReopen = useCallback(() => {
    setOpen(true);
    setMinimized(false);
  }, []);

  // Handle file input change
  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles]
  );

  // Drag & drop handlers
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  // Warn before closing browser tab if uploading
  useEffect(() => {
    if (!uploading) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploading]);

  const progressLabel = copy.mediaUploadProgress
    .replace("{done}", String(doneCount))
    .replace("{total}", String(entries.length));

  const minimizedLabel = copy.mediaUploadMinimized
    .replace("{done}", String(doneCount))
    .replace("{total}", String(entries.length));

  const totalProgress = entries.length === 0 ? 0 : Math.round(entries.reduce((s, e) => s + e.progress, 0) / entries.length);

  const hasPending = entries.some(
    (e) => (e.status === "pending" || e.status === "error") && e.file.size <= MAX_UPLOAD_BYTES
  );

  return (
    <>
      {/* Upload button */}
      <Button
        icon={<UploadCloud />}
        onClick={() => { setOpen(true); setMinimized(false); }}
        variant="primary"
      >
        {copy.mediaUploadAction}
      </Button>

      {/* Minimized floating pill (visible when uploading in background) */}
      {minimized && uploading && (
        <button
          type="button"
          className="ml-pill"
          onClick={handleReopen}
        >
          <span className="admin-spinner" />
          {minimizedLabel}
          <span className="ml-pill__bar">
            <span style={{ width: `${totalProgress}%` }} />
          </span>
        </button>
      )}

      {/* Full modal */}
      <Dialog
        description={copy.mediaUploadText}
        footer={
          <DialogActions>
            {uploading && (
              <Button icon={<Minimize2 />} iconOnly onClick={() => { setOpen(false); setMinimized(true); }} variant="ghost">
                Minimize
              </Button>
            )}
            {allFinished ? (
              <Button icon={<CheckCircle />} onClick={handleClose} variant="primary">
                {copy.mediaUploadDone}
                {errorCount > 0 && ` (${errorCount} ${copy.mediaUploadError})`}
              </Button>
            ) : (
              <Button
                disabled={uploading || entries.length === 0 || !hasPending}
                icon={uploading ? <span className="admin-spinner" /> : <UploadCloud />}
                onClick={startUpload}
                variant="primary"
              >
                {uploading
                  ? copy.mediaUploading
                  : `${copy.mediaUploadStart} (${entries.filter((e) => e.status === "pending" || e.status === "error").length})`}
              </Button>
            )}
          </DialogActions>
        }
        onClose={handleClose}
        open={open}
        title={copy.mediaUploadTitle}
      >
        <Stack gap="md">
          <MediaUploadRequirements />

          {/* Drop zone */}
          {!uploading && (
            <div
              className={`ml-dropzone${dragOver ? " is-dragover" : ""}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <UploadCloud size={28} />
              <span>{copy.mediaUploadDragHint}</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/mp4,video/webm"
                multiple
                onChange={onFileChange}
                style={{ display: "none" }}
              />
            </div>
          )}

          {/* File list */}
          {entries.length > 0 && (
            <div className="ml-files">
              {entries.map((entry) => (
                <div className="ml-file" key={entry.id}>
                  <div className="ml-file__info">
                    {entry.status === "done" && <CheckCircle size={14} className="ml-file__ok" />}
                    {entry.status === "error" && <AlertCircle size={14} className="ml-file__bad" />}
                    {(entry.status === "pending" || entry.status === "uploading") && entry.status === "uploading" && <span className="admin-spinner" />}
                    <span className="ml-file__name">{entry.file.name}</span>
                    <span className="ml-file__size">{(entry.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  {!uploading && entry.status !== "uploading" ? (
                    <Button icon={<X />} iconOnly onClick={() => removeEntry(entry.id)} size="sm" variant="ghost">
                      Remove
                    </Button>
                  ) : <span />}
                  {entry.status === "uploading" && <Progress value={entry.progress} />}
                  {entry.status === "error" && (
                    <span className="ml-file__error">{entry.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Overall progress */}
          {uploading && <Progress label={progressLabel} value={totalProgress} />}
        </Stack>
      </Dialog>
    </>
  );
}
