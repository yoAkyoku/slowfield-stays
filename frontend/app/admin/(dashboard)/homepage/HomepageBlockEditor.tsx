"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useOverlay } from "../../../modules/useOverlay";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  X,
  Settings2,
  Monitor,
  Save,
  ExternalLink
} from "lucide-react";
import type { AdminContentTag, AdminSite } from "../../modules/adminApi";
import SubmitButton from "../../modules/SubmitButton";
import { Button, ButtonLink, buttonClass, Callout, Segmented } from "../../ui";
import { Field, getVal, setVal } from "../../modules/blockFields";
import { PAD_PRESETS, isBlockBgColor, paintsOwnBackground } from "../../../modules/blockStyle";
import FoldSection from "../../modules/FoldSection";
import BlockBackgroundImage from "../../modules/BlockBackgroundImage";
import { BLOCK_LABELS, BLOCK_HINTS, groupTitle } from "../../modules/blockCatalogue";
import BlockLivePreview from "../../modules/BlockLivePreview";
import DraftPagePreview from "../../modules/DraftPagePreview";
import UndoRedoButtons from "../../modules/UndoRedoButtons";
import { useUndoableList } from "../../modules/useUndoableList";
import { useFormDraft } from "../../modules/useFormDraft";
import { useUnsavedGuard } from "../../modules/useUnsavedGuard";
import type { PreviewRenderer } from "../../../modules/previewRenderer";
import {
  AboutConfigForm,
  AttractionsConfigForm,
  ContactInfoConfigForm,
  EditorialConfigForm,
  VideoTextConfigForm,
  FeatureHeroConfigForm,
  AlternatingConfigForm,
  FaqConfigForm,
  FlowConfigForm,
  GalleryConfigForm,
  HeroBannerConfigForm,
  MapConfigForm,
  NewsletterConfigForm,
  OembedConfigForm,
  ContactFormConfigForm,
  FeatureBadgesConfigForm,
  HouseRulesConfigForm,
  PartnersConfigForm,
  PathwaysConfigForm,
  RichTextConfigForm,
  FeatureListConfigForm,
  RoomsConfigForm,
  SearchBarConfigForm,
  StaysConfigForm,
  buildContentSources,
  TableConfigForm,
  showsVAlign,
  RoleTypeControls,
  radioGroupKeys,
} from "../../modules/blockForms";
import PreviewOverlay, { previewDeviceClass } from "../../modules/PreviewOverlay";
import type { ContentSource } from "../../modules/blockForms";

type Block = {
  id: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

/* Both tables moved to modules/blockCatalogue — there were two copies, one
   here and one in PropertyBlockEditor, and they had drifted into calling the
   same block by different names. Re-exported so the existing import in
   homepage/page.tsx keeps working. */
export { BLOCK_LABELS, BLOCK_HINTS } from "../../modules/blockCatalogue";

const BLOCK_TYPES = Object.keys(BLOCK_LABELS);

/** Types a homepage may hold exactly one of.
 *
 *  Both are synthesised on load when the saved list has none, and the page
 *  renders the block in place of its built-in hero / search band, so a second
 *  one draws a second hero on the live site. The palette has always hidden
 *  these once one exists; naming the rule once is what stops the other ways in
 *  (duplicate) from quietly disagreeing with it. */
const SINGLETON_TYPES = new Set(["hero_banner", "search"]);

/** The width at which .hpb drops to one column and the inspector moves below
 *  the canvas (globals.css @media (max-width: 1080px)). Read here so the code
 *  that decides "is the panel still beside the canvas?" cannot disagree with
 *  the stylesheet that decides where it actually is. */
const STACKED_QUERY = "(max-width: 1080px)";

function makeId() {
  return Math.random().toString(36).slice(2, 8);
}

/** Everything in this admin is zh/en. Same helper as the article editor, so the
 *  two do not drift into two spellings of the same button. */
function bi(editLocale: string, zh: string, en: string): string {
  return editLocale === "zh" ? zh : en;
}

/** Enter/Space on a role="button" element, which the browser only does for real
 *  buttons. The row cannot BE a button: its thumbnail is an iframe of the real
 *  block, and interactive content is invalid inside a button. */
function activateOnKey(e: React.KeyboardEvent, run: () => void) {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault(); // Space would otherwise scroll the canvas
  run();
}

/** Scroll something into view, honouring the visitor's motion setting.
 *
 *  Smooth is the default because an instant jump gives no sense of which way
 *  the page moved, which is the whole point of the scroll here. Anyone who has
 *  asked the OS for less motion gets the jump instead: a long animated scroll
 *  across a tall canvas is exactly the vestibular trigger that setting exists
 *  for. Guarded because jsdom and older Safari have no matchMedia/scrollIntoView
 *  options and would throw rather than degrade. */
function revealElement(el: HTMLElement | null | undefined, block: ScrollLogicalPosition = "center") {
  if (!el) return;
  const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: still ? "auto" : "smooth", block });
}

/** Deep copy of a block with a fresh id.
 *
 *  Ids must not be shared: the list keys on them and the inspector selects by
 *  them, so a duplicate carrying the original's id would open the original's
 *  settings. structuredClone rather than a spread because config nests arrays
 *  and objects (partners items, gallery images, table rows) that a shallow copy
 *  would leave shared, making an edit to the duplicate's third brand also edit
 *  the original's. */
function cloneBlock(block: Block): Block {
  return { ...structuredClone(block), id: makeId() };
}

/** Whether deleting this block would lose work that cannot be retyped from the
 *  row alone. Used to decide if a delete is worth interrupting: confirming
 *  every delete trains people to dismiss the dialog without reading it, so a
 *  block added by a misclick and never filled in goes without one.
 *
 *  Underscore keys (_padY, _bgColor and friends) are styling the block would
 *  get back from its defaults, so they do not count as content. */
function blockHasContent(block: Block): boolean {
  const filled = (v: unknown): boolean => {
    if (v == null) return false;
    if (typeof v === "string") return v.replace(/<[^>]*>/g, "").trim().length > 0;
    if (typeof v === "number" || typeof v === "boolean") return true;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(filled);
    return false;
  };
  return Object.entries(block.config).some(([k, v]) => !k.startsWith("_") && filled(v));
}

/* ── Block Config Forms ────────────────────────────────────────────── */

function BlockConfigForm({
  block,
  zh,
  editLocale,
  onChange,
  contentSources,
  contentTags,
  site,
}: {
  block: Block;
  zh: boolean;
  editLocale: string;
  onChange: (c: Record<string, unknown>) => void;
  contentSources: ContentSource[];
  contentTags: AdminContentTag[];
  site: AdminSite;
}) {
  const c = block.config;

  switch (block.type) {
    case "hero_banner":
      return <HeroBannerConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "search":
      return <SearchBarConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "image_gallery":
      return <GalleryConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "rooms":
      return <RoomsConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} site={site} />;

    case "rich_text":
      return <RichTextConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "feature_list":
      return <FeatureListConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "flow":
      return <FlowConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "stays":
      return <StaysConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} contentSources={contentSources} contentTags={contentTags} siteSlug={site.slug} />;

    // BlockGallery reads only images, eyebrow and title — hiding the layout
    // options keeps the form from offering settings it would ignore.
    case "gallery":
      return <GalleryConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} showLayoutOptions={false} />;

    case "pathways":
      return <PathwaysConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "editorial":
      return <EditorialConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;
    case "video_text":
      return <VideoTextConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;
    case "feature_hero":
      return <FeatureHeroConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;
    case "alternating":
      return <AlternatingConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "about":
      return <AboutConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "newsletter":
      return <NewsletterConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "faq_accordion":
      return <FaqConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "table":
      return <TableConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "contact_info":
      return <ContactInfoConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "map":
      return <MapConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} site={site} />;

    case "attractions":
      return <AttractionsConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "partners":
      return <PartnersConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "contact_form":
      return <ContactFormConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} site={site} />;

    case "feature_badges":
      return <FeatureBadgesConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} site={site} />;

    case "house_rules":
      return <HouseRulesConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    case "oembed":
      return <OembedConfigForm c={c} zh={zh} editLocale={editLocale} onChange={onChange} />;

    default:
      return null;
  }
}

