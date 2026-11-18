"use server";

import { adminJsonDataRequest, adminJsonRequest } from "./adminRequest";
import { actionRedirect, bulkDeleteResult, formRedirect, parseTranslations, safeReturnTo, stampedRedirect } from "./adminUtils";

function parseBodyBlocks(formData: FormData) {
  const raw = String(formData.get("body_blocks") ?? "[]");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** What the banner form sends, the same on create and on save. */
function bannerPayload(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    subtitle: String(formData.get("subtitle") ?? ""),
    image_url: String(formData.get("image_url") ?? ""),
    cta_label: String(formData.get("cta_label") ?? "Explore"),
    cta_href: String(formData.get("cta_href") ?? "/stays"),
    sort_order: Number(formData.get("sort_order") ?? 0),
    status: String(formData.get("status") ?? "draft"),
    translations: parseTranslations(formData)
  };
}

export async function createBannerAction(formData: FormData) {
  const result = await adminJsonDataRequest<{ id: number; status: string }>("/cms/banners", bannerPayload(formData));
  if (!result.ok) formRedirect(result, formData, "/admin/cms");
  const banner = result.data;
  if (!banner?.id) stampedRedirect("/admin/cms/banners/new?error=Banner+create+failed");
  actionRedirect(result, `/admin/cms/banners/${banner.id}/edit`);
}

export async function updateBannerAction(id: string, formData: FormData) {
  const result = await adminJsonRequest(`/cms/banners/${id}`, bannerPayload(formData), "PUT");
  formRedirect(result, formData, "/admin/cms");
}

export async function updateBannerStatusAction(id: string, status: string) {
  const result = await adminJsonRequest(`/cms/banners/${id}/status`, { status }, "PATCH");
  actionRedirect(result, "/admin/cms");
}

export async function deleteBannerAction(id: string, returnTo = "/admin/cms") {
  const result = await adminJsonRequest(`/cms/banners/${id}/delete`, {}, "POST");
  actionRedirect(result, returnTo);
}

export async function restoreBannerAction(id: string, returnTo = "/admin/cms?visibility=deleted") {
  const result = await adminJsonRequest(`/cms/banners/${id}/restore`, {}, "POST");
  actionRedirect(result, returnTo);
}

/** What the page form sends, the same on create and on save. */
function pagePayload(formData: FormData) {
  return {
    slug: String(formData.get("slug") ?? "").trim() || null,
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    body: String(formData.get("body") ?? ""),
    body_blocks: parseBodyBlocks(formData),
    content_type: String(formData.get("content_type") ?? "page"),
    categories: [
      String(formData.get("content_type") ?? "page"),
      ...formData.getAll("categories").map(String),
    ],
    layout: String(formData.get("layout") ?? "page"),
    cover_image_url: String(formData.get("cover_image_url") ?? ""),
    sort_order: Number(formData.get("sort_order") ?? 0),
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    related_stay_ids: String(formData.get("related_stay_ids") ?? "")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter(Boolean),
    status: String(formData.get("status") ?? "draft"),
    seo: {
      title: String(formData.get("seo_title") ?? ""),
      description: String(formData.get("seo_description") ?? ""),
      og_image: String(formData.get("seo_og_image") ?? ""),
      canonical: String(formData.get("seo_canonical") ?? "")
    },
    translations: parseTranslations(formData)
  };
}

export async function createPageAction(formData: FormData) {
  const result = await adminJsonDataRequest<{ id: number; slug: string | null; status: string }>("/cms/pages", pagePayload(formData));
  if (!result.ok) formRedirect(result, formData, "/admin/cms");
  const page = result.data;
  if (!page?.id) stampedRedirect("/admin/cms/pages/new?error=Page+create+failed");
  // Allow caller to override redirect target (e.g. site editor tab2 wants to stay on its page)
  const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""), "");
  actionRedirect(result, returnTo && returnTo !== "/admin/cms/pages/new" ? returnTo : `/admin/cms/pages/${page.id}/edit`, "Saved");
}

export async function updatePageAction(id: string, formData: FormData) {
  const result = await adminJsonRequest(`/cms/pages/${id}`, pagePayload(formData), "PUT");
  formRedirect(result, formData, "/admin/cms");
}

function tagPayload(formData: FormData) {
  return {
    slug: String(formData.get("slug") ?? "").trim() || null,
    name_zh: String(formData.get("name_zh") ?? "").trim(),
    name_en: String(formData.get("name_en") ?? "").trim(),
    status: String(formData.get("status") ?? "active"),
    sort_order: Number(formData.get("sort_order") ?? 0),
  };
}

export async function createContentTagAction(formData: FormData) {
  const result = await adminJsonDataRequest<{ id: number }>("/cms/tags", tagPayload(formData));
  const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""), "/admin/cms/tags");
  if (!result.ok) actionRedirect(result, returnTo);
  actionRedirect(result, returnTo, "Tag created");
}

export async function updatePageStatusAction(id: string, status: string) {
  const result = await adminJsonRequest(`/cms/pages/${id}/status`, { status }, "PATCH");
  actionRedirect(result, "/admin/cms");
}

export async function deletePageAction(id: string, returnTo = "/admin/cms") {
  const result = await adminJsonRequest(`/cms/pages/${id}/delete`, {}, "POST");
  actionRedirect(result, returnTo);
}

export async function restorePageAction(id: string, returnTo = "/admin/cms?visibility=deleted") {
  const result = await adminJsonRequest(`/cms/pages/${id}/restore`, {}, "POST");
  actionRedirect(result, returnTo);
}

export async function purgePageAction(id: string, returnTo = "/admin/cms?visibility=deleted") {
  const result = await adminJsonRequest(`/cms/pages/${id}/purge`, {}, "POST");
  actionRedirect(result, returnTo);
}

export async function bulkDeletePagesAction(formData: FormData) {
  const ids = formData.getAll("ids") as string[];
  const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""), "/admin/cms");
  const purge = formData.get("purge") === "1";
  const result = await bulkDeleteResult(
    ids,
    (id) => `/cms/pages/${id}/${purge ? "purge" : "delete"}`,
    (path) => adminJsonRequest(path, {}, "POST"),
    purge ? "permanently deleted" : "deleted"
  );
  actionRedirect(result, returnTo);
}

export async function purgeBannerAction(id: string, returnTo = "/admin/cms?visibility=deleted") {
  const result = await adminJsonRequest(`/cms/banners/${id}/purge`, {}, "POST");
  actionRedirect(result, returnTo);
}

export async function bulkDeleteBannersAction(formData: FormData) {
  const ids = formData.getAll("ids") as string[];
  const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""), "/admin/cms");
  const purge = formData.get("purge") === "1";
  const result = await bulkDeleteResult(
    ids,
    (id) => `/cms/banners/${id}/${purge ? "purge" : "delete"}`,
    (path) => adminJsonRequest(path, {}, "POST"),
    purge ? "permanently deleted" : "deleted"
  );
  actionRedirect(result, returnTo);
}
