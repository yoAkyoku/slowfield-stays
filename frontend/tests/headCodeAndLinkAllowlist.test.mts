import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

import {
  isSafeUrl,
  mapSrcForLocale,
  safeHtml,
  sanitizeCustomCode,
  sanitizeInlineHtml,
} from "../app/modules/safeHtml.ts";
import { readCode } from "./readCode.mts";
import { sharedModule } from "./sharedModules.mts";

/**
 * The link and head-code allow-lists, and the three ways they used to be walked
 * around.
 *
 * All four sanitisers in safeHtml.ts guard admin-authored markup, and the site
 * is multi-tenant on ONE origin — villa sites and the group site share it — so
 * "it only defaces their own villa" is not a sentence that can be said about
 * anything here.
 */

/* ── safeHtml: one allow-list, and no half-rendered tags ───────────────── */

/**
 * safeHtml escapes everything and then re-allows a small set. Its link pass
 * required an absolute http(s) href AND nothing else inside the tag, so the two
 * commonest anchors an editor writes matched nothing and stayed escaped —
 * while the SEPARATE closing-tag pass turned their `</a>` into a real one.
 * Measured before the fix:
 *
 *   safeHtml('<a href="/internal/page">x</a>')
 *     => '&lt;a href="/internal/page"&gt;x</a>'
 *   safeHtml('<a href="https://ok.com" title="t">x</a>')
 *     => '&lt;a href="https://ok.com" title="t"&gt;x</a>'
 *
 * The reader saw the literal text `<a href="…">` followed by an orphan `</a>`.
 * This is the same allow-list the rich and inline sanitisers were moved onto;
 * this one was left behind, which its own docblock records the other two doing.
 */
test("safeHtml renders a site-relative link instead of printing its tag", () => {
  const out = safeHtml('<a href="/internal/page">x</a>');
  assert.equal(out, '<a href="/internal/page">x</a>');
  // Staying on the site means staying in the tab, the way sanitizeRichHtml
  // decides it.
  assert.doesNotMatch(out, /target=/);
  assert.doesNotMatch(out, /&lt;a/, "the opening tag is still being printed as text");
});

test("safeHtml keeps a link that carries other attributes, and keeps only the href", () => {
  const out = safeHtml('<a href="https://ok.com" title="t">x</a>');
  assert.equal(out, '<a href="https://ok.com" target="_blank" rel="noopener noreferrer">x</a>');
  assert.doesNotMatch(out, /title=/, "an attribute rode along with the href");
});

test("safeHtml lets no attribute through, however safe the href beside it is", () => {
  // "Escape everything, re-allow some of it" is a string rewrite, not a walk,
  // so the opening tag has to be written from scratch rather than edited.
  for (const attr of ["onclick", "onmouseover", "target", "style", "srcset"]) {
    const out = safeHtml(`<a href="/ok" ${attr}="alert(1)">x</a>`);
    assert.doesNotMatch(out, new RegExp(attr), `${attr} survived`);
  }
  assert.equal(safeHtml('<a href="/ok" onclick="alert(1)">x</a>'), '<a href="/ok">x</a>');
});

test("safeHtml refuses every href isSafeUrl refuses", () => {
  /* One allow-list, so a hole closed in one place is closed everywhere. The
     tab/LF/CR cases matter most: a browser strips those BEFORE parsing, so
     "/<TAB>/evil.example" resolves off-site while reading as a path. */
  const hostile = [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/pa\tth//evil.example",
  ];
  for (const href of hostile) {
    assert.equal(isSafeUrl(href), false, `isSafeUrl accepted ${JSON.stringify(href)}`);
    const out = safeHtml(`<a href="${href}">x</a>`);
    assert.doesNotMatch(out, /<a\b/, `safeHtml linked ${JSON.stringify(href)}`);
    assert.doesNotMatch(out, /href=/, `safeHtml kept the href for ${JSON.stringify(href)}`);
  }
});