/* ── Rich text config ──────────────────────────────────────────────── */




/* photo() and StaysThumb existed only to draw the skeleton thumbnails, and
   went with them. */

function BlockThumb({ block, locale, siteSlug, renderer }: { block: Block; locale: string; siteSlug: string; renderer: PreviewRenderer }) {
  const c = block.config;
  const eyebrow = getVal(c, "eyebrow", locale);
  const title = getVal(c, "title", locale) || getVal(c, "headline", locale);
  const pair = BLOCK_LABELS[block.type] ?? [block.type, block.type];
  const fallback = locale === "zh" ? pair[0] : pair[1];
  const images = Array.isArray(c.images) ? (c.images as unknown[]) : [];
  const items = Array.isArray(c.items) ? (c.items as Array<Record<string, unknown>>) : [];
  const steps = Array.isArray(c.steps) ? (c.steps as Array<Record<string, unknown>>) : [];

  /* Nothing but the live frame. This used to print the block's eyebrow and
     title above the preview, which repeated what the card's own header row
     already says two lines higher and stole height from the one part of the
     row that shows something (客戶: 內容塊不要顯示預覽以外的內容，預覽要佔滿
     下方空間). */
  return (
    <div className="hpb-thumb">
      {/* The real block, drawn by the front-end components. The hand-made
          skeleton below stands in only until the frame has loaded — and for
          block types the homepage renderer does not draw. */}
      <BlockLivePreview type={block.type} config={c} siteSlug={siteSlug} renderer={renderer} />
    </div>
  );
}

/**
 * The saved blocks with the two that the front page always draws put back.
 *
 * Hoisted out of the useUndoableList initialiser so the unsaved-work baseline
 * can be built from the same function: the seeded hero and search bar are part
 * of what the editor considers "the saved page", and a baseline computed
 * without them would call an untouched homepage dirty from the first render.
 */
function seedBlocks(initialBlocks: Block[]): Block[] {
  // The front page has always had a hero; it just was not a block, so the
  // editor listed everything below it and nothing for the hero itself. One is
  // shown at the top when the saved blocks have none, which is how a hero
  // becomes reorderable and stylable like the rest. The page renders the block
  // in place of its built-in hero once it exists, so nothing doubles up.
  //
  // The search bar was hard-coded between the hero and the block list —
  // every homepage had it, so it is synthesised here the same way the hero
  // is, rather than only appearing once someone happens to add one.
  // Hero first, so the search bar has somewhere fixed to insert after. Doing
  // this the other way around — search always at index 0 — put the search
  // bar ahead of a hero that already existed but wasn't first in the saved
  // order (an admin had dragged it down), which page.tsx's own synthesis
  // never would.
  let seeded = initialBlocks;
  if (!seeded.some((b) => b.type === "hero_banner")) {
    seeded = [{ id: "hero-banner", type: "hero_banner", enabled: true, config: {} }, ...seeded];
  }
  if (!seeded.some((b) => b.type === "search")) {
    const heroIdx = seeded.findIndex((b) => b.type === "hero_banner");
    const insertAt = heroIdx === -1 ? 0 : heroIdx + 1;
    seeded = [...seeded.slice(0, insertAt), { id: "search-bar", type: "search", enabled: true, config: {} }, ...seeded.slice(insertAt)];
  }
  return seeded;
}

/** Everything this editor would submit, as one comparable string.
 *
 *  Built here rather than at the two call sites so the baseline and the current
 *  state cannot disagree about key order and report an untouched homepage as
 *  having unsaved work. The three fields are exactly the three hidden inputs
 *  that carry editor state — `_site_id` and `_site_json` are not editable here,
 *  so a change in them is not work to warn about. */
function homepageSnapshot(v: {
  blocks: Block[];
  seo: Record<string, unknown>;
  nameTranslations: Record<string, string>;
}): string {
  return JSON.stringify([v.blocks, v.seo, v.nameTranslations]);
}

/* ── Main Editor ───────────────────────────────────────────────────── */

