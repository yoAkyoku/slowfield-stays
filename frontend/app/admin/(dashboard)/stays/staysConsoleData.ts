import type { Stay } from "../../../modules/api";

export type StayWorkspaceTab = "overview" | "list" | "issues";
export type StayVisibility = "active" | "deleted" | "all";
export type AdminStayRecord = Stay & { status: string; deleted_at?: string | null };

/** `missing_title` / `missing_description` were `missing_seo_title` and
 *  `missing_seo_description`. Renamed with the rule in `stayIssueKeys`, which
 *  no longer reports an empty seo column as a defect. */
export type StayIssueKey =
  | "missing_hero"
  | "missing_summary"
  | "missing_rooms"
  | "missing_title"
  | "missing_description";

export type StayIssueRow = {
  id: number;
  name: string;
  destination: string;
  region: string;
  status: string;
  deleted_at?: string | null;
  href: string;
  previewHref: string;
  issues: StayIssueKey[];
};

export function normalizeStayTab(value?: string): StayWorkspaceTab {
  if (value === "list" || value === "issues") return value;
  return "overview";
}

export function normalizeStayVisibility(value?: string): StayVisibility {
  if (value === "deleted" || value === "all") return value;
  return "active";
}

/** Text stored for `field` in any language. `trs` reads the reader's
 *  translation, then the column, then the other locale, so one of the three is
 *  enough for every language version of the page. */
function hasAnyLocale(stay: Partial<AdminStayRecord>, field: "name" | "summary" | "story"): boolean {
  const own = String(stay[field] ?? "").trim();
  if (own) return true;
  return Object.values(stay.translations ?? {}).some((fields) => String(fields?.[field] ?? "").trim().length > 0);
}

/**
 * What this stay is actually missing, judged by what the public routes serve.
 *
 * The last two checks used to read `seo.title` / `seo.description` directly and
 * called every stay that had not overridden them broken — see the same fix and
 * the same reasoning in `cms/cmsConsoleData.ts`. Both stay routes
 * (`(site)/stays/[slug]` and `(site)/stays/detail/[slug]`) build their metadata
 * as
 *
 *     title:       stay.seo.title       || trs(stay, "name", locale)
 *     description: stay.seo.description || trs(stay, "summary", locale)
 *                                       || excerpt(trs(stay, "story", locale))
 *
 * so those columns are overrides, and a stay with a name and a summary already
 * serves correct metadata with both empty. The override is read off the flat
 * `seo` object alone here because that is all the routes read — unlike a CMS
 * page, a stay keeps no per-locale seo_title.
 */
export function stayIssueKeys(stay: Partial<AdminStayRecord>): StayIssueKey[] {
  const issues: StayIssueKey[] = [];
  if (!stay.hero_image_url) issues.push("missing_hero");
  if (!stay.summary) issues.push("missing_summary");
  if (!Array.isArray(stay.room_types) || stay.room_types.length === 0) issues.push("missing_rooms");
  if (!stay.seo?.title && !hasAnyLocale(stay, "name")) issues.push("missing_title");
  if (!stay.seo?.description && !hasAnyLocale(stay, "summary") && !hasAnyLocale(stay, "story")) {
    issues.push("missing_description");
  }
  return issues;
}

export function filterStays(
  stays: AdminStayRecord[],
  {
    destination,
    keyword,
    status
  }: {
    destination?: string;
    keyword?: string;
    status?: string;
  }
) {
  const normalizedKeyword = keyword?.trim().toLowerCase() ?? "";
  const normalizedDestination = destination?.trim().toLowerCase() ?? "";
  const normalizedStatus = status?.trim() ?? "";

  return stays
    .filter((stay) => {
      if (!normalizedKeyword) return true;
      const haystack = [stay.name, stay.summary, stay.destination, stay.region].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalizedKeyword);
    })
    .filter((stay) => {
      if (!normalizedDestination) return true;
      const haystack = [stay.destination, stay.region].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalizedDestination);
    })
    .filter((stay) => !normalizedStatus || stay.status === normalizedStatus);
}

export function buildStayIssueRows(stays: AdminStayRecord[]): StayIssueRow[] {
  return stays
    .map((stay) => ({
      id: stay.id,
      name: stay.name,
      destination: stay.destination,
      region: stay.region,
      status: stay.status,
      deleted_at: stay.deleted_at,
      href: `/admin/stays/${stay.id}/edit`,
      previewHref: `/admin/preview/stays/${stay.id}`,
      issues: stayIssueKeys(stay)
    }))
    .filter((row) => row.issues.length > 0);
}
