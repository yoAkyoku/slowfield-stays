import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";
import { blockStyle } from "../app/modules/blockStyle.ts";

/**
 * Two settings from the "saves but does nothing" audit.
 *
 * 左右留白 on a full-bleed block, the hero and the search bar: all three rules
 * wrote a flat clamp instead of reading the block's figure, and the full-bleed
 * one is two classes deep so it outweighed the `.section` rule that does read
 * it. Turning on 滿版貼邊 quietly disabled the padding control next to it.
 *
 * 對齊方式 on a hero block: the carousel wrote `textAlign` inline on
 * .hero-content for every hero, collapsing "the banner did not choose" into
 * "centre". An inline declaration outranks everything, so the block-level
 * setting was overridden by a value nobody had picked.
 */

const CSS = readStyles("app/globals.css");
const CAROUSEL = readCode("app/modules/home/HomeHeroCarousel.tsx");

test("a side-padding setting is published under a name only it defines", () => {
  const style = blockStyle({ _padX: 40 }) ?? {};
  assert.ok(style["--block-pad-x" as never], "--block-pad-x is not emitted");
  // --gutter stays too: the ordinary .section rule reads that one.
  assert.ok(style["--gutter" as never], "--gutter is no longer emitted");
});

test("no side-padding setting means no variable, so every fallback stands", () => {
  // The whole no-change guarantee for untouched blocks rests on this. If the
  // variable were always emitted, `var(--block-pad-x, <old clamp>)` could never
  // reach its fallback and every full-bleed block on the site would shift.
  const style = blockStyle({}) ?? {};
  assert.equal(style["--block-pad-x" as never], undefined);
});

test("the rules that ignored the setting now read it, keeping their old value as the fallback", () => {
  for (const [needle, label] of [
    ["padding-left: var(--block-pad-x, clamp(20px, 7vw, 120px))", "full-bleed section"],
    ["padding: clamp(34px, 5vw, 78px) var(--block-pad-x, clamp(20px, 4vw, 64px))", "hero"],
    ["padding: 0 var(--block-pad-x, 20px)", "search bar"],
  ] as Array<[string, string]>) {
    assert.ok(CSS.includes(needle), `${label} does not read the side-padding setting`);
  }
});

test("--block-pad-x is never read without a fallback", () => {
  // Bare, it would resolve to nothing on an untouched block and drop the
  // declaration — the block would lose its padding rather than keep today's.
  assert.doesNotMatch(CSS, /var\(\s*--block-pad-x\s*\)/);
});

test("the hero writes an inline alignment only when the banner chose one", () => {
  assert.match(
    CAROUSEL,
    /const bannerAlign = heroStyle\.align === "left"/,
    "the banner's own choice is not separated from the unset case",
  );
  assert.match(
    CAROUSEL,
    /\.\.\.\(bannerAlign \? \{ textAlign: bannerAlign/,
    "textAlign is still written unconditionally, which outranks the block setting",
  );
});

test("the centre default moved into the stylesheet, where it can be outranked", () => {
  // `.hero-content {` appears several times — the base rule and a couple of
  // media-query overrides. Find the base one by what only it contains; taking
  // the first match landed on a padding-only rule and reported the default
  // missing when it was three rules further down.
  const heroContent = /\{([^{}]*max-width: 1000px[^{}]*)\}/.exec(CSS);
  assert.ok(heroContent, ".hero-content base rule not found");
  assert.match(heroContent![1], /text-align: center/, "the default is not in the stylesheet");
});

test("the block-level alignment can reach the hero copy box", () => {
  // .hero-content carries its own text-align, and a direct declaration beats an
  // inherited value however specific the ancestor is — so the block setting
  // needs the same explicit escape hatch every other container uses. Moving the
  // default into CSS is not enough on its own; this was measured.
  assert.match(
    CSS,
    /\.property-block-styled\.is-text-align \.hero-content \{[\s\S]*?text-align: inherit/,
    "the hero copy box has no escape hatch for the block-level alignment",
  );
});
