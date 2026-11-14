import { ArrowLeft } from "lucide-react";
import { ButtonLink, Page, PageHeader } from "../../../ui";
import "../newsletter.css";
import { adminUiText, getLocale } from "../../../../modules/i18n";
import { AdminForbiddenError, getAdminProfile, hasPermission, getAdminSites, getCurrentAdminSiteSlug } from "../../../modules/adminApi";
import { createCampaignAction } from "../../../modules/newsletterActions";
import ComposePanel from "../panels/ComposePanel";

export default async function NewCampaignPage() {
  const profile = await getAdminProfile();
  if (!hasPermission(profile.permissions, "newsletter:write")) throw new AdminForbiddenError();
  const locale = await getLocale();
  const ui = adminUiText(locale);
  const zh = locale === "zh";

  // A parent site has no parent_site_id; only parent campaigns can opt to
  // fan out to child subscribers, so this drives the radio in ComposePanel.
  const [sites, currentSlug] = await Promise.all([getAdminSites(), Promise.resolve(getCurrentAdminSiteSlug())]);
  const currentSite = sites.find((s) => s.slug === currentSlug);
  const isParentSite = currentSite ? !currentSite.parent_site_id : false;

  return (
    <Page className="nl-detail-page" width="wide">
      <PageHeader
        eyebrow="Newsletter"
        title={ui.newsletter.createCampaign}
        description={zh ? "撰寫內容，右側即時預覽" : "Write content, preview on the right"}
        actions={
          <ButtonLink href="/admin/newsletter" icon={<ArrowLeft />}>
            {zh ? "返回電子報" : "Back to newsletter"}
          </ButtonLink>
        }
      />

      <ComposePanel
        copy={ui.newsletter}
        createCampaignAction={createCampaignAction}
        zh={zh}
        isParentSite={isParentSite}
        siteSlug={currentSlug ?? ""}
      />
    </Page>
  );
}
