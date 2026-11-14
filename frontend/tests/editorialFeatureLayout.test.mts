import assert from "node:assert/strict";
import test from "node:test";
import { readStyles, readCode, cssRules, splitSelectorList } from "./readCode.mts";
import { showsVAlign } from "../app/admin/modules/blockVAlign.ts";

/**
 * 大圖焦點 finally draws a 大圖.
 *
 * The block is named 大圖焦點 / Full-width Feature and its palette hint promised
 * 一句話配一張大圖. What it actually rendered for an image was the same small
 * contained side split as 圖文段落, and with no image it rendered
 * `.editorial-panel` — an 860px left-aligned panel, narrower than and off-axis
 * from the 960px centred blocks around it, which is what read as a seam
 * (客戶: 大圖焦點沒有弄得很好看 / 品牌故事上方一張主要大圖、下方搭配長篇文字 /
 * 不要有分割感).
 *
 * Measured before changing it: exactly ONE editorial block exists across all
 * three sites, so the default could be corrected rather than bolted on.
 */

const CSS = readStyles("app/globals.css");
const SRC = readCode("app/modules/home/blocks/BlockEditorial.tsx");

/** Declaration blocks of every rule whose selector list contains `selector`. */
function rulesFor(selector: string): Array<Array<{ prop: string; value: string }>> {
  const out: Array<Array<{ prop: string; value: string }>> = [];
  for (const chunk of CSS.split("}")) {
    const brace = chunk.indexOf("{");
    if (brace === -1) continue;
    const sels = chunk.slice(0, brace).split(",").map((x) => x.split(/\s+/).filter(Boolean).join(" "));
    if (!sels.includes(selector)) continue;
    out.push(chunk.slice(brace + 1).split(";").map((d) => {
      const c = d.indexOf(":");
      return c === -1 ? null : { prop: d.slice(0, c).trim(), value: d.slice(c + 1).split(/\s+/).filter(Boolean).join(" ") };
    }).filter(Boolean) as Array<{ prop: string; value: string }>);
  }
  return out;
}

test("an unset placement gets the layout the block is named for", () => {
  /* The old code was `c.image_position === "left"` with everything else
     falling through to the right-hand split, so a block saved with no
     placement drew a side image — never the 大圖. */
  assert.match(
    SRC,
    /rawPosition === "left" \|\| rawPosition === "right" \? rawPosition : null/,
    "the placement no longer falls back to picture-on-top",
  );
  assert.match(SRC, /if \(image && side\)/, "the side split is no longer gated on an explicit side");
});

test("both side placements are still reachable", () => {
  // Correcting the default must not remove the two layouts that did work.
  assert.match(SRC, /property-rich-text--img-\$\{side\}/, "the left/right split variant is gone");
  const form = readCode("app/admin/modules/blockForms.tsx");
  assert.match(form, /\["top", "left", "right"\] as const/, "the panel no longer offers all three placements");
});

test("the picture-on-top layout is built on the shared measure", () => {
  /* Not a width of its own. The seam it replaced was caused by exactly that —
     an 860px panel beside 960px blocks — so if this ever grows its own
     max-width the defect is back. */
  assert.match(SRC, /property-rich-text section is-centered editorial-feature/,
    "the shell no longer reuses the centred rich-text measure");
  /* Counted: a loop that `continue`s past everything asserts nothing when the
     class is renamed, which is the one moment this check earns its place. */
  let found = 0;
  for (const rule of cssRules(CSS)) {
    const sels = splitSelectorList(rule.selector);
    if (!sels.includes(".editorial-feature") && !sels.includes(".editorial-feature-media")) continue;
    found += 1;
    assert.doesNotMatch(rule.body, /(^|;)\s*(max-)?width\s*:/,
      `${rule.selector} sets its own width; it must inherit the page measure`);
  }
  assert.ok(found > 0, "no .editorial-feature rule found — re-anchor this test");
});

