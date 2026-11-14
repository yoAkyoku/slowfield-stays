"use server";

import { adminJsonDataRequest, adminJsonRequest, type AdminResult } from "./adminRequest";
import { actionRedirect, bulkDeleteResult, stampedRedirect } from "./adminUtils";

function safeReturnTo(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("/admin/") ? trimmed : fallback;
}

function formRedirect(result: AdminResult, formData: FormData) {
  const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""), "/admin/stays");
  actionRedirect(result, returnTo);
}

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRooms(value: FormDataEntryValue | null) {
  return lines(value).map((line) => {
    const [name = "", description = "", price = "0", capacity = "1"] = line.split("|").map((item) => item.trim());
    return {
      name,
      description,
      price: Number(price || 0),
      capacity: Number(capacity || 1)
    };
  });
}

function parseImages(value: FormDataEntryValue | null) {
  return lines(value).map((line, index) => {
    const [image_url = "", alt_text = "", sort_order = String(index)] = line.split("|").map((item) => item.trim());
    return {
      image_url,
      alt_text,
      sort_order: Number(sort_order || index)
    };
  });
}

function parseFaq(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  // JSON format (new): [{"question":"...","answer":"..."},...]
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw) as { question?: string; answer?: string }[];
      return arr
        .filter((item) => item.question || item.answer)
        .map((item) => ({ question: String(item.question ?? ""), answer: String(item.answer ?? "") }));
    } catch {
      // fall through to legacy format
    }
  }
  // Legacy pipe-delimited format: question | answer (one per line)
  return lines(value).map((line) => {
    const [question = "", answer = ""] = line.split("|").map((item) => item.trim());
    return { question, answer };
  });
}

function parseTranslations(formData: FormData): Record<string, Record<string, string>> {
  const raw = String(formData.get("translations") ?? "{}");
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Carried through the form as hidden JSON so a full-replace PUT does not blank
 *  fields that have no editor UI yet. A malformed value keeps the safe default
 *  rather than throwing the whole save. */
function parseIdList(value: FormDataEntryValue | null): number[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: FormDataEntryValue | null): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(value ?? "{}"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stayPayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    destination: String(formData.get("destination") ?? ""),
    region: String(formData.get("region") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    story: String(formData.get("story") ?? ""),
    hero_image_url: String(formData.get("hero_image_url") ?? ""),
    booking_url: String(formData.get("booking_url") ?? ""),
    sort_order: Number(formData.get("sort_order") ?? 0),
    base_price: Number(formData.get("base_price") ?? 0),
    max_guests: Number(formData.get("max_guests") ?? 1),
    status: String(formData.get("status") ?? "draft"),
    seo: {
      title: String(formData.get("seo_title") ?? ""),
      description: String(formData.get("seo_description") ?? ""),
      og_image: String(formData.get("seo_og_image") ?? ""),
      canonical: String(formData.get("seo_canonical") ?? "")
    },
    amenities: lines(formData.get("amenities")),
    // Canonical search values, kept apart from the free-text amenity copy.
    facilities: lines(formData.get("facilities")),
    experiences: lines(formData.get("experiences")),
    room_types: parseRooms(formData.get("room_types")),
    images: parseImages(formData.get("images")),
    tags: lines(formData.get("tags")),
    faq: parseFaq(formData.get("faq")),
    house_rules: lines(formData.get("house_rules")),
    location_config: {
      address: String(formData.get("location_address") ?? ""),
      map_url: String(formData.get("location_map_url") ?? ""),
      map_embed: String(formData.get("location_map_embed") ?? ""),
      // Stored as strings so a blank stays blank rather than becoming 0, which
      // would drop the pin in the Gulf of Guinea.
      lat: String(formData.get("location_lat") ?? "").trim(),
      lng: String(formData.get("location_lng") ?? "").trim()
    },
    social_links: {
      line: String(formData.get("social_line") ?? ""),
      facebook: String(formData.get("social_fb") ?? ""),
      instagram: String(formData.get("social_ig") ?? "")
    },
    // Round-tripped from the saved stay so a plain edit does not wipe them; the
    // backend PUT replaces the row wholesale and neither has an editor yet.
    related_content_ids: parseIdList(formData.get("related_content_ids")),
    detail_config: parseJsonObject(formData.get("detail_config")),
    translations: parseTranslations(formData)
  };
}

export async function createStayAction(formData: FormData) {
  const result = await adminJsonDataRequest<{ id: number; slug: string; status: string }>("/stays", stayPayload(formData));
  if (!result.ok) formRedirect(result, formData);
  const stay = result.data;
  if (!stay?.id) stampedRedirect("/admin/stays/new?error=Stay+create+failed");
  actionRedirect(result, `/admin/stays/${stay.id}/edit`);
}

export async function updateStayAction(id: string, formData: FormData) {
  const result = await adminJsonRequest(`/stays/${id}`, stayPayload(formData), "PUT");
  formRedirect(result, formData);
}

export async function updateStayStatusAction(id: string, status: string) {
  const result = await adminJsonRequest(`/stays/${id}/status`, { status }, "PATCH");
  actionRedirect(result, "/admin/stays");
}

export async function deleteStayAction(id: string, returnTo = "/admin/stays") {
  const result = await adminJsonRequest(`/stays/${id}/delete`, {}, "POST");
  actionRedirect(result, returnTo);
}

export async function restoreStayAction(id: string, returnTo = "/admin/stays?visibility=deleted") {
  const result = await adminJsonRequest(`/stays/${id}/restore`, {}, "POST");
  actionRedirect(result, returnTo);
}

export async function purgeStayAction(id: string, returnTo = "/admin/stays?visibility=deleted") {
  const result = await adminJsonRequest(`/stays/${id}/purge`, {}, "POST");
  actionRedirect(result, returnTo);
}

export async function bulkDeleteStaysAction(formData: FormData) {
  const ids = formData.getAll("ids") as string[];
  const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""), "/admin/stays");
  // Set by the list only while 已刪除 is the open view, where deleting again is
  // the second of the two deletes and therefore the permanent one.
  const purge = formData.get("purge") === "1";
  const result = await bulkDeleteResult(
    ids,
    (id) => `/stays/${id}/${purge ? "purge" : "delete"}`,
    (path) => adminJsonRequest(path, {}, "POST"),
    purge ? "permanently deleted" : "deleted"
  );
  actionRedirect(result, returnTo);
}
