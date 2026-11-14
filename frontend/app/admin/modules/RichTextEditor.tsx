"use client";

import {
  AlignCenter, AlignLeft, AlignRight, Bold, Eraser, Image as ImageIcon,
  Italic, Link as LinkIcon, List, ListOrdered, Minus, Quote, Redo2, Strikethrough,
  Underline as UnderlineIcon, Undo2, Unlink, Video as VideoIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isSafeUrl, sanitizeInlineHtml, sanitizeRichHtml, stripClipboardFragmentMarkers } from "../../modules/safeHtml";
import { youtubePosterUrl } from "../../modules/media";
import ImageUploadInput from "../(dashboard)/homepage/ImageUploadInput";

/**
 * Shared full WYSIWYG editor for body / paragraph fields. Uses contentEditable +
 * execCommand with styleWithCSS so colour / highlight / size / align controls
 * emit inline styles that survive sanitizeRichHtml on the front-end.
 *
 * Intended for BODY/paragraph text only — headings stay plain (theme-styled) to
 * keep typographic hierarchy consistent.
 */

// Font sizes in px — applied as an inline span style on the selection so the
// value is an exact number (execCommand fontSize only supports 1–7 keywords).
const FONT_SIZES = ["12", "13", "14", "15", "16", "18", "20", "24", "28", "32", "40"];

/**
 * Paragraph level. The size and weight of each comes from the site theme, not
 * from here — picking H2 marks what the text *is*, so a later change to the
 * site's typography moves every heading at once instead of leaving behind text
 * that was styled by hand.
 */
const BLOCK_FORMATS: { value: string; label: string }[] = [
  { value: "P", label: "內文 Body" },
  { value: "H2", label: "標題 H2" },
  { value: "H3", label: "小標 H3" },
  { value: "H4", label: "次小標 H4" },
];

/** Commands with no tag of their own, which must be written as inline style. */
const STYLED_COMMANDS = new Set(["foreColor", "hiliteColor"]);

/** Toolbar states worth reflecting back — the rest are one-shot actions. */
const TOGGLE_COMMANDS = ["bold", "italic", "underline", "strikeThrough",
  "insertUnorderedList", "insertOrderedList", "justifyLeft", "justifyCenter", "justifyRight"] as const;

