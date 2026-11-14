import assert from "node:assert/strict";
import test from "node:test";
import { readCode, readStyles } from "./readCode";
import { compileDeclarations } from "./sourceEval";
import { sanitizeRichHtml } from "../app/modules/safeHtml.ts";
import { youtubeId, youtubePosterUrl } from "../app/modules/media.ts";

/**
 * 客戶: 新建電子報的內容要做成 WYSIWYG（內容塊同款），要保留圖片/影片嵌入與連結.
 *
 * The composer had its own editor: six controls against the shared one's
 * twenty, no link button at all, an image insert that was a window.prompt for
 * a URL while the admin already has a media library, and every control bound to
 * mousedown only, so none of them answered the keyboard. It is the same
 * RichTextEditor the content blocks use now.
 *
 * The one thing it does NOT share is how a video is inserted, and that is
 * deliberate — see the email note on the video test.
 */

const PATH_PANEL = "app/admin/(dashboard)/newsletter/panels/ComposePanel.tsx";
const PANEL = readCode(PATH_PANEL);
const EDITOR = readCode("app/admin/modules/RichTextEditor.tsx");

test("the composer uses the shared editor, not a second one", () => {
  assert.match(PANEL, /import RichTextEditor from/, "the composer no longer imports the shared editor");
  assert.match(PANEL, /<RichTextEditor/, "the composer is not rendering the shared editor");
  // The bespoke toolbar and its contentEditable are gone, not merely unused.
  for (const gone of ["RichToolbar", "nl-rich-toolbar", "nl-rich-editor", "contentEditable"]) {
    assert.ok(!PANEL.includes(gone), `the composer's own editor is back (${gone})`);
  }
  // …and so are their rules, which would otherwise match nothing.
  const css = readStyles("app/globals.css");
  for (const cls of [".nl-rich-toolbar", ".nl-rich-editor", ".nl-toolbar-sep"]) {
    /* A word-boundary match, not a substring one. `includes(".nl-rich-toolbar ")`
       and `includes(".nl-rich-toolbar{")` both miss `.nl-rich-toolbar:hover`,
       a comma at the end of the line, and a brace on the next — reviving the
       rules in any of those shapes left this green. */
    const alive = new RegExp(cls.replace(".", "\\.") + "(?![\\w-])");
    // Guard the guard: this regex must actually match when the class is present.
    assert.ok(alive.test(`${cls}:hover { color: red }`), "the liveness pattern matches nothing");
    assert.ok(!alive.test(css), `${cls} is styled but nothing renders it`);
  }
});

test("images, video and links are all reachable from the toolbar", () => {
  // The three the client named. Link is the one the old toolbar never had.
  assert.match(EDITOR, /title="連結 Link"/, "the link control is gone");
  assert.match(EDITOR, /title="插入圖片 Image"/, "the image control is gone");
  assert.match(EDITOR, /title="插入影片 Video"/, "the video control is gone");
  // The newsletter opts into the two controls the CMS blocks do not want: a
  // CMS page has its own 影音 URL block that renders a real player.
  assert.match(PANEL, /showVideo/, "the composer no longer enables the video insert");
  assert.match(PANEL, /showDivider/, "the composer lost the divider the old toolbar had");
  assert.match(EDITOR, /showVideo &&/, "the video button is no longer opt-in");
  assert.match(EDITOR, /showDivider &&/, "the divider button is no longer opt-in");
});

test("an inserted video is a poster and a link, never an iframe", () => {
  /* Gmail, Outlook and Apple Mail all drop <iframe>, so a newsletter with an
     embedded player shows a blank gap to every recipient. The insert builds the
     thing newsletters actually use — a poster image inside a link — which is
     only <a> and <img>. If this ever becomes an iframe the newsletter silently
     loses its video, which is precisely the class of bug this whole pass was
     about. */
  const fn = EDITOR.slice(EDITOR.indexOf("const insertVideo"), EDITOR.indexOf("}, [videoUrl"));
  assert.ok(fn.length > 0, "insertVideo is gone");
  assert.ok(!/iframe/i.test(fn), "the video insert emits an iframe, which no email client will render");
  assert.match(fn, /youtubePosterUrl\(url\)/, "the poster frame is no longer used");
  assert.match(fn, /<img src="\$\{poster\}"/, "the poster is no longer an image");
  // The text link is the fallback for a reader whose client blocks images —
  // without it, images-off means no way to reach the video at all.
  assert.match(fn, /<a href="\$\{href\}">\$\{safeLabel\}<\/a><\/p>/, "the text link under the poster is gone");
  // Anything that is not YouTube has no poster to name, so it must degrade to
  // the link rather than to a broken image.
  assert.match(fn, /const thumb = poster\s*\n?\s*\?/, "a non-YouTube URL no longer degrades to a plain link");
  assert.match(fn, /isSafeUrl\(url\)/, "the pasted video URL is no longer checked");
});

