import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { type Banner, type Stay } from "../../modules/api";
import { ADMIN_DATA_DIGEST, ADMIN_FORBIDDEN_DIGEST, ADMIN_SITE_MISSING_DIGEST } from "./adminErrorDigests";
import { collectAllPages } from "./adminPagePagination";
import { SERVER_API_URL as API_URL } from "../../modules/apiBase";

export { ADMIN_DATA_DIGEST, ADMIN_FORBIDDEN_DIGEST, ADMIN_SITE_MISSING_DIGEST };

async function currentSiteSlug() {
  return (await cookies()).get("admin-site")?.value ?? "slowfield";
}

async function withSite(path: string, siteSlug?: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}site=${encodeURIComponent(siteSlug ?? await currentSiteSlug())}`;
}

/* `digest`, not just `name`: Next strips the name and message off any error a
   server component throws in a production build — the client boundary receives
   a generic "An error occurred in the Server Components render" and nothing
   else. `digest` is the one field it forwards verbatim, so it is what the
   boundary can actually branch on. Without this the 403 screen only ever
   appeared in dev; in production a permission error read as a generic outage. */
export class AdminForbiddenError extends Error {
  digest = ADMIN_FORBIDDEN_DIGEST;
  constructor() {
    super("Permission denied");
    this.name = "AdminForbiddenError";
  }
}

export class AdminDataError extends Error {
  digest = ADMIN_DATA_DIGEST;
  constructor(message = "Admin data could not be loaded") {
    super(message);
    this.name = "AdminDataError";
  }
}

/* The `admin-site` cookie names a site that no longer resolves — renamed,
   archived, or deleted. Every admin fetch carries that slug, so the backend
   404s all of them, including `/sites`; the SiteSwitcher's self-heal reads that
   same list, so it sees zero sites and never fires. The result was a fully
   blank admin with no message anywhere and no way out but logging in again.
   This is raised instead of swallowed so the boundary can offer the one action
   that fixes it: drop the cookie. */
export class AdminSiteMissingError extends Error {
  digest = ADMIN_SITE_MISSING_DIGEST;
  constructor(public readonly slug: string) {
    super(`Unknown admin site '${slug}'`);
    this.name = "AdminSiteMissingError";
  }
}

/* A 404 normally means "no such record", which is what `fallback` is for. It
   also comes back when the *site* in the cookie cannot be resolved, and that
   one must not be swallowed — see AdminSiteMissingError. The backend says which
   it is in `detail`; a body that cannot be read is treated as the ordinary
   record-missing case, since that is the common one. */
async function isUnknownSite(response: Response, slug: string) {
  try {
    const body = (await response.clone().json()) as { detail?: unknown };
    return typeof body.detail === "string" && body.detail === `Unknown site '${slug}'`;
  } catch {
    return false;
  }
}

async function adminFetch<T>(path: string, fallback: T, siteSlug?: string): Promise<T> {
  const token = (await cookies()).get("admin-token")?.value;
  if (!token) redirect("/admin/login");
  const slug = siteSlug ?? await currentSiteSlug();
  let response: Response;
  try {
    response = await fetch(`${API_URL}/admin${await withSite(path, slug)}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "X-Site-Slug": slug }
    });
  } catch {
    throw new AdminDataError(`Admin data could not be loaded (${path})`);
  }
  if (response.status === 401) redirect("/admin/login?expired=1");
  if (response.status === 403) throw new AdminForbiddenError();
  if (response.status === 404) {
    if (await isUnknownSite(response, slug)) throw new AdminSiteMissingError(slug);
    return fallback;
  }
  if (response.status >= 500) throw new AdminDataError(`Admin request failed (${response.status})`);
  if (!response.ok) return fallback;
  return response.json();
}

async function authorizedFetch<T>(path: string, fallback: T): Promise<T> {
  const token = (await cookies()).get("admin-token")?.value;
  if (!token) redirect("/admin/login");
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch {
    throw new AdminDataError(`Admin data could not be loaded (${path})`);
  }
  if (response.status === 401) redirect("/admin/login?expired=1");
  if (response.status === 403) throw new AdminForbiddenError();
  if (response.status === 404) return fallback;
  if (response.status >= 500) throw new AdminDataError(`Admin request failed (${response.status})`);
  if (!response.ok) return fallback;
  return response.json();
}

