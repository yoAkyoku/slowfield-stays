"use server";

import { authJsonRequest } from "./adminRequest";
import { actionRedirect } from "./adminUtils";

export async function changePasswordAction(formData: FormData) {
  const result = await authJsonRequest(
    "/change-password",
    {
      current_password: String(formData.get("current_password") ?? ""),
      new_password: String(formData.get("new_password") ?? "")
    },
    "Password change failed"
  );
  actionRedirect(result, "/admin/account");
}