test("the poster survives to an email at a sane width", () => {
  /* Two mechanisms because two renderers: Outlook reads the width ATTRIBUTE and
     not the stylesheet, and a phone needs the image to shrink below 480. The
     style says `width: 100%` rather than `max-width: 100%` because Chrome drops
     an inline declaration that only repeats the computed style, and
     `.rte-content img` already sets max-width: 100% — measured: the first
     version of this insert lost its max-width on the way through execCommand. */
  const html = '<img src="https://img.youtube.com/vi/abc/hqdefault.jpg" width="480" style="width: 100%; max-width: 480px" />';
  const out = sanitizeRichHtml(html);
  assert.match(out, / width="480"/, "the width attribute is stripped, so Outlook gets the image at full size");
  assert.match(out, /max-width: 480px/, "the responsive cap is stripped, so a phone gets an overflowing image");

  /* height is NOT kept: with it, a pasted <img width=480 height=360> rendered
     311×363 in a 311px column instead of 311×233, because the containers that
     show this html set max-width without height:auto. Width alone scales. */
  assert.ok(!/ height=/.test(sanitizeRichHtml('<img src="https://x.example/a.jpg" width="480" height="360" />')),
    "the height attribute is back, so pasted images will be distorted again");

  // The attribute takes digits and nothing else.
  for (const bad of ['width="480px"', 'width="100%"', 'width="x onerror=alert(1)"', 'width="12345"',
                     // 1-4 word characters: the case that separates \d from \w.
                     'width="auto"', 'width="abcd"']) {
    const o = sanitizeRichHtml(`<img src="https://x.example/a.jpg" ${bad} />`);
    assert.ok(!/ width=/.test(o), `a non-numeric width survived: ${bad}`);
  }
});

test("a video id is validated before it is put in a URL", () => {
  // It is interpolated into an img src and an iframe src, so anything that is
  // not an id has to come back empty rather than reach a page.
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  for (const bad of ["https://www.youtube.com/watch?v=../../evil", "https://www.youtube.com/@chan", "https://vimeo.com/1", "", null]) {
    assert.equal(youtubeId(bad), "", `${JSON.stringify(bad)} was treated as a video id`);
  }
  assert.equal(youtubePosterUrl("https://youtu.be/dQw4w9WgXcQ"), "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.equal(youtubePosterUrl("https://vimeo.com/1"), "");
});

test("an unsent newsletter survives a closed tab", () => {
  /* 客戶: 待測試 — 自動儲存是否正常. There was none: the panel had no effect, no
     timer and no storage, and closing the tab lost the newsletter with no
     warning. This had no test at all until a regression audit pointed out that
     deleting the write left every other assertion green. */
  assert.match(PANEL, /sessionStorage\.setItem\(storageKey/, "the draft is no longer written");
  assert.match(PANEL, /sessionStorage\.getItem\(storageKey\)/, "the draft is no longer restored on mount");
  assert.match(PANEL, /window\.setTimeout\(/, "the write is no longer debounced, so it runs on every keystroke");
  // An emptied form must drop its draft, or a cleared newsletter comes back.
  assert.match(PANEL, /if \(!subject && !groups && !bodyHtml\) \{[\s\S]{0,80}?removeItem\(storageKey\)/,
    "an emptied compose form no longer clears its draft");

  /* And the submit path must NOT clear it. createCampaignAction redirects on
     failure as well as success, so clearing after the await deleted the only
     copy of the work on exactly the path where it was the only copy. */
  const submit = PANEL.slice(PANEL.indexOf("const handleSubmit"), PANEL.indexOf("return ("));
  assert.ok(
    !/removeItem\(/.test(submit),
    "the submit path clears the draft again — a failed create will destroy the work",
  );
});

test("one site's draft cannot surface in another site's composer", () => {
  /* The admin switches between the parent and each villa in the same tab. With
     one key for all of them, starting a newsletter for the parent and then
     opening the composer for a villa restored the parent's subject, target
     groups and recipient scope into a form that would send somewhere else. */
  const key = compileDeclarations(PATH_PANEL, ["draftKey"], [])({}) as {
    draftKey: (slug: string) => string;
  };
  assert.notEqual(key.draftKey("slowfield"), key.draftKey("hejing"),
    "two sites share a draft slot");
  assert.match(key.draftKey("hejing"), /hejing/);
  // A missing slug must not silently collide with a real one.
  assert.notEqual(key.draftKey(""), key.draftKey("slowfield"));
  // The composer has to be given the slug, or the key is always the same.
  assert.match(PANEL, /const storageKey = draftKey\(siteSlug\)/, "the key is not derived from the site");
  const page = readCode("app/admin/(dashboard)/newsletter/new/page.tsx");
  assert.match(page, /siteSlug=\{currentSlug/, "the page does not pass the current site to the composer");
});
