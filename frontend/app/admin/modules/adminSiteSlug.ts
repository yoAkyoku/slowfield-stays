import { cookies } from "next/headers";

/** The site the admin is working on, from the `admin-site` cookie. The admin
 *  API helpers and the admin request helpers each read it with their own copy. */
export async function currentSiteSlug(): Promise<string> {
  return (await cookies()).get("admin-site")?.value ?? "slowfield";
}
