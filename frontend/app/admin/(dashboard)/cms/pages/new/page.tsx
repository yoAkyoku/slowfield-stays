import { getLocale, t } from "../../../../../modules/i18n";
import { getAdminContentTags, getAdminPagesAll, getAdminSites, getAdminStays, getCurrentAdminSiteSlug, getAdminProfile, hasPermission } from "../../../../modules/adminApi";
import { createPageAction } from "../../../../modules/cmsActions";
import PageForm from "../../PageForm";
import { siteContentTypesFromConfig } from "../../../../modules/siteContentTypes";

export default async function NewCmsPage(props: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const searchParams = await props.searchParams;
  const copy = t(await getLocale());
  const profile = await getAdminProfile();
  const [allStays, sites, contentTags, allPages] = await Promise.all([hasPermission(profile.permissions, "stays:read") ? getAdminStays() : Promise.resolve([]), getAdminSites(), getAdminContentTags(true), getAdminPagesAll()]);
  const stays = allStays.map((s) => ({ id: s.id, name: s.name, destination: s.destination, hero_image_url: s.hero_image_url }));
  const currentSlug = await getCurrentAdminSiteSlug();
  const currentSite = sites.find((s) => s.slug === currentSlug) ?? sites[0];
  const siteContentTypes = siteContentTypesFromConfig(currentSite);

  return (
    <PageForm
      action={createPageAction}
      flash={searchParams}
      returnTo="/admin/cms/pages/new"
      stays={stays}
      title={copy.admin.adminCreatePage}
      siteContentTypes={siteContentTypes}
      siteDefaultLocale={currentSite?.default_locale}
      contentTags={contentTags}
      site={currentSite}
      allPages={allPages}
    />
  );
}
