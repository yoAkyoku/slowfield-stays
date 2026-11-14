import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles } from "./readCode";

/**
 * A container that can hold a confirm dialog must never carry a transform.
 *
 * ConfirmSubmitButton renders its dialog as a `position: fixed` layer meant to
 * cover the viewport. But a transform on ANY ancestor — including the identity
 * transform a `translateY(0)` resting state settles on — makes that ancestor
 * the containing block for fixed descendants. `inset: 0` then resolves to the
 * ancestor's box instead of the screen.
 *
 * This has now bitten twice, by two different routes:
 *
 *   1. 表單聯絡's row actions revealed with `transform: translateY(8px)`, so the
 *      永久刪除 dialog was laid out inside a 73px-wide action bar: text wrapped
 *      one character per line and the confirm button landed at y=939 in a 670px
 *      viewport, off screen and unclickable.
 *
 *   2. `.nl-subscribers` ran `animation: nl-panel-in 0.3s ease both`, whose
 *      final keyframe was `transform: translateX(0)`. `both` keeps that frame
 *      applied forever, so the subscriber panel became the containing block and
 *      the 永久刪除 dialog opened centred on the panel — hundreds of pixels
 *      below the fold on a long list, dimming only the panel.
 *
 * The second route is three indirections deep (element → class → animation →
 * keyframe), which a scan of rule bodies alone does not see. Both are checked.
 */

const CSS = readStyles("app/globals.css");

/** Files that render a ConfirmSubmitButton, so their classes can be ancestors. */
const DIALOG_HOSTS = [
  "app/admin/(dashboard)/inquiries/page.tsx",
  "app/admin/(dashboard)/newsletter/panels/SubscriberPanel.tsx",
  "app/admin/(dashboard)/newsletter/panels/CampaignsPanel.tsx",
  "app/admin/(dashboard)/sites/DeleteSiteButton.tsx",
  "app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx",
  "app/admin/(dashboard)/users/page.tsx",
  "app/admin/modules/StatusActions.tsx",
];

/** The row-action bars, which sit closest to the dialog. */
/* The containers a delete / confirm button sits in. They were page-specific
   bars; every screen now builds them from the admin kit (app/admin/ui), so the
   guard is on the kit's classes — one rule each, used everywhere. */
const ACTION_BAR_SELECTORS = [
  "a-row-actions",
  "a-form-actions",
  "a-card",
  "a-table-frame",
  "a-toolbar",
];

/**
 * Find a declaration that promotes an element to a containing block.
 *
 * The value matters, not just the property: `transform: none` is the explicit
 * opt-out and is safe — the touch override deliberately sets it, and flagging
 * that would make this test argue against the fix it exists to protect.
 */
const PROMOTING = /(transform|perspective|filter|backdrop-filter|will-change|contain)\s*:\s*([^;}]+)/g;

function trapIn(body: string): string | null {
  for (const [, prop, rawValue] of body.matchAll(PROMOTING)) {
    const value = rawValue.trim();
    if (prop === "contain") {
      if (/\b(paint|strict|content)\b/.test(value)) return `${prop}: ${value}`;
      continue;
    }
    if (value === "none" || value === "auto") continue;
    return `${prop}: ${value}`;
  }
  return null;
}

function blocksFor(selectorFragment: string): string[] {
  const found: string[] = [];
  for (const [, selector, body] of CSS.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    if (selector.includes(selectorFragment)) found.push(body);
  }
  return found;
}

for (const bar of ACTION_BAR_SELECTORS) {
  test(`${bar} never gets a property that traps a fixed dialog`, () => {
    const blocks = blocksFor(bar);
    assert.ok(blocks.length > 0, `no rules found for ${bar} — did the class get renamed?`);
    for (const body of blocks) {
      const trap = trapIn(body);
      assert.equal(
        trap,
        null,
        `${bar} declares "${trap}" — a fixed confirm dialog inside it would be laid out ` +
          `in the bar instead of over the page. Reveal with opacity only.`,
      );
    }
  });
}

