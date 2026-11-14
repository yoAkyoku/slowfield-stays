"use server";

import { cookies } from "next/headers";

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

export async function setAdminSiteCookie(slug: string) {
  if (!SAFE_SLUG.test(slug)) {
    throw new Error("Invalid site slug");
  }
  (await cookies()).set("admin-site", slug, { path: "/", maxAge: 2592000, sameSite: "lax", httpOnly: true });
}

/* Recovery from a cookie pointing at a site that no longer resolves. Without
   the cookie every admin fetch falls back to the default site, which is enough
   to get `/sites` answering again — from there the SiteSwitcher lists whatever
   this admin can actually reach. The token stays valid; only the site choice is
   discarded, so this is not a logout. */
export async function clearAdminSiteCookie() {
  (await cookies()).delete("admin-site");
}
