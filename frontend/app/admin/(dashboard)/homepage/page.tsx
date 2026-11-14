import { AdminForbiddenError, getAdminContentTags, getAdminProfile, getAdminSites, getCurrentAdminSiteSlug, hasPermission } from "../../modules/adminApi";
import AdminFlash from "../../modules/AdminFlash";
import AdminSopButton from "../../modules/AdminSopButton";
import { getLocale, t } from "../../../modules/i18n";
import { updateHomepageAction } from "../../modules/homepageActions";
import HomepageBlockEditor, { BLOCK_LABELS } from "./HomepageBlockEditor";
import type { HomepageBlock } from "../../../modules/home/HomepageBlocks";
import { Callout, Page, PageHeader } from "../../ui";

const DEFAULT_EDITOR_BLOCKS: HomepageBlock[] = [
  { id: "flow", type: "flow", enabled: true, config: {} },
  { id: "stays", type: "stays", enabled: true, config: {} },
  { id: "gallery", type: "gallery", enabled: true, config: {} },
  { id: "pathways", type: "pathways", enabled: true, config: {} },
  { id: "editorial", type: "editorial", enabled: true, config: {} },
];

export default async function HomepageEditorPage(
  props: {
    searchParams: Promise<{ error?: string; notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const copy = t(locale);
  const [sites, profile, contentTags] = await Promise.all([
    getAdminSites(),
    getAdminProfile(),
    getAdminContentTags(true),
  ]);
  if (!hasPermission(profile.permissions, "cms:read")) throw new AdminForbiddenError();
  const currentSlug = await getCurrentAdminSiteSlug();
  const site = sites.find((s) => s.slug === currentSlug) ?? sites[0] ?? null;
  const zh = locale === "zh";

  const hp = (site?.settings?.homepage ?? {}) as { blocks?: unknown[] };
  const rawBlocks = Array.isArray(hp.blocks) && hp.blocks.length > 0
    ? (hp.blocks as HomepageBlock[])
    : DEFAULT_EDITOR_BLOCKS;

  // Ensure all blocks have a config object
  const initialBlocks = rawBlocks.map(b => ({
    id: b.id,
    type: b.type,
    enabled: b.enabled !== false,
    config: (b.config ?? {}) as Record<string, unknown>,
  }));

  return (
    <Page>
      <PageHeader
        actions={
          <AdminSopButton label={zh ? "版塊類型說明" : "Block types"}>
            <p style={{ fontSize: 12, lineHeight: 1.7 }}>
              {zh
                ? "拖曳版塊左側握把即可像積木一樣調整堆疊順序，點擊版塊在右側面板編輯內容，眼睛圖示控制顯示與隱藏。"
                : "Drag the handle on a block to restack it like a building piece. Click a block to edit its content in the right panel. The eye icon shows or hides it."}
            </p>
            <ol>
              {Object.entries(BLOCK_LABELS).map(([key, [zhLabel, enLabel]]) => (
                <li key={key}><strong>{zh ? zhLabel : enLabel}</strong></li>
              ))}
            </ol>
          </AdminSopButton>
        }
        description={
          zh
            ? "拖曳版塊像積木一樣自由組合首頁，點擊即可編輯，即時反映到前台首頁"
            : "Snap blocks together like building pieces, click to edit, and publish straight to the homepage"
        }
        title={zh ? "首頁版塊編輯" : "Homepage Blocks"}
      />
      <AdminFlash
        closeLabel={copy.admin.adminFlashClose}
        message={searchParams.notice}
        title={copy.admin.adminFlashSuccess}
        tone="success"
      />
      <AdminFlash
        closeLabel={copy.admin.adminFlashClose}
        message={searchParams.error}
        title={copy.admin.adminFlashError}
        tone="error"
      />
      {site ? (
        <HomepageBlockEditor
          action={updateHomepageAction}
          initialBlocks={initialBlocks}
          locale={locale}
          site={site}
          contentTags={contentTags}
          /* updateHomepageAction redirects on failure as well as on success, so
             the editor comes back holding the last SAVED homepage. This is the
             flag that tells it to put the rejected attempt back instead. */
          saveFailed={Boolean(searchParams.error)}
        />
      ) : (
        <Callout tone="warning">{zh ? "找不到站台資料，請先切換站台。" : "No site found. Please switch to a site first."}</Callout>
      )}
    </Page>
  );
}
