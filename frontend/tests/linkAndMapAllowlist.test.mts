import assert from "node:assert/strict";
import test from "node:test";
import { googleMapEmbedSrc, isSafeUrl, safeLinkHref, sanitizeInlineHtml } from "../app/modules/safeHtml.ts";

/**
 * Both of these guard a value an editor types into a settings field and that
 * the browser then acts on — an href it navigates to, an iframe src it loads.
 * The site is multi-tenant on one origin, so "only defaces their own villa" is
 * not a thing that can be said here.
 */

test("safeLinkHref refuses every scheme that can run code", () => {
  for (const hostile of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "blob:https://example.com/x",
  ]) {
    assert.equal(safeLinkHref(hostile), "", hostile);
  }
});

test("safeLinkHref refuses a link that reads as internal and is not", () => {
  // Under a special scheme a browser treats the backslash as a slash, so
  // "/\evil.example" leaves the site while looking like a path on it.
  for (const offsite of ["//evil.example/x", "/\\evil.example", "/\\\\evil.example"]) {
    assert.equal(safeLinkHref(offsite), "", offsite);
  }
});

/**
 * A browser removes ASCII tab, LF and CR from a URL BEFORE parsing it, so the
 * string the allow-list tests is not the string that gets resolved. Measured in
 * Chrome: `/<TAB>/evil.example` resolves to http://evil.example/ — the same
 * phishing shape the backslash case above was written for, reached by a
 * character the pattern never looked at.
 *
 * Worse than an ordinary off-site link: BlockAttractions decides
 * `target="_blank" rel="noopener noreferrer"` from /^https?:\/\//, which is
 * false for these, so the link left the site in the same tab with no rel.
 */
const STRIPPED_BY_THE_PARSER = [
  "/\t/evil.example",
  "/\n/evil.example",
  "/\r/evil.example",
  "/\t\\evil.example",
  "/\t\t//evil.example",
  "/pa\tth//evil.example",
];

test("a control character cannot turn a path into another origin", () => {
  for (const offsite of STRIPPED_BY_THE_PARSER) {
    assert.equal(safeLinkHref(offsite), "", JSON.stringify(offsite));
  }
});

test("isSafeUrl refuses them too, not only safeLinkHref", () => {
  // The two disagreed: safeLinkHref is the settings-field gate, isSafeUrl gates
  // <img src> in BlockPartners and the <a> in sanitizeInlineHtml. Testing only
  // the first left the other half of the surface open.
  for (const offsite of STRIPPED_BY_THE_PARSER) {
    assert.equal(isSafeUrl(offsite), false, JSON.stringify(offsite));
  }
  for (const good of ["/stays/hejing", "https://example.com/a", "http://example.com"]) {
    assert.equal(isSafeUrl(good), true, good);
  }
});

test("rich text cannot carry one either", () => {
  // sanitizeInlineHtml tested the bare regex rather than isSafeUrl, so the
  // anchor survived byte-for-byte — escapeAttr escapes &<>" and not a tab.
  for (const offsite of STRIPPED_BY_THE_PARSER) {
    const out = sanitizeInlineHtml(`<a href="${offsite}">x</a>`);
    assert.ok(!out.includes("<a "), `anchor kept for ${JSON.stringify(offsite)}: ${out}`);
  }
  assert.match(sanitizeInlineHtml('<a href="/stays/x">y</a>'), /<a href="\/stays\/x">/);
});

test("safeLinkHref keeps the targets an editor legitimately types", () => {
  for (const good of [
    "https://slowfield.example/stays",
    "http://example.com",
    "/stays/hejing/contact",
    "/contact?source=booking",
    "#rooms",
    "#關於我們",
    "tel:+886-3-960-1268",
    "mailto:hello@slowfield.example",
  ]) {
    assert.equal(safeLinkHref(good), good, good);
  }
});

test("safeLinkHref returns the empty string for nothing, so callers can fall back", () => {
  for (const empty of [undefined, null, "", "   ", {}, 0]) {
    assert.equal(safeLinkHref(empty), "");
  }
});

test("safeLinkHref is wider than isSafeUrl only where a CTA needs it", () => {
  // The rich-text allow-list stays http(s)/relative; the settings-field one adds
  // exactly three shapes and nothing else.
  assert.equal(isSafeUrl("tel:+886000"), false);
  assert.equal(safeLinkHref("tel:+886000"), "tel:+886000");
  assert.equal(safeLinkHref("tel:+886000<script>"), "");
  assert.equal(safeLinkHref("mailto:a@b.co\"onmouseover=x"), "");
  assert.equal(safeLinkHref("#a b"), "");
  // …but a CJK anchor is exactly what the admin's 區塊標記 field produces.
  assert.equal(safeLinkHref("#關於"), "#關於");
  assert.equal(safeLinkHref("#a#b"), "");
  assert.equal(safeLinkHref("#a?x=1"), "");
});

test("googleMapEmbedSrc rejects a host that merely starts with a Google one", () => {
  // The regex this replaced ended the host alternative with \b, which matches
  // before "@" and before "." — so it anchored on a prefix of the authority.
  for (const bypass of [
    "https://maps.google.com@evil.example/",
    "https://www.maps.google.com@evil.example/",
    "https://maps.google.com.evil.example/x",
    "https://google.com.evil.example/maps/embed",
    "https://www.google.com.evil.example/maps",
    "http://www.google.com/maps/embed",
    "https://evil.example/maps/embed",
    "https://www.google.com/search?q=1",
    // The ccTLD allowance must stay anchored at both ends.
    "https://www.google.com.tw.evil.example/maps",
    "https://evil.google.com/maps",
    "https://notgoogle.com/maps",
  ]) {
    assert.equal(googleMapEmbedSrc(bypass), "", bypass);
  }
});

test("googleMapEmbedSrc accepts the embeds the admin actually pastes", () => {
  for (const good of [
    "https://www.google.com/maps/embed?pb=!1m18",
    "https://www.google.com/maps/d/embed?mid=abc",
    "https://maps.google.com/maps?q=24.5,121.8&output=embed",
    "https://google.com/maps/embed?pb=x",
    // A Taiwanese editor copying out of the URL bar gets a ccTLD.
    "https://www.google.com.tw/maps/embed?pb=x",
    "https://www.google.co.uk/maps/embed?pb=x",
    "https://google.de/maps/embed?pb=x",
  ]) {
    assert.ok(googleMapEmbedSrc(good).startsWith("https://"), good);
  }
});

test("googleMapEmbedSrc pulls the src out of a pasted iframe snippet", () => {
  const snippet = '<iframe src="https://www.google.com/maps/embed?pb=!1m18" width="600" loading="lazy"></iframe>';
  assert.equal(googleMapEmbedSrc(snippet), "https://www.google.com/maps/embed?pb=!1m18");
  // …and still applies the allow-list to what it pulled out.
  assert.equal(googleMapEmbedSrc('<iframe src="https://evil.example/x"></iframe>'), "");
  assert.equal(googleMapEmbedSrc("<iframe src='https://maps.google.com@evil.example/'></iframe>"), "");
});

test("googleMapEmbedSrc survives anything that is not a URL", () => {
  for (const junk of [undefined, null, "", "not a url", "<iframe>", 42, {}]) {
    assert.equal(googleMapEmbedSrc(junk), "");
  }
});
