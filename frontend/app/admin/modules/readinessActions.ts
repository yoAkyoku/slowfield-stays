"use server";

import { revalidatePath } from "next/cache";
import { adminJsonRequest } from "./adminRequest";
import { actionRedirect } from "./adminUtils";

export async function updateQaStatusAction(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  const done = formData.get("done") === "true";
  const result = await adminJsonRequest("/readiness/qa", { key, done }, "PUT", "QA status update failed");
  revalidatePath("/admin/readiness");
  actionRedirect(result, "/admin/readiness");
}

export async function updateQaNoteAction(formData: FormData) {
  const note = String(formData.get("note") ?? "");
  const decision = String(formData.get("decision") ?? "pending");
  const result = await adminJsonRequest("/readiness/qa-note", { note, decision }, "PUT", "QA note update failed");
  revalidatePath("/admin/readiness");
  actionRedirect(result, "/admin/readiness");
}
