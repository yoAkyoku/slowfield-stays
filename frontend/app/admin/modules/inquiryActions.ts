"use server";

import { adminJsonRequest } from "./adminRequest";
import { actionRedirect } from "./adminUtils";

export async function updateInquiryStatusAction(id: string, status: string, returnTo = "/admin/inquiries") {
  const result = await adminJsonRequest(`/inquiries/${id}/status`, { status }, "PATCH", "Inquiry request failed");
  actionRedirect(result, typeof returnTo === "string" && (returnTo === "/admin/inquiries" || returnTo.startsWith("/admin/inquiries?")) ? returnTo : "/admin/inquiries");
}

/** Soft delete — the row leaves the list, not the database, so a mis-click on
 *  a real enquiry is recoverable (see the restore action below). */
export async function deleteInquiryAction(id: string) {
  const result = await adminJsonRequest(`/inquiries/${id}`, {}, "DELETE", "Inquiry delete failed");
  actionRedirect(result, "/admin/inquiries");
}

export async function restoreInquiryAction(id: string) {
  const result = await adminJsonRequest(`/inquiries/${id}/restore`, {}, "POST", "Inquiry restore failed");
  actionRedirect(result, "/admin/inquiries?visibility=deleted");
}

/** The second delete, offered only from 已刪除. This one does not come back. */
export async function purgeInquiryAction(id: string) {
  const result = await adminJsonRequest(`/inquiries/${id}/purge`, {}, "POST", "Inquiry delete failed");
  actionRedirect(result, "/admin/inquiries?visibility=deleted");
}
