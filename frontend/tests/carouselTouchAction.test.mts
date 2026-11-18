import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { readCode, readStyles } from "./readCode";
import { SWIPE_MIN_PX, swipeDirection } from "../app/modules/swipe.ts";

/**
 * An element that handles a drag itself must tell the browser not to take it.
 *
 * `touch-action: auto` — the default, and what every carousel box computed —
 * leaves the browser free to claim a horizontal drag as a pan of its own. The
 * moment it does, it fires `pointercancel` / `touchcancel` and the `touchend`
 * or `pointerup` that decides the swipe never arrives, so the photo does not
 * move. On a real phone that reads as a swipe that works sometimes and not
 * others, depending on the angle of the finger: 客戶: 手機版沒有滑動功能.
 *
 * It cannot be reproduced synthetically. A dispatched pointer or touch sequence
 * has no compositor competing for it and is never cancelled, so the handler
 * always runs and the fault is invisible in a browser-driven check. The only
 * place it is visible is the stylesheet, which is why this file lives here.
 *
 * TWO THINGS THIS FILE PINS THAT ARE EASY TO GET BACKWARDS:
 *
 *  · `pan-y` is not the answer everywhere. It tells the browser it may still
 *    pan VERTICALLY, which is right for a carousel that only reads left/right
 *    and wrong for the lightbox, whose zoomed drag pans both axes — that one
 *    needs `none` and would be broken by a well-meant `pan-y`.
 *
 *  · It is not the answer where nothing handles a drag. `.hero.hero-carousel`
 *    (HomeHeroCarousel) and `.stay-card-media` (StayCard) were first reported as
 *    swipe surfaces stuck on `touch-action: auto`, and they were not: neither
 *    bound a gesture at all. Their slides moved on a TIMER, which is what an
 *    index seen changing under a synthetic drag actually was — `.stay-card-media`'s
 *    only touch listeners came from useAutoAdvance and existed to PAUSE it.
 *    They had no swipe to fix; they had no swipe, which is why 手機版沒有滑動功能
 *    outlived the touch-action fix. Both were given one afterwards, and only
 *    then did the declaration have something to deliver to. The rule the near
 *    miss leaves behind is the last test in this file: a `pan-*` on a box that
 *    binds no handler is a pure loss, because the browser stops doing something
 *    and nothing steps in.
 *
 * So the sweep below is the check that matters: it finds the drag surfaces from
 * the source rather than from a list, and each one has to be accounted for.
 */

const CSS = readStyles("app/globals.css");

/* ── The drag surfaces, found in the source ───────────────────────────────── */

/** A press that can begin a drag. An element with neither owns no gesture. */
const START_PROPS = ["onTouchStart", "onPointerDown"];
/** Reported alongside, so the tripwire message says what the element does. */
const GESTURE_PROPS = [
  "onTouchStart", "onTouchMove", "onTouchEnd",
  "onPointerDown", "onPointerMove", "onPointerUp",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });
}

/**
 * Every class name the `className` attribute can put on the element.
 *
 * Read out of the whole expression, not just a plain string: the lightbox image
 * is `` `lightbox-img${zoomed ? " is-zoomed" : ""}…` ``, so its state classes
 * live inside conditionals within a template literal. Collecting every string
 * and template chunk under the attribute catches those; a check that only
 * understood string literals would report the lightbox as having no class and
 * quietly stop guarding it.
 */
function classNames(attribute: ts.JsxAttribute | undefined): string[] {
  if (!attribute?.initializer) return [];
  const out = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      for (const cls of node.text.split(/\s+/)) if (cls) out.add(cls);
    }
    node.forEachChild(visit);
  };
  visit(attribute.initializer);
  return [...out];
}

type Surface = { file: string; classes: string[]; props: string[] };

