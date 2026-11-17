"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listingArticles, listingTagOptions, matchingTagArticles, type ListingArticle } from "../../../../../modules/listingTagOptions";
import { tagKey, trs } from "../../../../../../modules/tr";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  X,
  Settings2,
  Save,
} from "lucide-react";
import type { AdminContentTag, AdminSite } from "../../../../../modules/adminApi";
import SubmitButton from "../../../../../modules/SubmitButton";
import { buttonClass, Callout, Segmented, useConfirm } from "../../../../../ui";
import ImageUploadInput from "../../../../homepage/ImageUploadInput";
import { Field, getVal, setVal, HeadingInput } from "../../../../../modules/blockFields";
import { useOverlay } from "../../../../../../modules/useOverlay";
import FoldSection from "../../../../../modules/FoldSection";
import UndoRedoButtons from "../../../../../modules/UndoRedoButtons";
import { useUndoableList } from "../../../../../modules/useUndoableList";
import { useFormDraft } from "../../../../../modules/useFormDraft";
import { useUnsavedGuard } from "../../../../../modules/useUnsavedGuard";
import type { PreviewRenderer } from "../../../../../../modules/previewRenderer";
import { BLOCK_LABELS, BLOCK_HINTS, blockLabel, groupTitle } from "../../../../../modules/blockCatalogue";
import {
  buildContentSources,
} from "../../../../../modules/blockForms";
import { pairSecondIds } from "../../../../../../modules/blockPairs";
import { BlockConfigForm, BlockThumb } from "../../../../../modules/BlockConfigForm";
import BlockStyleInspector from "../../../../../modules/BlockStyleInspector";
import { activateOnKey, blockHasContent, makeBlockId, type EditorBlock } from "../../../../../modules/blockEditorUtils";
import type { ContentSource } from "../../../../../modules/blockForms";
import { blockPurpose } from "../../../../../modules/contentVocabulary";
import { adminProxyUrl } from "../../../../../../modules/apiBase";
import type { AskOptions } from "../../../../../ui/Confirm";

type Block = EditorBlock;

/* ── Block type labels (property-specific + reusable parent blocks) ── */

/**
 * Content sources a Featured Collection block can pull from.
 *
 * These four used to be a hardcoded list, so a new content type — 選品, or
 * whatever comes after it — appeared in the homepage editor's source picker and
 * silently not in this one. The site's own pages are the source of truth now;
 * the four stay listed as a floor so a site that has not configured them yet
 * keeps the sources its existing blocks already point at.
 */
const FALLBACK_SOURCES: ContentSource[] = [
  ["stays",    "住宿目錄", "Stay catalogue"],
  ["journal",  "旅遊專欄", "Journal"],
  ["activity", "活動", "Activities"],
  ["dining",   "餐飲", "Dining"],
];

function contentSourcesFor(site: AdminSite): ContentSource[] {
  const derived = buildContentSources(site);
  const seen = new Set(derived.map(([key]) => key));
  return [...derived, ...FALLBACK_SOURCES.filter(([key]) => !seen.has(key))];
}

/* The labels and hints these two tables held now live in
   modules/blockCatalogue. Two copies had drifted: the same block was
   「精選住宿」here and 「精選內容」on the homepage, 「探索路徑」here and
   「路徑卡片」there — an editor moving between the two pages could not tell
   they were the same block. */


/** Types the group homepage renders and a villa page does not. HomepageBlocks
 *  draws the stay search; PropertyPageRenderer has no case for it, so offering
 *  it on a villa page would save a block that renders nothing. */
/* Was ["search"]. The search bar needs a stay catalogue to search, which the
   parent site has on every page — 精品Villa above all, where it replaces the
   bar that used to be hardcoded into the page. A villa micro-site still has no
   catalogue of its own, so it stays withheld there. */
const GROUP_HOMEPAGE_ONLY = new Set<string>([]);
const CHILD_SITE_HIDDEN = new Set(["search"]);

const BLOCK_TYPES = Object.keys(BLOCK_LABELS);

/** Name the block being deleted, and only ask when there is something to lose.
 *
 *  「刪除此版塊？」named nothing at all, from a bar of six icon buttons where
 *  the row under the cursor is not necessarily the one the author has in mind —
 *  so the dialog could not be used to check the aim, which is the only thing it
 *  is for. There is no undo here. */
async function confirmRemove(block: Block, zh: boolean, ask: (o: AskOptions) => Promise<boolean>): Promise<boolean> {
  if (!blockHasContent(block)) return true;
  const name = blockLabel(block.type, zh);
  return ask({
    tone: "danger",
    title: zh
      ? `刪除「${name}」版塊？裡面的內容會一併移除，且無法復原。`
      : `Delete this "${name}" block? Its content goes with it and cannot be restored.`,
  });
}

type SubTab = { label: Record<string, string>; tag: Record<string, string> };

/** Everything this editor would submit, as one comparable string.
 *
 *  The unsaved-work guard asks "is what is on screen different from what the
 *  server last sent", which is a question about values, not about whether
 *  anyone touched a control: an edit typed and then typed back leaves nothing
 *  to lose, and a prompt that fires anyway is the prompt that gets dismissed
 *  unread.
 *
 *  Fixed order, built here rather than by the two callers, so the baseline and
 *  the current state cannot disagree about key order and report a clean editor
 *  as dirty. The fields are exactly the hidden inputs below — a value that is
 *  not submitted is not work that a save would keep. */
function pageSnapshot(v: {
  blocks: Block[];
  seo: Record<string, unknown>;
  subTabs: SubTab[];
  showCmsList: boolean;
  showSearch: boolean;
  showTags: boolean;
  cardsMatchText: boolean;
  pageName: Record<string, string>;
  navLinkMode: string;
  navAnchor: string;
  heroImage: string;
  heroTitle: Record<string, string>;
  heroSubtitle: Record<string, string>;
  heroTitleColor: string;
  heroSubtitleColor: string;
  heroHeight: string;
  heroLayout: string;
  heroMaskColor: string;
  heroMaskOpacity: string;
  heroAlign: string;
}): string {
  return JSON.stringify([
    v.blocks, v.seo, v.subTabs,
    v.showCmsList, v.showSearch, v.showTags, v.cardsMatchText,
    v.pageName, v.navLinkMode, v.navAnchor,
    v.heroImage, v.heroTitle, v.heroSubtitle,
    v.heroTitleColor, v.heroSubtitleColor, v.heroHeight, v.heroLayout, v.heroAlign,
    v.heroMaskColor, v.heroMaskOpacity,
  ]);
}

/* ── Main Editor ── */

