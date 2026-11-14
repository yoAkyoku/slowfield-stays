"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type LoginResult = { ok: true } | { ok: false; error: string };

/** Seconds until the token itself expires, read from its own `exp` claim.
 *
 * The cookie used to carry a hardcoded 12 hours while the backend issued
 * 7-day tokens. Two numbers, two files, one of them wrong: the session ended
 * at 12 hours, and a token captured in the meantime stayed valid for another
 * six and a half days after the cookie that held it was gone.
 *
 * Reading `exp` makes the cookie expire exactly when the credential does, so
 * changing the lifetime is a one-line change in backend config and the two
 * cannot drift again. The payload is only decoded, never trusted — it arrived
 * from our own API over this request, and the backend verifies the signature on
 * every call regardless. A malformed or missing claim falls back to a session
 * cookie, which is the safe direction: it dies when the browser closes.
 */
function secondsUntilExpiry(token: string): number | undefined {
  const payload = token.split(".")[1];
  if (!payload) return undefined;
  try {
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    if (typeof exp !== "number" || !Number.isFinite(exp)) return undefined;
    const seconds = Math.floor(exp - Date.now() / 1000);
    // An already-expired token would set a cookie that deletes itself; leave it
    // to the API's own 401 to surface that rather than silently signing nobody in.
    return seconds > 0 ? seconds : undefined;
  } catch {
    return undefined;
  }
}

export async function loginAction(email: string, password: string): Promise<LoginResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, error: "Network error" };
  }
  if (!response.ok) {
    return { ok: false, error: "Invalid credentials" };
  }
  const data = (await response.json()) as { access_token: string };

  (await cookies()).set("admin-token", data.access_token, {
    path: "/",
    maxAge: secondsUntilExpiry(data.access_token),
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete("admin-token");
  (await cookies()).delete("admin-site");
  redirect("/admin/login");
}
