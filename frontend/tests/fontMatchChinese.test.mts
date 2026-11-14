import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { readStyles, readCode } from "./readCode";
import { fontVars, CJK_FACES } from "../app/modules/fontPresets.ts";

/**
 * "Same as Chinese" for the Latin face.
 *
 * Before this, only 黑體 had a Latin twin (the `sans` entry, which pointed at
 * the same Noto Sans TC variable). A site on 宋體 or 楷書 had no way to ask for
 * one face throughout, so English always came out as EB Garamond or Cormorant
 * beside Chinese set in Noto Serif TC (客戶: 英文字體如何設定成與中文一樣).
 */

const vars = (cfg: Record<string, string>) => fontVars({ font_config: cfg });

for (const cjk of ["serif", "sans", "kai"]) {
  test(`match draws Latin in the ${cjk} Chinese face`, () => {
    const out = vars({ title_cjk: cjk, title_latin: "match", body_cjk: cjk, body_latin: "match" });
    const face = CJK_FACES[cjk];
    assert.ok(face, `CJK_FACES has no ${cjk}`);
    // The Latin slot comes first in the stack, so the chosen CJK face must lead.
    assert.ok(
      out["--font-title"].startsWith(face),
      `title stack does not lead with the ${cjk} face: ${out["--font-title"]}`,
    );
    assert.ok(
      out["--font-body"].startsWith(face),
      `body stack does not lead with the ${cjk} face: ${out["--font-body"]}`,
    );
  });
}

test("a Latin face that is not match is left alone", () => {
  const out = vars({ title_cjk: "serif", title_latin: "cormorant", body_cjk: "serif", body_latin: "serif" });
  assert.match(out["--font-title"], /Cormorant Garamond/);
  assert.match(out["--font-body"], /EB Garamond/);
});

test("every stack still ends in a Chinese fallback", () => {
  // A Latin face carries no Chinese glyphs; without the tail the browser picks
  // a system font at random for the CJK characters.
  for (const latin of ["match", "cormorant", "sans"]) {
    const out = vars({ title_cjk: "serif", title_latin: latin, body_cjk: "serif", body_latin: latin === "cormorant" ? "serif" : latin });
    assert.match(out["--font-title"], /Noto Serif TC|Noto Sans TC|LXGW WenKai TC/, `title (${latin}) has no CJK fallback`);
    assert.match(out["--font-body"], /Noto Serif TC|Noto Sans TC|LXGW WenKai TC/, `body (${latin}) has no CJK fallback`);
  }
});

test("the admin offers the option for both heading and body", () => {
  const src = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
  const opts = [...src.matchAll(/<option value="match">/g)];
  assert.equal(opts.length, 2, `expected the option on both Latin selects, found ${opts.length}`);
});

test("the stays listing uses the site's spacing, not its own clamps", () => {
  // Its padding was 6vw/5vw — the inverse of --section-y / --gutter — so the
  // page sat differently from every other one and ignored the admin's spacing.
  const css = readStyles("app/globals.css");
  const rule = css.match(/\.stays-index-body\s*\{([^}]*)\}/);
  assert.ok(rule, ".stays-index-body rule is gone");
  assert.match(rule![1], /padding:\s*var\(--section-y\)\s+var\(--gutter\)/);
});
