/**
 * Shared, allow-list HTML sanitiser for admin-authored block text.
 *
 * Everything is escaped first, then a small safe set of tags is re-allowed, so
 * editors can use basic formatting (bold / italic / lists / sub-headings /
 * links) consistently across blocks while scripts, event handlers and unknown
 * tags can never survive (no XSS).
 *
 * Use `convertNewlines: true` for plain-text fields where authors type with
 * Enter (rich_text body, FAQ answers, etc.) so newlines become <br>. Leave it
 * off for fields that already contain real HTML markup.
 */
/* An absolute http(s) URL, or a path on this site.
   The lookahead rejects a backslash as well as a slash. A browser parsing a URL
   under a special scheme treats a backslash exactly like a slash, so a href of
   slash-backslash-evil.example resolves to https://evil.example/ — measured in
   a real browser, not inferred. Rejecting only a double slash left a link that
   reads as internal in the editor and in the markup and leaves the site when
   it is clicked, which is a phishing link with the site's own domain in front
   of it. */
/* Case-insensitive, because a URL scheme is. Five sibling checks in this file
   already carry the flag and this one did not, so `HTTPS://…` was rejected by
   isSafeUrl while sanitizeRichHtml's own `/^https?:\/\//i` accepted it. The
   disagreement was silent and only ever lost content: an og:image dropped, a
   block CTA falling back to its default target, a video cover link becoming
   `href="#"`. */
const INLINE_HREF_RE = /^(https?:\/\/|\/(?![/\\]))/i;

/* The character references a browser resolves before it resolves an href.
   safeHtml deliberately leaves a valid reference intact so `&nbsp;` renders as
   a space rather than as its own source text — which means the escaped string
   an allow-list would test is not the string the browser navigates to.
   `&#106;avascript:alert(1)` and `javascript&colon;alert(1)` both survive the
   escape untouched and both read as a scheme to the parser, so the href is
   decoded here first and the ALLOW-LIST decides on the decoded value. The same
   entity-blind check is what the custom-code docblock below records as the
   hole in the pass it replaced. */
const NAMED_REFS: Record<string, string> = {
  amp: "&", AMP: "&", lt: "<", LT: "<", gt: ">", GT: ">", quot: '"', QUOT: '"',
  apos: "'", colon: ":", semi: ";", sol: "/", bsol: "\\", period: ".",
  num: "#", nbsp: " ", Tab: "\t", NewLine: "\n",
};
function decodeCharRefs(s: string): string {
  return s.replace(/&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (m, body: string) => {
    // An unknown named reference is left as typed: the browser will not decode
    // it either, so the two agree on what the URL says.
    if (body[0] !== "#") return NAMED_REFS[body] ?? m;
    const cp = body[1] === "x" || body[1] === "X"
      ? Number.parseInt(body.slice(2), 16)
      : Number.parseInt(body.slice(1), 10);
    if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return m;
    return String.fromCodePoint(cp);
  });
}

