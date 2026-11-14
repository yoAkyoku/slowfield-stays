import assert from "node:assert/strict";
import test from "node:test";
import { isSafeUrl, sanitizeInlineHtml, sanitizeRichHtml, stripClipboardFragmentMarkers } from "../app/modules/safeHtml.ts";

/**
 * Run with: npm test  (node --test, no test framework dependency)
 *
 * These cover the URL allow-list that decides whether a link an editor typed
 * into a block is rendered. It shipped allowing a leading slash followed by a
 * backslash, which a browser resolves off-site, so a link reading as internal
 * left the site when clicked.
 */

test("site-relative paths are allowed", () => {
  for (const url of ["/dining", "/contact?subject=x", "/a/b/c#frag"]) {
    assert.equal(isSafeUrl(url), true, url);
  }
});

test("absolute http(s) is allowed", () => {
  assert.equal(isSafeUrl("https://example.com/x"), true);
  assert.equal(isSafeUrl("http://example.com"), true);
});

test("protocol-relative and backslash-smuggled hosts are rejected", () => {
  // A browser resolves every one of these to https://evil.example/.
  for (const url of ["//evil.example", "/\\evil.example", "/\\\\evil.example", "\\/evil.example"]) {
    assert.equal(isSafeUrl(url), false, url);
  }
});

test("other schemes are rejected", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,<script>", "vbscript:x", ""]) {
    assert.equal(isSafeUrl(url), false, url);
  }
});

test("rich text keeps an internal link and drops a smuggled one", () => {
  const kept = sanitizeRichHtml('<p><a href="/contact?subject=x">Ask</a></p>');
  assert.match(kept, /href="\/contact\?subject=x"/);
  // Internal links stay in the tab the reader is already in.
  assert.doesNotMatch(kept, /target="_blank"/);

  const dropped = sanitizeRichHtml('<a href="/\\evil.example">Looks internal</a>');
  assert.doesNotMatch(dropped, /href=/);

  const external = sanitizeRichHtml('<a href="https://example.com">Out</a>');
  assert.match(external, /rel="noopener noreferrer"/);
});

test("rich text drops an image pointing off-site by backslash", () => {
  assert.doesNotMatch(sanitizeRichHtml('<img src="/\\evil.example/p.png">'), /<img/);
  assert.match(sanitizeRichHtml('<img src="/storage/media/a.jpg">'), /src="\/storage\/media\/a.jpg"/);
});

test("clipboard fragment markers never become newsletter text", () => {
  const html = "<!--StartFragment--><p>Hello</p><!--EndFragment-->";
  assert.equal(stripClipboardFragmentMarkers(html), "<p>Hello</p>");
  assert.equal(sanitizeRichHtml(html), "<p>Hello</p>");
  // Campaigns saved before this fix may already contain escaped markers.
  assert.equal(sanitizeRichHtml("<p>Hello</p>&lt;!--EndFragment--&gt;"), "<p>Hello</p>");
  const inline = sanitizeInlineHtml("StartFragment\n<p>Hello</p>\nEndFragment");
  assert.match(inline, /Hello/);
  assert.doesNotMatch(inline, /Fragment/);
});

test("inline sanitiser applies the same allow-list", () => {
  assert.match(sanitizeInlineHtml('<a href="/news">n</a>'), /href="\/news"/);
  assert.doesNotMatch(sanitizeInlineHtml('<a href="/\\evil.example">n</a>'), /href=/);
});

/**
 * Pasting a formatted draft into a CMS block. The inline allow-list has no
 * block tags, so paragraphs and list items used to be dropped with nothing in
 * their place and the draft arrived as one unbroken line; a <style> tag was
 * dropped but its stylesheet text was kept, and rendered as body copy.
 */
test("a pasted draft keeps its line breaks", () => {
  assert.equal(
    sanitizeInlineHtml("<p>A</p><p>B</p><ul><li>C</li></ul>"),
    "A<br>B<br>C",
  );
});

test("every block boundary becomes a break", () => {
  assert.equal(sanitizeInlineHtml("<h1>T</h1><h6>S</h6><div>d</div>"), "T<br>S<br>d");
  assert.equal(sanitizeInlineHtml("<table><tr><td>a</td></tr><tr><td>b</td></tr></table>"), "a<br>b");
  // A blank line out of contentEditable is one break, not two.
  assert.equal(sanitizeInlineHtml("<div>a</div><div><br></div><div>b</div>"), "a<br><br>b");
  // Inline formatting still survives the boundary rewrite.
  assert.equal(sanitizeInlineHtml("<p><b>A</b></p><p>B</p>"), "<b>A</b><br>B");
});

test("stylesheet and script text never becomes body copy", () => {
  assert.equal(sanitizeInlineHtml("<p>A</p><style>.x{color:red}</style>"), "A");
  assert.equal(sanitizeInlineHtml("<script>alert(1)</script>hi"), "hi");
  // Attributes on the opening tag, and a closing tag with a stray space, are
  // both things a real page emits.
  assert.equal(sanitizeInlineHtml('<style type="text/css">.x{color:red}</style>ok'), "ok");
  assert.equal(sanitizeInlineHtml("<script>x=1</script >ok"), "ok");
  // Unterminated: a browser reads the rest of the document as its content.
  assert.equal(sanitizeInlineHtml("<p>A</p><script>alert(1)"), "A");
  // The other sanitisers share the walk, so they must not leak it either.
  assert.equal(sanitizeRichHtml("<p>A</p><style>.x{color:red}</style>"), "<p>A</p>");
  assert.doesNotMatch(sanitizeRichHtml("<script>alert(1)</script>"), /alert/);
});

/**
 * Cutting a region out of a string can splice its neighbours into a new tag.
 * That is how "strip the bad thing" sanitisers get bypassed: the filter runs
 * once, and its own output is the attack. The walk that follows has to be the
 * thing that decides, and these check it still is.
 */
test("removing a raw-text element cannot splice a new tag into existence", () => {
  // The inner <script>…</script> is cut, leaving "<scr" + "ipt>alert(1)".
  assert.doesNotMatch(sanitizeInlineHtml("<scr<script>x</script>ipt>alert(1)</scr\ipt>"), /alert\(1\)/);
  assert.doesNotMatch(sanitizeRichHtml("<sty<style>y</style>le>.a{}</style>"), /\.a\{\}/);
  // Splicing an <img> back together must still meet the attribute allow-list.
  const img = sanitizeRichHtml('<im<style>z</style>g src="/ok.jpg" onerror="alert(1)">');
  assert.doesNotMatch(img, /onerror/);
});

test("a raw-text element cannot hide inside an attribute value", () => {
  // The opening-tag pattern skips quoted runs, so a ">" inside an attribute
  // must not end the tag early and expose the rest as text.
  assert.doesNotMatch(sanitizeInlineHtml('<style title="a>b">.x{}</style>keep'), /\.x\{\}/);
  assert.match(sanitizeInlineHtml('<style title="a>b">.x{}</style>keep'), /keep/);
});
