"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Callout, Field, Input } from "../ui";
import { PUBLIC_API_URL as API_URL } from "../../modules/apiBase";

type ResetLabels = {
  adminNewPassword: string;
  adminSave: string;
  loginBack: string;
  loginConfirmPassword: string;
  loginPasswordMismatch: string;
  loginResetComplete: string;
  loginResetFailed: string;
  loginResetInvalid: string;
  loginResetPassword: string;
  loginSaving: string;
};

export default function ResetPasswordForm({ labels, token }: { labels: ResetLabels; token: string }) {
  const router = useRouter();
  const [error, setError] = useState(token ? "" : labels.loginResetInvalid);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitReset(formData: FormData) {
    if (!token) {
      setError(labels.loginResetInvalid);
      return;
    }
    const newPassword = String(formData.get("new_password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");
    if (newPassword !== confirmPassword) {
      setError(labels.loginPasswordMismatch);
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);
    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
    } catch {
      setLoading(false);
      setError(labels.loginResetFailed);
      return;
    }
    setLoading(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError((data as { detail?: string }).detail ?? labels.loginResetFailed);
      return;
    }
    setNotice(labels.loginResetComplete);
    window.setTimeout(() => router.push("/admin/login"), 1500);
  }

  return (
    <form className="a-auth__form" aria-busy={loading} action={submitReset}>
      <Field label={labels.adminNewPassword}>
        <Input
          name="new_password"
          type="password"
          minLength={8}
          placeholder={labels.adminNewPassword}
          autoComplete="new-password"
          required
        />
      </Field>
      <Field label={labels.loginConfirmPassword}>
        <Input
          name="confirm_password"
          type="password"
          minLength={8}
          placeholder={labels.loginConfirmPassword}
          autoComplete="new-password"
          required
        />
      </Field>
      <Button variant="primary" size="lg" block type="submit" disabled={loading || !token}>
        {loading ? (
          <>
            <span className="admin-spinner" />
            {labels.loginSaving}
          </>
        ) : (
          labels.loginResetPassword
        )}
      </Button>
      <div className="a-auth__links">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/login")}>
          {labels.loginBack}
        </Button>
      </div>
      {notice && <Callout tone="success">{notice}</Callout>}
      {error && <Callout tone="danger">{error}</Callout>}
    </form>
  );
}