/** Lists paginated in the UI still need the complete scoped dataset. */
async function adminFetchAll<T extends { id: number }>(path: string): Promise<T[]> {
  const separator = path.includes("?") ? "&" : "?";
  return collectAllPages(
    (skip, limit) => adminFetch<T[]>(`${path}${separator}skip=${skip}&limit=${limit}`, []),
    500,
  );
}

export type DashboardData = {
  metrics: {
    new_inquiries: number;
    in_review: number;
    published_stays: number;
    recent_logins: number;
  };
  review_queue: { title: string; status: string; kind: "stay" | "page"; href: string }[];
};

export type AdminProfile = {
  id: number;
  email: string;
  name: string;
  role: string;
  permissions: string[];
};

export type AdminInquiry = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  line_id?: string;
  stay?: string;
  stay_id?: number;
  check_in?: string;
  check_out?: string;
  guests: number;
  /** What the enquiry is about, in the visitor's words — replaced the fixed
   *  詢問類型 codes. Optional: rows created before the column existed have none. */
  subject?: string;
  message?: string;
  source?: string;
  status: string;
  created_at?: string;
  /** Set when soft-deleted. Only rows in the 已刪除 view carry it. */
  deleted_at?: string | null;
};

export type AdminMedia = {
  id: number;
  file: string;
  display_name?: string;
  alt: string;
  alt_text?: string;
  type: string;
  url?: string;
  poster_url?: string;
  created_at?: string;
};

export type AdminMediaSummary = { total: number; images: number; videos: number };
export type AdminMediaOverview = { media: AdminMedia[]; summary: AdminMediaSummary };

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  site_role?: string;
  permissions?: string[];
  status: string;
  /** Set once the account has been moved to 已刪除. `status` is the other axis
   *  entirely — an account can be 停用 without being deleted, and a deleted one
   *  keeps whichever status it had — so the two are read separately. */
  deleted_at?: string | null;
  created_at?: string;
};

export type AdminLoginAudit = {
  id: number;
  admin_user_id?: number | null;
  email: string;
  ip_address?: string | null;
  success: boolean;
  created_at?: string;
};

export type AdminRole = {
  id: number;
  name: string;
  permissions: string[];
};

export type AdminSite = {
  id: number;
  parent_site_id?: number | null;
  template_site_id?: number | null;
  name: string;
  slug: string;
  domain: string;
  status: string;
  is_template?: boolean;
  template_version?: string;
  default_locale: string;
  theme_config: Record<string, string>;
  contact_config: Record<string, string>;
  seo_defaults: Record<string, string>;
  settings?: Record<string, unknown>;
  /** Backend authorization hints. _can_edit = false means render read-only. */
  _can_edit?: boolean;
  _can_view?: boolean;
};

export type AdminBookingRequest = AdminInquiry & {
  room_type?: string;
  admin_note?: string;
};

export type NewsletterSubscriber = {
  id: number;
  email: string;
  name: string;
  groups: string[];
  status: string;
  created_at?: string;
  deleted_at?: string | null;
};

export type NewsletterCampaign = {
  id: number;
  subject: string;
  body: string;
  status: string;
  target_groups: string[];
  deliveries: number;
  sent_count?: number;
  pending_count?: number;
  skipped_count?: number;
  failed_count?: number;
  max_retries?: number;
  created_at?: string;
  queued_at?: string;
  scheduled_at?: string;
  sent_at?: string;
  deleted_at?: string | null;
};

export type AdminSiteUser = {
  id: number;
  name: string;
  email: string;
  global_role: string;
  site_role: string;
  permissions: string[];
  status: string;
};

export type AdminEmailSettings = {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  has_password: boolean;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  is_enabled: boolean;
  daily_cap: number;
  sent_today: number;
  reply_to: string;
};

export type AdminSystemReadiness = {
  environment: string;
  site: { id: number; slug: string; name: string };
  qa_status: Record<string, boolean>;
  qa_note: string;
  qa_decision: "pending" | "ready" | "conditional" | "blocked";
  checks: { key: string; status: "ready" | "blocked"; detail: string }[];
};

export type AdminPage = {
  id: number;
  title: string;
  slug: string | null;
  summary?: string;
  body?: string;
  body_blocks?: CmsContentBlock[];
  content_type?: string;
  categories?: string[];
  layout?: string;
  cover_image_url?: string;
  sort_order?: number;
  tags?: string[];
  related_stay_ids?: number[];
  status: string;
  seo?: Record<string, string | null>;
  translations?: Record<string, Record<string, string>>;
  deleted_at?: string | null;
};