test("an entity-encoded scheme is decoded before the allow-list sees it", () => {
  /* safeHtml deliberately leaves a VALID character reference intact so &nbsp;
     renders as a space — which means the escaped text an allow-list would read
     is not the URL the browser resolves. `&#106;` is "j". The custom-code
     docblock records this exact bypass ("javascript&colon; never matched its
     URL pattern") in the pass it replaced. */
  for (const href of [
    "&#106;avascript:alert(1)",
    "&#x6a;avascript:alert(1)",
    "javascript&colon;alert(1)",
    "&Tab;javascript:alert(1)",
    // These two are the ones the prefix rule alone would let through: they read
    // as a path until the references are resolved.
    "&#47;&#47;evil.example",
    "/&#92;evil.example",
  ]) {
    const out = safeHtml(`<a href="${href}">x</a>`);
    assert.doesNotMatch(out, /<a\b/, `safeHtml linked ${href}`);
  }
});

test("an ampersand in a legitimate URL survives exactly once", () => {
  /* The other half of decoding before the check: the href is re-escaped from
     the DECODED value, so a query string arrives at the browser as the author
     wrote it. Validating the raw text and emitting that instead turns an
     author's `&amp;` into `&amp;amp;`, and the link then goes to a URL with a
     literal "&amp;" in its query — a broken search or booking link, silently. */
  for (const typed of ["https://x.com/?a=1&b=2", "https://x.com/?a=1&amp;b=2"]) {
    const out = safeHtml(`<a href="${typed}">x</a>`);
    assert.match(out, /href="https:\/\/x\.com\/\?a=1&amp;b=2"/, `${typed} => ${out}`);
    assert.doesNotMatch(out, /&amp;amp;/, `${typed} came out double-escaped: ${out}`);
  }
  const internal = safeHtml('<a href="/search?q=a&amp;b=c">x</a>');
  assert.equal(internal, '<a href="/search?q=a&amp;b=c">x</a>');
});

test("a refused link leaves no orphan closing tag behind", () => {
  /* Emitting every `</a>` regardless is what ended the ENCLOSING link early.
     Measured before the fix, in the inline sanitiser:
       '<a href="/ok">safe start <a href="javascript:x">inner</a> still inside?</a>'
         => '<a href="/ok">safe start inner</a> still inside?</a>'
     — the outer link closes after "inner", its remaining text falls out of it,
     and the stray `</a>` is left for a browser to attach to whatever follows. */
  const nested = '<a href="/ok">safe start <a href="javascript:x">inner</a> still inside?</a>';
  assert.equal(sanitizeInlineHtml(nested), '<a href="/ok">safe start inner still inside?</a>');
  assert.equal(safeHtml(nested), '<a href="/ok">safe start inner still inside?</a>');

  for (const sanitise of [safeHtml, sanitizeInlineHtml]) {
    // A refused link and its closing tag go together…
    assert.doesNotMatch(sanitise('<a href="javascript:x">B</a> tail'), /<\/a>/);
    // …and a closing tag that never had an opening one goes too.
    assert.doesNotMatch(sanitise("</a>stray"), /<\/a>/);
    // The counts have to balance, or the markup below the block is inside a
    // link that nobody wrote.
    const ok = sanitise('<a href="/a">one</a><a href="javascript:x">two</a><a href="/b">three</a>');
    assert.equal((ok.match(/<a\b/g) ?? []).length, (ok.match(/<\/a>/g) ?? []).length, ok);
  }
});

/* ── Custom head/body code ─────────────────────────────────────────────── */

/**
 * `http-equiv` is a pragma, not a label: the browser ACTS on it. Measured
 * before the fix, the sanitiser passed this through unchanged —
 *
 *   sanitizeCustomCode('<meta http-equiv="refresh" content="0;url=https://evil.example/">')
 *     => '<meta http-equiv="refresh" content="0;url=https://evil.example/" />'
 *
 * — which is site-wide head code redirecting every page of that site.
 */
test("a meta that makes the browser do something is dropped", () => {
  for (const hostile of [
    '<meta http-equiv="refresh" content="0;url=https://evil.example/">',
    '<meta http-equiv="REFRESH" content="0;url=https://evil.example/">',
    "<meta http-equiv=' refresh ' content='0;url=x'>",
    '<meta http-equiv="content-security-policy" content="default-src *">',
    '<meta http-equiv="set-cookie" content="a=b">',
  ]) {
    assert.equal(sanitizeCustomCode(hostile), "", hostile);
  }
});

