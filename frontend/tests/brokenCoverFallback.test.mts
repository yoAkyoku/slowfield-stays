import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

import * as tr from "../app/modules/tr.ts";
import * as swipe from "../app/modules/swipe.ts";
import { sharedModule } from "./sharedModules.mts";

/**
 * A cover whose URL exists and does not resolve is a missing cover.
 *
 * Both card components treated a non-empty `src` as proof there was a picture.
 * Media outlives the entries that point at it — an upload is deleted, a bucket
 * is re-keyed, a slug changes — so that is not a rare state. Measured on the
 * homepage before the fix: four `/storage/media/*.jpg` covers 404, and each one
 * rendered as an `img.stay-card-image` with `naturalWidth === 0` filling a
 * 575×431 box. A broken <img> under `fill` has no intrinsic size, so it
 * collapses to a transparent rectangle: the reader sees an empty panel, and
 * nothing on the page distinguishes it from one still loading. The drawn
 * `.card-cover-empty` placeholder that exists for exactly this hole was reached
 * only when the gallery was empty to begin with.
 *
 * Two components, two mechanisms, and the difference matters:
 *
 *   · StayCard renders next/image, which handles the case that makes this hard
 *     — an image that failed BEFORE React hydrated, whose error event is long
 *     gone by the time a handler exists. Next re-assigns `img.src` on mount
 *     when (and only when) an `onError` prop is present, so the event fires
 *     again. That is why the handler has to be on <Image>.
 *   · CardCover renders a plain <img> and has to ask instead: a decoded image
 *     is `complete` with a non-zero `naturalWidth`, a broken one is `complete`
 *     with zero, and one still loading is not `complete` at all.
 *
 * Both are driven here rather than grepped, because the interesting half is
 * what the components must NOT do: a load cancelled by its element leaving the
 * document fires the same `error` event as a refused one, and treating that as
 * a 404 hides a working photo for the rest of the session.
 */

type El = { type: unknown; props: Record<string, unknown> };
const isEl = (v: unknown): v is El =>
  typeof v === "object" && v !== null && "type" in v && "props" in v;

function h(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): El {
  return { type, props: { ...(props ?? {}), children: children.length === 1 ? children[0] : children } };
}
const FRAGMENT = Symbol("fragment");

function compile(file: string, imports: Record<string, unknown>): Record<string, unknown> {
  const js = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      jsxFactory: "__h",
      jsxFragmentFactory: "__FRAGMENT",
    },
  }).outputText;
  const mod = { exports: {} as Record<string, unknown> };
  const req = (id: string) => {
    if (!(id in imports)) {
      const shared = sharedModule(file, id);
      if (shared) return shared;
      throw new Error(`${file}: no stub for import "${id}"`);
    }
    return imports[id];
  };
  new Function("exports", "require", "module", "__h", "__FRAGMENT", js)(
    mod.exports, req, mod, h, FRAGMENT,
  );
  return mod.exports;
}

/**
 * The smallest thing that is still React's state, not a mock of it.
 *
 * A component that only ever renders once cannot show whether a handler
 * *changes* anything, and "does the placeholder appear" is entirely about the
 * second render. Hooks are keyed by call order the way React keys them, so a
 * re-render picks up what the last setter wrote.
 */
function harness() {
  const cells: unknown[] = [];
  let cursor = 0;
  const react = {
    useState: (init: unknown) => {
      const i = cursor++;
      if (!(i in cells)) cells[i] = typeof init === "function" ? (init as () => unknown)() : init;
      return [cells[i], (v: unknown) => { cells[i] = typeof v === "function" ? (v as (p: unknown) => unknown)(cells[i]) : v; }];
    },
    useMemo: (f: () => unknown) => f(),
    useRef: (v: unknown) => ({ current: v }),
    useCallback: (f: unknown) => f,
    useEffect: () => {},
    useId: () => "id",
  };
  /* One cell store, and the component compiled against this exact stub — the
     first version of this file built two, so every render allocated fresh cells
     and no setter could ever be observed. */
  return {
    react,
    mount<P extends Record<string, unknown>>(Component: (p: P) => unknown) {
      return (props: P) => { cursor = 0; return expand(Component(props)); };
    },
  };
}

