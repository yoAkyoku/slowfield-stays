import { notFound } from "next/navigation";
import { getLocale, t } from "../../../../../../modules/i18n";
import { getAdminContentTags, getAdminPage, getAdminPagesAll, getAdminSites, getAdminStays, getCurrentAdminSiteSlug, getAdminProfile, hasPermission } from "../../../../../modules/adminApi";
import { deletePageAction, restorePageAction, updatePageAction } from "../../../../../modules/cmsActions";
import PageForm from "../../../PageForm";
import { siteContentTypesFromConfig } from "../../../../../modules/siteContentTypes";

export default async function EditCmsPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string; notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const copy = t(await getLocale());
  const profile = await getAdminProfile();
  const [page, allStays, sites, contentTags, allPages] = await Promise.all([
    getAdminPage(params.id),
    hasPermission(profile.permissions, "stays:read") ? getAdminStays() : Promise.resolve([]),
    getAdminSites(),
    getAdminContentTags(true),
    getAdminPagesAll(),
  ]);

  if (!page) {
    notFound();
  }

  const stays = allStays.map((s) => ({ id: s.id, name: s.name, destination: s.destination, hero_image_url: s.hero_image_url }));
  const currentSlug = await getCurrentAdminSiteSlug();
  const currentSite = sites.find((s) => s.slug === currentSlug) ?? sites[0];
  const siteContentTypes = siteContentTypesFromConfig(currentSite);

  return (
    <PageForm
      action={updatePageAction.bind(null, params.id)}
      deleteAction={deletePageAction.bind(null, params.id, `/admin/cms/pages/${params.id}/edit`)}
      flash={searchParams}
      isDeleted={Boolean(page?.deleted_at)}
      page={page}
      restoreAction={restorePageAction.bind(null, params.id, `/admin/cms/pages/${params.id}/edit`)}
      returnTo={`/admin/cms/pages/${params.id}/edit`}
      stays={stays}
      submitLabel={copy.admin.adminSavePage}
      title={copy.admin.adminEditPage}
      siteContentTypes={siteContentTypes}
      siteDefaultLocale={currentSite?.default_locale}
      contentTags={contentTags}
      site={currentSite}
      allPages={allPages}
    />
  );
}