test("the verification and declarative metas customers actually paste survive", () => {
  // The point of this field. Blocking these would be the more expensive bug.
  for (const [snippet, expected] of [
    [
      '<meta name="google-site-verification" content="abc123">',
      '<meta name="google-site-verification" content="abc123" />',
    ],
    ['<meta property="og:title" content="hi">', '<meta property="og:title" content="hi" />'],
    [
      '<meta http-equiv="content-type" content="text/html; charset=utf-8">',
      '<meta http-equiv="content-type" content="text/html; charset=utf-8" />',
    ],
    [
      '<meta http-equiv="content-language" content="zh-TW">',
      '<meta http-equiv="content-language" content="zh-TW" />',
    ],
  ] as const) {
    assert.equal(sanitizeCustomCode(snippet), expected, snippet);
  }
});

/**
 * `rel` is what makes a `<link>` fetch. Measured before the fix:
 *
 *   sanitizeCustomCode('<link rel="stylesheet" href="https://evil.example/x.css">')
 *     => '<link href="https://evil.example/x.css" rel="stylesheet" />'
 *
 * — arbitrary CSS from an arbitrary host, restyling every page of the site.
 */
test("a link may only carry a rel that fetches nothing of its own", () => {
  for (const hostile of [
    '<link rel="stylesheet" href="https://evil.example/x.css">',
    '<link rel="preload" as="script" href="https://evil.example/x.js">',
    '<link rel="modulepreload" href="https://evil.example/x.js">',
    '<link rel="prefetch" href="https://evil.example/x.js">',
    '<link rel="import" href="https://evil.example/x.html">',
    '<link href="https://evil.example/x.css">',
  ]) {
    assert.equal(sanitizeCustomCode(hostile), "", hostile);
  }
  // The inert ones stay, and a legacy `shortcut icon` keeps its icon rather
  // than losing the whole element over the token in front of it.
  assert.equal(
    sanitizeCustomCode('<link rel="icon" href="https://cdn.example/f.ico">'),
    '<link href="https://cdn.example/f.ico" rel="icon" />',
  );
  assert.equal(
    sanitizeCustomCode('<link rel="shortcut icon" href="https://cdn.example/f.ico">'),
    '<link href="https://cdn.example/f.ico" rel="icon" />',
  );
  assert.match(
    sanitizeCustomCode('<link rel="canonical" href="https://ok.example/a">'),
    /rel="canonical"/,
  );
  // http is still not https, whatever the rel says.
  assert.equal(sanitizeCustomCode('<link rel="canonical" href="http://ok.example/a">'), "");
});

test("none of that loosened the rest of the custom-code allow-list", () => {
  for (const hostile of [
    "<script>alert(1)</script>",
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">click</a>',
    '<img src="//evil.example/p.png">',
    '<iframe src="https://evil.example/"></iframe>',
  ]) {
    const out = sanitizeCustomCode(hostile);
    assert.doesNotMatch(out, /alert|onerror|iframe|evil\.example/, `${hostile} => ${out}`);
  }
  assert.equal(sanitizeCustomCode('<div onclick="alert(1)">t</div>'), "<div>t</div>");
});

/* ── ServerHeadCode: the meta path that never reached the sanitiser ────── */

type El = { type: unknown; props: Record<string, unknown> };
const isEl = (v: unknown): v is El =>
  typeof v === "object" && v !== null && "type" in v && "props" in v;

function h(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): El {
  return { type, props: { ...(props ?? {}), children: children.length === 1 ? children[0] : children } };
}
const FRAGMENT = Symbol("fragment");

function compile(file: string, imports: Record<string, unknown>): Record<string, unknown> {
  const js = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      jsxFactory: "__h",
      jsxFragmentFactory: "__FRAGMENT",
    },
  }).outputText;
  const mod = { exports: {} as Record<string, unknown> };
  const req = (id: string) => {
    if (!(id in imports)) {
      const shared = sharedModule(file, id, (p, remap) => compile(p, remap(imports)));
      if (shared) return shared;
      throw new Error(`${file}: no stub for import "${id}"`);
    }
    return imports[id];
  };
  new Function("exports", "require", "module", "__h", "__FRAGMENT", js)(
    mod.exports, req, mod, h, FRAGMENT,
  );
  return mod.exports;
}

const ServerHeadCode = compile("app/modules/ServerHeadCode.tsx", {
  "./safeHtml": { sanitizeCustomCode },
}).default as (p: { html: string }) => unknown;