function expand(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(expand);
  if (!isEl(node)) return node;
  if (typeof node.type === "function") {
    return expand((node.type as (p: Record<string, unknown>) => unknown)(node.props));
  }
  return { type: node.type, props: { ...node.props, children: expand(node.props.children) } };
}

function findAll(node: unknown, pred: (el: El) => boolean): El[] {
  const out: El[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(visit);
    if (!isEl(n)) return;
    if (pred(n)) out.push(n);
    visit(n.props.children);
  };
  visit(node);
  return out;
}

const hasClass = (cls: string) => (el: El) =>
  typeof el.props.className === "string" && el.props.className.split(/\s+/).includes(cls);

/** A real error event carries the element it fired on. */
const errorEvent = (isConnected = true) => ({ currentTarget: { isConnected } });

/* ── StayCard ───────────────────────────────────────────────────────────── */

const IMG = "next-image";
function buildStayCard() {
  const box = harness();
  const StayCard = compile("app/modules/stays/StayCard.tsx", {
    "lucide-react": { ChevronLeft: "ChevronLeft", ChevronRight: "ChevronRight" },
    "next/image": { default: IMG },
    "next/link": { default: "next-link" },
    react: box.react,
    "../useAutoAdvance": { default: () => ({ current: null }) },
    /* The real one, like ../tr: it is a pure pair of functions with no imports
       of its own, so a stub here would only be a second implementation to keep
       in step. */
    "../swipe": swipe,
    "../api": {},
    "../i18n": {},
    "../tr": tr,
    // StayCard uses the shared location formatter for the small destination
    // line. This test isolates gallery state, so keep the formatter a stable
    // value instead of pulling its unrelated search dependencies into the
    // hand-compiled component.
    "../stayLocations": { stayLocationLabel: () => "d" },
  }).default as (p: Record<string, unknown>) => unknown;
  return { render: box.mount(StayCard) };
}

const stayWith = (srcs: string[]) => ({
  slug: "a-stay",
  name: "House",
  summary: "s",
  destination: "d",
  region: "",
  hero_image_url: srcs[0] ?? "",
  images: srcs.slice(1).map((src) => ({ image_url: src, alt_text: "" })),
});

const photos = (tree: unknown) => findAll(tree, (el) => el.type === IMG);
const dots = (tree: unknown) => findAll(tree, hasClass("stay-card-gallery-dots"))
  .flatMap((d) => findAll(d.props.children, (el) => el.type === "button"));
const placeholder = (tree: unknown) => findAll(tree, hasClass("card-cover-empty"));

test("a photo that 404s leaves the gallery", () => {
  const card = buildStayCard();
  const props = { stay: stayWith(["/a.jpg", "/gone.jpg", "/c.jpg"]), detailsLabel: "View", locale: "zh" };
  let tree = card.render(props);
  assert.equal(photos(tree).length, 3, "the harness did not render the gallery");
  assert.equal(dots(tree).length, 3);

  const broken = photos(tree).find((p) => p.props.src === "/gone.jpg")!;
  (broken.props.onError as (e: unknown) => void)(errorEvent());

  tree = card.render(props);
  const left = photos(tree).map((p) => p.props.src);
  assert.deepEqual(left, ["/a.jpg", "/c.jpg"], "the missing photo is still in the carousel as a blank frame");
  assert.equal(dots(tree).length, 2, "the dots still count a photo that cannot be shown");
});

