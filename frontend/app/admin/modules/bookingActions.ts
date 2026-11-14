"use server";

/* The booking inbox was merged into 表單聯絡 — the public form decides between
   the two tables from an invisible flag, so operators had two pages for one
   stream. These actions still address the booking-requests API (a booking is
   still a booking row) but return to the single merged list. */

import { adminJsonRequest } from "./adminRequest";
import { actionRedirect } from "./adminUtils";

export async function updateBookingStatusAction(id: string, status: string, returnTo = "/admin/inquiries") {
  const result = await adminJsonRequest(`/booking-requests/${id}/status`, { status }, "PATCH", "Booking request failed");
  actionRedirect(result, typeof returnTo === "string" && (returnTo === "/admin/inquiries" || returnTo.startsWith("/admin/inquiries?")) ? returnTo : "/admin/inquiries");
}

/** Soft delete, matching the enquiry inbox. There was no delete here at all:
 *  a spam or test booking stayed in the list permanently. */
export async function deleteBookingAction(id: string) {
  const result = await adminJsonRequest(`/booking-requests/${id}`, {}, "DELETE", "Booking delete failed");
  actionRedirect(result, "/admin/inquiries");
}

export async function restoreBookingAction(id: string) {
  const result = await adminJsonRequest(`/booking-requests/${id}/restore`, {}, "POST", "Booking restore failed");
  actionRedirect(result, "/admin/inquiries?visibility=deleted");
}

/** The second delete, offered only from 已刪除. This one does not come back. */
export async function purgeBookingAction(id: string) {
  const result = await adminJsonRequest(`/booking-requests/${id}/purge`, {}, "POST", "Booking delete failed");
  actionRedirect(result, "/admin/inquiries?visibility=deleted");
}