function surfacesIn(file: string): Surface[] {
  /* Line endings normalised for the same reason readCode does it: this file is
     LF, most others are CRLF, and every offset here has to be in one system. */
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Surface[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      const named = (name: string) =>
        attributes.find((a) => ts.isIdentifier(a.name) && a.name.text === name);
      const props = GESTURE_PROPS.filter((p) => named(p));
      /* The stay cards bind the shared photo-strip swipe (useCardGallery) as a
         spread, `{...swipeHandlers}`: onTouchStart and onTouchEnd by another
         route, and just as much a drag surface. */
      const spreadsSwipe = node.attributes.properties.some(
        (p) => ts.isJsxSpreadAttribute(p) && p.expression.getText(source) === "swipeHandlers",
      );
      if (spreadsSwipe) {
        out.push({ file, classes: classNames(named("className")), props: ["onTouchStart", "onTouchEnd"] });
      } else if (START_PROPS.some((p) => named(p))) {
        out.push({ file, classes: classNames(named("className")), props });
      }
    }
    node.forEachChild(visit);
  };
  visit(source);
  return out;
}

const SURFACES = walk("app")
  .filter((f) => f.endsWith(".tsx"))
  .flatMap(surfacesIn)
  .map((s) => `${s.file.replace(/\\/g, "/")} [${s.classes.join(" ")}] ${s.props.join(" ")}`)
  .sort();

/**
 * What each surface needs, and why it is that value and not the other one.
 *
 * The selector is the one the declaration has to land on: for the lightbox that
 * is the zoomed state, because the drag only pans while zoomed.
 */
const KNOWN = [
  {
    surface:
      "app/modules/property/LightboxGallery.tsx [lightbox-img is-zoomed is-dragging] "
      + "onPointerDown onPointerMove onPointerUp",
    selector: ".lightbox-img.is-zoomed",
    /* Both axes: the drag moves `pan.x` and `pan.y` together, so there is no
       direction left for the browser to have. */
    expect: "none",
  },
  {
    surface: "app/modules/stays/StayHeroCarousel.tsx [stay-hero-carousel] onTouchStart onTouchEnd",
    selector: ".stay-hero-carousel",
    /* One axis: the handler ignores a drag unless |dx| > |dy|, so vertical
       belongs to the page and has to be handed back — a `none` here would trap
       a guest scrolling with their thumb over the photo. */
    expect: "pan-y",
  },
  {
    surface:
      "app/modules/home/HomeHeroCarousel.tsx [hero hero-carousel hero--v- hero--h-] "
      + "onTouchStart onTouchEnd",
    selector: ".hero.hero-carousel",
    /* One axis, same as the other two — and it matters most here: this box is a
       whole screen tall, so `none` would make the homepage unscrollable by any
       thumb that landed on the photo. */
    expect: "pan-y",
  },
  {
    surface: "app/modules/stays/StayCard.tsx [stay-card-media] onTouchStart onTouchEnd",
    selector: ".stay-card-media",
    /* One axis. Several of these sit in a vertical list, so vertical is exactly
       what a reader is doing when their thumb crosses one. */
    expect: "pan-y",
  },
  {
    surface: "app/modules/stays/StayShowcaseCard.tsx [home-showcase-media] onTouchStart onTouchEnd",
    selector: ".home-showcase-media",
    /* One axis, the same strip as the stay card: the homepage scrolls past
       these, so vertical has to stay with the page. */
    expect: "pan-y",
  },
  {
    surface: "app/modules/home/blocks/AboutImageCarousel.tsx [block-about-image block-about-carousel] onTouchStart onTouchEnd",
    selector: ".block-about-carousel",
    /* One axis. The About image carousel belongs to the page's vertical scroll
       while its own handler consumes only a left/right swipe. */
    expect: "pan-y",
  },
];

/** The components whose swipe the `pan-y` above is handing the gesture to. */
const SWIPE_SURFACES = [
  "app/modules/stays/StayHeroCarousel.tsx",
  "app/modules/home/HomeHeroCarousel.tsx",
  // Both stay cards decide their swipe in the shared photo-strip hook.
  "app/modules/useCardGallery.ts",
  "app/modules/home/blocks/AboutImageCarousel.tsx",
];