test("when every photo 404s the card falls back to the drawn placeholder", () => {
  const card = buildStayCard();
  const props = { stay: stayWith(["/gone1.jpg", "/gone2.jpg"]), detailsLabel: "View", locale: "zh" };
  let tree = card.render(props);
  assert.equal(placeholder(tree).length, 0, "the placeholder is drawn while there are still photos to try");

  for (const p of photos(tree)) (p.props.onError as (e: unknown) => void)(errorEvent());
  tree = card.render(props);

  assert.equal(photos(tree).length, 0);
  assert.equal(placeholder(tree).length, 1, "an all-broken card is a blank panel again, not the placeholder");
  assert.equal(dots(tree).length, 0, "the dots outlived the photos they point at");
  assert.equal(
    findAll(tree, hasClass("stay-card-gallery-controls")).length,
    0,
    "the prev/next arrows are still drawn with nothing to move between",
  );
});

test("a cancelled load is not a missing photo", () => {
  /* An <img> whose request is aborted — because React took it out of the
     document — fires `error` exactly as a 404 does. Acting on that blacklists a
     working photo for the rest of the session, and the reader has no way to get
     it back short of a reload. */
  const card = buildStayCard();
  const props = { stay: stayWith(["/a.jpg", "/b.jpg"]), detailsLabel: "View", locale: "zh" };
  let tree = card.render(props);
  for (const p of photos(tree)) (p.props.onError as (e: unknown) => void)(errorEvent(false));
  tree = card.render(props);
  assert.deepEqual(
    photos(tree).map((p) => p.props.src),
    ["/a.jpg", "/b.jpg"],
    "a load cancelled by unmounting was treated as a missing file",
  );
  assert.equal(placeholder(tree).length, 0);
});

test("removing one photo does not remount the others", () => {
  /* This is what caused cancelled loads in the first place. The key used to be
     `${src}-${index}`: dropping a 404 shifts every later index, React sees new
     keys, unmounts the surviving photos and mounts fresh ones — cancelling
     their in-flight requests, whose error events then blacklisted them too.
     Measured on the homepage: two `net::ERR_ABORTED` on 200 responses before,
     none after. */
  const card = buildStayCard();
  const props = { stay: stayWith(["/gone.jpg", "/b.jpg", "/c.jpg"]), detailsLabel: "View", locale: "zh" };
  let tree = card.render(props);
  const keysBefore = new Map(photos(tree).map((p) => [p.props.src, p.props.key]));

  (photos(tree)[0]!.props.onError as (e: unknown) => void)(errorEvent());
  tree = card.render(props);

  for (const p of photos(tree)) {
    assert.equal(
      p.props.key,
      keysBefore.get(p.props.src),
      `${p.props.src} was re-keyed when another photo was removed, which remounts it and cancels its load`,
    );
  }
});

test("the shown photo survives the gallery shrinking under it", () => {
  const card = buildStayCard();
  const props = { stay: stayWith(["/a.jpg", "/b.jpg", "/gone.jpg"]), detailsLabel: "View", locale: "zh" };
  let tree = card.render(props);
  // Move to the last photo, then have the two before it fail.
  const lastDot = dots(tree)[2]!;
  (lastDot.props.onClick as (e: unknown) => void)({ preventDefault() {}, stopPropagation() {} });
  tree = card.render(props);
  // Photos only — the dots carry `is-active` too.
  assert.deepEqual(
    photos(tree).filter(hasClass("is-active")).map((p) => p.props.src),
    ["/gone.jpg"],
    "the click did not move the carousel",
  );

  for (const src of ["/a.jpg", "/b.jpg"]) {
    (photos(tree).find((p) => p.props.src === src)!.props.onError as (e: unknown) => void)(errorEvent());
  }
  tree = card.render(props);
  const active = photos(tree).filter(hasClass("is-active"));
  assert.equal(active.length, 1, "the index ran off the end of the shortened gallery and no photo is showing");
  assert.equal(active[0]!.props.src, "/gone.jpg");
});