export function safeHtml(input: unknown, opts: { convertNewlines?: boolean } = {}): string {
  if (input == null) return "";
  let s = String(input)
    // Escape bare ampersands but keep valid character references intact, so
    // author-pasted entities like &nbsp; / &amp; / &#39; render instead of
    // showing the literal "&nbsp;" text.
    .replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]*;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Re-allow simple formatting / structural tags (opening or closing), no attrs.
  const TAGS = "b|strong|i|em|u|s|br|p|ul|ol|li|h3|h4|h5|blockquote|span";
  s = s.replace(
    new RegExp(`&lt;(\\/?(?:${TAGS}))\\s*\\/?&gt;`, "gi"),
    (_m, tag: string) => `<${tag.toLowerCase()}>`
  );

  /* Re-allow safe links, through isSafeUrl — the same allow-list the rich and
     inline sanitisers use, so one hole closed is closed everywhere.

     This one was left behind when those two were moved onto it (the docblock at
     sanitizeRichHtml records that pair "disagreed in silence"), and the shape of
     the miss was worse than a dropped link: the pattern here required an
     absolute http(s) href and nothing else in the tag, so `<a href="/internal">`
     and `<a href="https://ok.com" title="t">` matched nothing and stayed
     ESCAPED, while the separate `&lt;/a&gt;` pass below turned their closing tag
     into a real one. The reader saw the literal text `<a href="/internal">`
     followed by a live orphan `</a>`.

     Rebuilt from scratch rather than patched: the whole attribute run is
     discarded and only href is written back, so an `onclick=` sitting beside a
     perfectly good href cannot ride along. `[^<>]` keeps the match inside one
     escaped tag — by this point the pass above has put real `<b>`/`<br>` tags
     back into the string, and a tempered run that could cross them would eat
     them whenever an author left an angle bracket unpaired.

     A rejected opening tag takes its own `</a>` with it — see anchorBalance,
     which the other three sanitisers share. */
  const anchors = anchorBalance();
  s = s.replace(/&lt;(\/)?a\b((?:(?!&gt;)[^<>])*)&gt;/gi, (_m, close: string | undefined, attrs: string) => {
    if (close) return anchors.close();
    const quoted = attrs.match(/(?:^|\s)href\s*=\s*"([^"]*)"/i) ?? attrs.match(/(?:^|\s)href\s*=\s*'([^']*)'/i);
    const href = decodeCharRefs(quoted?.[1] ?? "");
    if (!isSafeUrl(href)) { anchors.refused(); return ""; }
    anchors.opened();
    // Site-relative stays in the tab the reader is already in — the same split
    // sanitizeRichHtml makes.
    return /^https?:\/\//i.test(href)
      ? `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">`
      : `<a href="${escapeAttr(href)}">`;
  });

  if (opts.convertNewlines) s = s.replace(/\n/g, "<br>");
  return s;
}

/**
 * Richer sanitiser for WYSIWYG-authored body / paragraph HTML.
 *
 * Unlike safeHtml (which allows tags but no attributes), this keeps a strict,
 * whitelisted `style` attribute (colour, highlight, alignment, font-size, basic
 * weight/style/decoration) plus safe links and images, so the rich-text editor's
 * colour / highlight / size / align controls survive to the front-end. Disallowed
 * tags, event handlers, javascript: URLs and url()/expression in styles are
 * dropped. Authors are trusted admins, but everything is still sanitised so
 * pasted or malformed markup can't inject script.
 */
const RICH_TAGS = new Set([
  "p", "br", "b", "strong", "i", "em", "u", "s",
  // h2 and hr are what the newsletter composer's own Heading and Divider
  // buttons emit; both are inert, and leaving them out silently deleted the
  // formatting an author had just applied.
  "ul", "ol", "li", "h2", "h3", "h4", "h5", "hr", "blockquote", "span", "a", "img", "div",
]);
const VOID_TAGS = new Set(["br", "img", "hr"]);

/* Browsers put these sentinels around the selected HTML when content is copied
   from a web page. They are transport markers, not newsletter content. The
   old rich-text path escaped the opening `<` and left the rest as visible text,
   which made `<!--EndFragment-->` appear in the preview and in sent mail.

   Keep this helper separate from the tag walker: it also handles values saved
   by the old path, where the marker has already been HTML-escaped. */
const CLIPBOARD_FRAGMENT_COMMENT_RE = /<!--\s*(?:Start|End)Fragment\s*-->|&lt;!--\s*(?:Start|End)Fragment\s*--(?:&gt;|>)/gi;
const CLIPBOARD_FRAGMENT_TEXT_RE = /(^|\n)[ \t]*(?:Start|End)Fragment[ \t]*(?=\n|$)/gim;

export function stripClipboardFragmentMarkers(input: unknown): string {
  if (input == null) return "";
  return String(input)
    .replace(CLIPBOARD_FRAGMENT_COMMENT_RE, "")
    .replace(CLIPBOARD_FRAGMENT_TEXT_RE, "$1");
}

const STYLE_PROPS = new Set([
  "color", "background-color", "text-align", "font-size",
  "font-weight", "font-style", "text-decoration",
  // Inert layout properties the composer applies to inserted images.
  "max-width", "width", "margin", "border-radius", "border-top", "border",
]);