test("the dialog layer is still fixed, which is what makes these rules matter", () => {
  // Every confirm dialog is the kit <Dialog> now (ConfirmSubmitButton included).
  const layer = CSS.match(/\.a-dialog-layer\s*\{[^}]*\}/)?.[0] ?? "";
  assert.match(layer, /position:\s*fixed/);
  assert.match(readFileSync("app/admin/modules/ConfirmSubmitButton.tsx", "utf8"), /<Dialog\b/, "the confirm button no longer uses the kit Dialog this guards");
});


/* ── The animation route ──────────────────────────────────────────────────── */

/**
 * The same trap, reached through an animation instead of a declaration.
 *
 * `.nl-archive` and `.nl-subscribers` carry `animation: nl-panel-in … both`.
 * The `both` fill mode keeps the final keyframe applied forever, and a finished
 * animation resolves even `transform: none` to `matrix(1, 0, 0, 1, 0, 0)` —
 * measured on the deployed stylesheet, where the keyframe read `none` and
 * getComputedStyle returned the identity matrix. That matrix still makes the
 * element the containing block for its `position: fixed` descendants, so the
 * 永久刪除 dialog anchored to the panel (874x680 at top 322) instead of the
 * viewport and its buttons sat below the fold, unclickable.
 *
 * So the property must be ABSENT from these keyframes, not merely set to none.
 * An earlier version of this test asserted "ends at none" and passed for days
 * while the bug was live in production.
 *
 * Listed explicitly rather than derived by walking JSX → class → animation →
 * keyframes: that walk was four regexes deep, three of them silently broken by
 * template-literal escaping, and it reported success the whole time.
 */
const PANEL_ANIMATIONS = ["nl-panel-in"];

/** The body of a @keyframes block, braces balanced. */
function keyframesBody(name: string): string | null {
  const at = CSS.indexOf("@keyframes " + name);
  if (at === -1) return null;
  const open = CSS.indexOf("{", at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < CSS.length; i += 1) {
    if (CSS[i] === "{") depth += 1;
    else if (CSS[i] === "}") {
      depth -= 1;
      if (depth === 0) return CSS.slice(open + 1, i);
    }
  }
  return null;
}

function withoutComments(css: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const begin = css.indexOf("/*", i);
    if (begin === -1) return out + css.slice(i);
    out += css.slice(i, begin);
    const finish = css.indexOf("*/", begin);
    if (finish === -1) return out;
    i = finish + 2;
  }
}

for (const name of PANEL_ANIMATIONS) {
  test(`@keyframes ${name} never mentions transform`, () => {
    const body = keyframesBody(name);
    assert.ok(body !== null, `@keyframes ${name} not found — renamed?`);
    assert.ok(
      !withoutComments(body!).includes("transform:"),
      `@keyframes ${name} sets transform. With a persisting fill mode that leaves ` +
        `an identity matrix on the panel even when the last keyframe says none, and ` +
        `the confirm dialog inside it then anchors to the panel instead of the ` +
        `viewport. Animate opacity only.`,
    );
  });
}

test("the panels that host a confirm dialog are not animated with a transform", () => {
  /* The newsletter panels used to fade in with nl-panel-in; on the kit they are
     plain <Card>s with no entrance animation at all, which is the safest form
     of the rule above. If an animation comes back, it has to be opacity-only. */
  for (const file of [
    "app/admin/(dashboard)/newsletter/panels/CampaignsPanel.tsx",
    "app/admin/(dashboard)/newsletter/panels/SubscriberPanel.tsx",
  ]) {
    const src = readFileSync(file, "utf8");
    const animated = src.match(/className="([^"]*(?:enter|animate)[^"]*)"/)?.[1];
    if (!animated) continue;
    for (const cls of animated.split(/\s+/)) {
      const rule = CSS.match(new RegExp(`\\.${cls}\\s*\\{[^}]*animation:\\s*([\\w-]+)`));
      if (rule) assert.ok(!withoutComments(keyframesBody(rule[1]) ?? "").includes("transform:"), `${file} animates with a transform`);
    }
  }
});

test("a progress bar may still animate a transform — the rule is scoped", () => {
  assert.ok(keyframesBody("adminFlashProgress")?.includes("transform:"));
});