test("a stay with no photos at all still gets the placeholder", () => {
  // The behaviour that already existed, and that this change routes through.
  const card = buildStayCard();
  const tree = card.render({ stay: stayWith([]), detailsLabel: "View", locale: "zh" });
  assert.equal(placeholder(tree).length, 1);
});

/* ── CardCover ──────────────────────────────────────────────────────────── */

function buildCardCover() {
  const box = harness();
  const CardCover = compile("app/modules/content/CardCover.tsx", { react: box.react })
    .default as (p: Record<string, unknown>) => unknown;
  return { render: box.mount(CardCover) };
}

const img = (tree: unknown) => findAll(tree, (el) => el.type === "img");
const PROPS = { src: "/cover.jpg", alt: "Cover", className: "article-card-img" };

test("a cover that fails after hydration is replaced by the placeholder", () => {
  const cover = buildCardCover();
  let tree = cover.render(PROPS);
  assert.equal(img(tree).length, 1);
  (img(tree)[0]!.props.onError as (e: unknown) => void)(errorEvent());
  tree = cover.render(PROPS);
  assert.equal(img(tree).length, 0, "the broken <img> is still in the card");
  assert.equal(placeholder(tree).length, 1, "the card keeps a blank frame instead of the placeholder");
});

test("a cover that failed before hydration is caught on mount", () => {
  /* The case `onError` alone cannot see. The image is server-rendered, the
     request fails while the page is still HTML, and the error event is over
     before any handler exists — so the component has to ask the element. */
  const cover = buildCardCover();
  let tree = cover.render(PROPS);
  const ref = img(tree)[0]!.props.ref as (el: unknown) => void;
  ref({ complete: true, naturalWidth: 0 });
  tree = cover.render(PROPS);
  assert.equal(placeholder(tree).length, 1, "an image that had already failed at mount is not noticed");
});

test("an image that is merely still loading is left alone", () => {
  // The false positive this check invites: a lazy cover that has not started
  // loading is not complete, and swapping it for the placeholder would replace
  // a real photograph with a drawing.
  const cover = buildCardCover();
  let tree = cover.render(PROPS);
  const ref = img(tree)[0]!.props.ref as (el: unknown) => void;
  ref({ complete: false, naturalWidth: 0 });
  tree = cover.render(PROPS);
  assert.equal(img(tree).length, 1, "a cover still loading was replaced by the placeholder");
  assert.equal(placeholder(tree).length, 0);
});

test("a decoded image is left alone", () => {
  const cover = buildCardCover();
  let tree = cover.render(PROPS);
  (img(tree)[0]!.props.ref as (el: unknown) => void)({ complete: true, naturalWidth: 1200 });
  tree = cover.render(PROPS);
  assert.equal(img(tree).length, 1);
});

test("a cancelled cover load is not a missing cover", () => {
  // A category filter swapping its cards cancels every in-flight cover.
  const cover = buildCardCover();
  let tree = cover.render(PROPS);
  (img(tree)[0]!.props.onError as (e: unknown) => void)(errorEvent(false));
  tree = cover.render(PROPS);
  assert.equal(img(tree).length, 1, "a cancelled load was treated as a missing file");
});

test("a card handed a new cover is not held on the placeholder by the old one", () => {
  const cover = buildCardCover();
  let tree = cover.render(PROPS);
  (img(tree)[0]!.props.onError as (e: unknown) => void)(errorEvent());
  assert.equal(placeholder(cover.render(PROPS)).length, 1);
  // Same component, different entry.
  tree = cover.render({ ...PROPS, src: "/replacement.jpg" });
  assert.equal(img(tree).length, 1, "the replacement cover is hidden because the previous one was broken");
  assert.equal(img(tree)[0]!.props.src, "/replacement.jpg");
});

test("an entry with no cover keeps the placeholder it always had", () => {
  const cover = buildCardCover();
  const tree = cover.render({ ...PROPS, src: "" });
  assert.equal(placeholder(tree).length, 1);
  assert.equal(img(tree).length, 0);
});
