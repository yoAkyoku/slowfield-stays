import { redirect } from "next/navigation";

/**
 * 預約隊列 was merged into 表單聯絡.
 *
 * The public forms post to /inquiries or /booking-requests depending on whether
 * a stay happened to be attached — an internal detail no visitor ever sees. Two
 * admin inboxes for one stream meant an operator had to guess which page a
 * message landed in. The merged list carries a badge instead.
 *
 * Kept as a redirect rather than deleted: this path is bookmarked, linked from
 * older notices, and was the dashboard's booking quick-action for a long time.
 *
 * redirect(), not permanentRedirect(): a 308 is cached by the browser more or
 * less forever, so reversing this merge later would leave every operator who
 * ever opened the old URL unable to reach it again without clearing their
 * cache. A route reorganisation inside a signed-in admin is not worth that.
 */
export default async function BookingRequestsPage(
  props: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const searchParams = await props.searchParams;
  const carried = new URLSearchParams();
  for (const key of ["status", "keyword", "visibility", "page"]) {
    const value = searchParams[key];
    if (typeof value === "string" && value) carried.set(key, value);
  }
  // Land on the booking half of the merged inbox, so the redirect shows what
  // this URL always showed rather than dropping the reader into everything.
  carried.set("kind", "booking");
  redirect(`/admin/inquiries?${carried.toString()}`);
}
