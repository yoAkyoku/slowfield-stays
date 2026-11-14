import { notFound } from "next/navigation";
import { getAdminStay } from "../../../modules/adminApi";
import { getCurrentSite } from "../../../../modules/api";
import { fontVars, layoutVars, typeScaleVars, themeVars } from "../../../../modules/fontPresets";
import StayDetailView from "../../../../modules/stays/StayDetailView";

/**
 * Live preview of a stay, drawn by the component that renders the real page.
 *
 * This used to be a hand-written approximation: a hero image, the name, and one
 * paragraph of the story. Rooms, amenities, the FAQ, the gallery, the map and
 * the booking bar — the parts an editor most needs to check before publishing —
 * were simply absent, and the whole thing sat inside (dashboard), wrapped in the
 * admin sidebar. Sharing StayDetailView with /stays/[slug] means what is shown
 * here is what visitors get, and it cannot drift.
 *
 * Fetched through the admin API rather than the public one because the point is
 * to look at a stay before it is published, and the public route serves only
 * published rows. Lives under /admin/ so middleware requires an admin token,
 * and outside (dashboard) so it carries no admin chrome.
 */
export default async function AdminStayPreviewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [stay, site] = await Promise.all([getAdminStay(params.id), getCurrentSite()]);
  if (!stay) notFound();

  return (
    <div
      style={{
        ...themeVars(site.theme_config),
        ...fontVars(site.settings as Record<string, unknown> | undefined),
        ...typeScaleVars(site.settings as Record<string, unknown> | undefined),
        ...layoutVars(site.settings as Record<string, unknown> | undefined),
        fontFamily: "var(--font-body)",
      }}
    >
      <StayDetailView stay={stay} />
    </div>
  );
}