export default function PropertyBlockEditor({
  action,
  initialBlocks,
  initialSeo,
  initialShowCmsList,
  initialLabel,
  initialHeroImage,
  initialHeroTitle,
  initialHeroSubtitle,
  initialHeroTitleColor,
  initialHeroSubtitleColor,
  initialHeroHeight,
  initialHeroLayout,
  locale,
  site,
  contentTags = [],
  pageKey,
  canWrite = true,
  saveFailed,
}: {
  action: (formData: FormData) => void;
  initialBlocks: Block[];
  initialSeo: Record<string, unknown>;
  initialShowCmsList?: boolean;
  initialLabel?: Record<string, string>;
  initialHeroImage?: string;
  initialHeroTitle?: Record<string, string>;
  initialHeroSubtitle?: Record<string, string>;
  initialHeroTitleColor?: string;
  initialHeroSubtitleColor?: string;
  initialHeroHeight?: string;
  initialHeroLayout?: string;
  locale: string;
  site: AdminSite;
  contentTags?: AdminContentTag[];
  pageKey: string;
  canWrite?: boolean;
  /** The last save came back rejected. `updatePropertyPageAction` redirects on
   *  failure as well as on success, so a 422 remounts this editor seeded from
   *  the last SAVED page and takes every unsaved block with it — see
   *  useFormDraft, which is what puts the work back. */
  saveFailed?: boolean;
}) {
  const { ask } = useConfirm();
  const zh = locale === "zh";
  /* The group site's homepage is the one page reached through this editor that
     the front end does NOT draw with PropertyPageRenderer — app/(site)/page.tsx
     renders it through HomepageBlocks. So it previews with the homepage
     renderer and gets the block types only that renderer has. Everything else
     here — villa homepages included — is a property page. */
  const isGroupHomepage = pageKey === "homepage" && site.parent_site_id == null;
  /* A villa micro-site has no stay catalogue of its own to search. */
  const isChildSite = site.parent_site_id != null;
  const previewRenderer: PreviewRenderer = isGroupHomepage ? "homepage" : "property";
  const blockTypes = BLOCK_TYPES
    .filter((type) => isGroupHomepage || !GROUP_HOMEPAGE_ONLY.has(type))
    .filter((type) => !isChildSite || !CHILD_SITE_HIDDEN.has(type));

  /* Undoable, like the other two block editors.
     This was a bare useState, so a mis-aimed 刪除 or a drag that landed one row
     off had no way back at all — on the one editor that ALSO had no draft
     rescue, which made a villa page the most fragile surface in the admin. The
     hook carries the Ctrl+Z / Ctrl+Shift+Z bindings with it; the buttons in the
     toolbar are the same shared pair the homepage editor uses.
     `history.set` takes the same updater form the mutators below already pass,
     so two writes in one React tick still compose. */
  const history = useUndoableList<Block[]>(initialBlocks);
  const blocks = history.value;
  const setBlocks = history.set;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blockSearch, setBlockSearch] = useState("");
  const [reordering, setReordering] = useState(false);
  const [editLocale, setEditLocale] = useState<string>(locale);
  const [seo, setSeo] = useState<Record<string, unknown>>(initialSeo);
  /* The row of groupings shown above the entries on a CMS list page. Each is a
     tag an entry carries, so adding one here and tagging the entries is the
     whole job — no deploy.
     Hoisted out of the useState initialiser so the unsaved-work baseline can be
     built from the same expression the state is seeded from; two copies of this
     derivation would drift and report a clean page as dirty. */
  const initialSubTabs = useMemo<SubTab[]>(() => {
    const raw = (((site.settings as Record<string, unknown> | undefined)?.pages as Record<string, Record<string, unknown>> | undefined)?.[pageKey]?.sub_tabs);
    return Array.isArray(raw)
      ? raw.map((r) => {
          const t = (r ?? {}) as Record<string, unknown>;
          const l = t.label;
          const g = t.tag;
          return {
            label: typeof l === "string" ? { zh: l, en: l } : ((l ?? {}) as Record<string, string>),
            // Entries tag themselves per locale, so the tab must match per locale.
            tag: typeof g === "string" ? { zh: g, en: g } : ((g ?? {}) as Record<string, string>),
          };
        })
      : [];
  }, [site, pageKey]);
  const [subTabs, setSubTabs] = useState<SubTab[]>(initialSubTabs);
  // Multi-select tag picker for the sub-tabs (客戶: 後台改 tag → 打開 modal 可複選).
  // The options are the tags this category's own entries actually carry, paired
  // by locale, fetched the first time the picker opens.
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<Array<{ zh: string; en: string }>>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [tagsError, setTagsError] = useState(false);
  const [listingEntries, setListingEntries] = useState<ListingArticle[]>([]);
  const loadTags = useCallback(async (refresh = false) => {
    if (tagsLoaded && !refresh) return;
    setTagsLoading(true);
    setTagsError(false);
    try {
      const res = await fetch(
        adminProxyUrl("/admin/cms/pages", site.slug),
        { headers: { accept: "application/json" } },
      );
      /* A 401/403/500 used to fall through as an empty list, so the picker
         stated as fact that the entries carry no tags — and, because it still
         marked the load done, never retried for the rest of the session. */
      if (!res.ok) { setTagsError(true); return; }
      const list = await res.json();
      if (!Array.isArray(list)) throw new Error("Invalid article list");
      const config = ((site.settings?.pages ?? {}) as Record<string, Record<string, unknown>>)[pageKey] ?? {};
      const entries = listingArticles(list, config, pageKey);
      setListingEntries(entries);
      setAvailableTags(listingTagOptions(entries));
      setTagsLoaded(true);
    } catch {
      // Network error / non-JSON response. Swallowed so `void loadTags()`
      // never becomes an unhandled rejection.
      setTagsError(true);
    } finally {
      setTagsLoading(false);
    }
  }, [site.slug, site.settings, pageKey, tagsLoaded]);
  const isTagSelected = (t: { zh: string; en: string }) =>
    subTabs.some((st) => tagKey(st.tag.zh || st.tag.en) === tagKey(t.zh || t.en));
  const toggleTag = (t: { zh: string; en: string }) =>
    setSubTabs((prev) =>
      prev.some((st) => tagKey(st.tag.zh || st.tag.en) === tagKey(t.zh || t.en))
        ? prev.filter((st) => tagKey(st.tag.zh || st.tag.en) !== tagKey(t.zh || t.en))
        : [...prev, { label: { zh: t.zh, en: t.en }, tag: { zh: t.zh, en: t.en } }],
    );
  const tagPickerRef = useRef<HTMLDivElement>(null);
  /* Escape, the page-behind scroll lock, focus restore AND the Tab trap all come
     from the shared overlay hook, so this modal behaves like every other one.
     `trapFocus` is not optional for this panel: it says `aria-modal="true"`,
     which tells a screen reader the editor behind it is unavailable, and without
     the trap Tab walked straight out into that editor — the reader ends up
     typing into a form they cannot see and cannot reach with the mouse.

     The trap used to be a second, hand-rolled copy sitting right here beside the
     hook. Two keydown listeners meant two preventDefault-and-focus passes on the
     same Tab, so wrapping at either edge jumped two controls instead of one. */
  useOverlay(tagPickerOpen, () => setTagPickerOpen(false), { trapFocus: tagPickerRef });
  // Nav link mode + anchor (this page's nav item → sub-page, or #tag to a
  // homepage block). Seeded from the saved page config.
  const _pageCfg = (((site.settings as Record<string, unknown> | undefined)?.pages as Record<string, Record<string, unknown>> | undefined)?.[pageKey]) ?? {};
  /* Each seed value is named once and used twice: to open the state, and to
     build the "what the server currently holds" baseline further down. Inlining
     them at the useState call — as they were — meant the baseline had to repeat
     every expression, and a repeated derivation drifts. */
  const initialShowCmsListValue = initialShowCmsList ?? (pageKey !== "homepage");
  const initialPageName = initialLabel ?? {};
  /* 客戶: 搜尋分類應該就不太需要了、看起來有點多。
     `=== true`, matching what the page itself does. These two disagreed: the
     switch read `!== false` and so sat ON for a page that had never been saved,
     while the page read `=== true` and hid the box. The switch was describing a
     state the site did not have, and "turning it on" changed nothing because it
     already looked on — the only way to actually get a search box was to toggle
     it off, save, then on again. */
  const initialShowSearch = _pageCfg.show_search === true;
  /* Default ON, mirroring the readers: a page saved before this switch
     existed has no show_tag_row key and must keep showing its chip row. */
  const initialShowTags = _pageCfg.show_tag_row !== false;
  /* Default OFF, matching the page reader's `=== true`: an index saved
     before this switch existed keeps its full-width card grid. */
  const initialCardsMatchText = _pageCfg.cards_match_text === true;
  const initialNavLinkMode: "page" | "anchor" = _pageCfg.link_mode === "anchor" ? "anchor" : "page";
  const initialNavAnchor = typeof _pageCfg.anchor === "string" ? _pageCfg.anchor : "";
  /* One control for the whole hero: the 大標, 小標 and any CTA sit in one
     wrapper, so aligning the wrapper aligns all three together — which is what
     is wanted. Aligning them apart from each other reads as a mistake. */
  const initialHeroAlign = typeof _pageCfg.hero_align === "string" ? _pageCfg.hero_align : "";
  /* Default to no mask: the fixed gradients this replaced have been removed,
     so a page that has never been configured shows its photograph as it is. */
  const initialHeroMaskColor = typeof _pageCfg.hero_mask_color === "string" ? _pageCfg.hero_mask_color : "";
  const initialHeroMaskOpacity =
    _pageCfg.hero_mask_opacity === "" || _pageCfg.hero_mask_opacity === null || _pageCfg.hero_mask_opacity === undefined
      ? ""
      : String(_pageCfg.hero_mask_opacity);

  const [showCmsList, setShowCmsList] = useState(initialShowCmsListValue);
  useEffect(() => {
    if (showCmsList && pageKey !== "homepage") void loadTags();
  }, [showCmsList, pageKey, loadTags]);
  const [pageName, setPageName] = useState<Record<string, string>>(initialPageName);
  const [showSearch, setShowSearch] = useState(initialShowSearch);
  const [showTags, setShowTags] = useState(initialShowTags);
  const [cardsMatchText, setCardsMatchText] = useState(initialCardsMatchText);
  const [navLinkMode, setNavLinkMode] = useState<"page" | "anchor">(initialNavLinkMode);
  const [navAnchor, setNavAnchor] = useState<string>(initialNavAnchor);
  const [heroImage, setHeroImage] = useState<string>(initialHeroImage ?? "");
  const [heroTitle, setHeroTitle] = useState<Record<string, string>>(initialHeroTitle ?? {});
  const [heroSubtitle, setHeroSubtitle] = useState<Record<string, string>>(initialHeroSubtitle ?? {});
  const [heroTitleColor, setHeroTitleColor] = useState<string>(initialHeroTitleColor ?? "#ffffff");
  const [heroSubtitleColor, setHeroSubtitleColor] = useState<string>(initialHeroSubtitleColor ?? "#ffffff");
  const [heroHeight, setHeroHeight] = useState<string>(initialHeroHeight ?? "");
  const [heroLayout, setHeroLayout] = useState<string>(initialHeroLayout ?? "");
  const [heroAlign, setHeroAlign] = useState<string>(initialHeroAlign);
  const [heroMaskColor, setHeroMaskColor] = useState<string>(initialHeroMaskColor);
  const [heroMaskOpacity, setHeroMaskOpacity] = useState<string>(initialHeroMaskOpacity);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const label = (type: string) => {
    const pair = BLOCK_LABELS[type] ?? [type, type];
    return zh ? pair[0] : pair[1];
  };
  const hint = (type: string) => {
    const pair = BLOCK_HINTS[type] ?? ["", ""];
    return zh ? pair[0] : pair[1];
  };
  const normalizedBlockSearch = blockSearch.trim().toLocaleLowerCase();
  const matchingBlockTypes = blockTypes.filter((type) => `${label(type)} ${hint(type)}`.toLocaleLowerCase().includes(normalizedBlockSearch));

  /* Every mutator below takes the updater form.
     They each used to close over `blocks` and hand `setBlocks` a finished
     array, so two of them running before the next render both computed from the
     same stale snapshot and the second overwrote the first: hide a block and
     delete another in one gesture and the hide came back, drag while a config
     edit was still in flight and the edit was gone. React invokes updaters
     against the CURRENT value, which is the only thing that makes two writes in
     one tick compose — the same fix the homepage editor's `add` carries a note
     about. */
  const toggle = (id: string) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)));
  const remove = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const add = (type: string) => {
    const nb: Block = { id: makeBlockId(), type, enabled: true, config: {} };
    setBlocks((prev) => [...prev, nb]);
    setSelectedId(nb.id);
  };
  /** Tagged per block, so a run of keystrokes in one field collapses into a
   *  single undo step while moving to another block starts a new one. Untagged,
   *  one Ctrl+Z would step back one character and the 60-step history would be
   *  spent on half a sentence. */
  const updateConfig = (id: string, config: Record<string, unknown>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, config } : b)), `config:${id}`);

  // Drag-and-drop reorder
  const onDragOver = (index: number, e: React.DragEvent) => {
    if (dragIndex === null) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY - rect.top > rect.height / 2;
    setDropIndex(after ? index + 1 : index);
  };
  /* Reordering by keyboard and by touch.
     The drag handle beside this uses HTML5 drag and drop, which never fires on
     a touch screen — so on a phone or tablet the order of a villa page's blocks
     could not be changed at all, at any width. The homepage editor has shipped
     these two buttons all along; this is the same pair, on the same state. */
  const move = (id: string, delta: number) => {
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === id);
      const to = from + delta;
      // Bounds are read off `prev` too: pressing 上移 twice in a row must judge
      // the second press against the position the first one produced.
      if (from === -1 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const onDrop = () => {
    if (dragIndex === null || dropIndex === null) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const from = dragIndex;
    const at = dropIndex;
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      const target = at > from ? at - 1 : at;
      next.splice(target, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDropIndex(null);
  };

  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  /* The right-hand column of a 兩區塊並排. The pair wrapper carries ONE vertical
     inset — both columns occupy the same band — and blockPairStyle takes it from
     the first block, so this column's 上下留白 saves and moves nothing. Its
     左右留白 IS read (it supplies the pair's right edge), so only the vertical
     one is withheld — see where this is used below.

     From the renderer's own walk, not from "does the previous block set
     _pairNext": that answer is wrong whenever a disabled block sits between the
     two, and wrong again for two _pairNext in a row. */
  const isPairSecond = selected ? pairSecondIds(blocks).has(selected.id) : false;
  const dropLine = (index: number) => <div className={`hpb-drop${dropIndex === index ? " is-active" : ""}`} />;

  /* Draft rescue.
     `updatePropertyPageAction` redirects on failure exactly as it does on
     success, so a rejected save re-navigates here, the page re-fetches, and
     this editor comes back seeded from the last SAVED page — an afternoon of
     blocks gone, with `?error=` in the address bar to show for it. The hook was
     written for this and names this editor in its own comment; it just was
     never attached. Everything here lives in React state and reaches the server
     through the hidden inputs above, so the DOM restore the hook does is
     invisible on the next render — `onRestore` is what actually puts the work
     back. */
  const draftKey = `property-page-draft:${site.id}:${pageKey}`;
  const json = <T,>(raw: string | undefined, fallback: T): T => {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  };
  const { stash: stashDraft, recovered: draftRecovered, registerForm } = useFormDraft(
    draftKey,
    saveFailed,
    {
      onRestore: (d) => {
        // `reset`, not `set`: a restored draft is a load, and an undo that
        // stepped back into the pre-restore state would silently re-throw away
        // the work that was just recovered.
        if (d._blocks_json !== undefined) history.reset(json<Block[]>(d._blocks_json, blocks));
        if (d._seo_json !== undefined) setSeo(json<Record<string, unknown>>(d._seo_json, {}));
        if (d._sub_tabs_json !== undefined) setSubTabs(json<SubTab[]>(d._sub_tabs_json, []));
        if (d._show_cms_list !== undefined) setShowCmsList(d._show_cms_list === "1");
        if (d._show_search !== undefined) setShowSearch(d._show_search === "1");
        if (d._show_tag_row !== undefined) setShowTags(d._show_tag_row === "1");
        if (d._cards_match_text !== undefined) setCardsMatchText(d._cards_match_text === "1");
        if (d._label_json !== undefined) setPageName(json<Record<string, string>>(d._label_json, {}));
        if (d._nav_link_mode !== undefined) setNavLinkMode(d._nav_link_mode === "anchor" ? "anchor" : "page");
        if (d._nav_anchor !== undefined) setNavAnchor(d._nav_anchor);
        if (d._hero_image !== undefined) setHeroImage(d._hero_image);
        if (d._hero_title_json !== undefined) setHeroTitle(json<Record<string, string>>(d._hero_title_json, {}));
        if (d._hero_subtitle_json !== undefined) setHeroSubtitle(json<Record<string, string>>(d._hero_subtitle_json, {}));
        if (d._hero_title_color !== undefined) setHeroTitleColor(d._hero_title_color);
        if (d._hero_subtitle_color !== undefined) setHeroSubtitleColor(d._hero_subtitle_color);
        if (d._hero_height !== undefined) setHeroHeight(d._hero_height);
        if (d._hero_layout !== undefined) setHeroLayout(d._hero_layout);
        if (d._hero_align !== undefined) setHeroAlign(d._hero_align);
        if (d._hero_mask_color !== undefined) setHeroMaskColor(d._hero_mask_color);
        if (d._hero_mask_opacity !== undefined) setHeroMaskOpacity(d._hero_mask_opacity);
      },
    },
  );

  /* The unsaved-work guard.
     The baseline is rebuilt from the PROPS, not copied out of state on the
     first render: the props are what the server currently holds, so a save that
     lands hands back the same values and the warning goes quiet by itself,
     while a save that is rejected re-renders with the OLD saved values and the
     warning correctly stays. A mount-time copy would have kept warning forever
     after every successful save, which is how a guard trains people to dismiss
     it. */
  const savedSnapshot = pageSnapshot({
    blocks: initialBlocks,
    seo: initialSeo,
    subTabs: initialSubTabs,
    showCmsList: initialShowCmsListValue,
    showSearch: initialShowSearch,
    showTags: initialShowTags,
    cardsMatchText: initialCardsMatchText,
    pageName: initialPageName,
    navLinkMode: initialNavLinkMode,
    navAnchor: initialNavAnchor,
    heroImage: initialHeroImage ?? "",
    heroTitle: initialHeroTitle ?? {},
    heroSubtitle: initialHeroSubtitle ?? {},
    heroTitleColor: initialHeroTitleColor ?? "#ffffff",
    heroSubtitleColor: initialHeroSubtitleColor ?? "#ffffff",
    heroHeight: initialHeroHeight ?? "",
    heroLayout: initialHeroLayout ?? "",
    heroAlign: initialHeroAlign,
    heroMaskColor: initialHeroMaskColor,
    heroMaskOpacity: initialHeroMaskOpacity,
  });
  const currentSnapshot = pageSnapshot({
    blocks, seo, subTabs, showCmsList, showSearch, showTags, cardsMatchText, pageName,
    navLinkMode, navAnchor, heroImage, heroTitle, heroSubtitle,
    heroTitleColor, heroSubtitleColor, heroHeight, heroLayout, heroAlign,
    heroMaskColor, heroMaskOpacity,
  });
  useUnsavedGuard(currentSnapshot !== savedSnapshot);

  if (!canWrite) return <section className="admin-card"><p>{zh ? "目前為檢視模式。更新文字、圖片與版面需要網站編輯權限。" : "View mode. Updating copy, images and layout requires site editor access."}</p>{blocks.map(block => <section key={block.id}><h3>{blockPurpose(block.type,block.config,zh,label(block.type))} {block.enabled === false ? (zh ? "（已隱藏）" : "(hidden)") : ""}</h3><BlockThumb block={block} siteSlug={site.slug} renderer={previewRenderer} /></section>)}</section>;

  return (
    <form
      action={action}
      className="hpb"
      noValidate
      ref={registerForm}
      onSubmit={(e) => stashDraft(e.currentTarget)}
    >
      <input type="hidden" name="_site_id" value={String(site.id)} />
      <input type="hidden" name="_site_json" value={JSON.stringify(site)} />
      <input type="hidden" name="_page_key" value={pageKey} />
      <input type="hidden" name="_blocks_json" value={JSON.stringify(blocks)} />
      <input type="hidden" name="_seo_json" value={JSON.stringify(seo)} />
      <input type="hidden" name="_sub_tabs_json" value={JSON.stringify(subTabs.filter((t) => Object.values(t.tag).some((v) => String(v).trim())))} />
      <input type="hidden" name="_show_cms_list" value={showCmsList ? "1" : "0"} />
      <input type="hidden" name="_show_search" value={showSearch ? "1" : "0"} />
      <input type="hidden" name="_show_tag_row" value={showTags ? "1" : "0"} />
      <input type="hidden" name="_cards_match_text" value={cardsMatchText ? "1" : "0"} />
      <input type="hidden" name="_label_json" value={JSON.stringify(pageName)} />
      <input type="hidden" name="_nav_link_mode" value={navLinkMode} />
      <input type="hidden" name="_nav_anchor" value={navAnchor} />
      <input type="hidden" name="_hero_image" value={heroImage} />
      <input type="hidden" name="_hero_title_json" value={JSON.stringify(heroTitle)} />
      <input type="hidden" name="_hero_subtitle_json" value={JSON.stringify(heroSubtitle)} />
      <input type="hidden" name="_hero_title_color" value={heroTitleColor} />
      <input type="hidden" name="_hero_subtitle_color" value={heroSubtitleColor} />
      <input type="hidden" name="_hero_height" value={heroHeight} />
      <input type="hidden" name="_hero_layout" value={heroLayout} />
      <input type="hidden" name="_hero_align" value={heroAlign} />
      <input type="hidden" name="_hero_mask_color" value={heroMaskColor} />
      <input type="hidden" name="_hero_mask_opacity" value={heroMaskOpacity} />

      {/* Silent recovery would look exactly like the save having worked, which
          is the one thing that must not be ambiguous after a failure. */}
      {/* `.hpb` is a two-column grid, so the notice has to span both or it
          takes the canvas's cell and pushes the inspector off. The class is the
          shared one from the site and stay editors — the same message in the
          same place should not look like three different messages. */}
      {draftRecovered && (
        <div style={{ gridColumn: "1 / -1", margin: "14px 18px 0" }}>
          <Callout className="se-draft-recovered" live="status" tone="warning">
            {zh
              ? "儲存失敗，已還原你未儲存的修改。請修正上方錯誤後再存一次。"
              : "The save failed. Your unsaved changes have been restored — fix the error above and save again."}
          </Callout>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="hpb-toolbar">
        <Segmented
          ariaLabel={zh ? "頁面操作模式" : "Page editor mode"}
          onChange={(mode) => { if (mode === "arrange") { setReordering(true); setSelectedId(null); } else setReordering(false); }}
          options={[
            { value: "edit", label: zh ? "編輯內容" : "Edit content" },
            ...(canWrite ? [{ value: "arrange" as const, label: zh ? "調整順序" : "Arrange sections" }] : [])
          ]}
          size="sm"
          value={reordering ? "arrange" : "edit"}
        />
        <Segmented
          ariaLabel={zh ? "編輯語言" : "Editing language"}
          onChange={setEditLocale}
          options={[{ value: "zh", label: "中文" }, { value: "en", label: "English" }]}
          size="sm"
          value={editLocale}
        />
        <UndoRedoButtons
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={history.undo}
          onRedo={history.redo}
          editLocale={editLocale}
        />
        <div className="hpb-toolbar__spacer" />
        {canWrite && (
          <SubmitButton className={buttonClass({ variant: "primary" })}>
            <Save /> {zh ? "儲存頁面設定" : "Save Page"}
          </SubmitButton>
        )}
      </div>

      {/* ── Canvas: interlocking pieces ── */}
      <div className="hpb-canvas">
        {blocks.length === 0 ? (
          <p className="hpb-empty">{zh ? "尚無版塊，從右側面板新增一個開始。" : "No blocks yet. Add one from the panel on the right."}</p>
        ) : (
          <div className="hpb-stack">
            {blocks.map((block, index) => (
              <div key={block.id} style={{ width: "100%" }}>
                {dropLine(index)}
                <div
                  className={`hpb-piece${selectedId === block.id ? " is-selected" : ""}${block.enabled === false ? " is-disabled" : ""}${dragIndex === index ? " is-dragging" : ""}`}
                  onClick={() => { if (!reordering) setSelectedId(block.id); }}
                  onDragOver={(e) => { if (reordering && canWrite) onDragOver(index, e); }}
                  onDrop={reordering && canWrite ? onDrop : undefined}
                >
                  <div className="hpb-piece__bar">
                    {reordering && canWrite && <span
                      className="hpb-handle"
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                      onClick={(e) => e.stopPropagation()}
                      title={zh ? "拖曳排序（也可用上移／下移）" : "Drag to reorder (or use move up / down)"}
                      aria-hidden="true"
                    >
                      <GripVertical />
                    </span>}
                    {/* The row that opens a block's settings was two bare spans
                        inside a div with an onClick: no tabindex, no role, so
                        the only way to open a block on a villa page was to click
                        it. The piece itself cannot take the role, because its
                        thumbnail is an iframe. Same shape as the homepage
                        editor's row, which has had this all along. */}
                    <span
                      className="hpb-piece__open"
                      data-block-open={block.id}
                      role={reordering ? undefined : "button"}
                      tabIndex={reordering ? undefined : 0}
                      aria-expanded={selectedId === block.id}
                      aria-label={zh ? `編輯「${blockPurpose(block.type, block.config, zh, label(block.type))}」區塊` : `Edit ${blockPurpose(block.type, block.config, zh, label(block.type))} section`}
                      onClick={(e) => { e.stopPropagation(); if (!reordering) setSelectedId(block.id); }}
                      onKeyDown={(e) => { if (!reordering) activateOnKey(e, () => setSelectedId(block.id)); }}
                    >
                      <span className="hpb-piece__idx">{index + 1}</span>
                      <span className="hpb-piece__name">{blockPurpose(block.type, block.config, zh, label(block.type))}<small>{label(block.type)}</small></span>
                    </span>
                    {reordering && canWrite && <><button
                      type="button"
                      className="hpb-piece__act"
                      onClick={(e) => { e.stopPropagation(); move(block.id, -1); }}
                      disabled={index === 0}
                      title={zh ? "上移" : "Move up"}
                      aria-label={zh ? "上移" : "Move up"}
                    >
                      <ChevronUp />
                    </button>
                    <button
                      type="button"
                      className="hpb-piece__act"
                      onClick={(e) => { e.stopPropagation(); move(block.id, 1); }}
                      disabled={index === blocks.length - 1}
                      title={zh ? "下移" : "Move down"}
                      aria-label={zh ? "下移" : "Move down"}
                    >
                      <ChevronDown />
                    </button></>}
                    {canWrite && !reordering && <button
                      type="button"
                      className={`hpb-piece__act${block.enabled !== false ? " hpb-piece__act--on" : ""}`}
                      onClick={(e) => { e.stopPropagation(); toggle(block.id); }}
                      title={block.enabled !== false ? (zh ? "顯示中（點擊隱藏）" : "Visible") : (zh ? "已隱藏（點擊顯示）" : "Hidden")}
                    >
                      {block.enabled !== false ? <Eye /> : <EyeOff />}
                    </button>}
                  </div>
                  {!reordering && <BlockThumb block={block} siteSlug={site?.slug} renderer={previewRenderer} />}
                </div>
              </div>
            ))}
            {dropLine(blocks.length)}
            <button
              type="button"
              className="hpb-add"
              onClick={() => setSelectedId(null)}
            >
              <Plus /> {zh ? "從右側面板新增版塊" : "Add a block from the panel"}
            </button>
          </div>
        )}
      </div>

      {/* ── Inspector ── */}
      <aside className="hpb-inspector">
        {selected ? (
          <>
            <div className="hpb-insp__head">
              <span className="hpb-insp__badge">{label(selected.type)}</span>
              <span className="hpb-insp__title">{blockPurpose(selected.type, selected.config, zh, label(selected.type))}</span>
              <button type="button" className="hpb-insp__close" onClick={() => setSelectedId(null)} title={zh ? "關閉" : "Close"}>
                <X />
              </button>
            </div>
            <div className="hpb-insp__body">
              <div className="hpb-insp__row" style={{ paddingTop: 0 }}>
                <div>
                  <div className="hpb-insp__row-txt">{zh ? "在頁面顯示" : "Show on page"}</div>
                  <div className="hpb-insp__row-sub">{zh ? "關閉則隱藏此版塊但保留設定" : "Hidden blocks keep their settings"}</div>
                </div>
                <button
                  type="button"
                  className={`hpb-switch${selected.enabled !== false ? " is-on" : ""}`}
                  onClick={() => toggle(selected.id)}
                  aria-label={zh ? "顯示開關" : "Visibility"}
                />
              </div>
              <div className="hpb-insp__section">
                <span className="hpb-insp__label">{groupTitle("content", zh)}</span>
                <BlockConfigForm key={selected.id} block={selected} zh={zh} editLocale={editLocale} onChange={(cfg) => updateConfig(selected.id, cfg)} site={site} contentSources={contentSourcesFor(site)} contentTags={contentTags} />
              </div>

              <BlockStyleInspector selected={selected} zh={zh} editLocale={editLocale} updateConfig={updateConfig} isPairSecond={isPairSecond} />

              <div className="hpb-insp__section">
                <button
                  type="button"
                  className="hpb-insp__delete"
                  onClick={async () => { if (await confirmRemove(selected, zh, ask)) remove(selected.id); }}
                >
                  <Trash2 /> {zh ? "刪除此版塊" : "Remove block"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="hpb-insp__head">
              <Settings2 style={{ width: 18, height: 18, color: "var(--muted)" }} />
              <span className="hpb-insp__title">{zh ? "頁面設定" : "Page Settings"}</span>
            </div>
            <div className="hpb-insp__body">
              {/* Page name (bilingual) */}
              {pageKey !== "homepage" && (
                <div className="hpb-insp__section" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
                  <span className="hpb-insp__label">{zh ? "頁面名稱" : "Page Name"}</span>
                  <Field label={editLocale === "zh" ? "中文名稱" : "English Name"}>
                    <input
                      type="text"
                      value={pageName[editLocale] ?? ""}
                      onChange={(e) => setPageName({ ...pageName, [editLocale]: e.target.value })}
                      placeholder={editLocale === "zh" ? "例：關於我們" : "e.g. About Us"}
                    />
                  </Field>
                </div>
              )}

              {/* Hero settings (page-level, not a block). The homepage draws its
                  hero from banner blocks and the save path stores no hero_* for
                  it, so showing these fields there lost whatever was typed. */}
              {pageKey !== "homepage" && (
              <FoldSection title={zh ? "頁面 Hero" : "Page Hero"}>
                <Field label={zh ? "Hero 圖片" : "Hero Image"}>
                  <ImageUploadInput value={heroImage} onChange={(url) => setHeroImage(url)} />
                </Field>
                <Field label={zh ? "Hero 標題" : "Hero Title"}>
                  <input
                    type="text"
                    value={heroTitle[editLocale] ?? ""}
                    onChange={(e) => setHeroTitle({ ...heroTitle, [editLocale]: e.target.value })}
                    placeholder={zh ? "頁面大標題" : "Page headline"}
                  />
                </Field>
                <Field label={zh ? "Hero 副標題" : "Hero Subtitle"}>
                  {/* An <input> cannot hold a newline at all — Enter submits the
                      form — so the field could not express a line break however
                      the front end rendered it (客戶: hero 的 subtitle 需要能換
                      行). Same auto-growing textarea the block headings use. */}
                  <HeadingInput
                    value={heroSubtitle[editLocale] ?? ""}
                    onChange={(v) => setHeroSubtitle({ ...heroSubtitle, [editLocale]: v })}
                    placeholder={zh ? "簡短描述" : "Short description"}
                  />
                </Field>
                <Field label={zh ? "標題顏色" : "Title Color"}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="color"
                      value={heroTitleColor}
                      onChange={(e) => setHeroTitleColor(e.target.value)}
                      style={{ width: "48px", height: "36px", cursor: "pointer", border: "1px solid var(--line)", borderRadius: "6px" }}
                    />
                    <input
                      type="text"
                      value={heroTitleColor}
                      onChange={(e) => setHeroTitleColor(e.target.value)}
                      placeholder="#ffffff"
                      style={{ flex: 1 }}
                    />
                  </div>
                </Field>
                <Field label={zh ? "副標題顏色" : "Subtitle Color"}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="color"
                      value={heroSubtitleColor}
                      onChange={(e) => setHeroSubtitleColor(e.target.value)}
                      style={{ width: "48px", height: "36px", cursor: "pointer", border: "1px solid var(--line)", borderRadius: "6px" }}
                    />
                    <input
                      type="text"
                      value={heroSubtitleColor}
                      onChange={(e) => setHeroSubtitleColor(e.target.value)}
                      placeholder="#ffffff"
                      style={{ flex: 1 }}
                    />
                  </div>
                </Field>
                <Field label={zh ? "Hero 版型" : "Hero Layout"}>
                  <div className="hpb-variant-pick" role="radiogroup" aria-label={zh ? "Hero 版型" : "Hero layout"}>
                    {([["", zh ? "覆蓋（文字在照片上）" : "Overlay"], ["split", zh ? "分割（照片在旁）" : "Split"]] as [string, string][]).map(([v, lbl]) => (
                      <button
                        key={v || "overlay"}
                        type="button"
                        role="radio"
                        aria-checked={(heroLayout === "split" ? "split" : "") === v}
                        className={`hpb-variant-pick__btn${(heroLayout === "split" ? "split" : "") === v ? " is-active" : ""}`}
                        onClick={() => setHeroLayout(v)}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <p className="hpb-field-hint">
                    {zh
                      ? "分割把照片放在文字旁邊、延伸到畫面邊緣，文字落在背景上。這時遽罩不再需要，也不會生效。"
                      : "Split puts the photograph beside the words and off the edge of the window, with the copy on the page background. The mask is neither needed nor applied."}
                  </p>
                </Field>
                <Field label={zh ? "Hero 高度" : "Hero Height"}>
                  <select
                    value={heroHeight}
                    onChange={(e) => setHeroHeight(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    {/* Not 55vh. With the height unset the winning rules are
                        `min(var(--hero-h, 78vh), …)` for a hero with a picture
                        and `var(--hero-h, 360px)` for a content index without
                        one — so 「中 (55vh)」 was the one option that made the
                        hero SHORTER than leaving it alone, while claiming to
                        keep it. */}
                    <option value="">{zh ? "預設 (依版面，約 78vh)" : "Default (per layout, ~78vh)"}</option>
                    <option value="small">{zh ? "小 (320px)" : "Small (320px)"}</option>
                    <option value="medium">{zh ? "中 (55vh)" : "Medium (55vh)"}</option>
                    <option value="large">{zh ? "大 (75vh)" : "Large (75vh)"}</option>
                    <option value="full">{zh ? "全螢幕 (100vh)" : "Full Screen (100vh)"}</option>
                  </select>
                </Field>
                {/* 客戶: 給每個頁面編輯加個 mask（可調顏色和透明度）。
                    Replaces the fixed gradients that used to wash every hero:
                    those peaked where no text sits and thinned out exactly
                    where the title does, so they dimmed the photo without
                    making anything easier to read. Only shown with a photo —
                    a wash over a plain colour is just another plain colour. */}
                {heroImage && (
                  <Field label={zh ? "Hero 遮罩" : "Hero mask"}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="color"
                        value={heroMaskColor || "#0a0a08"}
                        onChange={(e) => setHeroMaskColor(e.target.value)}
                        aria-label={zh ? "遮罩顏色" : "Mask colour"}
                        style={{ width: 44, height: 34, padding: 0 }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={heroMaskOpacity === "" ? 0 : Number(heroMaskOpacity)}
                        onChange={(e) => {
                          setHeroMaskOpacity(e.target.value);
                          // Picking an opacity before a colour would save a
                          // strength with nothing to paint, and the hero would
                          // not change — the "saved but no effect" case.
                          if (!heroMaskColor) setHeroMaskColor("#0a0a08");
                        }}
                        aria-label={zh ? "遮罩透明度" : "Mask opacity"}
                        style={{ flex: 1 }}
                      />
                      <span style={{ width: 46, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {heroMaskOpacity === "" ? "0" : heroMaskOpacity}%
                      </span>
                      {(heroMaskOpacity !== "" && Number(heroMaskOpacity) > 0) && (
                        <button
                          type="button"
                          onClick={() => { setHeroMaskOpacity(""); setHeroMaskColor(""); }}
                          aria-label={zh ? "清除遮罩" : "Clear mask"}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
                      {zh
                        ? "0% 等於沒有遮罩。照片較亮、白色標題看不清楚時再往上加；也可以改用深色標題，不必壓暗照片。"
                        : "0% means no mask. Raise it when a bright photo swallows the white title — or set a dark title colour instead and leave the photo alone."}
                    </p>
                  </Field>
                )}
                <Field label={zh ? "Hero 對齊（大標／小標／CTA）" : "Hero alignment (title / subtitle / CTA)"}>
                  <select
                    value={heroAlign}
                    onChange={(e) => setHeroAlign(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">{zh ? "預設（置中）" : "Default (centre)"}</option>
                    <option value="left">{zh ? "靠左" : "Left"}</option>
                    <option value="center">{zh ? "置中" : "Centre"}</option>
                    <option value="right">{zh ? "靠右" : "Right"}</option>
                  </select>
                </Field>
              </FoldSection>
              )}

              {/* Nav link mode (page vs anchor) */}
              {pageKey !== "homepage" && (
                <FoldSection title={zh ? "導航連結" : "Nav Link"}>
                  <Field label={zh ? "連結方式" : "Link type"}>
                    <div className="hpb-variant-pick">
                      {([
                        ["page",   zh ? "頁面" : "Page"],
                        ["anchor", zh ? "首頁區塊 #tag" : "Home section #tag"],
                      ] as ["page" | "anchor", string][]).map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          className={`hpb-variant-pick__btn${navLinkMode === val ? " is-active" : ""}`}
                          onClick={() => setNavLinkMode(val)}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </Field>
                  {navLinkMode === "anchor" && (
                    <Field label={zh ? "區塊標記（首頁編輯器設定的 tag）" : "Section tag (set in the homepage editor)"}>
                      <input
                        type="text"
                        value={navAnchor}
                        onChange={(e) => setNavAnchor(e.target.value.trim().replace(/\s+/g, "-").replace(/[#?&/\\%"'<>]/g, ""))}
                        placeholder={zh ? "例如 about、rooms" : "e.g. about, rooms"}
                        style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
                      />
                    </Field>
                  )}
                </FoldSection>
              )}

              {/* Add block palette */}
              <details className="hpb-insp__section admin-block-palette">
                <summary>{zh ? "新增區塊：選擇用途" : "Add a section: choose its purpose"}</summary>
                <input aria-label={zh ? "搜尋區塊用途" : "Search section purposes"} placeholder={zh ? "搜尋文字、圖片、文章、地圖…" : "Search text, images, articles, maps…"} value={blockSearch} onChange={(e) => setBlockSearch(e.target.value)} />
                <div className="hpb-palette">
                  {matchingBlockTypes.map((type) => (
                    <button key={type} type="button" className="hpb-palette__btn" onClick={() => add(type)}>
                      <span className="hpb-palette__name">{label(type)}</span>
                      <span className="hpb-palette__hint">{hint(type)}</span>
                    </button>
                  ))}
                  {blockSearch.trim() && matchingBlockTypes.length === 0 && (
                    <p className="hpb-palette__empty" role="status">
                      {zh ? "找不到符合的區塊用途，請換個關鍵字。" : "No matching section purposes. Try another search."}
                    </p>
                  )}
                </div>
              </details>

              {/* CMS article list toggle */}
              <FoldSection title={zh ? "文章列表" : "Article List"}>
                <div className="hpb-insp__row">
                  <div>
                    <div className="hpb-insp__row-txt">{zh ? "顯示文章列表" : "Show Article List"}</div>
                    <div className="hpb-insp__row-sub">{zh ? "區塊下方顯示 CMS 文章卡片" : "Show CMS article cards below blocks"}</div>
                  </div>
                  <button
                    type="button"
                    className={`hpb-switch${showCmsList ? " is-on" : ""}`}
                    onClick={() => setShowCmsList(!showCmsList)}
                    aria-label={zh ? "文章列表開關" : "Article list toggle"}
                  />
                </div>
                {showCmsList && pageKey !== "homepage" && (
                  <div className="hpb-insp__row">
                    <div>
                      <div className="hpb-insp__row-txt">{zh ? "顯示搜尋框" : "Show Search Box"}</div>
                      <div className="hpb-insp__row-sub">{zh ? "分類列上方的搜尋欄，關閉後版面較清爽" : "The search field above the category row"}</div>
                    </div>
                    <button
                      type="button"
                      className={`hpb-switch${showSearch ? " is-on" : ""}`}
                      onClick={() => setShowSearch(!showSearch)}
                      aria-label={zh ? "搜尋框開關" : "Search box toggle"}
                    />
                  </div>
                )}
                {/* Its own switch, not a mode shared with the search box
                    (客戶: 需要分開管理) — the two controls sit together but a
                    page may want either one without the other. */}
                {showCmsList && pageKey !== "homepage" && (
                  <div className="hpb-insp__row">
                    <div>
                      <div className="hpb-insp__row-txt">{zh ? "顯示分類列" : "Show Category Row"}</div>
                      <div className="hpb-insp__row-sub">{zh ? "文章上方的分類標籤（全部、關於我們…），關閉後不篩選、直接列出全部文章" : "The tag chips above the articles; off lists every entry unfiltered"}</div>
                    </div>
                    <button
                      type="button"
                      className={`hpb-switch${showTags ? " is-on" : ""}`}
                      onClick={() => setShowTags(!showTags)}
                      aria-label={zh ? "分類列開關" : "Category row toggle"}
                    />
                  </div>
                )}
                {/* 客戶: 內容要置中。Off by default: on every other index the wide
                    grid is the layout, and narrowing it uninvited would redraw
                    最新消息、旅遊專欄、選品 all at once. */}
                {showCmsList && pageKey !== "homepage" && (
                  <div className="hpb-insp__row">
                    <div>
                      <div className="hpb-insp__row-txt">{zh ? "卡片區對齊內文" : "Match Cards to Copy"}</div>
                      <div className="hpb-insp__row-sub">{zh ? "卡片區收窄到與上方內文同宽並置中，卡片內的標題、摘要、標籤也一併置中（適合一頁式版面）" : "Caps the card area to the copy's width and centres the card text — for a single-column page"}</div>
                    </div>
                    <button
                      type="button"
                      className={`hpb-switch${cardsMatchText ? " is-on" : ""}`}
                      onClick={() => setCardsMatchText(!cardsMatchText)}
                      aria-label={zh ? "卡片區對齊內文開關" : "Match cards to copy toggle"}
                    />
                  </div>
                )}
              </FoldSection>

              {/* Sub-tabs — only meaningful on a page that lists CMS entries.
                  The homepage renders no ContentFacets and its save path drops
                  sub_tabs, so the rows vanished on reload. */}
              {showCmsList && pageKey !== "homepage" && (
                <FoldSection title={zh ? "前台主題篩選" : "Public topic filters"}>
                  {!showTags && <p role="status" className="hpb-insp__hint">{zh ? "目前已關閉分類列；以下設定會保留，開啟分類列後才會顯示。" : "The filter row is currently hidden. These settings are retained and appear when the row is enabled."}</p>}
                  <p className="hpb-insp__hint hpb-subtab-hint">
                    {zh
                      ? "選擇文章已有的主題標籤，再設定訪客看到的篩選名稱。這裡不會新增文章分類。切換語言可分別設定中英文。"
                      : "Choose an existing article topic and set its public filter name. This does not create an article category. Switch languages to edit each translation."}
                  </p>
                  {subTabs.map((t, i) => {
                    const matches = matchingTagArticles(listingEntries, t.tag[editLocale] ?? "", editLocale === "zh" ? "zh" : "en");
                    return (
                    <div key={i} className="hpb-subtab-row">
                      <label className="hpb-subtab-field">
                        <span>{zh ? "篩選顯示名稱" : "Filter name"}</span>
                        <input
                          type="text"
                          value={t.label[editLocale] ?? ""}
                          onChange={(e) => setSubTabs(subTabs.map((x, j) => j === i ? { ...x, label: { ...x.label, [editLocale]: e.target.value } } : x))}
                          placeholder={zh ? "例如：公告" : "e.g. Announcements"}
                        />
                      </label>
                      <label className="hpb-subtab-field">
                        <span>{zh ? "對應文章標籤" : "Matching article tag"}</span>
                        <select
                          value={t.tag[editLocale] ?? ""}
                          onChange={(e) => {
                            const pair = availableTags.find(option => option[editLocale === "zh" ? "zh" : "en"] === e.target.value);
                            setSubTabs(subTabs.map((x, j) => j === i ? { ...x, tag: pair ? { ...x.tag, ...pair } : { ...x.tag, [editLocale]: e.target.value } } : x));
                          }}
                        >
                          <option value="">{zh ? "請選擇文章標籤" : "Choose an article tag"}</option>
                          {t.tag[editLocale] && !availableTags.some(option => option[editLocale === "zh" ? "zh" : "en"] === t.tag[editLocale]) && <option value={t.tag[editLocale]}>{t.tag[editLocale]}{tagsLoaded && !tagsLoading && !tagsError ? (zh ? "（尚無符合文章）" : " (no matching articles)") : ""}</option>}
                          {availableTags.map(option => <option key={tagKey(option.zh)} value={option[editLocale === "zh" ? "zh" : "en"]}>{option[editLocale === "zh" ? "zh" : "en"]}</option>)}
                        </select>
                      </label>
                      <button type="button" onClick={() => setSubTabs(subTabs.filter((_, j) => j !== i))} aria-label={zh ? "移除" : "Remove"}>×</button>
                      <details className="hpb-subtab-matches">
                        <summary>{tagsLoading ? (zh ? "載入符合文章…" : "Loading matches…") : tagsError ? (zh ? "無法取得符合文章，請重新載入" : "Matches unavailable. Reload articles.") : !tagsLoaded ? (zh ? "尚未載入符合文章" : "Matches not loaded") : (zh ? `${matches.length} 篇已發布文章` : `${matches.length} published articles`)}</summary>
                        {tagsLoaded && !tagsLoading && !tagsError && (matches.length ? <ul>{matches.map(article => <li key={article.id}><Link href={`/admin/cms/pages/${article.id}/edit`} target="_blank" rel="noopener noreferrer">{trs(article, "title", editLocale === "zh" ? "zh" : "en") || article.title}</Link></li>)}</ul> : <p>{zh ? "此篩選目前不會出現在前台。請確認文章已發布、屬於本頁收錄分類，並使用所選標籤。" : "This filter will not appear publicly. Check publication, included categories and the selected tag."}</p>)}
                      </details>
                    </div>
                  );})}
                  <button
                    type="button"
                    className={buttonClass({ size: "sm" })}
                    onClick={() => { setTagPickerOpen(true); void loadTags(); }}
                  >
                    + {zh ? "從標籤選擇（可複選）" : "Pick from tags"}
                  </button>
                  <button type="button" className={buttonClass({ size: "sm" })} disabled={tagsLoading} onClick={() => void loadTags(true)}>{zh ? "重新載入符合文章" : "Reload matching articles"}</button>
                  <Link className={buttonClass({ variant: "ghost", size: "sm" })} href="/admin/cms/tags" target="_blank" rel="noopener noreferrer">{zh ? "管理文章標籤" : "Manage article tags"}</Link>
                  <p className="hpb-insp__hint">
                    {zh
                      ? "符合篇數依本頁收錄分類中的已發布文章計算，尚未包含未儲存的文章變更。沒有符合文章的篩選不會顯示。未選任何篩選時，前台自動顯示文章使用的主題。"
                      : "Counts use published articles in this page’s included categories. Unsaved article edits are not included. Filters without matches stay hidden. With no curated filters, article topics appear automatically."}
                  </p>

                  {tagPickerOpen && (
                    <div
                      onClick={() => setTagPickerOpen(false)}
                      style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(20,18,14,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
                    >
                      <div ref={tagPickerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={zh ? "選擇標籤" : "Select tags"} onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 460, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #e7e3da" }}>
                          <strong style={{ fontSize: 14 }}>{zh ? "選擇標籤（可複選）" : "Select tags (multiple)"}</strong>
                          <button type="button" onClick={() => setTagPickerOpen(false)} aria-label={zh ? "關閉" : "Close"} style={{ background: "none", border: 0, cursor: "pointer", display: "flex", color: "#666", padding: 4 }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: 16, overflowY: "auto" }}>
                          {tagsLoading ? (
                            <p style={{ color: "#999", margin: 0 }}>{zh ? "載入中…" : "Loading…"}</p>
                          ) : tagsError ? (
                            <div>
                              <p style={{ color: "#a33", margin: "0 0 10px" }}>
                                {zh ? "標籤載入失敗，請重試。" : "Could not load tags. Please try again."}
                              </p>
                              <button
                                type="button"
                                className={buttonClass({ size: "sm" })}
                                onClick={() => { setTagsError(false); void loadTags(); }}
                              >
                                {zh ? "重新載入" : "Retry"}
                              </button>
                            </div>
                          ) : availableTags.length === 0 ? (
                            <p style={{ color: "#999", margin: 0 }}>{zh ? "這個分類的文章還沒有標籤。" : "This category's entries have no tags yet."}</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {availableTags.map((t) => {
                                const sel = isTagSelected(t);
                                return (
                                  <label key={`${t.zh}|${t.en}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: `1px solid ${sel ? "#16140f" : "#e7e3da"}`, borderRadius: 8, cursor: "pointer", background: sel ? "#faf8f3" : "#fff" }}>
                                    <input type="checkbox" checked={sel} onChange={() => toggleTag(t)} />
                                    <span style={{ fontSize: 13 }}>{t.zh}{t.en && t.en !== t.zh ? <span style={{ color: "#aaa" }}> / {t.en}</span> : null}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: "12px 18px", borderTop: "1px solid #e7e3da", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#999" }}>{zh ? `已選 ${subTabs.length}` : `${subTabs.length} selected`}</span>
                          <button type="button" onClick={() => setTagPickerOpen(false)} style={{ padding: "8px 20px", borderRadius: 999, border: "1px solid #16140f", background: "#16140f", color: "#fff", cursor: "pointer", fontSize: 13 }}>{zh ? "完成" : "Done"}</button>
                        </div>
                      </div>
                    </div>
                  )}
                </FoldSection>
              )}

              {/* SEO */}
              <FoldSection title={zh ? "頁面 SEO" : "Page SEO"}>
                <Field label={editLocale === "zh" ? "Meta 標題" : "Meta Title"}>
                  <input
                    type="text"
                    value={getVal(seo, "title", editLocale)}
                    onChange={(e) => setSeo(setVal(seo, "title", editLocale, e.target.value))}
                    placeholder={zh ? "留空則使用頁面標題" : "Leave empty to use page title"}
                  />
                </Field>
                <Field label={editLocale === "zh" ? "Meta 描述" : "Meta Description"}>
                  <textarea
                    rows={2}
                    value={getVal(seo, "description", editLocale)}
                    onChange={(e) => setSeo(setVal(seo, "description", editLocale, e.target.value))}
                    placeholder={zh ? "留空則使用預設描述" : "Leave empty to use default description"}
                  />
                </Field>
                {/* The renderer has always read seo.og_image for this page and
                    there was no field to set it, so the only way to give a page
                    its own share image was to edit the database. */}
                <Field label={editLocale === "zh" ? "分享圖 (1200×630)" : "Share image (1200×630)"}>
                  <input
                    type="text"
                    value={String(seo.og_image ?? "")}
                    onChange={(e) => setSeo({ ...seo, og_image: e.target.value })}
                    placeholder={zh ? "留空則使用頁面主圖" : "Leave empty to use the page hero"}
                  />
                </Field>
                {/* A page that must not rank — a thank-you page, a duplicate
                    kept for a campaign. There was no way to say so from here. */}
                <label className="hpb-insp__check">
                  <input
                    type="checkbox"
                    checked={seo.noindex === true}
                    onChange={(e) => setSeo({ ...seo, noindex: e.target.checked })}
                  />
                  <span>{zh ? "不要編入搜尋引擎索引" : "Keep out of search results"}</span>
                </label>
              </FoldSection>

              {/* Media library link */}
              {/* A new tab, because this is an exit the editor itself puts on
                  screen. A Next <Link> navigates client-side, which fires no
                  unload event, so the beforeunload guard cannot see it coming —
                  this button was a one-click way to lose every unsaved block on
                  the page, offered from inside the page. */}
              <FoldSection title={zh ? "媒體庫" : "Media Library"}>
                <Link
                  href="/admin/media"
                  target="_blank"
                  rel="noopener"
                  className={buttonClass({ size: "sm", block: true })}
                >
                  {zh ? "上傳 / 管理圖片（新分頁）" : "Upload / manage images (new tab)"}
                </Link>
              </FoldSection>
            </div>
          </>
        )}
      </aside>
    </form>
  );
}