function sanitizeStyle(raw: string): string {
  const out: string[] = [];
  for (const decl of raw.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!STYLE_PROPS.has(prop)) continue;
    // Reject anything that could escape the value or load external resources.
    if (/url\(|expression|javascript:|[<>"';{}]/i.test(val)) continue;
    if (!val || val.length > 40) continue;
    out.push(`${prop}: ${val}`);
  }
  return out.join("; ");
}

function attr(attrs: string, name: string): string {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"|${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? (m[1] ?? m[2] ?? "") : "";
}

/**
 * Walk HTML tag by tag, handing each well-formed tag to `handle` and dropping
 * anything it cannot parse.
 *
 * This exists because the three rewriting sanitisers below were built on
 * `String.replace(tagRegex, …)`, and that contract is backwards for a
 * sanitiser: text the pattern does not match is copied to the output verbatim.
 * The pattern treats a quote as always opening a quoted value, but a browser
 * accepts a stray quote inside an unquoted attribute as an ordinary character —
 * so `<img src=x' onerror=alert(1)>` matched nothing and was passed through
 * whole. On the rich-text and custom-code paths that output is server-rendered,
 * where even a bare <script> runs.
 *
 * So: fail closed. A `<` that does not begin something tag-shaped is escaped,
 * a tag-shaped run that will not parse is discarded up to its closing `>`, and
 * only a tag we fully understand reaches `handle`.
 */
/* <script> / <style> and everything between them.
   The walk below inspects one tag at a time and copies whatever sits between
   two tags, so dropping a <style> tag published its stylesheet as body copy:
   pasting a draft off a web page or out of Word ended the article with
   ".x{color:red}". Content of these two is never text to display, so it is cut
   here, before the walk, which has no way to skip a region. */
const RAW_TEXT_EL_RE = /<(script|style)\b(?:[^<>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>/gi;
/* The same element with no closing tag. A browser reads everything after it as
   its content, so there is no markup left worth keeping.

   The attribute run excludes a bare `<` — no real tag has one there, and
   without that exclusion this pattern ate the rest of the document from any
   LITERAL "<script" or "<style" in the prose. An article explaining an HTML tag
   ended at the word: `<p>The word <script appears.</p><p>Tail</p>` came back as
   `<p>The word ` because ` appears.</p` satisfied the attribute run and the
   `>` of `</p>` closed the "tag". Silent, and identical in the admin preview
   and on the page, so nothing looked wrong — it just stopped.

   The run also stops at the next `<` instead of at the end of the input. To
   end was too much for the same reason: `<p>使用 <script> 標籤</p><p>Next</p>`
   is an author writing ABOUT the tag, and the whole rest of the article went
   with it. Stopping at the next tag drops the tag and the few words behind it
   and leaves the document standing.

   Both are safe because nothing here is what makes the output safe: the walk
   below rebuilds every tag from an allow-list, and neither script nor style is
   in one, so text that survives this is text and cannot execute. This regex
   exists only so a dropped <style> does not publish its stylesheet as body
   copy — the Word-paste case — and stopping at the next `<` still does that. */
const UNCLOSED_RAW_TEXT_EL_RE = /<(script|style)\b(?:[^<>"']|"[^"]*"|'[^']*')*>[^<]*/i;

function rewriteTags(
  input: string,
  handle: (full: string, tag: string, attrs: string) => string,
): string {
  const WELL_FORMED = /^<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/;
  input = input.replace(RAW_TEXT_EL_RE, "").replace(UNCLOSED_RAW_TEXT_EL_RE, "");
  let out = "";
  let i = 0;
  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt < 0) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, lt);
    const rest = input.slice(lt);
    // A lone "<" in prose — "a < b" — is text, not a tag. Escaping it keeps the
    // sentence and stops it pairing with a later ">".
    if (!/^<\/?[a-zA-Z]/.test(rest)) {
      out += "&lt;";
      i = lt + 1;
      continue;
    }
    const m = WELL_FORMED.exec(rest);
    if (m) {
      out += handle(m[0], m[1], m[2]);
      i = lt + m[0].length;
      continue;
    }
    // Tag-shaped but unparseable. Drop the whole construct rather than emit it.
    const gt = input.indexOf(">", lt);
    i = gt < 0 ? input.length : gt + 1;
  }
  return out;
}

/**
 * A refused `<a>` and its `</a>`, together.
 *
 * Each sanitiser below rebuilds an opening tag from an allow-list and can
 * refuse it, and each of them then emitted the matching closing tag anyway — so
 * a refused link did not disappear, it ENDED THE ONE AROUND IT. Measured:
 *
 *   sanitizeInlineHtml('<a href="/ok">safe start <a href="javascript:x">inner</a> still inside?</a>')
 *     => '<a href="/ok">safe start inner</a> still inside?</a>'
 *
 * The outer link closes after "inner", the rest of its text falls out of it,
 * and a stray `</a>` is left in the markup for a browser to attach to whatever
 * follows.
 *
 * A stack rather than a counter, so each `</a>` is answered by the opening tag
 * it actually belongs to: a refused open pushes "no tag was written" and its
 * own closing tag is the one that disappears, which leaves the enclosing link
 * whole instead of ending it one closing tag early. A `</a>` that never had an
 * opening tag pops nothing and is dropped — the same defect from the other
 * side.
 */
function anchorBalance() {
  /** One entry per opening <a> seen; true when a tag was actually written. */
  const emitted: boolean[] = [];
  return {
    opened: (): void => { emitted.push(true); },
    refused: (): void => { emitted.push(false); },
    close: (): string => (emitted.pop() === true ? "</a>" : ""),
  };
}

/**
 * Sanitiser for third-party embed HTML (oEmbed provider markup).
 *
 * This input does not come from our own admins — it is whatever the oEmbed
 * endpoint returns — so it gets the strictest treatment: every tag is rebuilt
 * from an allow-list of attributes rather than having dangerous ones removed.
 * A remove-what-looks-bad pass cannot be trusted here; the previous one let an
 * untrusted iframe through whenever the provider wrote `</iframe >` or omitted
 * the closing tag, because its host check keyed off a paired-tag regex.
 *
 * `trustedHosts` are matched against the iframe's host exactly or as a parent
 * domain; an iframe from anywhere else is dropped entirely.
 */
const EMBED_TAGS = new Set(["iframe", "blockquote", "div", "p", "span", "a", "img", "br", "section", "figure", "figcaption"]);
const IFRAME_ATTRS = ["width", "height", "title", "allow", "allowfullscreen", "frameborder", "scrolling", "loading"];

export function sanitizeEmbedHtml(input: unknown, trustedHosts: readonly string[]): string {
  if (input == null) return "";
  const anchors = anchorBalance();
  return rewriteTags(String(input), (full, rawTag, attrs) => {
      const t = rawTag.toLowerCase();
      const isClose = full.startsWith("</");
      if (!EMBED_TAGS.has(t)) return "";
      if (isClose) {
        if (t === "a") return anchors.close();
        return VOID_TAGS.has(t) ? "" : `</${t}>`;
      }

      let open = `<${t}`;
      if (t === "iframe") {
        const src = attr(attrs, "src");
        let host = "";
        try {
          host = new URL(src).hostname.toLowerCase();
        } catch {
          return "";
        }
        if (!/^https:\/\//i.test(src)) return "";
        if (!trustedHosts.some((h) => host === h || host.endsWith(`.${h}`))) return "";
        open += ` src="${escapeAttr(src)}"`;
        for (const name of IFRAME_ATTRS) {
          const v = attr(attrs, name);
          // Keep only simple token values; anything else is not worth the risk.
          if (v && /^[\w .%-]{1,40}$/.test(v)) open += ` ${name}="${escapeAttr(v)}"`;
        }
        /* Written here rather than copied from the provider, the same way
           referrerpolicy is. Two of the attributes above can never survive that
           loop: `allowfullscreen` arrives valueless, so `attr()` returns "",
           and `allow` is a semicolon-separated list far past 40 characters. So
           every embedded player lost its fullscreen button and its autoplay /
           picture-in-picture permissions. The host has already been checked
           against trustedHosts by this point, and this is the standard player
           permission set — not the provider's own string. */
        /* Tracked as flags rather than by re-scanning `open`, which by this
           point contains the src: a provider URL with a space in it (escapeAttr
           does not touch spaces) made ` allow=` appear to be present already
           and the permissions were then skipped. Only ever lost a permission,
           never granted one — the values here are fixed, not the provider's —
           but the check was reading the wrong string. */
        const kept = new Set(IFRAME_ATTRS.filter((n) => /^[\w .%-]{1,40}$/.test(attr(attrs, n))));
        if (!kept.has("allow")) {
          open += ` allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`;
        }
        if (!kept.has("allowfullscreen")) open += ` allowfullscreen`;
        // A frame with no accessible name is announced as "frame" and nothing else.
        if (!kept.has("title")) open += ` title="Embedded content"`;
        open += ` referrerpolicy="strict-origin-when-cross-origin"`;
      } else {
        if (t === "a") {
          const href = attr(attrs, "href");
          if (!/^https?:\/\//i.test(href)) { anchors.refused(); return ""; }
          anchors.opened();
          open += ` href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer"`;
        } else if (t === "img") {
          const src = attr(attrs, "src");
          if (!/^https:\/\//i.test(src)) return "";
          open += ` src="${escapeAttr(src)}" alt="${escapeAttr(attr(attrs, "alt"))}" loading="lazy"`;
        }
        // Providers style their blockquote/div wrappers by class; keep it.
        const cls = attr(attrs, "class");
        if (cls && /^[\w\s-]{1,120}$/.test(cls)) open += ` class="${escapeAttr(cls)}"`;
        const style = sanitizeStyle(attr(attrs, "style"));
        if (style) open += ` style="${style}"`;
      }
      return VOID_TAGS.has(t) ? `${open} />` : `${open}>`;
  });
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function sanitizeRichHtml(input: unknown): string {
  if (input == null) return "";
  return rewriteTags(stripClipboardFragmentMarkers(input), (full, rawTag, attrs) => {
      const t = rawTag.toLowerCase();
      const isClose = full.startsWith("</");
      if (!RICH_TAGS.has(t)) return "";
      if (isClose) return VOID_TAGS.has(t) ? "" : `</${t}>`;

      let open = `<${t}`;
      if (t === "a") {
        const href = attr(attrs, "href");
        if (/^https?:\/\//i.test(href)) {
          open += ` href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer"`;
        } else if (isSafeUrl(href)) {
          // Site-relative, and staying on the site, so no target/rel. This used
          // to be dropped, which did not remove the link — it left an <a> with
          // no href, so an internal link written in a block rendered as text
          // that looked clickable and did nothing. The inline sanitiser below
          // has always allowed these; the two disagreed in silence.
          //
          // Same (?!\/) as there: "//evil.example" is not a path on this site.
          open += ` href="${href.replace(/"/g, "&quot;")}"`;
        }
      } else if (t === "img") {
        const src = attr(attrs, "src");
        // "//evil.example/p.png" is not a path on this site, it is a request
        // to evil.example on every page view. One allow-list for every URL we
        // render, so a hole closed in one place is closed everywhere.
        if (!isSafeUrl(src)) return "";
        open += ` src="${src.replace(/"/g, "&quot;")}" loading="lazy" alt="${attr(attrs, "alt").replace(/"/g, "&quot;")}"`;
        /* A plain pixel width, kept because an email client is the one renderer
           that will not read the stylesheet: the width ATTRIBUTE is how a
           newsletter has always sized an image, and without it a 480px poster
           arrives at its natural size in Outlook. Digits only, so it cannot
           carry anything but a number.

           `height` is deliberately NOT kept. It was, and it distorted every
           image pasted into a rich-text field: the editor's paste path runs
           through this sanitiser, so a copied `<img width=480 height=360>` kept
           both, and the containers that render this html — the newsletter
           preview, the campaign detail body, FAQ answers — set `max-width:100%`
           without `height:auto`. Measured: a 480×360 poster in a 311px column
           rendered 311×363 instead of 311×233. Width alone scales; width and
           height together fight. */
        const w = attr(attrs, "width");
        if (/^\d{1,4}$/.test(w)) open += ` width="${w}"`;
      }
      const style = sanitizeStyle(attr(attrs, "style"));
      if (style) open += ` style="${style}"`;
      return VOID_TAGS.has(t) ? `${open} />` : `${open}>`;
  });
}


/* ── Inline sanitiser for CMS body_blocks ──────────────────────────────
   Used by both the public content renderer and the admin's live preview.
   It lived in both files as identical copies, which is exactly how two
   allow-lists drift apart without anyone noticing. */

const INLINE_TAGS = new Set(["b", "i", "strong", "em", "u", "s", "a", "br", "blockquote", "span"]);
/** A link target we are willing to render: absolute http(s), or site-relative. */
export function isSafeUrl(url: unknown): boolean {
  const s = String(url ?? "");
  /* A browser strips ASCII tab, LF and CR from a URL *before* parsing it, so
     `/<TAB>/evil.example` reaches the parser as `//evil.example` and resolves
     off-site — measured in Chrome, not inferred:

       "/\t/evil.example"   =>  http://evil.example/
       "/\n/evil.example"   =>  http://evil.example/
       "/\t\\evil.example"  =>  http://evil.example/

     The lookahead above rejects `//` and `/\` and so reads as closing this,
     but it tests the string as typed rather than the string the browser will
     parse. Same phishing shape the backslash case was written for, and worse
     here: BlockAttractions decides `target="_blank" rel="noopener"` from
     `/^https?:\/\//`, which is false for these, so the off-site link opens in
     the same tab with no rel. Rejected rather than stripped — a control
     character in a settings field is a mistake or an attack, never a typo
     worth honouring. */
  if (/[\t\n\r]/.test(s)) return false;
  return INLINE_HREF_RE.test(s);
}

/**
 * An href for a link whose target an editor typed into a settings field —
 * a CTA button, the way back to the group, a pathway card.
 *
 * These went to the browser unchecked, and React and next/link both render a
 * `javascript:` href verbatim. On a shared origin that is not a defaced link,
 * it is script with the reader's admin cookie: the admin API proxy attaches
 * the token to any same-origin request.
 *
 * Wider than isSafeUrl because a CTA field reasonably holds a phone number, an
 * email address or an on-page anchor, and narrowing to http(s) would silently
 * break those. Returns "" for anything else so a caller can `|| fallback`.
 */
/** Hosts whose /maps pages we are willing to put inside an iframe.
 *  google.<cctld> included: a Taiwanese editor copying out of the URL bar gets
 *  google.com.tw, which the regex this replaced accepted and the first host set
 *  did not. */
const MAP_HOST_RE = /^(www\.|maps\.)?google\.(com|com?\.[a-z]{2}|[a-z]{2})$/;

/**
 * The `src` for a Google Maps iframe, from either a bare URL or a pasted
 * `<iframe …>` snippet. Returns "" when the value is anything else.
 *
 * Parsed rather than pattern-matched. One copy of this was a regex ending the
 * host alternative with \b — which matches before "@" and before "." — so it
 * anchored on a prefix of the authority instead of the whole host, and both
 * https://maps.google.com@evil.example/ and https://maps.google.com.evil.example/
 * framed someone else's page. URL parsing gives the host the browser will use.
 * Two renderers had grown their own version of this check; this is the one.
 */
export function googleMapEmbedSrc(raw: unknown): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const url = (text.match(/src=["']([^"']+)["']/)?.[1] ?? text).trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }
  const ok = parsed.protocol === "https:"
    && MAP_HOST_RE.test(parsed.hostname)
    && (parsed.pathname === "/maps" || parsed.pathname.startsWith("/maps/"));
  return ok ? parsed.toString() : "";
}

/**
 * Ask a Google Maps embed to draw its own labels in the reader's language.
 *
 * Place names, road names and the embed's own UI come from Google, not from
 * us, so switching the site to English used to leave the map itself in
 * Chinese (客戶: 切換英文時，地圖上的文字也要變英文). `hl` is Google's
 * interface-language parameter and is all that is needed.
 *
 * Set rather than appended: an editor who pasted an embed that already carries
 * an hl would otherwise pin the map to one language for both locales.
 *
 * Anything that is not a Google Maps embed resolves to "" so the caller draws
 * no frame. The docblock used to say the opposite — that this made no safety
 * judgement and handed anything else back untouched — and neither half was
 * true. Measured:
 *
 *   mapSrcForLocale("javascript:alert(1)", "en")   => "javascript:alert(1)?hl=en"
 *   mapSrcForLocale("https://evil.example/x", "en") => "https://evil.example/x?hl=en"
 *
 * Both went straight into an `<iframe src>`. Every caller today resolves its
 * src through googleMapEmbedSrc first, so this changes nothing they render; it
 * is the caller that forgets which this is written for, and a comment claiming
 * the check happens elsewhere is not a check.
 */
export function mapSrcForLocale(src: string, locale: string): string {
  if (!src) return src;
  const embed = googleMapEmbedSrc(src);
  if (!embed) return "";
  const parsed = new URL(embed);
  parsed.searchParams.set("hl", locale === "en" ? "en" : "zh-TW");
  return parsed.toString();
}

export function safeLinkHref(url: unknown): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  if (isSafeUrl(raw)) return raw;
  // Not [\w-]: \w is ASCII-only, and the admin's 區塊標記 field deliberately
  // keeps CJK, so "#關於" is an id it will hand us. Exclude whitespace and the
  // delimiters that would let a fragment smuggle a second URL.
  if (/^#[^\s#?&/\\%"'<>]{1,64}$/.test(raw)) return raw;
  if (/^tel:\+?[\d\-\s().]{3,32}$/i.test(raw)) return raw;
  if (/^mailto:[^\s<>"'`]{3,254}$/i.test(raw)) return raw;
  return "";
}

// Keep only colour / highlight from a span's inline style (no url(), no script).
function safeInlineStyle(attrs: string): string {
  const m = attrs.match(/style\s*=\s*"([^"]*)"|style\s*=\s*'([^']*)'/i);
  if (!m) return "";
  const raw = m[1] ?? m[2] ?? "";
  const out: string[] = [];
  // Allow function colours like rgb(…) / hsl(…); block only url()/script.
  const re = /(?:^|;)\s*(color|background-color)\s*:\s*([^;"'<>{}]+)/gi;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(raw))) {
    const val = mm[2].trim();
    if (val && val.length <= 30 && !/url\(|expression|javascript:/i.test(val)) out.push(`${mm[1].toLowerCase()}: ${val}`);
  }
  return out.join("; ");
}

/* Where one block of text ends and the next begins.
   This variant allows inline tags only, so a pasted draft's paragraphs, list
   items and headings were dropped with nothing in their place and the whole
   draft arrived as one line ("<p>A</p><p>B</p>" came out "AB"). <br> is the
   break this allow-list has, so a boundary becomes one. Closing tags only: the
   opening tag of the first block would add a break before text that has none. */
const BLOCK_END_RE = /<\/(?:p|li|h[1-6]|tr|div)\s*>/gi;

export function sanitizeInlineHtml(html: string): string {
  let clean = stripClipboardFragmentMarkers(html)
    // An empty line out of contentEditable already carries its own <br>, so
    // ending its div as well would turn one blank line into two.
    .replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, "<br>")
    .replace(BLOCK_END_RE, "<br>");
  // Same fail-closed walk as the others. Its own [^>]* pattern also stopped at
  // the first ">" even inside a quoted value, cutting <a title="a>b"> in half.
  const anchors = anchorBalance();
  clean = rewriteTags(clean, (match, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!INLINE_TAGS.has(t)) return "";
    if (t === "a") {
      // This ran for </a> too, where there is no href to find, so every closing
      // anchor was dropped and the link ran on into whatever followed it. It
      // then closed EVERY closing anchor, including the one belonging to a link
      // refused two lines below — see anchorBalance.
      if (match.startsWith("</")) return anchors.close();
      const href = attr(attrs, "href");
      /* isSafeUrl, not the bare regex: the regex tests the string as typed and
         a browser strips tab/LF/CR before parsing, so `/<TAB>/evil.example`
         passed here byte-for-byte while the same value was refused in a
         settings field. Two callers of one allow-list disagreeing is how the
         narrower check ends up guarding only half the surface — and escapeAttr
         escapes &<>" but not a tab, so nothing downstream caught it either. */
      if (href && isSafeUrl(href)) {
        anchors.opened();
        return `<a href="${escapeAttr(href)}">`;
      }
      anchors.refused();
      return "";
    }
    if (!match.startsWith("</")) {
      // Colour was kept on a span only, but a browser applying foreColor to
      // text that is already bold or italic puts the style on the <b> or <i>
      // it is already inside rather than adding a span — and the colour was
      // then dropped on the way out. What makes a style safe here is the
      // property filter below, which does not depend on the tag.
      const st = safeInlineStyle(attrs);
      return st ? `<${t} style="${st}">` : `<${t}>`;
    }
    return `</${t}>`;
  });
  // A break at either end is the wrapper the editor put around the text, not a
  // blank line the author asked for. The trailing one also stops a value from
  // growing a new break every time it is saved and re-loaded.
  clean = clean.replace(/^(<br\s*\/?>)+/, "").replace(/(<br\s*\/?>)+$/, "");
  return clean;
}

/* ── Custom head / body code ───────────────────────────────────────────
   Admin-pasted snippets: verification meta tags, analytics markup, the odd
   tracking pixel. Rebuilt from an allow-list rather than stripped, because the
   strip-what-looks-dangerous pass this replaced could be walked around — its
   handler pattern required whitespace before the attribute, so
   `<img src=x/onerror=…>` kept its handler, and `javascript&colon;` never
   matched its URL pattern.

   This matters more than it looks: villa sites and the group site share an
   origin, so a script injected on one runs with the other's cookies. */
const CODE_TAGS = new Set([
  "meta", "link", "div", "span", "p", "a", "img", "br", "noscript", "section",
]);
const META_ATTRS = ["name", "property", "http-equiv", "content", "charset"];
const LINK_ATTRS = ["rel", "type", "sizes", "title"];
/* http-equiv is a pragma, not a label — the browser ACTS on it, which is the
   one thing nothing in a pasted snippet is allowed to do. `refresh` navigates
   the page, and this markup is site-wide head code: measured,
   `<meta http-equiv="refresh" content="0;url=https://evil.example/">` came
   through this sanitiser unchanged and would send every page of that site
   somewhere else. `content-security-policy` rewrites the policy the rest of
   the document loads under, which can only ever loosen ours.
   These two are the declarative ones: both describe the document and neither
   makes the browser do anything. */
const META_HTTP_EQUIV = new Set(["content-type", "content-language"]);
/* rel is what makes a <link> fetch. `stylesheet` pulls CSS from any host and
   restyles the whole page — measured, `<link rel="stylesheet"
   href="https://evil.example/x.css">` survived intact — and preload / prefetch
   / modulepreload fetch on sight. Villa sites and the group site share an
   origin, so head code saved on one is markup running beside the other's
   cookies. The allow-list is the inert set: an icon, a canonical, a hint.
   Filtered token by token rather than compared whole, because a pasted favicon
   still carries `rel="shortcut icon"` and dropping the whole element over the
   legacy first token would lose the icon along with it. */
const LINK_RELS = new Set(["icon", "canonical", "alternate", "dns-prefetch", "preconnect", "apple-touch-icon"]);

export function sanitizeCustomCode(input: unknown): string {
  if (input == null) return "";
  const anchors = anchorBalance();
  return rewriteTags(String(input), (full, rawTag, attrs) => {
      const t = rawTag.toLowerCase();
      const isClose = full.startsWith("</");
      if (!CODE_TAGS.has(t)) return "";
      if (isClose) {
        if (t === "a") return anchors.close();
        return VOID_TAGS.has(t) || t === "meta" || t === "link" ? "" : `</${t}>`;
      }

      let open = `<${t}`;
      if (t === "meta") {
        const httpEquiv = attr(attrs, "http-equiv").trim().toLowerCase();
        if (httpEquiv && !META_HTTP_EQUIV.has(httpEquiv)) return "";
        for (const name of META_ATTRS) {
          const v = name === "http-equiv" ? httpEquiv : attr(attrs, name);
          if (v) open += ` ${name}="${escapeAttr(v)}"`;
        }
      } else if (t === "link") {
        const rels = attr(attrs, "rel").trim().toLowerCase().split(/\s+/).filter((r) => LINK_RELS.has(r));
        // A <link> with no rel we recognise has no reason to be in the head; a
        // <link> with no rel at all does nothing. Either way, not this one.
        if (!rels.length) return "";
        const href = attr(attrs, "href");
        if (!/^https:\/\//i.test(href)) return "";
        open += ` href="${escapeAttr(href)}" rel="${rels.join(" ")}"`;
        for (const name of LINK_ATTRS) {
          if (name === "rel") continue;
          const v = attr(attrs, name);
          if (v) open += ` ${name}="${escapeAttr(v)}"`;
        }
      } else if (t === "a") {
        const href = attr(attrs, "href");
        if (!/^https:\/\//i.test(href)) { anchors.refused(); return ""; }
        anchors.opened();
        open += ` href="${escapeAttr(href)}" rel="noopener noreferrer"`;
      } else if (t === "img") {
        const src = attr(attrs, "src");
        if (!/^https:\/\//i.test(src)) return "";
        open += ` src="${escapeAttr(src)}" alt="${escapeAttr(attr(attrs, "alt"))}"`;
      }
      const cls = attr(attrs, "class");
      if (cls && /^[\w\s-]{1,120}$/.test(cls)) open += ` class="${escapeAttr(cls)}"`;
      const style = sanitizeStyle(attr(attrs, "style"));
      if (style) open += ` style="${style}"`;
      return VOID_TAGS.has(t) || t === "meta" || t === "link" ? `${open} />` : `${open}>`;
  });
}
