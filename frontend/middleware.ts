import { NextResponse, type NextRequest } from "next/server";

function isExpiredJwt(token: string) {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * The site's configured default language, published as a request header so
 * getLocale() can honour it.
 *
 * Without this the whole site fell back to English for anyone without a
 * language cookie — on a Chinese-first brand whose default_locale has been set
 * to zh all along. Cached because it changes about never; a stale answer for a
 * few minutes is a visitor seeing the previous default, not a broken page.
 */
async function siteDefaultLocale(host: string | null, slug?: string): Promise<string> {
  try {
    const query = slug ? `?site=${encodeURIComponent(slug)}` : "";
    const res = await fetch(`${API_URL}/site/resolve${query}`, {
      headers: host ? { host } : undefined,
      next: { revalidate: 300 },
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { default_locale?: string };
    return data.default_locale === "zh" || data.default_locale === "en" ? data.default_locale : "";
  } catch {
    return "";
  }
}

/** Check if a slug belongs to a property (child) site. Lightweight API call. */
async function isPropertySite(slug: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_URL}/site/resolve?site=${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );
    // 404 is an answer, not an outage: it means no site carries this slug. The
    // dev fallback below exists for a missing backend, and treating a real 404
    // as one made every unknown slug under /stays/ resolve to a fabricated
    // villa — so a parent stay, or a plain typo, rendered as a live child site
    // full of demo copy while the API had correctly said "no such site".
    if (res.status === 404) return false;
    if (!res.ok) return devFallbackIsProperty(slug);
    const data = (await res.json()) as { parent_site_id?: number | null; is_template?: boolean };
    // A template child site (the leftover "測試子站" test tenant, is_template=true)
    // is a placeholder, not a real villa. Rewriting /stays/{slug} onto the
    // property route rendered it as a live, indexable LodgingBusiness. Refusing
    // the rewrite lets the URL fall through to the parent stay route, which 404s
    // when no such stay exists — a template must never be a public page.
    // Drafts are already handled downstream: getPropertySite() returns null for a
    // non-active child, so /property/{slug} 404s for them.
    if (data.is_template) return false;
    return data.parent_site_id != null;
  } catch {
    return devFallbackIsProperty(slug);
  }
}

/** DEV-ONLY: Treat any slug as a property site when backend is unreachable */
function devFallbackIsProperty(slug: string): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  // In dev mode without backend, assume all slugs under /stays/ are property sites
  return slug.length > 0;
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  const isAdminPath = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/");
  const isPublicAdminPath = request.nextUrl.pathname === "/admin/login" || request.nextUrl.pathname === "/admin/reset-password";
  const requestHeaders = new Headers(request.headers);
  // Which site a request renders is this middleware's decision, from the host or
  // from ?site=. Copying the incoming headers also copied any x-site-slug the
  // client sent, and the branches below only overwrite it on some paths — so a
  // request to the main domain carrying the header rendered a child site there.
  requestHeaders.delete("x-site-slug");
  const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;
  // Preview override is per-request via ?site= ONLY. We deliberately do NOT fall
  // back to a persistent cookie: a stale "preview-site" cookie used to make the
  // main domain render a child site for a whole hour (e.g. after the admin
  // homepage preview loaded /?site=hejing), so slowfield.example showed
  // 禾境 instead of 慢域旅遊 for that browser. Query-param-only keeps the admin
  // preview iframe working without leaking into normal browsing.
  const rawPreviewSite = request.nextUrl.searchParams.get("site");
  const previewSite = rawPreviewSite && SAFE_SLUG.test(rawPreviewSite) ? rawPreviewSite : undefined;

  // /admin is excluded so a preview link cannot repoint the admin itself at
  // another site — except /admin/preview/*, which exists to render one site's
  // content and is useless without being told which. Those pages carry no admin
  // chrome and still sit behind the admin token.
  const isAdminPreview = request.nextUrl.pathname.startsWith("/admin/preview/");
  if (previewSite && (isAdminPreview || !request.nextUrl.pathname.startsWith("/admin"))) {
    requestHeaders.set("x-site-slug", previewSite);
  }

  // /stays/detail/[slug] is a real parent route (full stay detail page) and must
  // NOT be treated as a property sub-path — let it fall through to Next routing.
  const isStayDetailPath = request.nextUrl.pathname.startsWith("/stays/detail/");

  // ── Property (child site) path rewrite ──
  // /stays/[slug]/[...rest] → /property/[slug]/[...rest]
  // Page slugs are fully dynamic (no hardcoded set). Regular stays have no
  // sub-paths, so any /stays/slug/rest pattern is safe to rewrite directly.
  // The catch-all route returns 404 for unknown pages.
  const propMatch = !isAdminPath && !isStayDetailPath && request.nextUrl.pathname.match(
    /^\/stays\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(.+)$/
  );
  if (propMatch) {
    const [, slug, rest] = propMatch;
    // Skip static asset-like paths (files with extensions)
    if (!rest.includes(".")) {
      requestHeaders.set("x-site-slug", slug);
      const url = request.nextUrl.clone();
      url.pathname = `/property/${slug}/${rest}`;
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  }

  // Property homepage: /stays/[slug] (bare, no sub-path)
  // Call API to check if this slug is a child site → rewrite to property homepage
  const homeMatch = !isAdminPath && request.nextUrl.pathname.match(
    /^\/stays\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/
  );
  if (homeMatch) {
    const slug = homeMatch[1];
    const isProperty = await isPropertySite(slug);
    if (isProperty) {
      requestHeaders.set("x-site-slug", slug);
      const url = request.nextUrl.clone();
      url.pathname = `/property/${slug}`;
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  }

  if (isAdminPath && token && !isPublicAdminPath && isExpiredJwt(token)) {
    const response = NextResponse.redirect(new URL("/admin/login?expired=1", request.url));
    response.cookies.delete("admin-token");
    return response;
  }

  if (isAdminPath && !isPublicAdminPath && !token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // Publish the site's default language for getLocale(); skipped on admin
  // paths, which are their own thing and do not need it.
  if (!isAdminPath) {
    const fallbackLocale = await siteDefaultLocale(
      request.headers.get("host"),
      requestHeaders.get("x-site-slug") ?? undefined,
    );
    if (fallbackLocale) requestHeaders.set("x-site-default-locale", fallbackLocale);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Clear any legacy preview-site cookie so browsers that still carry it stop
  // rendering a child site on the main domain.
  if (request.cookies.get("preview-site")) {
    response.cookies.set("preview-site", "", { maxAge: 0, path: "/" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|storage).*)"]
};
