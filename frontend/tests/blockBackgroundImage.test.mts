import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readEditorSurface } from "./readCode";
import { jsxTags } from "./sourceEval";
import { blockStyle } from "../app/modules/blockStyle.ts";

/**
 * 背景圖片 on any block — the closing CTA band in the brand-story design is a
 * photograph with white copy over it, and no block could carry one.
 *
 * Built on the surface the colour already uses rather than as a field on one
 * block type, because it is the same decision: a block's background. The
 * colour and its 透明度 become the WASH over the picture, which is why they
 * ride in the same declaration — see the scrim test below for why a
 * backgroundColor could not have done it.
 *
 * These run `blockStyle` rather than grepping it. Every assertion here is about
 * a value the browser receives.
 */

const IMG = "/storage/media/47d05fa1e7ac4ddf8eec41faf1b34aa7.webp";
const HOME_EDITOR = "app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx";
const PAGE_EDITOR = "app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx";
const INSPECTOR = "app/admin/modules/BlockStyleInspector.tsx";

test("a picture reaches the block as a covering background", () => {
  const s = blockStyle({ _bgImage: IMG });
  assert.equal(s?.backgroundImage, `url(${IMG})`, "背景圖片 no longer reaches background-image");
  /* `cover` and a centred origin, or a 1600px photo tiles across the band at
     its natural size — which is what a bare background-image does. */
  assert.equal(s?.backgroundSize, "cover");
  assert.equal(s?.backgroundPosition, "center");
  assert.equal(s?.backgroundRepeat, "no-repeat");
});

test("the colour becomes the scrim OVER the picture, not a layer behind it", () => {
  /* The whole reason the two share a declaration. A `cover` photograph is
     opaque, so a backgroundColor sits behind it and no amount of it is ever
     visible: white copy over a pale sky would have stayed unreadable however
     far the editor dragged 透明度. As the first of two background-image layers
     it is painted on top, which is what a mask means. */
  const s = blockStyle({ _bgImage: IMG, _bgColor: "#000000", _bgOpacity: 40 });
  assert.equal(
    s?.backgroundImage,
    `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${IMG})`,
    "the 背景顏色 no longer washes over the 背景圖片",
  );
  assert.equal(
    s?.backgroundColor,
    undefined,
    "the colour is ALSO painted behind the photo, where it can never show — one surface, one painter",
  );
  // …and with no picture it is still an ordinary background colour.
  assert.equal(blockStyle({ _bgColor: "#000000", _bgOpacity: 40 })?.backgroundColor, "rgba(0, 0, 0, 0.4)");
  assert.equal(blockStyle({ _bgColor: "#000000" })?.backgroundImage, undefined);
});

