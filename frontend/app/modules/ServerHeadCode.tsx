/**
 * Server-side head code renderer.
 * Parses meta tags from HTML string and renders them as React elements
 * so Next.js hoists them into <head> during SSR.
 */
import { sanitizeCustomCode } from "./safeHtml";

/* The reverse of the escaping sanitizeCustomCode applies on its way out. The
   meta tags below are read back out of the sanitised STRING and handed to React
   as props, and React escapes what it renders — so without this a "&" inside a
   verification token would reach the page as "&amp;amp;". `&amp;` last, or an
   escaped "&amp;lt;" would decode twice. */
function unescapeAttr(v: string): string {
  return v
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/* Built per call rather than shared: a /g regex carries lastIndex, and one
   left mid-string by the exec loop below would make the next render of the
   next site start reading part-way through its own head code. */
const metaTagRe = () => /<meta\s+([^>]*?)\s*\/?>/gi;

export default function ServerHeadCode({ html }: { html: string }) {
  if (!html) return null;

  /* Sanitise FIRST, then read the meta tags out of the result.
     This used to pull <meta> out of the RAW string with the regex below and
     hand the captures straight to React, and the sanitiser three lines down
     never saw them — it ran on the string with every meta already removed. So
     nothing about a meta tag was checked at all, and this is site-wide head
     code: `<meta http-equiv="refresh" content="0;url=https://evil.example/">`
     saved on a site sent every page of it somewhere else. One allow-list, and
     the extraction now works on output that has already passed it. */
  const clean = sanitizeCustomCode(html);

  const metaElements: React.ReactElement[] = [];
  let match: RegExpExecArray | null;
  let i = 0;
  const scan = metaTagRe();
  while ((match = scan.exec(clean)) !== null) {
    const attrStr = match[1];
    // Only double quotes: the sanitiser normalises every attribute it keeps.
    const pick = (name: string): string | undefined =>
      attrStr.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "i"))?.[1];

    const name = pick("name");
    const property = pick("property");
    const content = pick("content");
    const httpEquiv = pick("http-equiv");
    if (content === undefined) continue;
    const value = unescapeAttr(content);

    if (name) {
      metaElements.push(<meta key={`hc-${i++}`} name={unescapeAttr(name)} content={value} />);
    } else if (property) {
      metaElements.push(<meta key={`hc-${i++}`} property={unescapeAttr(property)} content={value} />);
    } else if (httpEquiv) {
      metaElements.push(<meta key={`hc-${i++}`} httpEquiv={unescapeAttr(httpEquiv)} content={value} />);
    }
  }

  // Whatever is not a meta tag still renders in the body, but rebuilt from an
  // allow-list rather than stripped: the pass this replaced missed a handler
  // written as <img src=x/onerror=…>, because its pattern wanted whitespace
  // before the attribute, and never matched an entity-encoded javascript: URL.
  const remaining = clean.replace(metaTagRe(), "").trim();

  return (
    <>
      {metaElements}
      {remaining && <div dangerouslySetInnerHTML={{ __html: remaining }} suppressHydrationWarning />}
    </>
  );
}
