import { cookies } from "next/headers";

const API_URL =
  process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Whether the person asking is a signed-in admin, and may therefore see a site
 * that is not published yet.
 *
 * A draft villa is built before it goes live, which means somebody has to be
 * able to look at it. Refusing drafts on the public routes — correct, and the
 * point of the status — took the last way of doing that away with it: the villa
 * route 404s a draft and the `?site=` override refuses one too, so a site could
 * be created, filled in, and never seen until the moment it was published to
 * the world. Making publishing the only way to preview is how a half-finished
 * villa ends up briefly public.
 *
 * The token is verified against the backend rather than merely present: a
 * cookie called `admin-token` is trivial to set, and "is this reader an admin"
 * is the whole question being asked. Only reached when a site is actually a
 * draft, so ordinary traffic never pays for the round trip.
 */
export async function isAdminPreview(): Promise<boolean> {
  const token = (await cookies()).get("admin-token")?.value;
  if (!token) return false;
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    // The backend being unreachable is not a reason to serve unpublished work.
    return false;
  }
}
