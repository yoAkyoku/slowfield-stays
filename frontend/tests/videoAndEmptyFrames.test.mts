import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode";
import { sanitizeEmbedHtml } from "../app/modules/safeHtml.ts";
import { platformForUrl, youtubeEmbedUrl } from "../app/modules/media.ts";

/**
 * 客戶: 點進文章後直接在頁面內觀看，不希望每次都跳轉 YouTube.
 *
 * The published page already embedded YouTube in place. Three things said
 * otherwise, and all three were in the admin:
 *
 *   - the block editor's live preview drew a link-out tile for every URL,
 *     including the ones the page embeds;
 *   - filling in 封面圖 silently converts the player into a link out, with
 *     nothing on the form saying so;
 *   - the field help named four platforms; only one of them plays in place.
 *
 * And 客戶: 它上面有放空白照片 — two frames were drawn for pictures that were not
 * there. Both only appear when the data is incomplete, which is the state the
 * client was testing in (「目前測試圖片數量不足」).
 */

test("one function decides what is embeddable", () => {
  assert.equal(youtubeEmbedUrl("https://www.youtube.com/watch?v=abc123"), "https://www.youtube.com/embed/abc123");
  assert.equal(youtubeEmbedUrl("https://youtu.be/abc123"), "https://www.youtube.com/embed/abc123");
  assert.equal(youtubeEmbedUrl("https://www.youtube.com/shorts/abc123"), "https://www.youtube.com/embed/abc123");
  // A YouTube URL with no video in it must not claim to be a player.
  assert.equal(youtubeEmbedUrl("https://www.youtube.com/@somechannel"), "");
  assert.equal(youtubeEmbedUrl("https://vimeo.com/12345"), "");
  assert.equal(youtubeEmbedUrl("not a url"), "");
  assert.equal(youtubeEmbedUrl(undefined), "");
  assert.equal(platformForUrl("https://www.tiktok.com/@x/video/1"), "tiktok");
  assert.equal(platformForUrl("https://vimeo.com/12345"), "unknown");
});

test("the admin preview shows what the page will render", () => {
  const editor = readCode("app/admin/(dashboard)/cms/PageBlockEditor.tsx");
  // The preview must resolve the embed the same way, not with its own test.
  assert.ok(
    !/block\.url\.includes\("youtube"\)/.test(editor),
    "the preview is back to its own `includes(\"youtube\")` test",
  );
  assert.match(editor, /const youtubeUrl = youtubeEmbedUrl\(block\.url\)/, "the preview no longer resolves an embed URL");
  assert.match(editor, /\{youtubeUrl \? \(\s*<iframe/, "the preview renders a link-out tile for an embeddable video again");
  /* And that the iframe is pointed at the RESOLVED url. Grepping only for the
     ternary let `src={block.url}` through — a watch?v= address, which YouTube
     refuses to frame, so the preview would go blank while this test stayed
     green. Proven by mutation. */
  assert.match(editor, /src=\{youtubeUrl\}/, "the preview iframe is not using the resolved embed URL");
  // …and the page it is previewing must use the same import, not a local copy.
  const page = readCode("app/modules/content/ContentBlockRenderer.tsx");
  assert.ok(!/function youtubeEmbedUrl/.test(page), "the renderer grew its own copy of the resolver again");
  assert.match(page, /from "\.\.\/media"/, "the renderer no longer shares the resolver");
});

test("the two settings that change where a video plays are explained", () => {
  const editor = readCode("app/admin/(dashboard)/cms/PageBlockEditor.tsx");
  // 封面圖 turns in-page playback into a new tab. Silently, before this.
  assert.match(editor, /不會在頁面內播放/, "the cover-image field no longer says it replaces the player");
  const i18n = readCode("app/modules/i18n.ts");
  assert.match(i18n, /只有 YouTube 會直接在頁面內播放/, "the zh field help no longer says which platforms embed");
  assert.match(i18n, /Only YouTube plays inside the page/, "the en field help no longer says which platforms embed");
});

test("an embedded player keeps fullscreen and its permissions", () => {
  /* `allowfullscreen` arrives valueless and `allow` is a semicolon list well
     past the 40-character token limit, so the copy loop could never keep
     either: every embed lost its fullscreen button. They are written from a
     fixed list instead, after the host check — the same way referrerpolicy is. */
  const provider =
    '<iframe src="https://www.youtube.com/embed/abc?feature=oembed" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
  const out = sanitizeEmbedHtml(provider, ["youtube.com"]);
  assert.match(out, / allowfullscreen/, "the fullscreen button is gone again");
  assert.match(out, / allow="[^"]*picture-in-picture/, "the player permissions are gone again");
  assert.match(out, / title="/, "the frame has no accessible name");
  assert.match(out, / referrerpolicy="strict-origin-when-cross-origin"/);

  // None of that may loosen the host check.
  for (const bad of [
    '<iframe src="https://evil.example.com/x" allowfullscreen></iframe>',
    '<iframe src="http://www.youtube.com/embed/abc"></iframe>',
    '<iframe src="javascript:alert(1)"></iframe>',
  ]) {
    assert.ok(!sanitizeEmbedHtml(bad, ["youtube.com"]).includes("<iframe"), `an iframe survived: ${bad}`);
  }
  // A quoted value must not be able to close the attribute and add another.
  const inject = '<iframe src="https://www.youtube.com/embed/a" title=\'x" onload="alert(1)\'></iframe>';
  assert.ok(!sanitizeEmbedHtml(inject, ["youtube.com"]).includes("onload"), "an event handler survived sanitising");
});

test("nothing draws a frame for a picture that is not there", () => {
  /* A stay with neither a hero image nor a gallery drew an empty beige panel.
     The card has to stay — a stay with no photos is still bookable — so it uses
     the same drawn placeholder as every other card with a missing cover. */
  const card = readCode("app/modules/stays/StayCard.tsx");
  assert.match(
    card,
    /\{gallery\.length === 0 && <span className="card-cover-empty"/,
    "a stay with no photos is back to an empty panel",
  );
  /* The placeholder is drawn entirely in CSS, so an empty <span> with no rules
     behind it is the same blank panel under another name. Deleting those rules
     left this test green until these two assertions existed. */
  const css = readStyles("app/globals.css");
  assert.match(css, /\.card-cover-empty \{[^}]*background:/, "the placeholder has no fill, so it draws nothing");
  assert.match(css, /\.card-cover-empty::(before|after)/, "the placeholder lost the motif that makes it read as a photo slot");

  /* An image grid row exists before its picture is chosen. The single-image
     branch has always checked the url; the grid checked only that the array was
     non-empty, so an unfilled row drew a blank cell. */
  for (const path of [
    "app/modules/content/ContentBlockRenderer.tsx",
    "app/admin/(dashboard)/cms/PageBlockEditor.tsx",
  ]) {
    const src = readCode(path);
    assert.match(src, /const images = block\.images\.filter\(\(img\) => img\.url\)/, `${path} no longer filters empty rows`);
    assert.match(src, /if \(!images\.length\) return null/, `${path} still renders an all-empty grid`);
    /* The filtered list has to be the one rendered. Computing `images` and then
       mapping `block.images` satisfied every assertion above while putting all
       the blank cells back — proven by mutation. */
    assert.ok(
      !/\{block\.images\.map\(/.test(src),
      `${path} maps the unfiltered block.images, so the filter changes nothing`,
    );
    assert.match(src, /\{images\.map\(/, `${path} does not render the filtered list`);
  }
});