export default function HomepageBlockEditor({
  initialBlocks,
  locale,
  site,
  contentTags = [],
  action,
  saveFailed,
}: {
  initialBlocks: Block[];
  locale: string;
  site: AdminSite;
  contentTags?: AdminContentTag[];
  action: (formData: FormData) => void;
  /** The last save came back rejected. `updateHomepageAction` redirects on
   *  failure as well as on success, so a 422 remounts this editor seeded from
   *  the last SAVED homepage and takes every unsaved block with it — see
   *  useFormDraft, which is what puts the work back. */
  saveFailed?: boolean;
}) {
  const zh = locale === "zh";
  const history = useUndoableList<Block[]>(() => seedBlocks(initialBlocks));
  // Named so the ~15 existing call sites keep reading as ordinary state; the
  // second argument is the coalescing tag (see historyStack), and everything
  // that omits it is a structural change worth exactly one undo step.
  const blocks = history.value;
  const setBlocks = history.set;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editLocale, setEditLocale] = useState<string>(locale);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  // Which page the overlay shows. "draft" is the default because the reason to
  // press 預覽 is almost always to look at the change just made; "saved" stays
  // reachable because it is the only view with the real header, footer and
  // cross-block layout.
  const [previewSource, setPreviewSource] = useState<"draft" | "saved">("draft");
  const canvasRef = useRef<HTMLDivElement | null>(null);
  // Which row should take focus once the pending delete has rendered. "" means
  // the list is now empty, so focus goes to the empty state instead.
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [paletteWanted, setPaletteWanted] = useState(false);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const inspectorRef = useRef<HTMLElement | null>(null);
  // The block a newly added one should land after. Opening the palette clears
  // selectedId (that is what renders it), so the block the editor was working
  // on has to be remembered separately or "insert next to it" has nothing to
  // aim at by the time a palette button is pressed.
  const anchorIdRef = useRef<string | null>(null);
  // Set to a new block's id by add(), consumed by the effect that reveals it
  // once React has rendered the row.
  const [addedId, setAddedId] = useState<string | null>(null);
  // Whether the inspector is below the canvas rather than beside it. Not read
  // during render setup: matchMedia does not exist while this is server
  // rendered, and seeding it false on both sides is what keeps the first client
  // render from mismatching the HTML.
  const [stacked, setStacked] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(STACKED_QUERY);
    const sync = () => setStacked(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Escape closed nothing: the preview covers the whole screen and its only
  // exits were the backdrop and an X with no accessible name, so anyone not
  // using a mouse was stuck inside it. The shared hook also holds the page
  // still and hands focus back to the button that opened it.
  useOverlay(previewOpen, () => setPreviewOpen(false));

  // Dynamic content sources for the Featured Collection block
  const contentSources = useMemo(() => buildContentSources(site), [site]);

  // SEO + site-name translations (stored in homepage.seo / settings.name_translations)
  const existingSettings = useMemo(() => (site.settings ?? {}) as Record<string, unknown>, [site.settings]);
  const existingHomepage = (existingSettings.homepage ?? {}) as Record<string, unknown>;
  /* Named once and used twice — to seed the state, and to build the "what the
     server currently holds" baseline the unsaved-work guard compares against.
     Repeating the derivation at the second site is how the two drift and an
     untouched editor starts claiming unsaved work. */
  const initialSeo = (existingHomepage.seo ?? {}) as Record<string, unknown>;
  const initialNameTranslations = useMemo(() => {
    const nt = (existingSettings.name_translations ?? {}) as Record<string, string>;
    return { en: nt.en ?? site.name ?? "", zh: nt.zh ?? site.name ?? "" };
  }, [existingSettings, site.name]);
  const [seo, setSeo] = useState<Record<string, unknown>>(initialSeo);
  const [nameTranslations, setNameTranslations] = useState<Record<string, string>>(initialNameTranslations);

  // Memoised because a useCallback below depends on it: rebuilt every render it
  // would defeat that memo entirely.
  const label = useCallback((type: string) => {
    const pair = BLOCK_LABELS[type] ?? [type, type];
    return zh ? pair[0] : pair[1];
  }, [zh]);
  const hint = (type: string) => {
    const pair = BLOCK_HINTS[type] ?? ["", ""];
    return zh ? pair[0] : pair[1];
  };

  /** Select a block and remember it as where the next added block belongs.
   *  Everything that opens a block goes through here so the anchor cannot fall
   *  out of step with the selection. Deselecting (closing the panel, opening
   *  the palette) deliberately does not clear the anchor: opening the palette
   *  is exactly when the editor still means "next to the one I was on". */
  const select = useCallback((id: string) => {
    anchorIdRef.current = id;
    setSelectedId(id);
  }, []);

  const toggle = (id: string) =>
    setBlocks((cur) => cur.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)));

  /** Delete, guarded only when there is something to lose, and naming what goes.
   *
   *  There is no undo and no version history here, and the villa pages are built
   *  from this list, so the dialog is the only thing between a mis-aimed click
   *  and a rebuilt block. The old prompt asked "刪除此版塊？" about no block in
   *  particular, which is not enough to catch aiming at the wrong row. */
  const remove = useCallback((id: string) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    if (blockHasContent(block)) {
      const name = label(block.type);
      const msg = zh
        ? `刪除「${name}」區塊？裡面的設定會一併移除，且無法復原。`
        : `Delete this "${name}" block? Its settings go with it and cannot be restored.`;
      if (!window.confirm(msg)) return;
    }
    const index = blocks.findIndex((b) => b.id === id);
    setBlocks((cur) => cur.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
    // Focus used to fall to <body>, dropping a keyboard user at the top of the
    // page after every delete. Hand it to the row that takes the deleted one's
    // place (the one below, or the one above when the last row goes), or to the
    // empty state's button when nothing is left.
    //
    // Targeted by block id rather than by position: the callback runs before
    // React has re-rendered, so an index into the list of rows still on screen
    // would resolve against the pre-delete DOM and land somewhere else.
    const heir = blocks[index + 1] ?? blocks[index - 1] ?? null;
    setPendingFocusId(heir ? heir.id : "");
    // A deleted block cannot anchor the next insert; hand the role to the heir
    // so an add straight after a delete still lands where the work was.
    if (anchorIdRef.current === id) anchorIdRef.current = heir ? heir.id : null;
  }, [blocks, selectedId, zh, label, setBlocks]);

  // Runs after the delete has been committed, so the heir row exists.
  useEffect(() => {
    if (pendingFocusId === null) return;
    const root = canvasRef.current;
    const target = pendingFocusId
      ? root?.querySelector<HTMLElement>(`[data-block-open="${pendingFocusId}"]`)
      : root?.querySelector<HTMLElement>(".hpb-empty-cta");
    target?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId]);

  // Which selection the inspector has already been scrolled to, so that a
  // resize across the breakpoint (or any unrelated re-render) cannot yank a
  // narrow viewport down to a panel the editor never asked for a second time.
  const revealedForRef = useRef<string | null>(null);

  // Stacked layout only: the inspector sits below a canvas that is taller than
  // the screen, so tapping a block moved nothing on screen and its settings
  // were measured at y=1897 on a 812px-tall viewport, most of two screens down.
  // Deliberately not done on desktop, where the panel is already beside the
  // canvas and scrolling would move the block out from under the cursor.
  useEffect(() => {
    if (!selectedId) {
      revealedForRef.current = null;
      return;
    }
    if (!stacked || revealedForRef.current === selectedId) {
      revealedForRef.current = selectedId;
      return;
    }
    revealedForRef.current = selectedId;
    revealElement(inspectorRef.current, "start");
  }, [stacked, selectedId]);

  // Runs once the added block's row exists.
  useEffect(() => {
    if (!addedId) return;
    // Focus went to <body>, so the settings that had just opened on screen were
    // a full document's worth of tabbing away and the palette was gone. The
    // panel takes focus instead, putting its fields one Tab from the cursor.
    // preventScroll because the scrolling is decided below: letting focus do it
    // would drag a desktop editor to the panel it can already see.
    inspectorRef.current?.focus({ preventScroll: true });
    // Stacked viewports are handled by the effect above, which takes them to
    // the inspector; showing the new row there would scroll away from the
    // settings the editor just opened.
    if (!stacked) {
      revealElement(canvasRef.current?.querySelector<HTMLElement>(`[data-block-open="${addedId}"]`));
    }
    setAddedId(null);
  }, [addedId, stacked]);

  /** Add a block next to the one being worked on, then take the editor to it.
   *
   *  It used to append to the end and leave the page where it was: adding a FAQ
   *  while editing the fourth of eight blocks put the new row 1082px below the
   *  fold with scrollY still 0, so the only sign anything had happened was the
   *  title changing in the far-right panel. Appending is kept only for the case
   *  it is actually right (nothing selected), because there is no other block
   *  to be next to. */
  const add = (type: string) => {
    const nb: Block = { id: makeId(), type, enabled: true, config: {} };
    // Read into a local before the updater: React invokes state updaters lazily
    // (and twice in development), by which point the ref has already been moved
    // on to nb.id below, so the updater found no such block and appended, which
    // is the very bug this is meant to fix.
    const anchor = anchorIdRef.current;
    setBlocks((cur) => {
      const at = anchor ? cur.findIndex((b) => b.id === anchor) : -1;
      if (at === -1) return [...cur, nb];
      return [...cur.slice(0, at + 1), nb, ...cur.slice(at + 1)];
    });
    setSelectedId(nb.id);
    // The next add should follow this one, so adding three blocks in a row
    // builds them in the order they were picked instead of stacking them all
    // against the original anchor in reverse.
    anchorIdRef.current = nb.id;
    setAddedId(nb.id);
  };

  /** Duplicate: the everyday move this editor had no answer for. A configured
   *  gallery or a partners row with eight brands had to be rebuilt field by
   *  field to get a second one. */
  const duplicate = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i === -1) return;
    // The palette hides hero_banner and search once one exists, but duplicate
    // went around that rule and produced two heroes and two search bars (both
    // measured). The button is disabled for these types; this guard is what
    // holds when it is reached some other way.
    if (SINGLETON_TYPES.has(blocks[i].type)) return;
    const copy = cloneBlock(blocks[i]);
    const next = [...blocks];
    next.splice(i + 1, 0, copy);
    setBlocks(next);
    // Open the copy, not the original: the only reason to duplicate is to change
    // something, and leaving the original selected is how you edit the wrong one.
    select(copy.id);
  };

  /** Keyboard reorder. Dragging was the only way to move a block, and the grip
   *  is a span that never takes focus, so the order of the homepage could not
   *  be changed from the keyboard at all. */
  const move = (id: string, dir: -1 | 1) => {
    setBlocks((cur) => {
      const i = cur.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  /** Tagged per block, so a run of keystrokes in one field is one undo step
   *  while moving to a different block starts a new one. Untagged would put an
   *  undo between every character. */
  const updateConfig = (id: string, config: Record<string, unknown>) =>
    setBlocks((cur) => cur.map((b) => (b.id === id ? { ...b, config } : b)), `config:${id}`);

  // ── drag-and-drop reorder ──
  const onDragOver = (index: number, e: React.DragEvent) => {
    if (dragIndex === null) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY - rect.top > rect.height / 2;
    setDropIndex(after ? index + 1 : index);
  };
  const onDrop = () => {
    if (dragIndex === null || dropIndex === null) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const next = [...blocks];
    const [moved] = next.splice(dragIndex, 1);
    // dropIndex is a GAP index, not a row index: onDragOver picks index or
    // index + 1 from which half of the row the cursor is over, and dropLine()
    // draws a line in that gap. Removing the dragged block first shifts every
    // later gap down by one, which is what this -1 corrects. (The article
    // editor highlights a whole row instead, so it must NOT subtract; the two
    // look alike and the adjustment is not interchangeable.)
    const target = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
    next.splice(target, 0, moved);
    setBlocks(next);
    setDragIndex(null);
    setDropIndex(null);
  };

  /** Send focus to the first block in the add-block palette.
   *
   *  Deselecting is what renders the palette, and that has not happened yet when
   *  this runs, so the move is deferred to the effect below rather than done
   *  here (a requestAnimationFrame still fires before React commits, and finds
   *  no palette to focus). */
  const focusPalette = () => setPaletteWanted(true);

  useEffect(() => {
    if (!paletteWanted) return;
    paletteRef.current?.querySelector<HTMLElement>("button")?.focus();
    setPaletteWanted(false);
  }, [paletteWanted]);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  // Villa sites keep their homepage blocks under the same settings.homepage.blocks
  // key, but the published page for a child site is /stays/<slug>, which
  // middleware rewrites to /property/<slug> on exactly this test, so those
  // blocks are drawn by PropertyPageRenderer. Thumbnails rendered through the
  // homepage renderer showed a different hero component and different block
  // wrappers than the page the editor was actually building.
  const renderer: PreviewRenderer = site.parent_site_id != null ? "property" : "homepage";
  // Below 1080px the panel is under the canvas, not to the right of it, so the
  // copy pointing at "the panel on the right" named a place that is not there.
  const panelWhere = stacked
    ? bi(editLocale, "從下方面板挑選", "pick from the panel below")
    : bi(editLocale, "從右側面板挑選", "pick from the panel on the right");
  const dropLine = (index: number) => <div className={`hpb-drop${dropIndex === index ? " is-active" : ""}`} />;

  /* Draft rescue.
     `updateHomepageAction` redirects on failure exactly as it does on success,
     so a rejected save re-navigates here, the page re-fetches, and this editor
     comes back seeded from the last SAVED homepage — every block added or
     rearranged since it was opened, gone, with `?error=` in the address bar to
     show for it. The state here reaches the server through the hidden inputs
     above, so the DOM restore the hook does is overwritten on the next render;
     `onRestore` is what actually puts the work back. */
  const draftKey = `homepage-draft:${site.id}`;
  const { stash: stashDraft, recovered: draftRecovered, registerForm } = useFormDraft(
    draftKey,
    saveFailed,
    {
      onRestore: (d) => {
        const json = <T,>(raw: string | undefined, fallback: T): T => {
          if (!raw) return fallback;
          try { return JSON.parse(raw) as T; } catch { return fallback; }
        };
        // `reset`, not `set`: a restored draft is a load, and an undo that
        // stepped back into the pre-restore state would silently re-throw away
        // the work that was just recovered.
        if (d._blocks_json !== undefined) history.reset(json<Block[]>(d._blocks_json, blocks));
        if (d._seo_json !== undefined) setSeo(json<Record<string, unknown>>(d._seo_json, {}));
        if (d._name_translations_json !== undefined) {
          setNameTranslations(json<Record<string, string>>(d._name_translations_json, {}));
        }
      },
    },
  );

  /* The unsaved-work guard.
     The baseline is rebuilt from the PROPS rather than copied out of state on
     the first render, so a save that lands hands back the same values and the
     warning goes quiet by itself, while a save that is rejected re-renders with
     the OLD saved values and the warning correctly stays. A mount-time copy
     would warn forever after every successful save, which is how a guard trains
     people to dismiss it unread. */
  const savedSnapshot = homepageSnapshot({
    blocks: seedBlocks(initialBlocks),
    seo: initialSeo,
    nameTranslations: initialNameTranslations,
  });
  const currentSnapshot = homepageSnapshot({ blocks, seo, nameTranslations });
  useUnsavedGuard(currentSnapshot !== savedSnapshot);

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
      <input type="hidden" name="_blocks_json" value={JSON.stringify(blocks)} />
      <input type="hidden" name="_seo_json" value={JSON.stringify(seo)} />
      <input type="hidden" name="_name_translations_json" value={JSON.stringify(nameTranslations)} />

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
        <Button icon={<Monitor />} onClick={() => setPreviewOpen(true)}>
          {zh ? "預覽首頁" : "Preview"}
        </Button>
        <SubmitButton className={buttonClass({ variant: "primary" })}>
          <Save /> {zh ? "儲存首頁設定" : "Save Homepage"}
        </SubmitButton>
      </div>

      {/* ── Canvas: interlocking pieces ── */}
      <div className="hpb-canvas" ref={canvasRef}>
        {blocks.length === 0 ? (
          /* The empty state was a sentence pointing at a panel and nothing to
             press, so the first thing anyone had to do here was hunt. It now
             carries the one control it was describing. */
          <div className="hpb-empty">
            <strong>{bi(editLocale, "還沒有任何版塊", "No blocks yet")}</strong>
            <span>{bi(editLocale, `先加一個主視覺，或${panelWhere}其他版塊。`, `Start with a hero, or ${panelWhere} to add another.`)}</span>
            <Button icon={<Plus />} onClick={() => { setSelectedId(null); focusPalette(); }} variant="primary">
              {bi(editLocale, "選擇要新增的版塊", "Choose a block to add")}
            </Button>
          </div>
        ) : (
          <div className="hpb-stack">
            {blocks.map((block, index) => (
              <div key={block.id} style={{ width: "100%" }}>
                {dropLine(index)}
                <div
                  className={`hpb-piece${selectedId === block.id ? " is-selected" : ""}${block.enabled === false ? " is-disabled" : ""}${dragIndex === index ? " is-dragging" : ""}`}
                  onClick={() => select(block.id)}
                  onDragOver={(e) => onDragOver(index, e)}
                  onDrop={onDrop}
                >
                  <div className="hpb-piece__bar">
                    {/* aria-hidden: dragging is mouse-only and the move up /
                        down buttons are the keyboard route, so announcing an
                        unreachable grip only adds noise. */}
                    <span
                      className="hpb-handle"
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                      onClick={(e) => e.stopPropagation()}
                      title={zh ? "拖曳排序（也可用上移／下移）" : "Drag to reorder (or use move up / down)"}
                      aria-hidden="true"
                    >
                      <GripVertical />
                    </span>
                    {/* The row was a bare div with onClick: reachable by mouse
                        only, and announced as plain text with no hint that it
                        opens anything. The piece itself cannot take the role,
                        because its thumbnail is an iframe. */}
                    <span
                      className="hpb-piece__open"
                      data-block-open={block.id}
                      role="button"
                      tabIndex={0}
                      aria-expanded={selectedId === block.id}
                      aria-label={zh ? `編輯「${label(block.type)}」區塊` : `Edit ${label(block.type)} block`}
                      onClick={() => select(block.id)}
                      onKeyDown={(e) => activateOnKey(e, () => select(block.id))}
                    >
                      <span className="hpb-piece__idx">{index + 1}</span>
                      <span className="hpb-piece__name">{label(block.type)}</span>
                    </span>
                    <button
                      type="button"
                      className="hpb-piece__act"
                      onClick={(e) => { e.stopPropagation(); move(block.id, -1); }}
                      disabled={index === 0}
                      title={bi(editLocale, "上移", "Move up")}
                      aria-label={bi(editLocale, "上移", "Move up")}
                    >
                      <ChevronUp />
                    </button>
                    <button
                      type="button"
                      className="hpb-piece__act"
                      onClick={(e) => { e.stopPropagation(); move(block.id, 1); }}
                      disabled={index === blocks.length - 1}
                      title={bi(editLocale, "下移", "Move down")}
                      aria-label={bi(editLocale, "下移", "Move down")}
                    >
                      <ChevronDown />
                    </button>
                    {/* Disabled rather than hidden for the one-per-page types:
                        a control that vanishes on some rows reads as a missing
                        feature, while a disabled one with a reason attached
                        says the rule out loud. */}
                    {(() => {
                      const only = SINGLETON_TYPES.has(block.type);
                      const dupLabel = only
                        ? bi(editLocale, `「${label(block.type)}」每頁只能有一個，無法複製`, `Only one ${label(block.type)} per page, cannot duplicate`)
                        : bi(editLocale, "複製此版塊", "Duplicate block");
                      return (
                        <button
                          type="button"
                          className="hpb-piece__act"
                          onClick={(e) => { e.stopPropagation(); duplicate(block.id); }}
                          disabled={only}
                          title={dupLabel}
                          aria-label={dupLabel}
                        >
                          <Copy />
                        </button>
                      );
                    })()}
                    {/* aria-pressed carries the state the eye icon shows: the
                        icon swap alone says nothing to a screen reader. */}
                    <button
                      type="button"
                      className={`hpb-piece__act${block.enabled !== false ? " hpb-piece__act--on" : ""}`}
                      onClick={(e) => { e.stopPropagation(); toggle(block.id); }}
                      aria-pressed={block.enabled === false}
                      title={block.enabled !== false ? bi(editLocale, "顯示中（點擊隱藏）", "Visible (click to hide)") : bi(editLocale, "已隱藏（點擊顯示）", "Hidden (click to show)")}
                      aria-label={block.enabled !== false ? bi(editLocale, "隱藏此版塊", "Hide block") : bi(editLocale, "顯示此版塊", "Show block")}
                    >
                      {block.enabled !== false ? <Eye /> : <EyeOff />}
                    </button>
                    <button
                      type="button"
                      className="hpb-piece__act is-danger"
                      onClick={(e) => { e.stopPropagation(); remove(block.id); }}
                      title={bi(editLocale, "刪除此版塊", "Remove block")}
                      aria-label={bi(editLocale, "刪除此版塊", "Remove block")}
                    >
                      <Trash2 />
                    </button>
                  </div>
                  <BlockThumb block={block} locale={editLocale} siteSlug={site.slug} renderer={renderer} />
                </div>
              </div>
            ))}
            {dropLine(blocks.length)}
            {/* This looked like the add button and behaved like nothing: its
                only effect was swapping the inspector on the far right, too far
                from the cursor to read as a response. It now also moves focus
                into the palette it opens, so the click lands somewhere. */}
            <button
              type="button"
              className="hpb-add"
              onClick={() => { setSelectedId(null); focusPalette(); }}
            >
              <Plus /> {bi(editLocale, `新增版塊（${panelWhere}）`, `Add a block (${panelWhere})`)}
            </button>
          </div>
        )}
      </div>

      {/* ── Inspector ── */}
      {/* tabIndex -1 so adding a block can hand focus here without putting the
          panel itself into the Tab order. aria-label rather than a heading
          reference because the head swaps between a block's name and the
          homepage settings, and the region needs a name in both states. */}
      <aside
        className="hpb-inspector"
        ref={inspectorRef}
        tabIndex={-1}
        aria-label={selected ? bi(editLocale, `${label(selected.type)}設定`, `${label(selected.type)} settings`) : bi(editLocale, "首頁設定", "Homepage settings")}
      >
        {selected ? (
          <>
            <div className="hpb-insp__head">
              <span className="hpb-insp__badge">{label(selected.type)}</span>
              <span className="hpb-insp__title">{label(selected.type)}</span>
              <button
                type="button"
                className="hpb-insp__close"
                onClick={() => setSelectedId(null)}
                title={bi(editLocale, "關閉設定面板", "Close settings panel")}
                aria-label={bi(editLocale, "關閉設定面板", "Close settings panel")}
              >
                <X />
              </button>
            </div>
            <div className="hpb-insp__body">
              <div className="hpb-insp__row" style={{ paddingTop: 0 }}>
                <div>
                  <div className="hpb-insp__row-txt">{zh ? "在首頁顯示" : "Show on homepage"}</div>
                  <div className="hpb-insp__row-sub">{zh ? "關閉則隱藏此版塊但保留設定" : "Hidden blocks keep their settings"}</div>
                </div>
                <button
                  type="button"
                  className={`hpb-switch${selected.enabled !== false ? " is-on" : ""}`}
                  onClick={() => toggle(selected.id)}
                  role="switch"
                  aria-checked={selected.enabled !== false}
                  aria-label={zh ? "顯示開關" : "Visibility"}
                />
              </div>
              <div className="hpb-insp__section">
                <span className="hpb-insp__label">{groupTitle("content", zh)}</span>
                <BlockConfigForm key={selected.id} block={selected} zh={zh} editLocale={editLocale} onChange={(cfg) => updateConfig(selected.id, cfg)} contentSources={contentSources} contentTags={contentTags} site={site} />
              </div>
              {/* Text formatting */}
              <FoldSection title={groupTitle("text", zh)}>
                {selected.type === "rich_text" ? (
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 8px" }}>
                    {zh ? "字體大小／顏色等請用上方文字工具列（WYSIWYG）的「字級」設定。" : "Use the rich-text toolbar (font size / colour) inside the text block above."}
                  </p>
                ) : (
                  /* blockStyle reads both and all three renderers apply them, but
                     only the site-page editor offered the fields — so a homepage
                     block had no way to set a size or a line height that the page
                     was perfectly willing to honour. Same two controls as the
                     other editor, so a block edited from either place has the
                     same panel. */
                  <>
                {/* Named for what it does, after it was measured doing something
                    else. 「字體大小」 reads as "the size of the text in this block"
                    and it is not: the options are 12–32px, an absolute figure,
                    and a heading given one would sit at the same size as the
                    paragraph under it. So it drives the block's BODY — copy,
                    lists, captions, and the sub-headings inside body copy, which
                    are 1.15em and scale with it. A title has 標題字級 in the role
                    panel below. 行距 is a ratio and cannot flatten anything, so
                    that one does cover the headings; saying so here is cheaper
                    than leaving an editor to discover the difference. */}
                <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 8px" }}>
                  {zh
                    ? "基準字級只動內文（含內文裡的小標，會等比跟著）；區塊標題請用下方「標題」的字級。行距則整塊套用，標題也會跟著。"
                    : "The base size drives body copy only (sub-headings scale with it); a block title has its own size under the 標題 role below. Line height applies to the whole block, headings included."}
                </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                    <Field label={zh ? "基準字級" : "Base Size"}>
                      <select
                        value={String(selected.config._fontSize ?? "")}
                        onChange={(e) => updateConfig(selected.id, { ...selected.config, _fontSize: e.target.value || undefined })}
                      >
                        <option value="">{zh ? "預設" : "Default"}</option>
                        {["12px","13px","14px","15px","16px","18px","20px","24px","28px","32px"].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label={zh ? "行距" : "Line Height"}>
                      <select
                        value={String(selected.config._lineHeight ?? "")}
                        onChange={(e) => updateConfig(selected.id, { ...selected.config, _lineHeight: e.target.value || undefined })}
                      >
                        <option value="">{zh ? "預設" : "Default"}</option>
                        {["1.2","1.4","1.6","1.8","2.0"].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                  </div>
                  </>
                )}
                <Field label={zh ? "對齊方式" : "Text Align"}>
                  {/* radiogroup, not four loose buttons: the choice is one-of-four
                      and "is-active" was a colour with nothing behind it, so a
                      screen reader announced four identical buttons. */}
                  <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={bi(editLocale, "對齊方式", "Text align")}>
                    {([
                      ["", zh ? "預設" : "Default"],
                      ["left", zh ? "靠左" : "Left"],
                      ["center", zh ? "置中" : "Center"],
                      ["right", zh ? "靠右" : "Right"],
                    ] as [string, string][]).map(([val, lbl]) => (
                      <button
                        key={val}
                        type="button"
                        role="radio"
                        aria-checked={(selected.config._textAlign ?? "") === val}
                        className={`hpb-variant-pick__btn${(selected.config._textAlign ?? "") === val ? " is-active" : ""}`}
                        onClick={() => updateConfig(selected.id, { ...selected.config, _textAlign: val || undefined })}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </Field>
                {/* Only side-by-side layouts have a picture to align against;
                    on a full-width block the control would do nothing. */}
                {showsVAlign(selected.type, selected.config) && (
                  <Field label={zh ? "文字對齊圖片（垂直）" : "Text against the picture"}>
                    <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={bi(editLocale, "文字垂直對齊", "Text vertical align")}>
                      {([
                        ["", zh ? "從圖頂開始" : "From the top"],
                        ["center", zh ? "垂直置中" : "Centred"],
                        ["bottom", zh ? "貼齊圖底" : "To the bottom"],
                      ] as [string, string][]).map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          role="radio"
                          aria-checked={(selected.config._textVAlign ?? "") === val}
                          className={`hpb-variant-pick__btn${(selected.config._textVAlign ?? "") === val ? " is-active" : ""}`}
                          onClick={() => updateConfig(selected.id, { ...selected.config, _textVAlign: val || undefined })}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                    <p className="hpb-field-hint">
                      {zh
                        ? "預設讓眉批貼齊圖片上緣。「關於」與加了圖片的「圖文分欄」用同一個設定。"
                        : "By default the eyebrow sits on the picture's top edge. 關於 and an 圖文分欄 block with a picture share this one setting."}
                    </p>
                  </Field>
                )}
                {/* Per-role overrides. Not offered on rich_text: that block's
                    copy is styled inline by the WYSIWYG toolbar, so a role
                    override here would be a control with nothing to act on. */}
                {selected.type !== "rich_text" && (
                  <RoleTypeControls
                    c={selected.config}
                    zh={zh}
                    onChange={(cfg) => updateConfig(selected.id, cfg)}
                  />
                )}
              </FoldSection>

              {/* Section tag (anchor id) — nav links can jump here via #tag */}
              <FoldSection title={groupTitle("anchor", zh)}>
                <Field label={zh ? "標記名稱（導覽列可用 #標記 跳到此區塊）" : "Anchor id (nav can link via #tag)"}>
                  <input
                    type="text"
                    value={String(selected.config.anchor ?? "")}
                    onChange={(e) => {
                      // Keep letters (incl. CJK) & digits; spaces → "-"; drop chars
                      // that break an id / URL fragment.
                      const raw = e.target.value.trim().replace(/\s+/g, "-").replace(/[#?&/\\%"'<>]/g, "").replace(/^-+|-+$/g, "");
                      /* By CHARACTER, not by code unit: `slice(0, 64)` cuts an
                         astral character (CJK Ext, an emoji) in half at the
                         boundary and leaves a lone surrogate, which safeAnchor's
                         negated class happily accepts and which round-trips
                         through UTF-8 as U+FFFD. */
                      const v = Array.from(raw).slice(0, 64).join("");
                      updateConfig(selected.id, { ...selected.config, anchor: v || undefined });
                    }}
                    placeholder={zh ? "例如 about、rooms、contact" : "e.g. about, rooms, contact"}
                    style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
                  />
                </Field>
              </FoldSection>

              {/* Block spacing — one vertical value so top and bottom always match */}
              <FoldSection title={groupTitle("spacing", zh)}>
                <Field label={zh ? "上下留白" : "Vertical"}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select
                      value={selected.config._padY === undefined ? "" : String(selected.config._padY)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") { const { _padY, ...rest } = selected.config as Record<string, unknown>; void _padY; updateConfig(selected.id, rest); }
                        else updateConfig(selected.id, { ...selected.config, _padY: Number(v) });
                      }}
                      style={{ flex: 1 }}
                    >
                      <option value="">{zh ? "預設" : "Default"}</option>
                      {PAD_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>{(zh ? p.zh : p.en) + " (" + p.value + "px)"}</option>
                      ))}
                    </select>
                    {/* A Field's <label> only names its FIRST control, so in
                        every one of these two-control rows the second was
                        announced as an unnamed spin button. */}
                    <input
                      type="number" min={0} max={400} placeholder="px"
                      aria-label={bi(editLocale, "上下留白（px）", "Vertical padding (px)")}
                      value={selected.config._padY === undefined ? "" : String(selected.config._padY)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") { const { _padY, ...rest } = selected.config as Record<string, unknown>; void _padY; updateConfig(selected.id, rest); }
                        else updateConfig(selected.id, { ...selected.config, _padY: Number(v) });
                      }}
                      style={{ width: 72 }}
                    />
                  </div>
                </Field>
                <Field label={zh ? "左右留白" : "Horizontal"}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select
                      value={selected.config._padX === undefined ? "" : String(selected.config._padX)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") { const { _padX, ...rest } = selected.config as Record<string, unknown>; void _padX; updateConfig(selected.id, rest); }
                        else updateConfig(selected.id, { ...selected.config, _padX: Number(v) });
                      }}
                      style={{ flex: 1 }}
                    >
                      <option value="">{zh ? "預設" : "Default"}</option>
                      {PAD_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>{(zh ? p.zh : p.en) + " (" + p.value + "px)"}</option>
                      ))}
                    </select>
                    <input
                      type="number" min={0} max={400} placeholder="px"
                      aria-label={bi(editLocale, "左右留白（px）", "Horizontal padding (px)")}
                      value={selected.config._padX === undefined ? "" : String(selected.config._padX)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") { const { _padX, ...rest } = selected.config as Record<string, unknown>; void _padX; updateConfig(selected.id, rest); }
                        else updateConfig(selected.id, { ...selected.config, _padX: Number(v) });
                      }}
                      style={{ width: 72 }}
                    />
                  </div>
                </Field>
              </FoldSection>

              {/* Background color */}
              <FoldSection title={groupTitle("surface", zh)}>
                {/* Withheld from a block that paints its own background — see
                    SELF_PAINTING_BLOCK_TYPES in blockStyle. The newsletter has
                    its own 背景顏色 field in its own form, which writes
                    `bg_color`; offering the generic `_bgColor` here as well gave
                    one block two colour controls that disagreed, and setting
                    this one painted the band AND a 100vw wrapper behind it,
                    which is also what stopped the block's own 版面寬度 →
                    留白置中 from ever being visible. 版面寬度 below stays: that
                    one IS this panel's to set. */}
                {!paintsOwnBackground(selected.type) && (
                <Field label={zh ? "背景顏色" : "Background Color"}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="color"
                      value={String(selected.config._bgColor ?? "#ffffff")}
                      onChange={(e) => updateConfig(selected.id, { ...selected.config, _bgColor: e.target.value })}
                      style={{ width: 40, height: 32, cursor: "pointer", border: "1px solid var(--line)", borderRadius: 4 }}
                    />
                    <input
                      type="text"
                      value={String(selected.config._bgColor ?? "")}
                      onChange={(e) => updateConfig(selected.id, { ...selected.config, _bgColor: e.target.value || undefined })}
                      placeholder="#ffffff"
                      aria-label={bi(editLocale, "背景顏色代碼", "Background colour hex code")}
                      style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
                    />
                    {typeof selected.config._bgColor === "string" && selected.config._bgColor && (
                      <button
                        type="button"
                        onClick={() => {
                          const { _bgColor, _bgOpacity, ...rest } = selected.config as Record<string, unknown>;
                          updateConfig(selected.id, rest);
                        }}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--muted)", fontSize: 12, textDecoration: "underline" }}
                      >
                        {zh ? "清除" : "Clear"}
                      </button>
                    )}
                  </div>
                  {/* The box beside the swatch is free text, and blockStyle
                      paints nothing at all for a value hexToRgb rejects — no
                      colour, and no full-bleed band either. Measured on the
                      preview route: `_bgColor: "red"` renders the block with no
                      inline style. Said here, at the point of typing, the same
                      way the 官方網站 field already reports an address the card
                      will drop. */}
                  {typeof selected.config._bgColor === "string"
                    && selected.config._bgColor.trim() !== ""
                    && !isBlockBgColor(selected.config._bgColor) && (
                    <p style={{ color: "#b3261e", fontSize: 11, lineHeight: 1.5, margin: "-6px 0 10px" }}>
                      {zh
                        ? "色碼要寫成 #ffffff 或 #fff。照現在這樣存檔，這個區塊不會有背景色。"
                        : "The code must be written as #ffffff or #fff. Saved as written, this block gets no background at all."}
                    </p>
                  )}
                </Field>
                )}
                {/* Only where it can do something. blockStyle reads _bgOpacity
                    inside the branch that needs a usable colour, so with none
                    set the slider moved, saved a number, and changed nothing —
                    with no error to notice. And blockStyle now refuses that
                    branch outright for a self-painting block, so a legacy
                    `_bgColor` left in one of those configs must not bring the
                    slider back either. */}
                {!paintsOwnBackground(selected.type) && isBlockBgColor(selected.config._bgColor) && (
                <Field label={zh ? "透明度" : "Opacity"}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Number(selected.config._bgOpacity ?? 100)}
                      onChange={(e) => updateConfig(selected.id, { ...selected.config, _bgOpacity: Number(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 11, color: "var(--muted)", minWidth: 32, textAlign: "right" }}>
                      {Number(selected.config._bgOpacity ?? 100)}%
                    </span>
                  </div>
                </Field>
                )}
                {/* Withheld on the same terms as the colour: a self-painting
                    block draws its own surface, and a picture behind it would
                    be covered by the band it paints. */}
                {!paintsOwnBackground(selected.type) && (
                  <BlockBackgroundImage
                    value={selected.config._bgImage}
                    zh={zh}
                    onChange={(url) => {
                      if (url) { updateConfig(selected.id, { ...selected.config, _bgImage: url }); return; }
                      const { _bgImage, ...rest } = selected.config as Record<string, unknown>;
                      void _bgImage;
                      updateConfig(selected.id, rest);
                    }}
                  />
                )}
                {/* Folded in with the background rather than kept as a
                    collapsible section of its own: it is one switch, and it
                    decides how far the background it sits under reaches. Two
                    folds for one decision meant an editor could set a colour
                    and not see the control that makes it span the window. */}
                <div style={{ marginTop: 14 }}>
                  <div className="hpb-insp__row-txt" style={{ marginBottom: 6 }}>
                    {zh ? "版面寬度" : "Width"}
                  </div>
                <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={bi(editLocale, "滿版", "Full bleed")}>
                  {([
                    [false, zh ? "留白置中" : "Contained"],
                    [true, zh ? "滿版貼邊" : "Full bleed"],
                  ] as [boolean, string][]).map(([val, lbl]) => (
                    <button
                      key={String(val)}
                      type="button"
                      role="radio"
                      aria-checked={(selected.config.full_bleed === true) === val}
                      className={`hpb-variant-pick__btn${(selected.config.full_bleed === true) === val ? " is-active" : ""}`}
                      onClick={() => updateConfig(selected.id, { ...selected.config, full_bleed: val || undefined })}
                    >
                      {lbl}
                    </button>
                  ))}
                  </div>
                </div>
              </FoldSection>

              {/* Side-by-side Pair */}
              <FoldSection title={groupTitle("pair", zh)}>
                <div className="hpb-insp__row">
                  <div>
                    <div className="hpb-insp__row-txt">{zh ? "與下一個區塊並列" : "Pair with next block"}</div>
                    <div className="hpb-insp__row-sub">{zh ? "啟用後兩個區塊左右並排" : "Two blocks side by side"}</div>
                  </div>
                  <button
                    type="button"
                    className={`hpb-switch${selected.config._pairNext ? " is-on" : ""}`}
                    onClick={() => updateConfig(selected.id, { ...selected.config, _pairNext: !selected.config._pairNext || undefined })}
                    role="switch"
                    aria-checked={!!selected.config._pairNext}
                    aria-label={zh ? "並列開關" : "Pair toggle"}
                  />
                </div>
                {!!selected.config._pairNext && (
                  <>
                    <div className="hpb-insp__row">
                      <div>
                        <div className="hpb-insp__row-txt">{zh ? "排列方向" : "Direction"}</div>
                      </div>
                      <div className="hpb-variant-pick" role="radiogroup" onKeyDown={radioGroupKeys} aria-label={bi(editLocale, "排列方向", "Direction")}>
                        {([["row", "左右並排", "Side by side"], ["column", "上下並排", "Stacked"]] as const).map(([val, zhL, enL]) => (
                          <button
                            key={val}
                            type="button"
                            role="radio"
                            aria-checked={(selected.config._pairDirection ?? "row") === val}
                            className={`hpb-variant-pick__btn${(selected.config._pairDirection ?? "row") === val ? " is-active" : ""}`}
                            onClick={() => updateConfig(selected.id, { ...selected.config, _pairDirection: val === "row" ? undefined : val })}
                          >
                            {zh ? zhL : enL}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="hpb-insp__row">
                      <div>
                        <div className="hpb-insp__row-txt">
                          {zh ? ((selected.config._pairDirection === "column") ? "上下對調" : "左右對調") : (selected.config._pairDirection === "column" ? "Swap top/bottom" : "Swap left/right")}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`hpb-switch${selected.config._pairReverse ? " is-on" : ""}`}
                        onClick={() => updateConfig(selected.id, { ...selected.config, _pairReverse: !selected.config._pairReverse || undefined })}
                        role="switch"
                        aria-checked={!!selected.config._pairReverse}
                        aria-label={zh ? "對調開關" : "Reverse toggle"}
                      />
                    </div>
                  </>
                )}
                {/* A pair holds two columns; this puts a block into the second
                    one rather than leaving it full width below — e.g. a feature
                    list belonging under the text it describes. */}
                <div className="hpb-insp__row">
                  <div>
                    <div className="hpb-insp__row-txt">{zh ? "併入上一組並列" : "Join the pair above"}</div>
                    <div className="hpb-insp__row-sub">
                      {zh ? "接在上一個區塊下方，共用同一欄" : "Stacks under the previous block, same column"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`hpb-switch${selected.config._pairJoin ? " is-on" : ""}`}
                    onClick={() => updateConfig(selected.id, { ...selected.config, _pairJoin: !selected.config._pairJoin || undefined })}
                    role="switch"
                    aria-checked={!!selected.config._pairJoin}
                    aria-label={zh ? "併入開關" : "Join toggle"}
                  />
                </div>
              </FoldSection>

              <div className="hpb-insp__section">
                <button
                  type="button"
                  className="hpb-insp__delete"
                  onClick={() => remove(selected.id)}
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
              <span className="hpb-insp__title">{zh ? "首頁設定" : "Homepage Settings"}</span>
            </div>
            <div className="hpb-insp__body">
              <div className="hpb-insp__section" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
                <span className="hpb-insp__label">{zh ? "新增版塊" : "Add block"}</span>
                <div className="hpb-palette" ref={paletteRef}>
                  {BLOCK_TYPES.filter(
                    (type) => !SINGLETON_TYPES.has(type) || !blocks.some((b) => b.type === type),
                  )
                    /* A villa homepage is drawn by PropertyPageRenderer, which
                       has no case for 搜尋列 — offering it here let a villa admin
                       add the block, save without error, and get nothing on
                       /stays/{slug}. The page editor already withholds it for
                       the same reason (GROUP_HOMEPAGE_ONLY); this palette did
                       not, though it already knows which renderer it is
                       previewing. */
                    .filter((type) => renderer === "homepage" || type !== "search")
                    .map((type) => (
                    <button key={type} type="button" className="hpb-palette__btn" onClick={() => add(type)}>
                      <span className="hpb-palette__name">{label(type)}</span>
                      <span className="hpb-palette__hint">{hint(type)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="hpb-insp__section">
                <span className="hpb-insp__label">{zh ? "網站名稱" : "Site Name"}</span>
                <Field label={editLocale === "zh" ? "網站名稱" : "Site Name"}>
                  <input
                    type="text"
                    value={nameTranslations[editLocale] ?? ""}
                    onChange={(e) => setNameTranslations({ ...nameTranslations, [editLocale]: e.target.value })}
                  />
                </Field>
              </div>

              <FoldSection title={zh ? "首頁 SEO" : "Homepage SEO"}>
                <Field label={editLocale === "zh" ? "Meta 標題" : "Meta Title"}>
                  <input
                    type="text"
                    value={getVal(seo, "title", editLocale)}
                    onChange={(e) => setSeo(setVal(seo, "title", editLocale, e.target.value))}
                    placeholder={zh ? "留空則使用 Banner 標題或網站名稱" : "Leave empty to use banner title or site name"}
                  />
                </Field>
                <Field label={editLocale === "zh" ? "Meta 描述" : "Meta Description"}>
                  <textarea
                    rows={2}
                    value={getVal(seo, "description", editLocale)}
                    onChange={(e) => setSeo(setVal(seo, "description", editLocale, e.target.value))}
                    placeholder={zh ? "留空則使用 Banner 副標題或預設描述" : "Leave empty to use banner subtitle or default description"}
                  />
                </Field>
              </FoldSection>

              {/* A new tab, because this is an exit the editor itself puts on
                  screen. A Next <Link> navigates client-side, which fires no
                  unload event, so the beforeunload guard cannot see it coming —
                  this button was a one-click way to lose every unsaved block on
                  the homepage, offered from inside the homepage editor. */}
              <FoldSection title={zh ? "媒體庫" : "Media Library"}>
                <ButtonLink block external href="/admin/media" icon={<ExternalLink />} rel="noopener" size="sm" target="_blank">
                  {zh ? "上傳 / 管理圖片（新分頁）" : "Upload / manage images (new tab)"}
                </ButtonLink>
              </FoldSection>
            </div>
          </>
        )}
      </aside>

      {/* ── Live preview overlay ── */}
      {previewOpen ? (
        <PreviewOverlay
          zh={editLocale === "zh"}
          title={zh ? "首頁即時預覽" : "Live Homepage Preview"}
          onClose={() => setPreviewOpen(false)}
          device={previewDevice}
          onDevice={setPreviewDevice}
          source={previewSource}
          onSource={setPreviewSource}
        >
              {previewSource === "draft" ? (
                <div
                  className={`hpb-overlay__frame hpb-overlay__frame--draft${previewDeviceClass(previewDevice)}`}
                  data-preview-source="draft"
                >
                  {/* Says what this view is and is not, because it is assembled
                      block by block: no site header or footer, and blocks set to
                      pair side by side are stacked. Silently showing a page that
                      differs from the published one in ways nobody mentioned is
                      the same failure as showing the last save. */}
                  {/* editLocale, not the site locale: this names what is on
                      screen, and the editor reads it in whichever language the
                      locale toggle is set to. */}
                  <p className="hpb-draft__banner">
                    {bi(
                      editLocale,
                      "顯示編輯中的內容（含未儲存的變更）。逐一版塊呈現，不含頁首／頁尾，並列版塊會上下堆疊。",
                      "Showing your current edits, unsaved changes included. Assembled block by block: no site header or footer, and paired blocks are stacked.",
                    )}
                  </p>
                  <DraftPagePreview
                    blocks={blocks}
                    siteSlug={site.slug}
                    renderer={renderer}
                    zh={editLocale === "zh"}
                    labelFor={label}
                  />
                </div>
              ) : (
                <iframe
                  src={`/?site=${site.slug}`}
                  title={zh ? "已儲存的首頁" : "Saved homepage"}
                  data-preview-source="saved"
                  className={`hpb-overlay__frame${previewDeviceClass(previewDevice)}`}
                />
              )}
        </PreviewOverlay>
      ) : null}
    </form>
  );
}
