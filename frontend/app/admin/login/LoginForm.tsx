"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginAction } from "../modules/authActions";
import { Button, Callout, Field, Input, buttonClass } from "../ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type LoginLabels = {
  loginBack: string;
  loginFailed: string;
  loginForgotTitle: string;
  loginForgotText: string;
  loginForgot: string;
  loginPassword: string;
  loginEmail: string;
  loginReset: string;
  loginResetFailed: string;
  loginResetLink: string;
  loginResetSent: string;
  loginSending: string;
  loginSignIn: string;
  loginSigningIn: string;
};

export default function LoginForm({ initialNotice = "", labels }: { initialNotice?: string; labels: LoginLabels }) {
  const router = useRouter();
  const [error, setError] = useState<"" | "loginFailed" | "loginResetFailed">("");
  const [notice, setNotice] = useState<"" | "initial" | "resetSent">(initialNotice ? "initial" : "");
  const noticeText = notice === "resetSent" ? labels.loginResetSent : notice === "initial" ? initialNotice : "";
  const [resetUrl, setResetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"login" | "forgot">("login");

  async function submitLogin(formData: FormData) {
    const submittedEmail = String(formData.get("email") ?? "");
    setEmail(submittedEmail);
    setError("");
    setNotice("");
    setResetUrl("");
    setLoading(true);

    const result = await loginAction(
      submittedEmail,
      String(formData.get("password") ?? ""),
    );

    setLoading(false);
    if (!result.ok) {
      setError("loginFailed");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  async function submitForgotPassword(formData: FormData) {
    const submittedEmail = String(formData.get("email") ?? "");
    setEmail(submittedEmail);
    setError("");
    setNotice("");
    setResetUrl("");
    setLoading(true);
    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail })
      });
    } catch {
      setLoading(false);
      setError("loginResetFailed");
      return;
    }
    setLoading(false);
    if (!response.ok) {
      setError("loginResetFailed");
      return;
    }
    const data = (await response.json()) as { reset_url?: string };
    setNotice("resetSent");
    setResetUrl(data.reset_url ?? "");
  }

  const notices = noticeText ? <Callout live="status" tone={notice === "resetSent" ? "success" : "info"}>{noticeText}</Callout> : null;
  const errors = error ? <Callout live="alert" tone="danger">{labels[error]}</Callout> : null;

  if (mode === "forgot") {
    return (
      <form className="a-auth__form" aria-busy={loading} action={submitForgotPassword}>
        <div className="a-auth__intro">
          <strong>{labels.loginForgotTitle}</strong>
          <p>{labels.loginForgotText}</p>
        </div>
        <Field label={labels.loginEmail}>
          <Input name="email" type="email" aria-label={labels.loginEmail} autoComplete="username" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Button variant="primary" size="lg" block type="submit" disabled={loading}>
          {loading ? <><span className="admin-spinner" />{labels.loginSending}</> : labels.loginReset}
        </Button>
        <div className="a-auth__links">
          <Button variant="ghost" size="sm" onClick={() => { setError(""); setNotice(""); setMode("login"); }}>
            {labels.loginBack}
          </Button>
        </div>
        {notices}
        {resetUrl && process.env.NODE_ENV === "development" ? (
          <a className={buttonClass({ variant: "secondary", size: "sm", block: true })} href={resetUrl}>
            {labels.loginResetLink}
          </a>
        ) : null}
        {errors}
      </form>
    );
  }

  return (
    <form className="a-auth__form" aria-busy={loading} action={submitLogin}>
      <Field label={labels.loginEmail}>
        <Input name="email" type="email" aria-label={labels.loginEmail} autoComplete="username" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </Field>
      <Field label={labels.loginPassword}>
        <Input name="password" type="password" aria-label={labels.loginPassword} autoComplete="current-password" placeholder={labels.loginPassword} required />
      </Field>
      <Button variant="primary" size="lg" block type="submit" disabled={loading}>
        {loading ? <><span className="admin-spinner" />{labels.loginSigningIn}</> : labels.loginSignIn}
      </Button>
      <div className="a-auth__links">
        <Button variant="ghost" size="sm" onClick={() => { setError(""); setNotice(""); setMode("forgot"); }}>
          {labels.loginForgot}
        </Button>
      </div>
      {notices}
      {errors}
    </form>
  );
}
