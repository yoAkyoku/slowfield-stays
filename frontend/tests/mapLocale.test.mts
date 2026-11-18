import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mapSrcForLocale } from "../app/modules/safeHtml.ts";

/**
 * The map's own labels come from Google, not from us, so the site language has
 * to be asked for on the URL (客戶: 切換英文時，地圖上的文字也要變英文).
 */

const BASE = "https://www.google.com/maps/embed?pb=!1m18!1m12!abc";

test("en asks Google for English, zh for Traditional Chinese", () => {
  assert.match(mapSrcForLocale(BASE, "en"), /[?&]hl=en(&|$)/);
  assert.match(mapSrcForLocale(BASE, "zh"), /[?&]hl=zh-TW(&|$)/);
});

test("an hl the editor pasted is replaced, not appended", () => {
  // Appending would leave two hl params and pin the map to whichever Google
  // reads first — the same language in both locales.
  const pinned = `${BASE}&hl=ja`;
  const out = mapSrcForLocale(pinned, "en");
  assert.equal(out.match(/hl=/g)?.length, 1, `expected one hl, got ${out}`);
  assert.match(out, /hl=en/);
  assert.doesNotMatch(out, /hl=ja/);
});

test("the rest of the URL is left alone", () => {
  const out = new URL(mapSrcForLocale(BASE, "en"));
  assert.equal(out.origin + out.pathname, "https://www.google.com/maps/embed");
  assert.equal(out.searchParams.get("pb"), "!1m18!1m12!abc");
});

test("anything that is not a map embed resolves to nothing to frame", () => {
  /* This used to assert that a value it did not understand "comes back
     untouched", which is what the function's own docblock claimed — and it was
     not true of anything a URL parser accepts. Measured before the fix:

       mapSrcForLocale("javascript:alert(1)", "en")    => "javascript:alert(1)?hl=en"
       mapSrcForLocale("https://evil.example/x", "en") => "https://evil.example/x?hl=en"

     Both values go straight into an `<iframe src>`, so "untouched" meant
     framing someone else's page on a multi-tenant origin. The empty string is
     still the empty string; everything else has to be a Google Maps embed. */
  assert.equal(mapSrcForLocale("", "en"), "");
  for (const bad of [
    "not a url",
    "javascript:alert(1)",
    "https://evil.example/x",
    "https://maps.google.com@evil.example/maps",
    "http://www.google.com/maps/embed?pb=1",
  ]) {
    assert.equal(mapSrcForLocale(bad, "en"), "", bad);
  }
});

test("both map iframes are keyed on the localised src they frame", () => {
  /* Google reads hl at load: without a key that CHANGES, the frame keeps the
     old language when only the attribute changes.

     This was a pair of greps — "mapSrcForLocale appears in the file" and "an
     <iframe has some key={" — and neither is the invariant. The first is
     satisfied by the import line. The second is satisfied by `key={block.id}`,
     which is constant across a locale switch and so leaves exactly the bug the
     key exists to prevent, with the test still green.

     What actually has to hold: the iframe's key and its src are the same
     expression, and that expression is what mapSrcForLocale returned. */
  /* The content pages' contact map used to frame Google itself; it is the
     shared MapEmbed now, so that one iframe is the one to check, and the page
     must not grow a second, unkeyed one. */
  const pageBlocks = readFileSync("app/modules/content/PageBlocks.tsx", "utf8");
  const pageCode = pageBlocks.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.ok(!/<iframe\b/.test(pageCode), "PageBlocks frames a map itself again");
  assert.match(pageBlocks, /<MapEmbed\b/, "PageBlocks no longer draws its map through MapEmbed");
  for (const f of ["app/modules/MapEmbed.tsx"]) {
    const source = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const framed = [...source.matchAll(/<iframe\b([\s\S]*?)\/>/g)]
      .map((m) => m[1])
      .filter((attrs) => /\bsrc=\{/.test(attrs));
    assert.equal(framed.length, 1, `${f}: expected one <iframe src={…}>, found ${framed.length}`);

    const srcExpr = framed[0].match(/\bsrc=\{([A-Za-z0-9_$]+)\}/)?.[1];
    const keyExpr = framed[0].match(/\bkey=\{([A-Za-z0-9_$]+)\}/)?.[1];
    assert.ok(srcExpr, `${f}: the map iframe's src is not a plain identifier, so this check cannot read it`);
    assert.ok(
      keyExpr,
      `${f}: the map iframe has no key — a locale switch changes the attribute ` +
        `without remounting, and Google keeps the language it loaded with`,
    );
    assert.equal(
      keyExpr,
      srcExpr,
      `${f}: the iframe is keyed on ${keyExpr} but frames ${srcExpr}. Only a key ` +
        `that changes with the src forces the remount`,
    );
    assert.ok(
      source.includes(`const ${srcExpr} = mapSrcForLocale(`),
      `${f}: ${srcExpr} is not what mapSrcForLocale returned, so the frame is not localised`,
    );
  }
});