/** Every element in the returned tree, flattened. */
function elements(node: unknown): El[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isEl(node)) return [];
  return [node, ...elements(node.props.children)];
}

/**
 * The meta tags did not go through the sanitiser at all.
 *
 * This component pulled `<meta>` out of the RAW html with its own regex and
 * handed the captures straight to React as `<meta httpEquiv={…}>`; the
 * sanitiser call below it ran on the string with every meta already removed. So
 * the whole of the meta surface was unchecked, and a `refresh` saved into a
 * site's head code redirected every page of that site.
 */
test("a head-code meta reaches <head> only if the sanitiser allows it", () => {
  const redirected = elements(
    ServerHeadCode({ html: '<meta http-equiv="refresh" content="0;url=https://evil.example/">' }),
  ).filter((el) => el.type === "meta");
  assert.deepEqual(redirected, [], "the meta-refresh still reaches the document head");

  const stylesheet = ServerHeadCode({ html: '<link rel="stylesheet" href="https://evil.example/x.css">' });
  assert.doesNotMatch(JSON.stringify(stylesheet), /evil\.example/, "the stylesheet link still renders");
});

test("the verification metas still reach <head>, with their values intact", () => {
  const metas = elements(
    ServerHeadCode({
      html:
        '<meta name="google-site-verification" content="abc123">' +
        "<meta property='og:title' content='Hi & welcome'>" +
        '<meta http-equiv="content-language" content="zh-TW">',
    }),
  ).filter((el) => el.type === "meta");

  assert.equal(metas.length, 3, JSON.stringify(metas));
  assert.equal(metas[0].props.name, "google-site-verification");
  assert.equal(metas[0].props.content, "abc123");
  assert.equal(metas[1].props.property, "og:title");
  /* Unescaped on the way back out of the sanitised string. The metas are now
     read out of the sanitiser's OUTPUT, where an ampersand an editor typed has
     become `&amp;`; React escapes whatever it is handed, so passing that
     through unchanged would put "&amp;amp;" in the rendered tag. */
  assert.equal(metas[1].props.content, "Hi & welcome");
  assert.equal(metas[2].props.httpEquiv, "content-language");
});

test("the component reads its metas out of sanitised output, not out of the input", () => {
  /* The shape is the fix. Extracting from `html` and sanitising the remainder
     separately is what left the metas unchecked, and it reads as reasonable
     code — so it is worth naming here rather than only testing an example. */
  const src = readCode("app/modules/ServerHeadCode.tsx");
  const sanitisedAt = src.indexOf("sanitizeCustomCode(html)");
  assert.ok(sanitisedAt > -1, "the head code is no longer sanitised as a whole");
  assert.ok(
    src.indexOf("exec(clean)") > sanitisedAt,
    "the meta scan no longer runs over the sanitised string",
  );
  assert.ok(
    !/\.exec\(html\)|html\.replace\(\/<meta/.test(src),
    "the raw html is being scanned for metas again, which skips the allow-list",
  );
});

/* ── mapSrcForLocale ───────────────────────────────────────────────────── */

/**
 * The docblock said this made no safety judgement and returned a non-map value
 * untouched. Neither was true — it appended `?hl=` to whatever it was handed
 * and returned that, and the result goes straight into an `<iframe src>`:
 *
 *   mapSrcForLocale("javascript:alert(1)", "en")    => "javascript:alert(1)?hl=en"
 *   mapSrcForLocale("https://evil.example/x", "en") => "https://evil.example/x?hl=en"
 */
test("mapSrcForLocale frames a Google Maps embed or nothing", () => {
  for (const bad of [
    "javascript:alert(1)",
    "https://evil.example/x",
    "https://maps.google.com@evil.example/maps",
    "https://maps.google.com.evil.example/maps",
    "http://www.google.com/maps/embed?pb=1",
    "not a url",
  ]) {
    assert.equal(mapSrcForLocale(bad, "en"), "", bad);
  }
  const good = mapSrcForLocale("https://www.google.com/maps/embed?pb=!1m18!abc", "en");
  assert.match(good, /^https:\/\/www\.google\.com\/maps\/embed\?/);
  assert.match(good, /[?&]hl=en(&|$)/);
  assert.equal(new URL(good).searchParams.get("pb"), "!1m18!abc");
});