// Existing bodies may be plain text (legacy). Show their line breaks in the
// editor by escaping and converting newlines; real HTML is loaded as-is.
function toEditorHtml(v: string): string {
  const clean = stripClipboardFragmentMarkers(v);
  if (!clean) return "";
  if (/<\/?[a-z][\s\S]*?>/i.test(clean)) return clean;
  return clean
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/** A toolbar button. Module level on purpose: defined inside the editor it was
 *  a new component type on every render, and since selectionchange refreshes the
 *  active-format state on every caret move, the whole toolbar was unmounting and
 *  remounting continuously while typing. */
function Btn({ title, onDo, children, cmd, active, buttonRef }: {
  title: string;
  onDo: () => void;
  children: React.ReactNode;
  /** When given, the button lights up while that formatting applies. */
  cmd?: string;
  active: Record<string, boolean>;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const on = cmd ? Boolean(active[cmd]) : false;
  // The action ran on mousedown, because mousedown fires before focus leaves the
  // contentEditable and so the selection the command acts on is still there. A
  // button that only answers the mouse is dead to the keyboard: focusing Bold
  // with text selected and pressing Enter or Space did nothing, for all fifteen
  // controls, every one of them a tab stop. Preventing the default on mousedown
  // keeps focus (and the selection) where it was without consuming the event,
  // which leaves click to carry the action for pointer and keyboard alike.
  return (
    <button
      ref={buttonRef}
      type="button"
      title={title}
      aria-pressed={cmd ? on : undefined}
      className={on ? "is-active" : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onDo}
    >
      {children}
    </button>
  );
}

/**
 * Which renderer this editor is feeding.
 *
 * "full" writes bodies that go through sanitizeRichHtml; "inline" writes CMS
 * block text that goes through sanitizeInlineHtml, which keeps only inline tags
 * — so headings, lists, images and alignment would be stripped back out on the
 * way to the page. One prop picks the sanitiser *and* the toolbar together,
 * because the two have to agree: the CMS used to get this right by keeping a
 * second copy of the whole editor, which is a promise a copy cannot keep.
 */
export type RichTextVariant = "full" | "inline";

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  minRows = 4,
  localeKey,
  variant = "full",
  autoFocus,
  singleLine,
  showDivider,
  showVideo,
  videoLabel,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minRows?: number;
  /** Change this when the edited locale switches so the editor reloads its content. */
  localeKey?: string;
  variant?: RichTextVariant;
  autoFocus?: boolean;
  /** Suppress Enter — for single-line fields such as a heading block. */
  singleLine?: boolean;
  /** Offer a horizontal rule. Off by default; the newsletter composer had one
   *  and the CMS blocks have never asked for it. */
  showDivider?: boolean;
  /** Offer the video insert. Off by default: a CMS page has a dedicated 影音 URL
   *  block that renders a real player, and this insert deliberately does not —
   *  see insertVideo. */
  showVideo?: boolean;
  /** Wording of the text link written under an inserted video. */
  videoLabel?: string;
}) {
  const inline = variant === "inline";
  const sanitize = inline ? sanitizeInlineHtml : sanitizeRichHtml;
  const ref = useRef<HTMLDivElement>(null);
  const linkButtonRef = useRef<HTMLButtonElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const videoButtonRef = useRef<HTMLButtonElement>(null);
  const initialized = useRef(false);
  const prevLocaleKey = useRef(localeKey);
  const savedSelection = useRef<Range | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showImage, setShowImage] = useState(false);
  const [showVideoBox, setShowVideoBox] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [videoError, setVideoError] = useState("");
  const dismissPopover = useCallback((kind: "link" | "image" | "video") => {
    if (kind === "link") { setShowLink(false); setLinkUrl(""); setLinkError(""); }
    if (kind === "image") setShowImage(false);
    if (kind === "video") { setShowVideoBox(false); setVideoUrl(""); setVideoError(""); }
    savedSelection.current = null;
    const trigger = kind === "link" ? linkButtonRef : kind === "image" ? imageButtonRef : videoButtonRef;
    requestAnimationFrame(() => trigger.current?.focus());
  }, []);
  // Which formatting applies where the caret is. Without this the toolbar gave
  // no sign whether bold was on, so the only way to find out was to type.
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [blockFormat, setBlockFormat] = useState("P");

  useEffect(() => {
    if (!ref.current) return;
    if (!initialized.current) {
      ref.current.innerHTML = toEditorHtml(value || "");
      initialized.current = true;
      if (autoFocus) requestAnimationFrame(() => ref.current?.focus());
      return;
    }
    // Take an externally changed value — a reset, an undo in the parent form, or
    // this instance being handed a different block after a reorder — but never
    // while the author is typing in here, or the caret would jump to the start
    // on every keystroke.
    if (document.activeElement !== ref.current && sanitize(ref.current.innerHTML) !== (value || "")) {
      ref.current.innerHTML = toEditorHtml(value || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (localeKey && prevLocaleKey.current !== localeKey && ref.current) {
      ref.current.innerHTML = toEditorHtml(value || "");
      prevLocaleKey.current = localeKey;
    }
  }, [localeKey, value]);

  const emit = useCallback(() => {
    if (ref.current) onChange(sanitize(ref.current.innerHTML));
  }, [onChange, sanitize]);

  // Any toolbar control that takes focus away from the editor — a select, an OS
  // colour picker — loses the selection it is meant to act on, so it has to put
  // it back before running the command.
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedSelection.current = sel.getRangeAt(0).cloneRange();
  }, []);

  const restoreSelection = useCallback(() => {
    const range = savedSelection.current;
    if (!range) return;
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(range); }
  }, []);

  const refreshState = useCallback(() => {
    if (!ref.current || document.activeElement !== ref.current) return;
    const next: Record<string, boolean> = {};
    for (const cmd of TOGGLE_COMMANDS) {
      try { next[cmd] = document.queryCommandState(cmd); } catch { next[cmd] = false; }
    }
    setActive(next);
    let block = "P";
    try {
      const v = document.queryCommandValue("formatBlock").toUpperCase();
      if (BLOCK_FORMATS.some((f) => f.value === v)) block = v;
    } catch { /* not supported — leave as body */ }
    setBlockFormat(block);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshState);
    return () => document.removeEventListener("selectionchange", refreshState);
  }, [refreshState]);

  const exec = useCallback((cmd: string, val?: string) => {
    ref.current?.focus();
    // styleWithCSS decides whether execCommand emits a tag or a styled span.
    // Bold, italic, underline and strikethrough have tags, and both sanitisers
    // keep them — with it on they came out as <span style="font-weight:bold">
    // instead, and the inline sanitiser keeps only colour out of a style, so
    // bold applied in a CMS block was silently dropped on the way to the page.
    // Colour and highlight have no tag of their own, so they still need it.
    const asCss = STYLED_COMMANDS.has(cmd);
    try { document.execCommand("styleWithCSS", false, asCss ? "true" : "false"); } catch { /* ignore */ }
    document.execCommand(cmd, false, val);
    emit();
    refreshState();
  }, [emit, refreshState]);

  // Wrap the current selection in a span carrying an inline style (px font-size).
  // execCommand("fontSize") only accepts 1–7 keyword sizes, so we do it by hand.
  const applyFontSize = useCallback((px: string) => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;
    try {
      range.surroundContents(span);
    } catch {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(span);
    sel.addRange(r);
    emit();
  }, [emit]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    // Paste used to be flattened to plain text, which threw away bold, links
    // and lists when copying between two fields in this very admin. The HTML
    // goes through the same sanitiser the value does, so Word's wrapper markup
    // and any script still cannot get in.
    const html = e.clipboardData.getData("text/html");
    if (html) {
      document.execCommand("insertHTML", false, sanitize(html));
    } else {
      document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    }
    emit();
  }, [emit, sanitize]);

  // Pressing Quote on a line that is already a quote should take it back out.
  // The CMS copy did this; this one only ever wrapped, so there was no way to
  // undo a quote short of clearing the formatting.
  const toggleBlockquote = useCallback(() => {
    ref.current?.focus();
    let inQuote = false;
    let node: Node | null = window.getSelection()?.anchorNode ?? null;
    while (node && node !== ref.current) {
      if ((node as Element).tagName === "BLOCKQUOTE") { inQuote = true; break; }
      node = node.parentNode;
    }
    exec("formatBlock", inQuote ? "P" : "BLOCKQUOTE");
  }, [exec]);

  const onContentKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (singleLine && e.key === "Enter") e.preventDefault();
  }, [singleLine]);

  const openLink = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedSelection.current = sel.getRangeAt(0).cloneRange();
    // Editing a link that already exists should show its address, not an empty
    // box that silently replaces it.
    const node = sel?.anchorNode;
    const el = node instanceof Element ? node : node?.parentElement;
    const anchor = el?.closest("a");
    setLinkUrl(anchor?.getAttribute("href") ?? "");
    setLinkError("");
    setShowLink(true);
  }, []);

  const applyLink = useCallback(() => {
    const url = linkUrl.trim();
    if (!isSafeUrl(url)) {
      setLinkError(document.documentElement.lang.startsWith("zh") ? "請輸入有效的網址（https://… 或網站內路徑）。" : "Enter a valid URL or site path.");
      return;
    }
    ref.current?.focus();
    if (savedSelection.current) {
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(savedSelection.current); }
      document.execCommand("createLink", false, url);
      emit();
    }
    dismissPopover("link");
  }, [linkUrl, emit, dismissPopover]);

  const openImage = useCallback(() => {
    const editor = ref.current;
    if (!editor) return;
    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (range && editor.contains(range.startContainer) && editor.contains(range.endContainer)) {
      savedSelection.current = range.cloneRange();
    } else {
      // Toolbar clicks can precede any editor focus. Insert at the end rather
      // than restoring a selection from the page or silently doing nothing.
      const end = document.createRange();
      end.selectNodeContents(editor);
      end.collapse(false);
      savedSelection.current = end;
    }
    setShowImage(true);
  }, []);

  // Inserting used to be a window.prompt for a URL, which meant an author had
  // to go and find one — while the admin already has an uploader and a media
  // library. This is that component, not a second one.
  const insertImage = useCallback((url: string) => {
    setShowImage(false);
    // The one allow-list, not a looser copy of it: "//evil.example/p.png" is
    // not a path on this site, and the renderer would strip it anyway.
    if (!isSafeUrl(url)) return;
    ref.current?.focus();
    if (savedSelection.current) {
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(savedSelection.current); }
    }
    document.execCommand("insertImage", false, url);
    savedSelection.current = null;
    emit();
  }, [emit]);

  const insertHtmlAtCaret = useCallback((html: string) => {
    ref.current?.focus();
    if (savedSelection.current) {
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(savedSelection.current); }
    }
    // Through the same sanitiser as everything else, so an insert cannot put
    // markup into the value that a paste would not be allowed to.
    document.execCommand("insertHTML", false, sanitize(html));
    savedSelection.current = null;
    emit();
  }, [emit, sanitize]);

  const insertDivider = useCallback(() => {
    insertHtmlAtCaret('<hr style="border: none; border-top: 1px solid #d6d1c5" />');
  }, [insertHtmlAtCaret]);

  const openVideo = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedSelection.current = sel.getRangeAt(0).cloneRange();
    setShowVideoBox(true);
    setVideoError("");
  }, []);

  /**
   * A video, as something an email can actually show.
   *
   * Not an <iframe>: Gmail, Outlook and Apple Mail all drop it, so an embedded
   * player in a newsletter is a blank gap for every recipient. A poster image
   * inside a link is what newsletters use instead — plain <a> and <img>, which
   * render everywhere and open the video when clicked.
   *
   * The text link underneath is not decoration either. Most clients block
   * remote images until the reader allows them, and with images off the poster
   * is invisible; the line below it is then the only way to reach the video.
   */
  const insertVideo = useCallback(() => {
    const url = videoUrl.trim();
    if (!/^https?:\/\//i.test(url) || !isSafeUrl(url)) {
      setVideoError(document.documentElement.lang.startsWith("zh") ? "請輸入有效的影片網址。" : "Enter a valid video URL.");
      return;
    }
    const label = videoLabel || "▶ Watch the video";
    const poster = youtubePosterUrl(url);
    const href = url.replace(/"/g, "&quot;");
    const safeLabel = label.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
    // Anything that is not YouTube has no poster we can name, so it becomes the
    // text link on its own rather than a broken image.
    const thumb = poster
      /* width attribute AND the responsive pair, because they answer different
         renderers: Outlook reads the attribute and ignores the stylesheet, and
         a phone needs the image to shrink below 480. `width: 100%` rather than
         `max-width: 100%` also survives the editor — Chrome drops an inline
         declaration that merely repeats the computed style, and .rte-content
         img already says max-width: 100%. */
      ? `<a href="${href}"><img src="${poster}" alt="${safeLabel}" width="480" style="width: 100%; max-width: 480px; border-radius: 6px" /></a>`
      : "";
    insertHtmlAtCaret(`${thumb}<p style="text-align: center"><a href="${href}">${safeLabel}</a></p>`);
    dismissPopover("video");
  }, [videoUrl, videoLabel, insertHtmlAtCaret, dismissPopover]);

  return (
    <div className={`rte${inline ? " rte--inline" : ""}`} onClick={(e) => e.stopPropagation()} onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      const nestedDialog = (event.target as HTMLElement).closest('dialog[open], [role="dialog"]');
      if (nestedDialog && event.currentTarget.contains(nestedDialog)) return;
      const kind = showLink ? "link" : showVideoBox ? "video" : showImage ? "image" : null;
      if (kind) { event.preventDefault(); event.stopPropagation(); dismissPopover(kind); }
    }}>
      <div className="rte-toolbar">
        {!inline && (
          <>
            <select
              className="rte-block"
              title="段落層級 Paragraph level"
              value={blockFormat}
              onMouseDown={saveSelection}
              onChange={(e) => {
                restoreSelection();
                exec("formatBlock", e.target.value);
              }}
            >
              {BLOCK_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <span className="rte-sep" />
          </>
        )}
        <Btn active={active} cmd="bold" title="粗體 Bold (Ctrl+B)" onDo={() => exec("bold")}><Bold size={14} /></Btn>
        <Btn active={active} cmd="italic" title="斜體 Italic (Ctrl+I)" onDo={() => exec("italic")}><Italic size={14} /></Btn>
        <Btn active={active} cmd="underline" title="底線 Underline (Ctrl+U)" onDo={() => exec("underline")}><UnderlineIcon size={14} /></Btn>
        <Btn active={active} cmd="strikeThrough" title="刪除線 Strikethrough" onDo={() => exec("strikeThrough")}><Strikethrough size={14} /></Btn>
        <span className="rte-sep" />
        {!inline && (
          <select className="rte-size" title="字級 Font size (px)" value=""
            onMouseDown={saveSelection}
            onChange={(e) => {
              if (!e.target.value) return;
              restoreSelection();
              applyFontSize(e.target.value);
              e.target.value = "";
            }}>
            <option value="">{"字級"}</option>
            {FONT_SIZES.map((v) => <option key={v} value={v}>{v}px</option>)}
          </select>
        )}
        <label className="rte-color" title="文字顏色 Text colour">
          <span style={{ fontWeight: 700 }}>A</span>
          {/* The label's title is not a name: it sits on the wrapper, and the
              swatch inside it is a <span>, so the control announced itself as an
              unlabelled colour picker to anyone arriving by keyboard. */}
          <input
            type="color"
            aria-label="文字顏色 Text colour"
            onMouseDown={saveSelection}
            onChange={(e) => { restoreSelection(); exec("foreColor", e.target.value); }}
          />
        </label>
        <label className="rte-color rte-color--hl" title="螢光標記 Highlight">
          <span style={{ background: "#ffe08a", padding: "0 2px" }}>A</span>
          <input
            type="color"
            aria-label="螢光標記 Highlight"
            defaultValue="#ffe08a"
            onMouseDown={saveSelection}
            onChange={(e) => { restoreSelection(); exec("hiliteColor", e.target.value); }}
          />
        </label>
        {!inline && (
          <>
            <span className="rte-sep" />
            <Btn active={active} cmd="justifyLeft" title="靠左 Align left" onDo={() => exec("justifyLeft")}><AlignLeft size={14} /></Btn>
            <Btn active={active} cmd="justifyCenter" title="置中 Align center" onDo={() => exec("justifyCenter")}><AlignCenter size={14} /></Btn>
            <Btn active={active} cmd="justifyRight" title="靠右 Align right" onDo={() => exec("justifyRight")}><AlignRight size={14} /></Btn>
            <span className="rte-sep" />
            <Btn active={active} cmd="insertUnorderedList" title="項目符號 Bulleted list" onDo={() => exec("insertUnorderedList")}><List size={14} /></Btn>
            <Btn active={active} cmd="insertOrderedList" title="編號清單 Numbered list" onDo={() => exec("insertOrderedList")}><ListOrdered size={14} /></Btn>
          </>
        )}
        <span className="rte-sep" />
        <Btn active={active} title="引言 Quote" onDo={toggleBlockquote}><Quote size={14} /></Btn>
        <Btn buttonRef={linkButtonRef} active={active} title="連結 Link" onDo={openLink}><LinkIcon size={14} /></Btn>
        <Btn active={active} title="移除連結 Unlink" onDo={() => exec("unlink")}><Unlink size={14} /></Btn>
        {!inline && <Btn buttonRef={imageButtonRef} active={active} title="插入圖片 Image" onDo={openImage}><ImageIcon size={14} /></Btn>}
        {showVideo && <Btn buttonRef={videoButtonRef} active={active} title="插入影片 Video" onDo={openVideo}><VideoIcon size={14} /></Btn>}
        {showDivider && <Btn active={active} title="分隔線 Divider" onDo={insertDivider}><Minus size={14} /></Btn>}
        <span className="rte-sep" />
        <Btn active={active} title="復原 Undo (Ctrl+Z)" onDo={() => exec("undo")}><Undo2 size={14} /></Btn>
        <Btn active={active} title="重做 Redo (Ctrl+Shift+Z)" onDo={() => exec("redo")}><Redo2 size={14} /></Btn>
        <Btn active={active} title="清除格式 Clear formatting" onDo={() => { exec("removeFormat"); exec("formatBlock", "P"); }}><Eraser size={14} /></Btn>
      </div>
      {showImage && (
        <div className="rte-image-popover">
          <ImageUploadInput value="" onChange={insertImage} hideRemove />
          <button type="button" className="rte-image-cancel" aria-label="取消插入圖片 Cancel image insertion" onClick={() => dismissPopover("image")}>
            {"取消"}
          </button>
        </div>
      )}
      {showVideoBox && (
        <div className="rte-link-popover rte-video-popover">
          <input type="url" aria-label="影片網址 Video URL" aria-invalid={Boolean(videoError)} placeholder="https://www.youtube.com/watch?v=…" value={videoUrl} autoFocus
            onChange={(e) => { setVideoUrl(e.target.value); setVideoError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertVideo(); } }} />
          <button type="button" aria-label="插入影片 Insert video" onClick={insertVideo}>&#10003;</button>
          <button type="button" aria-label="取消插入影片 Cancel video insertion" onClick={() => dismissPopover("video")}>&#10005;</button>
          {videoError && <p role="alert">{videoError}</p>}
          <small>{"信件無法播放影片，會插入封面圖與連結，點擊後開啟影片"}</small>
        </div>
      )}
      {showLink && (
        <div className="rte-link-popover">
          <input type="text" inputMode="url" aria-label="連結網址 Link URL" aria-invalid={Boolean(linkError)} placeholder="https://…" value={linkUrl} autoFocus
            onChange={(e) => { setLinkUrl(e.target.value); setLinkError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } }} />
          <button type="button" aria-label="套用連結 Apply link" onClick={applyLink}>&#10003;</button>
          <button type="button" aria-label="取消連結 Cancel link" onClick={() => dismissPopover("link")}>&#10005;</button>
          {linkError && <p role="alert">{linkError}</p>}
        </div>
      )}
      <div
        ref={ref}
        className="rte-content"
        contentEditable
        role="textbox"
        aria-label={placeholder || "內容 Content"}
        aria-multiline={!singleLine}
        onInput={emit}
        onPaste={handlePaste}
        onKeyDown={onContentKeyDown}
        onKeyUp={refreshState}
        onFocus={refreshState}
        data-placeholder={placeholder || ""}
        suppressContentEditableWarning
        style={{ minHeight: singleLine ? "1.6em" : `${minRows * 1.7}em` }}
      />
    </div>
  );
}
