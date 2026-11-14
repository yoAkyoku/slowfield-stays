"use server";

import { revalidatePath } from "next/cache";
import { adminJsonRequest, adminJsonDataRequest } from "./adminRequest";
import { actionRedirect, stampedRedirect } from "./adminUtils";

async function newsletterPost(path: string, body: Record<string, unknown> = {}) {
  const result = await adminJsonRequest(path, body, "POST", "Newsletter request failed");
  if (!result.ok) stampedRedirect(`/admin/newsletter?error=${encodeURIComponent(result.message)}`);
  return result;
}

export async function createSubscriberAction(formData: FormData) {
  const result = await adminJsonRequest("/newsletter/subscribers", {
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    groups: String(formData.get("groups") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    status: "subscribed"
  }, "POST", "Subscriber request failed");
  if (result.ok) revalidatePath("/admin/newsletter");
  return result;
}

export async function createCampaignAction(formData: FormData) {
  const rawScope = String(formData.get("recipient_scope") ?? "self");
  const recipient_scope = rawScope === "self+children" ? "self+children" : "self";
  const result = await newsletterPost("/newsletter/campaigns", {
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
    target_groups: String(formData.get("target_groups") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    status: "draft",
    recipient_scope,
  });
  actionRedirect(result, "/admin/newsletter");
}

export async function queueCampaignAction(id: number) {
  const result = await newsletterPost(`/newsletter/campaigns/${id}/queue`);
  actionRedirect(result, "/admin/newsletter");
}

export async function processNewsletterAction() {
  const result = await newsletterPost("/newsletter/process");
  actionRedirect(result, "/admin/newsletter");
}

export async function retryFailedNewsletterAction() {
  const result = await adminJsonRequest("/newsletter/retry-failed", {}, "POST", "Newsletter request failed");
  actionRedirect(result, "/admin/newsletter?tab=send");
}

export async function updateSubscriberAction(id: number, formData: FormData) {
  const result = await adminJsonRequest(
    `/newsletter/subscribers/${id}`,
    {
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      groups: String(formData.get("groups") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      status: String(formData.get("status") ?? "subscribed")
    },
    "PUT",
    "Newsletter request failed"
  );
  if (result.ok) revalidatePath("/admin/newsletter");
  return result;
}

export async function deleteSubscriberAction(id: number, returnTo = "/admin/newsletter?tab=subscribers") {
  const result = await adminJsonRequest(`/newsletter/subscribers/${id}/delete`, {}, "POST", "Newsletter request failed");
  actionRedirect(result, returnTo);
}

export async function restoreSubscriberAction(id: number, returnTo = "/admin/newsletter?visibility=deleted") {
  const result = await adminJsonRequest(`/newsletter/subscribers/${id}/restore`, {}, "POST", "Newsletter request failed");
  actionRedirect(result, returnTo);
}

/** The second delete, offered only from 已刪除. Past sends stay in the log —
 *  the API clears the link rather than destroying the delivery rows. */
export async function purgeSubscriberAction(id: number, returnTo = "/admin/newsletter?tab=subscribers&visibility=deleted") {
  const result = await adminJsonRequest(`/newsletter/subscribers/${id}/purge`, {}, "POST", "Newsletter request failed");
  actionRedirect(result, returnTo);
}

export async function updateCampaignAction(id: number, formData: FormData) {
  const result = await adminJsonRequest(
    `/newsletter/campaigns/${id}`,
    {
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
      target_groups: String(formData.get("target_groups") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    },
    "PUT",
    "Newsletter request failed"
  );
  actionRedirect(result, `/admin/newsletter/${id}`);
}

export async function deleteCampaignAction(id: number, returnTo = "/admin/newsletter") {
  const result = await adminJsonRequest(`/newsletter/campaigns/${id}/delete`, {}, "POST", "Newsletter request failed");
  actionRedirect(result, returnTo);
}

export async function restoreCampaignAction(id: number, returnTo = "/admin/newsletter?visibility=deleted") {
  const result = await adminJsonRequest(`/newsletter/campaigns/${id}/restore`, {}, "POST", "Newsletter request failed");
  actionRedirect(result, returnTo);
}

/** The second delete, offered only from 已刪除. See purgeSubscriberAction on
 *  why the send log survives. */
export async function purgeCampaignAction(id: number, returnTo = "/admin/newsletter?visibility=deleted") {
  const result = await adminJsonRequest(`/newsletter/campaigns/${id}/purge`, {}, "POST", "Newsletter request failed");
  actionRedirect(result, returnTo);
}

export async function processCampaignAction(id: number) {
  const result = await adminJsonDataRequest<{ sent: number; failed: number; skipped: number }>(`/newsletter/campaigns/${id}/process`);
  if (result.ok) revalidatePath("/admin/newsletter");
  return result;
}

export async function scheduleCampaignAction(id: number, scheduledAt: string) {
  const result = await adminJsonRequest(`/newsletter/campaigns/${id}/schedule`, {
    scheduled_at: scheduledAt
  });
  if (result.ok) revalidatePath("/admin/newsletter");
  return result;
}

export async function unscheduleCampaignAction(id: number) {
  const result = await newsletterPost(`/newsletter/campaigns/${id}/unschedule`);
  actionRedirect(result, "/admin/newsletter?tab=send");
}
