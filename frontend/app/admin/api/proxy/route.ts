/**
 * Server-side proxy for authenticated client-side requests.
 *
 * Client components call `/admin/api/proxy?path=/admin/media&site=slug` instead
 * of hitting the backend directly. The proxy reads the HttpOnly `admin-token`
 * cookie and forwards the request with an Authorization header.
 *
 * Supports GET, POST, PUT, DELETE, PATCH.
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SERVER_API_URL as API_URL } from "../../../modules/apiBase";

export const runtime = "nodejs";

// Leave one MiB for multipart boundaries and field headers around a 100 MB file.
const MAX_MULTIPART_REQUEST_BYTES = 101 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Security: path allowlist prevents SSRF / path traversal
// ---------------------------------------------------------------------------
const ALLOWED_PATH_PREFIXES = ["/admin/", "/media", "/auth/me"];

/**
 * Resolve the path against the API base and check what actually comes out.
 *
 * The previous version tested the raw string for "..", which a percent-encoded
 * traversal walks straight past: the URL parser treats "%2E%2E" as a parent
 * segment, so `/admin/%2E%2E/%2E%2E/%2E%2E/docs` passed the allow-list and
 * resolved to `/docs` — outside the `/api/v1` prefix entirely, on a request
 * that carries the admin's bearer token. Measured, not assumed.
 *
 * Nothing reachable that way is sensitive today (`/docs` is off in production,
 * `/storage/media` is public), so this was a control that did not hold rather
 * than a live leak — but the control is the whole point of the proxy, and the
 * next endpoint mounted outside `/api/v1` would inherit the hole silently.
 *
 * Checking the resolved pathname closes the class instead of the instance: any
 * encoding that means "go up" has already been applied by the time it is tested.
 */
function isPathAllowed(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  // A userinfo section would repoint the request at another host entirely.
  if (path.includes("@")) return false;
  // An encoded separator survives URL parsing intact, so a path can still read
  // as a traversal after resolution. These API paths never legitimately contain
  // one, and letting something shaped like an escape through — even to a 404 —
  // is not a line worth defending.
  if (/%2f|%5c|\\/i.test(path)) return false;

  let resolved: URL;
  try {
    resolved = new URL(`${API_URL}${path}`);
  } catch {
    return false;
  }

  // Same origin as the configured API, and still under its base path.
  const base = new URL(API_URL);
  if (resolved.origin !== base.origin) return false;
  const basePath = base.pathname.replace(/\/+$/, "");
  if (!resolved.pathname.startsWith(`${basePath}/`)) return false;

  const rest = resolved.pathname.slice(basePath.length);
  return ALLOWED_PATH_PREFIXES.some((prefix) => rest.startsWith(prefix));
}

async function getAuthHeaders(site?: string): Promise<Record<string, string>> {
  const token = (await cookies()).get("admin-token")?.value;
  if (!token) return {};
  const hdrs: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (site) hdrs["X-Site-Slug"] = site;
  return hdrs;
}

async function proxyRequest(request: NextRequest) {
  const token = (await cookies()).get("admin-token")?.value;
  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  // --- CSRF: verify Origin matches our host ---
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !origin) {
    return NextResponse.json({ detail: "Missing Origin header" }, { status: 403 });
  }
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ detail: "CSRF rejected" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ detail: "Bad origin" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const apiPath = searchParams.get("path");
  if (!apiPath) {
    return NextResponse.json({ detail: "Missing path parameter" }, { status: 400 });
  }

  if (!isPathAllowed(apiPath)) {
    return NextResponse.json({ detail: "Path not allowed" }, { status: 403 });
  }

  /* Build the target URL, merging the caller's own query string with the
     proxy's extra params.
     `path` may already carry one — `/admin/newsletter/subscribers?visibility=all`
     is a perfectly ordinary thing to ask for. Appending `?${qs}` to that
     produced a second question mark, so the backend saw
     `visibility=all?site=hejing` and rejected the request as an invalid
     visibility. Splitting first and merging into one set means a caller can put
     params on either side and get the same result. */
  const [pathOnly, pathQuery = ""] = apiPath.split("?");
  const targetParams = new URLSearchParams(pathQuery);
  searchParams.forEach((value, key) => {
    if (key !== "path") targetParams.set(key, value);
  });
  const qs = targetParams.toString();
  const targetUrl = `${API_URL}${pathOnly}${qs ? `?${qs}` : ""}`;

  const site = searchParams.get("site") ?? undefined;
  const authHeaders = await getAuthHeaders(site);

  // Forward body for non-GET methods
  const isBodyMethod = ["POST", "PUT", "PATCH"].includes(request.method);
  let body: BodyInit | undefined;
  const forwardHeaders: Record<string, string> = { ...authHeaders };

  if (isBodyMethod) {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const contentLength = Number(request.headers.get("content-length") ?? 0);
      if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_REQUEST_BYTES) {
        return NextResponse.json({ detail: "Upload exceeds the 100 MB limit" }, { status: 413 });
      }
      /* Rebuild the multipart payload instead of forwarding NextRequest.body.
         In the standalone production server the forwarded stream arrived at
         FastAPI as an empty multipart body, so the required `file` field was
         missing even though the browser had sent it. A fresh FormData makes
         fetch generate a matching boundary and preserves every field. */
      body = await request.formData();
    } else if (contentType.includes("application/json")) {
      forwardHeaders["Content-Type"] = "application/json";
      body = await request.text();
    } else {
      body = await request.arrayBuffer();
      if (contentType) forwardHeaders["Content-Type"] = contentType;
    }
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body,
    });
  } catch {
    return NextResponse.json({ detail: "Backend unavailable" }, { status: 502 });
  }

  // If backend says 401, clear the token cookie
  if (response.status === 401) {
    const res = NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    res.cookies.delete("admin-token");
    return res;
  }

  // Stream the response back
  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const data = await response.arrayBuffer();
  return new NextResponse(data, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(request: NextRequest) { return proxyRequest(request); }
export async function POST(request: NextRequest) { return proxyRequest(request); }
export async function PUT(request: NextRequest) { return proxyRequest(request); }
export async function DELETE(request: NextRequest) { return proxyRequest(request); }
export async function PATCH(request: NextRequest) { return proxyRequest(request); }
