"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type AdminResult = { ok: true; message?: string } | { message: string; ok: false };

async function currentSiteSlug() {
  return (await cookies()).get("admin-site")?.value ?? "slowfield";
}

function detailItemMessage(item: unknown) {
  if (typeof item === "object" && item !== null) {
    const record = item as Record<string, unknown>;
    if (typeof record.msg === "string") return record.msg;
    if (typeof record.message === "string") return record.message;
  }
  return "Invalid input";
}

export async function resultFromResponse(response: Response, fallback = "Request failed"): Promise<AdminResult> {
  if (response.ok) {
    try {
      const data = (await response.json()) as { message?: string };
      if (typeof data.message === "string") return { ok: true, message: data.message };
    } catch {
      // No JSON body or no message field — that's fine.
    }
    return { ok: true };
  }
  if (response.status === 401) redirect("/admin/login?expired=1");
  if (response.status === 403) return { message: "Permission denied", ok: false };
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === "string") return { message: data.detail, ok: false };
    if (Array.isArray(data.detail)) return { message: data.detail.map(detailItemMessage).join(" "), ok: false };
  } catch {
    // Fall through to a compact status message.
  }
  return { message: `${fallback} (${response.status})`, ok: false };
}

export async function adminJsonRequest(
  path: string,
  body: Record<string, unknown> = {},
  method = "POST",
  fallback = "Request failed"
) {
  const token = (await cookies()).get("admin-token")?.value;
  if (!token) redirect("/admin/login");
  const siteSlug = await currentSiteSlug();
  const separator = path.includes("?") ? "&" : "?";
  const hasBody = method !== "GET" && method !== "HEAD";
  const response = await fetch(`${API_URL}/admin${path}${separator}site=${encodeURIComponent(siteSlug)}`, {
    method,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      "X-Site-Slug": siteSlug
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });
  return resultFromResponse(response, fallback);
}

export async function adminJsonDataRequest<T>(
  path: string,
  body: Record<string, unknown> = {},
  method = "POST",
  fallback = "Request failed"
): Promise<AdminResult & { data?: T }> {
  const token = (await cookies()).get("admin-token")?.value;
  if (!token) redirect("/admin/login");
  const siteSlug = await currentSiteSlug();
  const separator = path.includes("?") ? "&" : "?";
  const isBodyAllowed = method !== "GET" && method !== "HEAD";
  const response = await fetch(`${API_URL}/admin${path}${separator}site=${encodeURIComponent(siteSlug)}`, {
    method,
    headers: {
      ...(isBodyAllowed ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      "X-Site-Slug": siteSlug
    },
    ...(isBodyAllowed ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 401) redirect("/admin/login?expired=1");
  if (response.status === 403) return { message: "Permission denied", ok: false };
  // Parse body once to avoid "Body has already been read" error
  let parsed: unknown;
  try { parsed = await response.json(); } catch { parsed = null; }
  if (!response.ok) {
    const detail = (parsed as Record<string, unknown> | null)?.detail;
    if (typeof detail === "string") return { message: detail, ok: false };
    if (Array.isArray(detail)) return { message: detail.map(detailItemMessage).join(" "), ok: false };
    return { message: `${fallback} (${response.status})`, ok: false };
  }
  const message = typeof (parsed as Record<string, unknown> | null)?.message === "string"
    ? (parsed as Record<string, string>).message
    : undefined;
  return { ok: true, message, data: parsed as T };
}

export async function authJsonRequest(path: string, body: Record<string, unknown>, fallback = "Request failed") {
  const token = (await cookies()).get("admin-token")?.value;
  if (!token) redirect("/admin/login");
  const response = await fetch(`${API_URL}/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  return resultFromResponse(response, fallback);
}


export async function adminFormRequest(path: string, formData: FormData, method = "POST", fallback = "Request failed") {
  const token = (await cookies()).get("admin-token")?.value;
  if (!token) redirect("/admin/login");
  const siteSlug = await currentSiteSlug();
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${API_URL}/admin${path}${separator}site=${encodeURIComponent(siteSlug)}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Site-Slug": siteSlug
    },
    body: formData
  });
  return resultFromResponse(response, fallback);
}