test("a block with only a picture still gets the band geometry AND its side padding", () => {
  /* The geometry branch was `if (bgColor)`, and the padding branch below it
     was `if (bgColor && style.width)`. An image-only block satisfies neither by
     name. The first would have left the photo inside the text column instead of
     spanning the window; the second would have taken the uncoloured path,
     zeroing --gutter while the wrapper is 100vw wide — copy hard against both
     edges of the screen, which is the visible half of the bug. */
  const s = blockStyle({ _bgImage: IMG }) as Record<string, string>;
  assert.equal(s.width, "100vw", "an image-only block no longer spans the window");
  assert.equal(s.marginLeft, "calc(-50vw + 50%)");

  const padded = blockStyle({ _bgImage: IMG, _padX: 56 }) as Record<string, string>;
  assert.match(
    String(padded.paddingLeft),
    /^calc\(50vw - 50% \+ /,
    "左右留白 on an image-only block no longer keeps the half-window that holds its text in the column",
  );
  assert.equal(padded["--gutter"], "0px", "the inner section adds its own gutter on top again");
  // The coloured case it was modelled on is unchanged.
  const colour = blockStyle({ _bgColor: "#ff0000", _padX: 56 }) as Record<string, string>;
  assert.match(String(colour.paddingLeft), /^calc\(50vw - 50% \+ /);
});

test("a value that is not a plausible URL paints nothing at all", () => {
  /* Through `cssUrl`, the same sanitiser PageHero runs the hero photo through:
     React serialises a style value verbatim on the server, so a stored
     `x);position:fixed;inset:0` would close the url() and append its own
     declarations on a real slowfield.example page. The block must come back
     with no background AND no 100vw geometry — a rejected value taking half
     the layout with it is how a hostile config becomes a visible break. */
  for (const bad of ["x);position:fixed;inset:0", "a b.png", "url(x)", "'x'", 42, null, {}]) {
    const s = blockStyle({ _bgImage: bad }) as Record<string, unknown> | undefined;
    assert.equal(s, undefined, `_bgImage accepted ${String(bad)}`);
  }
  // A rejected picture must not take a legitimate colour down with it.
  const s = blockStyle({ _bgImage: "a b.png", _bgColor: "#ff0000" });
  assert.equal(s?.backgroundColor, "rgba(255, 0, 0, 1)");
  assert.equal(s?.backgroundImage, undefined);
});

test("a self-painting block gets no picture, on the same terms as the colour", () => {
  /* SELF_PAINTING_BLOCK_TYPES exists because the newsletter draws its own band:
     a wrapper photo behind it would be covered by that band and would still
     force the wrapper to 100vw, which is what stopped its 留白置中 from ever
     being visible when the colour did the same thing. */
  assert.equal(blockStyle({ _bgImage: IMG }, "newsletter"), undefined);
  assert.equal(blockStyle({ _bgImage: IMG }, "rich_text")?.backgroundImage, `url(${IMG})`);
});

test("both editors offer the field, and both withhold it from a self-painting block", () => {
  for (const [name, path] of [["homepage", HOME_EDITOR], ["site page", PAGE_EDITOR]] as Array<[string, string]>) {
    const src = readEditorSurface(path);
    assert.ok(
      src.includes("<BlockBackgroundImage"),
      `the ${name} editor no longer offers 背景圖片 — the key would be unreachable from the CMS`,
    );
    const tag = [path, INSPECTOR].flatMap((p) => jsxTags(p)).find((t) => t.tag === "BlockBackgroundImage");
    assert.ok(tag, `${name}: BlockBackgroundImage is mentioned but not rendered`);
    assert.equal(
      tag.attrs.get("value"),
      "selected.config._bgImage",
      `${name}: the field is bound to a key blockStyle does not read`,
    );
    /* The guard is on the same predicate the colour uses. Asserted on the text
       around the tag rather than by re-implementing the condition: what matters
       is that the two controls cannot drift apart. */
    const at = src.indexOf("<BlockBackgroundImage");
    const before = src.slice(Math.max(0, at - 400), at);
    assert.match(
      before,
      /!paintsOwnBackground\(selected\.type\) && \(/,
      `${name}: 背景圖片 is offered on a block that paints its own background`,
    );
  }
});

test("clearing the field removes the key rather than storing an empty string", () => {
  /* An empty string is falsy everywhere it is read, so this is cosmetic in the
     renderer — but a config that accumulates `_bgImage: ""` on every block an
     editor once experimented with is how "which blocks have a background?"
     stops being answerable, and blockStyle's own early-return already treats
     absent and empty differently for every other key. */
  const src = readCode("app/admin/modules/BlockBackgroundImage.tsx");
  assert.match(src, /onChange\(next \|\| undefined\)/, "an emptied 背景圖片 now stores \"\"");
  for (const path of [HOME_EDITOR, PAGE_EDITOR]) {
    const surface = readEditorSurface(path);
    const at = surface.indexOf("<BlockBackgroundImage");
    const tag = surface.slice(at, at + 600);
    assert.match(tag, /const \{ _bgImage, \.\.\.rest \}/, `${path}: clearing 背景圖片 leaves the key behind`);
  }
});