test("the media is a real feature image, and reshaped for a phone", () => {
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  const ratios: string[] = [];
  for (let m = RULE.exec(CSS); m; m = RULE.exec(CSS)) {
    if (!m[1].includes(".editorial-feature-media img")) continue;
    const r = /aspect-ratio\s*:\s*([^;]+)/.exec(m[2]);
    if (r) ratios.push(r[1].trim());
  }
  assert.ok(ratios.includes("16 / 9"), "the feature image lost its wide crop");
  assert.ok(
    ratios.includes("4 / 3"),
    "no narrower crop for small screens — 16/9 across a phone column is a letterbox strip, not the page's main picture",
  );
});

test("the figure's user-agent margin is cleared", () => {
  /* Every browser gives <figure> a 1em inline margin. Left in, it adds to the
     gap set here AND indents the picture, which is the one element that must
     line up with the section's own edges. The phone override below only
     restates margin-bottom, so it is enough that ONE rule clears it. */
  const cleared = rulesFor(".editorial-feature-media").filter((decls) =>
    decls.some((d) => d.prop === "margin" && d.value.split(" ")[0] === "0"));
  assert.ok(cleared.length > 0, "the figure keeps its UA margin, so the picture sits indented");
});

test("typed line breaks and balanced headings survived the markup change", () => {
  /* Both behaviours were attached to `.editorial-panel h2`, which this block no
     longer emits. Losing them silently is the failure mode: the heading simply
     stops honouring a break the editor typed. */
  for (const prop of ["white-space", "text-wrap"]) {
    const carriers = rulesFor(".editorial-feature h2").filter((decls) =>
      decls.some((d) => d.prop === prop));
    assert.ok(
      carriers.length > 0,
      `.editorial-feature h2 is not in any ${prop} rule; the old panel's behaviour was dropped`,
    );
  }
});

test("the vertical-alignment control follows the placement, not just the image", () => {
  /* On the picture-on-top layout there is no second column, so
     --block-text-valign is read by nothing. Offering the control there is the
     same silent no-op the helper exists to prevent. */
  assert.equal(showsVAlign("editorial", { image: "/a.jpg", image_position: "left" }), true);
  assert.equal(showsVAlign("editorial", { image: "/a.jpg", image_position: "right" }), true);
  assert.equal(showsVAlign("editorial", { image: "/a.jpg", image_position: "top" }), false,
    "the control is offered on a layout that cannot use it");
  assert.equal(showsVAlign("editorial", { image: "/a.jpg" }), false,
    "an unset placement IS picture-on-top, so the control must stay hidden");
  assert.equal(showsVAlign("editorial", {}), false);
  /* 關於 needs a picture too. This line asserted `true` for an image-less block,
     pinning the very defect this helper exists to prevent: `.block-about` is a
     single 1fr column until `.block-about--has-image` adds the second, so
     justify-content has no free space to distribute. Measured in a browser
     before changing it — with no image the heading sits at 114px under both
     flex-start and flex-end; with one it moves 114 → 491. */
  assert.equal(showsVAlign("about", { image: "/a.jpg" }), true);
  assert.equal(showsVAlign("about", {}), false,
    "offered on a one-column 關於, where it distributes nothing");
  /* The inverse the same audit found: both of these render .property-rich-split,
     which is the rule that reads the variable, and neither was offered it. */
  /* …once it has a picture to align against. This asserted `true` for an EMPTY
     config, which pinned the one branch of this helper that did not check its
     content: BlockAlternating drops every row with no image and returns null
     when nothing is left, so on a block of text-only rows the control was
     offered against a `.property-rich-split-media` that is never drawn. */
  assert.equal(showsVAlign("alternating", { items: [{ image: "/a.jpg", title: "t" }] }), true);
  assert.equal(showsVAlign("alternating", { items: [{ title: "t", body: "b" }] }), false,
    "offered on rows that are all text, where there is no picture to align against");
  assert.equal(showsVAlign("alternating", {}), false);
  assert.equal(showsVAlign("video_text", { url: "u", video_position: "left" }), true);
  assert.equal(showsVAlign("video_text", { url: "u" }), false,
    "stacked video has no second column either");
  assert.equal(showsVAlign("rich_text", { image: "/a.jpg" }), true);
});