test("every element that binds a drag is one this file accounts for", () => {
  /* The tripwire. A new carousel with a swipe is exactly the change that
     reintroduces this bug, and it arrives as a new gesture handler in a .tsx
     file — not as anything a stylesheet check would notice. */
  assert.deepEqual(
    SURFACES,
    KNOWN.map((k) => k.surface).sort(),
    "the set of elements binding a touch/pointer drag has changed. A NEW one needs a "
      + "touch-action of its own (pan-y for a left/right swipe, none for a drag that "
      + "pans both axes) and a case added here; a RENAMED one needs its selector "
      + "updated below, or its rule in globals.css is now pointing at nothing.",
  );
});

/* ── The stylesheet side ──────────────────────────────────────────────────── */

type Decl = { at: number; value: string; inAtRule: boolean; selectors: string[] };

/**
 * Every `touch-action` declaration in the file, in source order.
 *
 * Depth is carried forward across matches rather than recounted from the top of
 * the file for each one: the rule regex only ever matches an INNERMOST rule (its
 * `[^{}]+` selector part cannot cross the `{` of an enclosing `@media`), so the
 * braces inside each match balance and only the text between matches moves the
 * depth. That keeps a whole-file sweep affordable and, unlike a selector-text
 * test for "@media", it cannot miss a rule nested inside one.
 */
function touchActionDeclarations(): Decl[] {
  const out: Decl[] = [];
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  let cursor = 0;
  let depth = 0;
  for (let m = RULE.exec(CSS); m; m = RULE.exec(CSS)) {
    for (const ch of CSS.slice(cursor, m.index)) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
    }
    cursor = m.index + m[0].length;

    const selectors = m[1].split(",").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
    for (const declaration of m[2].split(";")) {
      const colon = declaration.indexOf(":");
      if (colon === -1) continue;
      if (declaration.slice(0, colon).trim() !== "touch-action") continue;
      out.push({
        at: m.index,
        value: declaration.slice(colon + 1).replace(/\s+/g, " ").trim(),
        inAtRule: depth > 0,
        selectors,
      });
    }
  }
  return out;
}

const TOUCH_ACTIONS = touchActionDeclarations();

/** Declarations that land on exactly this selector, in source order. */
function declarationsFor(selector: string): Decl[] {
  return TOUCH_ACTIONS.filter((d) => d.selectors.includes(selector));
}

for (const { selector, expect } of KNOWN) {
  test(`${selector}: the winning touch-action is "${expect}"`, () => {
    const found = declarationsFor(selector);
    assert.ok(
      found.length > 0,
      `no touch-action declared for ${selector} — the browser defaults to auto and is free `
        + "to swallow the drag this element handles",
    );

    /* Positional, not existential. globals.css is 36,000 lines with a long tail
       of later overrides, and a declaration that some later rule takes back is
       worth nothing — the same trap roleTypeCascade.test.mts exists for. The
       last one outside an at-rule is what applies at every width. */
    const winner = found.filter((d) => !d.inAtRule).at(-1);
    assert.ok(winner, `${selector} only declares touch-action inside a media query`);
    assert.equal(
      winner.value.split(" ")[0],
      expect,
      `the last touch-action on ${selector} is "${winner.value}"`,
    );
  });

  test(`${selector}: no later rule takes the gesture back at some width`, () => {
    /* A media query adds no specificity, so an override of this in one is only
       a matter of source order — and it would apply on exactly the devices this
       fix is for. Every declaration has to agree, not just the last. */
    const wrong = declarationsFor(selector)
      .filter((d) => d.value.split(" ")[0] !== expect)
      .map((d) => `"${d.value}" at offset ${d.at}`);
    assert.deepEqual(
      wrong,
      [],
      `${selector} declares a touch-action that disagrees with "${expect}"`,
    );
  });
}