export type AdminContentTag = {
  id: number;
  slug: string;
  name_zh: string;
  name_en: string;
  status: "active" | "archived" | string;
  sort_order: number;
  usage_count: number;
};

function withVisibility(path: string, visibility?: string) {
  if (!visibility) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}visibility=${encodeURIComponent(visibility)}`;
}

/** Shared by every content block. `enabled: false` hides a block from the public
 *  page without deleting it — the same flag the homepage and villa block
 *  systems use, so "hide for now" means one thing across the admin. */
type CmsBlockBase = { id?: string; enabled?: boolean };

export type CmsContentBlock =
  | (CmsBlockBase & { type: "heading"; level?: "h2" | "h3"; text?: string; align?: "left" | "center" | "right" })
  | (CmsBlockBase & { type: "paragraph"; text?: string; align?: "left" | "center" | "right"; fontSize?: number | "small" | "base" | "large" })
  | (CmsBlockBase & { type: "image"; url?: string; alt?: string; caption?: string; size?: "full" | "wide" | "medium" | "small" })
  | (CmsBlockBase & { type: "video_embed"; platform?: string; url?: string; title?: string; caption?: string; cover?: string })
  | (CmsBlockBase & { type: "quote"; text?: string; source?: string })
  | (CmsBlockBase & { type: "cta"; label?: string; href?: string; style?: "primary" | "outline" | "ghost" })
  | (CmsBlockBase & { type: "spacer"; size?: "small" | "medium" | "large" })
  | (CmsBlockBase & { type: "image_grid"; images: { url: string; alt?: string; caption?: string }[]; columns?: 2 | 3 | 4; gap?: "tight" | "normal" | "wide" })
  | (CmsBlockBase & { type: "columns"; items?: { blocks: CmsContentBlock[]; flex: number }[]; left?: CmsContentBlock[]; right?: CmsContentBlock[]; ratio?: string });

export function getAdminDashboard() {
  return adminFetch<DashboardData>("/dashboard", {
    metrics: { new_inquiries: 0, in_review: 0, published_stays: 0, recent_logins: 0 },
    review_queue: []
  });
}

export function getAdminSystemReadiness() {
  return adminFetch<AdminSystemReadiness>("/readiness", {
    environment: "unknown",
    site: { id: 0, slug: "", name: "" },
    qa_status: {},
    qa_note: "",
    qa_decision: "pending",
    checks: []
  });
}

export function getCurrentAdminSiteSlug() {
  return currentSiteSlug();
}

export const getAdminSites = cache(async function getAdminSites() {
  return adminFetch<AdminSite[]>("/sites", []);
});

export function getAdminSite(id: string) {
  return adminFetch<AdminSite | null>(`/sites/${id}`, null);
}

export function getAdminSiteUsers(siteId: string) {
  return adminFetch<AdminSiteUser[]>(`/sites/${siteId}/users`, []);
}

export function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes("*") || permissions?.includes(permission));
}

export const getAdminProfile = cache(async function getAdminProfile(targetSiteSlug?: string) {
  const siteSlug = targetSiteSlug ?? await currentSiteSlug();
  const separator = "/auth/me?site=";
  return authorizedFetch<AdminProfile>(`${separator}${encodeURIComponent(siteSlug)}`, {
    id: 0,
    email: "",
    name: "",
    role: "admin",
    permissions: []
  });
});

export const getAdminStays = cache(async function getAdminStays(visibility?: string) {
  return adminFetchAll<Stay & { status: string; deleted_at?: string | null }>(withVisibility("/stays", visibility));
});

export function getAdminStay(id: string) {
  return adminFetch<(Stay & { status: string }) | null>(`/stays/${id}`, null);
}

export const getAdminBanners = cache(async function getAdminBanners(visibility?: string) {
  return adminFetchAll<Banner>(withVisibility("/cms/banners", visibility));
});

export function getAdminBanner(id: string) {
  return adminFetch<Banner | null>(`/cms/banners/${id}`, null);
}

export const getAdminPages = cache(async function getAdminPages(visibility?: string, siteSlug?: string) {
  return adminFetch<AdminPage[]>(withVisibility("/cms/pages", visibility), [], siteSlug);
});

/** Fetch the complete non-deleted article catalogue for aggregate views such as tag usage. */
export const getAdminPagesAll = cache(async function getAdminPagesAll(visibility = "active", siteSlug?: string) {
  const pageSize = 500; // Match the backend's maximum `limit`.
  return collectAllPages((skip, limit) => {
    const basePath = `/cms/pages?skip=${skip}&limit=${limit}`;
    return adminFetch<AdminPage[]>(withVisibility(basePath, visibility), [], siteSlug);
  }, pageSize);
});

export function getAdminPage(id: string) {
  return adminFetch<AdminPage | null>(`/cms/pages/${id}`, null);
}

export const getAdminContentTags = cache(async function getAdminContentTags(includeArchived = true, siteSlug?: string) {
  const query = includeArchived ? "" : "?include_archived=false";
  return adminFetch<AdminContentTag[]>(`/cms/tags${query}`, [], siteSlug);
});

/**
 * @param keyword Sent to the API so matching is consistent across inquiry
 *   fields. Every matching batch is collected before date/status filtering,
 *   totals, CSV export, and UI pagination.
 */
export function getAdminInquiries(visibility: "active" | "deleted" = "active", keyword = "") {
  const params = new URLSearchParams({ visibility });
  const q = keyword.trim();
  if (q) params.set("q", q);
  return adminFetchAll<AdminInquiry>(`/inquiries?${params.toString()}`);
}

/** @param keyword Searched server-side, like the enquiry list. Both feed the
 *  one 表單聯絡 screen and its single search box, so a keyword that reaches the
 *  whole enquiry table but only the newest page of bookings is a search that
 *  quietly lies about half its results. */
export function getAdminBookingRequests(visibility?: string, keyword = "") {
  const params = new URLSearchParams({ visibility: visibility === "deleted" ? "deleted" : "active" });
  const q = keyword.trim();
  if (q) params.set("q", q);
  return adminFetchAll<AdminBookingRequest>(`/booking-requests?${params.toString()}`);
}

export const getNewsletterSubscribers = cache(async function getNewsletterSubscribers(visibility?: string) {
  return adminFetchAll<NewsletterSubscriber>(withVisibility("/newsletter/subscribers", visibility));
});

export const getNewsletterCampaigns = cache(async function getNewsletterCampaigns(visibility?: string) {
  return adminFetchAll<NewsletterCampaign>(withVisibility("/newsletter/campaigns", visibility));
});

export async function getNewsletterCampaign(id: number) {
  const direct = await adminFetch<NewsletterCampaign | null>(`/newsletter/campaigns/${id}`, null);
  if (direct) return direct;
  /* Fallback: backend may not have single-campaign endpoint yet */
  const all = await getNewsletterCampaigns();
  return all.find((c) => c.id === id) ?? null;
}

export function getAdminMediaSummary() {
  return adminFetch<AdminMediaSummary>("/media/summary", { total: 0, images: 0, videos: 0 });
}

export function getAdminMediaOverview(limit = 48) {
  return adminFetch<AdminMediaOverview>(`/media/overview?limit=${limit}`, {
    media: [],
    summary: { total: 0, images: 0, videos: 0 },
  });
}

/** 帳號管理's list. Omitting `visibility` keeps the caller's old behaviour —
 *  the API defaults to "active", which is the live list with 已刪除 left out. */
export const getAdminUsers = cache(async function getAdminUsers(visibility?: string) {
  return adminFetch<AdminUser[]>(withVisibility("/users", visibility), []);
});

export function getAdminLoginAudits() {
  return adminFetch<AdminLoginAudit[]>("/login-audits", []);
}

export const getAdminRoles = cache(async function getAdminRoles() {
  return adminFetch<AdminRole[]>("/roles", []);
});

export const getAdminPermissions = cache(async function getAdminPermissions() {
  return adminFetch<string[]>("/permissions", [
    "*",
    "global_users:read", "global_users:write",
    "roles:read", "roles:write",
    "sites:read", "sites:write",
    "stays:read", "stays:write",
    "cms:read", "cms:write",
    "inquiries:read", "inquiries:write",
    "media:read", "media:write",
    "newsletter:read", "newsletter:write",
    "site_users:read", "site_users:write"
  ]);
});

export function getAdminEmailSettings() {
  return adminFetch<AdminEmailSettings>("/email-settings", {
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    has_password: false,
    from_email: "",
    from_name: "Slowfield Stays",
    use_tls: true,
    is_enabled: false,
    daily_cap: 100,
    sent_today: 0,
    reply_to: ""
  });
}

export type AdminArticleCategory = { key: string; label: {zh: string; en: string}; status: "active" | "archived"; sort_order: number };
export const getAdminArticleCategories = cache(async function getAdminArticleCategories() {
  return adminFetch<AdminArticleCategory[]>("/cms/categories", []);
});
