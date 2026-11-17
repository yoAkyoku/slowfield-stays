"use server";

import { adminJsonRequest } from "./adminRequest";
import { actionRedirect } from "./adminUtils";

export async function updateEmailSettingsAction(formData: FormData) {
  const result = await adminJsonRequest("/email-settings", {
    smtp_host: String(formData.get("smtp_host") ?? ""),
    smtp_port: Number(formData.get("smtp_port") ?? 587),
    smtp_username: String(formData.get("smtp_username") ?? ""),
    smtp_password: String(formData.get("smtp_password") ?? ""),
    from_email: String(formData.get("from_email") ?? ""),
    from_name: String(formData.get("from_name") ?? ""),
    use_tls: formData.get("use_tls") === "on",
    is_enabled: formData.get("is_enabled") === "on",
    daily_cap: Math.max(0, Number(formData.get("daily_cap") ?? 100)),
    reply_to: String(formData.get("reply_to") ?? "")
  }, "PUT", "Email request failed");
  actionRedirect(result, "/admin/email-settings");
}

/** Persistent inline feedback for the test form; keep the recipient for retry. */
export async function testEmailSettingsResult(formData: FormData) {
  return adminJsonRequest("/email-settings/test", { to_email: String(formData.get("to_email") ?? "").trim() }, "POST", "Email request failed");
}
