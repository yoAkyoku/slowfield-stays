import { ExternalLink, Pencil, Plus } from "lucide-react";
import { adminUiText, getLocale, t } from "../../../modules/i18n";
import { getAdminProfile, getAdminSites, hasPermission } from "../../modules/adminApi";
import AdminFlash from "../../modules/AdminFlash";
import AdminSopButton from "../../modules/AdminSopButton";
import AdminEmptyState from "../../modules/AdminEmptyState";
import StatusBadge from "../../modules/StatusBadge";
import { Badge, ButtonLink, Card, ListRow, ListRows, Page, PageHeader, RowActions, TableFrame } from "../../ui";
import DeleteSiteButton from "./DeleteSiteButton";

export default async function AdminSitesPage(
  props: {
    searchParams: Promise<{ error?: string; notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const ui = adminUiText(locale);
  const zh = locale === "zh";
  const [sites, profile] = await Promise.all([getAdminSites(), getAdminProfile()]);
  const canWrite = hasPermission(profile.permissions, "sites:write");
  const settingsAccess = await Promise.all(sites.map(async (site) => {
    try {
      const siteProfile = await getAdminProfile(site.slug);
      return [site.id, hasPermission(siteProfile.permissions, "site_users:read")] as const;
    } catch {
      return [site.id, false] as const;
    }
  }));
  const canReadSiteSettings = new Map(settingsAccess);
  const rootSite = sites.find((s) => !s.parent_site_id);
  // Show ALL sites except the primary root in the child list (includes old root sites without parent_site_id)
  const childSites = sites.filter((s) => s.id !== rootSite?.id);

  return (
    <Page>
      <PageHeader
        eyebrow="Site network"
        title={copy.admin.adminSitesTitle}
        description={
          zh
            ? `共 ${sites.length} 個站台（1 個母站 + ${childSites.length} 個子站）`
            : `${sites.length} sites (1 root + ${childSites.length} children)`
        }
        actions={
          <>
            <AdminSopButton label={copy.admin.adminSitesGuideTitle}>
              <p>{copy.admin.adminSitesGuideText}</p>
              <ol>
                {copy.admin.adminSitesGuideSteps.map(([step, title, text]) => (
                  <li key={step}>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </li>
                ))}
              </ol>
            </AdminSopButton>
            {canWrite && (
              <ButtonLink href="/admin/sites/new" icon={<Plus />} variant="primary">
                {zh ? "新增子站" : "New Child Site"}
              </ButtonLink>
            )}
          </>
        }
      />

      <AdminFlash closeLabel={copy.admin.adminFlashClose} message={searchParams.notice} title={copy.admin.adminFlashSuccess} tone="success" />
      <AdminFlash closeLabel={copy.admin.adminFlashClose} message={searchParams.error} title={copy.admin.adminFlashError} tone="error" />

      {/* Root site card */}
      {rootSite && (
        <Card>
          <ListRows>
            <ListRow
              title={
                <>
                  <Badge tone="brand">{zh ? "母站" : "Root Site"}</Badge> {rootSite.name}
                </>
              }
              meta={<code>/stays/{rootSite.slug}</code>}
              aside={
                <span className="a-toolbar__end">
                  {canReadSiteSettings.get(rootSite.id) && (
                    <ButtonLink href={`/admin/sites/${rootSite.id}`} icon={<Pencil />} size="sm">
                      {copy.admin.adminEdit}
                    </ButtonLink>
                  )}
                  <ButtonLink external href={`/stays/${rootSite.slug}`} icon={<ExternalLink />} rel="noopener noreferrer" size="sm" target="_blank" variant="ghost">
                    {copy.admin.adminPreviewSite}
                  </ButtonLink>
                </span>
              }
            />
          </ListRows>
        </Card>
      )}

      {/* Child sites table */}
      <Card flush title={zh ? `子站列表（${childSites.length}）` : `Child Sites (${childSites.length})`}>
        {childSites.length > 0 ? (
          /* TableFrame scrolls sideways and a-table sizes columns to content,
             so the name and slug never collapse at 375px. */
          <TableFrame>
          <table className="a-table">
            <thead>
              <tr>
                <th>{copy.admin.adminSiteName}</th>
                <th>Slug</th>
                <th>{copy.admin.adminStatus}</th>
                <th className="is-shrink">{zh ? "操作" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {childSites.map((site) => (
                <tr key={site.id}>
                  <td><strong>{site.name}</strong></td>
                  <td><code>/stays/{site.slug}</code></td>
                  <td>
                    <StatusBadge status={site.status} />
                  </td>
                  <td className="is-shrink">
                    <RowActions>
                      {canReadSiteSettings.get(site.id) ? (
                        <ButtonLink href={`/admin/sites/${site.id}`} icon={<Pencil />} size="sm">
                          {copy.admin.adminEdit}
                        </ButtonLink>
                      ) : (
                        <span className="admin-public-state">
                          {zh ? "無設定權限" : "No settings access"}
                        </span>
                      )}
                      {canWrite && (
                        <DeleteSiteButton siteId={String(site.id)} siteName={site.name} zh={zh} />
                      )}
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableFrame>
        ) : (
          <AdminEmptyState
            text={zh ? "尚無子站。點擊「新增子站」來建立第一個子站。" : "No child sites yet. Click 'New Child Site' to create one."}
            title={zh ? "尚無子站" : "No child sites"}
            variant="compact"
          />
        )}
      </Card>
    </Page>
  );
}