test("the swipe reads one axis, which is what makes pan-y the right value", () => {
  /* pan-y is only correct while the handler ignores vertical drags. If it ever
     starts acting on dy as well, the declaration above becomes the thing that
     breaks it, and this is the line that says so.

     Run rather than grepped: this used to match `Math.abs(dx) > Math.abs(dy)`
     in one component's source, which said nothing about what the code does and
     stopped meaning anything the moment the three carousels started sharing one
     helper. */
  const at = (x: number, y: number) => ({ x, y });
  const origin = at(0, 0);

  assert.equal(swipeDirection(origin, at(-120, 0)), 1, "a firm drag left should advance");
  assert.equal(swipeDirection(origin, at(120, 0)), -1, "a firm drag right should go back");

  /* The vertical guard: the same 120px of travel, now mostly downward, is a
     reader scrolling past the photo and must not move it. */
  assert.equal(swipeDirection(origin, at(60, 120)), 0, "a mostly-vertical drag is a scroll");
  assert.equal(swipeDirection(origin, at(-60, 120)), 0, "…in either direction");

  /* And the distance guard, so a tap that drifts is still a tap. */
  assert.equal(swipeDirection(origin, at(-SWIPE_MIN_PX, 0)), 0, "exactly the threshold is not past it");
  assert.equal(swipeDirection(origin, at(-(SWIPE_MIN_PX + 1), 0)), 1, "one pixel past it is");
});

test("every swipe surface decides the gesture with that one helper", () => {
  /* The behavioural test above is only worth what it covers. If a carousel grows
     its own inline dx/dy check, the axis guard `touch-action: pan-y` depends on
     stops being something this file can see. */
  for (const file of SWIPE_SURFACES) {
    const src = readCode(file);
    assert.match(
      src,
      /swipeDirection\(/,
      `${file} binds a drag but does not decide it with swipeDirection — its axis guard is `
        + "now unverified, and `touch-action: pan-y` on its box may be handing away a gesture "
        + "it does not actually restrict itself to",
    );
    assert.doesNotMatch(
      src,
      /Math\.abs\(\s*d[xy]\s*\)/,
      `${file} has grown its own dx/dy arithmetic alongside the shared helper`,
    );
  }
});

test("pinching into the photo is not taken away along with the pan", () => {
  /* `pan-y` alone disables pinch-zoom, which on a full-bleed photo is the one
     browser gesture a guest is most likely to want. Naming pinch-zoom keeps it;
     a browser too old to know the keyword drops the whole declaration and lands
     back on today's `auto`, which is no worse than before the fix. */
  const winner = declarationsFor(".stay-hero-carousel").filter((d) => !d.inAtRule).at(-1);
  assert.ok(winner?.value.split(" ").includes("pinch-zoom"), `it reads "${winner?.value}"`);
});

test("touch-action is not sprayed at boxes that handle no gesture", () => {
  /* The other half of the fix. Taking horizontal panning away from an element
     nothing listens on is a pure loss: the browser stops doing something and
     no handler steps in. `.hero.hero-carousel` and `.stay-card-media` are the
     two this was nearly done to — see the note at the top of this file. */
  const owners = new Set(KNOWN.map((k) => k.selector));
  const sprayed = TOUCH_ACTIONS
    .filter((d) => /(^|\s)pan-(x|y|left|right|up|down)(\s|$)/.test(d.value))
    .flatMap((d) => d.selectors)
    .filter((s) => !owners.has(s));
  assert.deepEqual(
    sprayed,
    [],
    "these selectors restrict panning but bind no drag handler, so the restriction only "
      + "removes browser behaviour: " + sprayed.join(", "),
  );
});

test("the drag surfaces named here still carry the class their rule targets", () => {
  /* The stylesheet and the sweep are matched on the class name alone, so a
     rename in one place and not the other would leave both halves green and the
     rule inert. This is the join. */
  for (const { surface, selector } of KNOWN) {
    const classes = /\[([^\]]*)\]/.exec(surface)?.[1].split(" ") ?? [];
    const wanted = selector.split(".").filter(Boolean);
    for (const cls of wanted) {
      assert.ok(
        classes.includes(cls),
        `${selector} targets ".${cls}", which the element in ${surface.split(" ")[0]} does not carry`,
      );
    }
  }
});
