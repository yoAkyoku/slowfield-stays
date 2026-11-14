import Link from "next/link";
import { ArrowRight, BookOpenText, Building2, Check, CircleDashed, ClipboardCheck, FilePlus2, Inbox, Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import { getLocale, t } from "../../modules/i18n";
import {
  getAdminBanners,
  getAdminDashboard,
  getAdminEmailSettings,
  getAdminPagesAll,
  getAdminProfile,
  getAdminSites,
  getAdminStays,
  getAdminSystemReadiness,
  hasPermission,
  getNewsletterCampaigns,
  getNewsletterSubscribers
} from "../modules/adminApi";
import StatusBadge from "../modules/StatusBadge";
import AdminTaskLinks from "../modules/AdminTaskLinks";
import AdminEmptyState from "../modules/AdminEmptyState";
import { ActionTile, Badge, ButtonLink, Card, Grid, ListRow, ListRows, Page, PageHeader, Progress, StatCard, Stack } from "../ui";

function settingValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function AdminDashboardPage() {
  const locale = await getLocale();
  const copy = t(locale);
  const profile = await getAdminProfile();
  const canReadSystem = hasPermission(profile.permissions, "site_users:read");
  const canReadStays = hasPermission(profile.permissions, "stays:read");
  const canReadCms = hasPermission(profile.permissions, "cms:read");
  const canReadInquiries = hasPermission(profile.permissions, "inquiries:read");
  const canReadNewsletter = hasPermission(profile.permissions, "newsletter:read");
  const canReadMedia = hasPermission(profile.permissions, "media:read");

  if (!canReadSystem) {
    return <main className="admin-page"><AdminTaskLinks zh={locale === "zh"} permissions={profile.permissions} />
      <h1>{locale === "zh" ? "你的工作區" : "Your workspace"}</h1>
      <nav className="admin-task-links" aria-label={locale === "zh" ? "可檢視內容" : "Available content"}>
        {canReadCms && <Link href="/admin/cms">{locale === "zh" ? "文章工作台" : "Articles"}</Link>}
        {canReadCms && <Link href="/admin/publishing">{locale === "zh" ? "發布待辦" : "Publishing tasks"}</Link>}
        {canReadStays && <Link href="/admin/stays">{locale === "zh" ? "住宿管理" : "Stays"}</Link>}
        {canReadMedia && <Link href="/admin/media">{locale === "zh" ? "共用素材" : "Media"}</Link>}
        {canReadNewsletter && <Link href="/admin/newsletter">{locale === "zh" ? "電子報" : "Newsletter"}</Link>}
        {canReadInquiries && <Link href="/admin/inquiries">{locale === "zh" ? "詢問紀錄" : "Inquiries"}</Link>}
      </nav></main>;
  }

  const [dashboard, system, sites, stays, pages, banners, emailSettings, subscribers, campaigns] = await Promise.all([
    getAdminDashboard(),
    canReadSystem
      ? getAdminSystemReadiness()
      : Promise.resolve({
          environment: "limited",
          site: { id: 0, slug: "", name: "" },
          qa_status: {},
          qa_note: "",
          qa_decision: "pending" as const,
          checks: []
        }),
    canReadSystem ? getAdminSites() : Promise.resolve([]),
    canReadStays ? getAdminStays() : Promise.resolve([]),
    canReadCms ? getAdminPagesAll() : Promise.resolve([]),
    canReadCms ? getAdminBanners() : Promise.resolve([]),
    canReadSystem
      ? getAdminEmailSettings()
      : Promise.resolve({
          smtp_host: "",
          smtp_port: 587,
          smtp_username: "",
          has_password: false,
          from_email: "",
          from_name: "",
          use_tls: true,
          is_enabled: false
        }),
    canReadNewsletter ? getNewsletterSubscribers() : Promise.resolve([]),
    canReadNewsletter ? getNewsletterCampaigns() : Promise.resolve([])
  ]);

  const localCopy =
    locale === "zh"
      ? {
          heroKicker: "Operations cockpit",
          heroTitle: "營運總覽控制台",
          heroText: "把每日營運、待審內容與上線前準備收斂到一個工作台。先處理今天真的需要決策的項目，再進入各模組完成細節。",
          siteLabel: "目前網站",
          environmentLabel: "環境",
          decisionLabel: "上線決策",
          metrics: [
            ["新詢問", "先回應新的旅客需求與待追蹤詢問。"],
            ["待審內容", "住宿與內容頁正在等待最後審核。"],
            ["已發布住宿", "目前前台已上線、需要持續巡檢的住宿。"],
            ["近期登入", "近期後台登入活動，用來追蹤安全與交接。"]
          ],
          collaborationKicker: "Review and handoff",
          reviewTitle: "待審項目",
          reviewText: "快速看過今天需要決策的內容，直接跳到對應編輯頁處理。",
          reviewEmpty: "目前沒有待審項目。",
          reviewOpen: "前往處理",
          reviewKind: {
            stay: "住宿",
            page: "內容頁"
          },
          workspacesTitle: "核心工作區",
          workspacesText: "四個日常最常切換的模組放在同一區，不再分散在不同提示卡裡。",
          workspaces: {
            sites: ["站台網路", "管理母子網站、網域、聯絡與站點設定。"],
            cms: ["內容工作台", "整理 Banner、內容頁、SEO 與待完善項目。"],
            bookings: ["表單聯絡", "集中查看訂房請求與一般詢問，以及後續聯繫狀態。"],
            newsletter: ["電子報", "管理訂閱名單、活動與寄送進度。"]
          },
          readinessKicker: "Launch readiness",
          readinessTitle: "第一版上線摘要",
          readinessText: "這裡只保留上線前最重要的摘要。完整檢查與 QA 紀錄仍留在 readiness 工作台。",
          readinessOpen: "展開上線摘要",
          readinessClose: "收合",
          readinessAction: "前往完整上線檢查",
          readinessStatusReady: "已就緒",
          readinessStatusMissing: "待補",
          readinessSummary: {
            content: ["內容齊備", "已經有可公開的 Banner、內容頁與住宿。"],
            email: ["寄信可用", "SMTP 已完成，能進行通知與測試寄送。"],
            multisite: ["多站切換", "至少已有兩個網站可供隔離測試與切換管理。"],
            newsletter: ["電子報基線", "已有訂閱名單與活動可供內部測試。"],
            compliance: ["法規與輸出", "站點已有 SEO、Cookie 與隱私通知基礎資料。"],
            launch: ["正式上線前檢查", "已經留下明確的 QA 決策與上線備註。"]
          },
          readinessProgress: "整體準備度",
          readinessDecision: {
            pending: "待確認",
            ready: "可上線",
            conditional: "條件上線",
            blocked: "暫停上線"
          }
        }
      : {
          heroKicker: "Operations cockpit",
          heroTitle: "Operating overview",
          heroText:
            "Bring daily operations, review work, and launch preparation into one workspace. Start with today's decisions, then move into the right module without hunting across the admin.",
          siteLabel: "Current site",
          environmentLabel: "Environment",
          decisionLabel: "Launch decision",
          metrics: [
            ["New inquiries", "Respond to new guest demand and follow-up requests first."],
            ["Content in review", "Stay profiles and editorial pages waiting for final approval."],
            ["Published stays", "Live listings that still need routine inspection on the public site."],
            ["Recent logins", "Recent back-office sign-ins used for security and handoff checks."]
          ],
          collaborationKicker: "Review and handoff",
          reviewTitle: "Review queue",
          reviewText: "Preview the items waiting for a decision and jump straight into the correct editor.",
          reviewEmpty: "No items are waiting for review.",
          reviewOpen: "Open item",
          reviewKind: {
            stay: "Stay",
            page: "Page"
          },
          workspacesTitle: "Core workspaces",
          workspacesText: "Keep the four daily operating modules in one place instead of scattering them across small prompt cards.",
          workspaces: {
            sites: ["Site network", "Manage parent and child sites, domains, contact settings, and site defaults."],
            cms: ["Content workspace", "Handle banners, pages, SEO, and unresolved content issues."],
            bookings: ["Booking queue", "Review inquiries, booking requests, and follow-up status in one place."],
            newsletter: ["Newsletter", "Manage subscribers, campaigns, and outbound delivery progress."]
          },
          readinessKicker: "Launch readiness",
          readinessTitle: "First-release readiness summary",
          readinessText:
            "Keep only the most important launch signals here. The full QA and release worksheet still lives in the readiness workspace.",
          readinessOpen: "Expand launch summary",
          readinessClose: "Collapse",
          readinessAction: "Open full launch readiness",
          readinessStatusReady: "Ready",
          readinessStatusMissing: "Needs setup",
          readinessSummary: {
            content: ["Content coverage", "Published banners, editorial pages, and stay listings exist for the public site."],
            email: ["Email delivery", "SMTP is configured and ready for notifications or test sends."],
            multisite: ["Multi-site switching", "At least two sites exist for isolation and switching checks."],
            newsletter: ["Newsletter baseline", "Subscribers and campaigns exist for internal send tests."],
            compliance: ["Compliance output", "The site has SEO, cookie, and privacy baseline data."],
            launch: ["Launch review", "A QA decision and handoff note have been recorded."]
          },
          readinessProgress: "Overall readiness",
          readinessDecision: {
            pending: "Pending",
            ready: "Ready",
            conditional: "Conditional",
            blocked: "Blocked"
          }
        };

  const currentSite = sites.find((item) => item.slug === system.site.slug) ?? sites[0];
  const siteSettings = currentSite?.settings ?? {};
  const siteSeo = currentSite?.seo_defaults ?? {};
  const publishedStays = stays.filter((item) => item.status === "published").length;
  const publishedPages = pages.filter((item) => item.status === "published").length;
  const publishedBanners = banners.filter((item) => item.status === "published").length;
  const emailReady = Boolean(emailSettings.is_enabled && emailSettings.smtp_host && emailSettings.from_email && emailSettings.has_password);
  const complianceReady = Boolean(
    settingValue(siteSeo.title) &&
      settingValue(siteSeo.description) &&
      settingValue(siteSettings.cookie_notice) &&
      settingValue(siteSettings.gdpr_notice)
  );

  const workspaceCards = [
    canReadSystem && { href: "/admin/sites", icon: Building2, title: localCopy.workspaces.sites[0], text: localCopy.workspaces.sites[1] },
    canReadCms && { href: "/admin/cms", icon: BookOpenText, title: localCopy.workspaces.cms[0], text: localCopy.workspaces.cms[1] },
    canReadInquiries && { href: "/admin/inquiries?kind=booking", icon: MessageSquareText, title: localCopy.workspaces.bookings[0], text: localCopy.workspaces.bookings[1] },
    canReadNewsletter && { href: "/admin/newsletter", icon: Mail, title: localCopy.workspaces.newsletter[0], text: localCopy.workspaces.newsletter[1] }
  ].filter((card): card is { href: string; icon: typeof Building2; title: string; text: string } => Boolean(card));
  const decisionLabel = localCopy.readinessDecision[system.qa_decision ?? "pending"];
  const zh = locale === "zh";
  const readiness: Array<{ title: string; text: string; ok: boolean; href: string }> = [
    { key: "content", ok: publishedBanners > 0 && publishedPages > 0 && publishedStays > 0, href: "/admin/cms" },
    { key: "email", ok: emailReady, href: "/admin/email-settings" },
    { key: "multisite", ok: sites.length >= 2, href: "/admin/sites" },
    { key: "newsletter", ok: subscribers.length > 0 && campaigns.length > 0, href: "/admin/newsletter" },
    { key: "compliance", ok: complianceReady, href: currentSite ? `/admin/sites/${currentSite.id}` : "/admin/sites" },
    { key: "launch", ok: system.qa_decision === "ready" && Boolean(system.qa_note), href: "/admin/readiness" }
  ].map(({ key, ok, href }) => {
    const [title, text] = localCopy.readinessSummary[key as keyof typeof localCopy.readinessSummary];
    return { title, text, ok, href };
  });
  const readyCount = readiness.filter((item) => item.ok).length;

  const metrics = [
    { label: localCopy.metrics[0][0], hint: localCopy.metrics[0][1], value: dashboard.metrics.new_inquiries, href: "/admin/inquiries", icon: <Inbox />, tone: dashboard.metrics.new_inquiries > 0 ? "warning" : "neutral" },
    { label: localCopy.metrics[1][0], hint: localCopy.metrics[1][1], value: dashboard.metrics.in_review, href: "/admin/publishing", icon: <ClipboardCheck />, tone: dashboard.metrics.in_review > 0 ? "info" : "neutral" },
    { label: localCopy.metrics[2][0], hint: localCopy.metrics[2][1], value: dashboard.metrics.published_stays, href: "/admin/stays?tab=list&status=published", icon: <Building2 />, tone: "success" },
    { label: localCopy.metrics[3][0], hint: localCopy.metrics[3][1], value: dashboard.metrics.recent_logins, href: "/admin/login-audits", icon: <ShieldCheck />, tone: "brand" }
  ] as const;

  return (
    <Page className="admin-dashboard">
      <PageHeader
        eyebrow={currentSite?.name ?? system.site.name}
        title={zh ? `${profile.name || "你好"}，歡迎回來` : `Welcome back${profile.name ? `, ${profile.name}` : ""}`}
        description={localCopy.heroText}
        meta={
          <>
            <span>{localCopy.environmentLabel}：<Badge tone="neutral">{system.environment}</Badge></span>
            <span>{localCopy.decisionLabel}：<Badge tone={system.qa_decision === "ready" ? "success" : system.qa_decision === "blocked" ? "danger" : "warning"} dot>{decisionLabel}</Badge></span>
          </>
        }
        actions={
          <>
            {canReadCms ? <ButtonLink href="/admin/publishing" icon={<ClipboardCheck />}>{zh ? "發布待辦" : "Publishing tasks"}</ButtonLink> : null}
            {canReadCms ? <ButtonLink href="/admin/cms/pages/new" icon={<FilePlus2 />} variant="primary">{zh ? "新增文章" : "New article"}</ButtonLink> : null}
          </>
        }
      />

      <Grid cols={4}>
        {metrics.map((metric) => (
          <StatCard hint={metric.hint} href={metric.href} icon={metric.icon} key={metric.label} label={metric.label} tone={metric.tone} value={metric.value} />
        ))}
      </Grid>

      <AdminTaskLinks zh={zh} siteId={currentSite?.id} permissions={profile.permissions} />

      <div className="a-split">
        <Stack>
          <Card
            id="dashboard-review-queue"
            title={localCopy.reviewTitle}
            description={localCopy.reviewText}
            actions={dashboard.review_queue.length ? <Badge tone="warning">{dashboard.review_queue.length}</Badge> : null}
            flush
          >
            {dashboard.review_queue.length > 0 ? (
              <ListRows>
                {dashboard.review_queue.map((item) => (
                  <ListRow
                    aside={<><span>{localCopy.reviewOpen}</span><ArrowRight /></>}
                    href={item.href}
                    key={`${item.kind}-${item.href}`}
                    meta={<><Badge>{localCopy.reviewKind[item.kind]}</Badge><StatusBadge labels={copy.admin.statusLabels} status={item.status} /></>}
                    title={item.title}
                  />
                ))}
              </ListRows>
            ) : (
              <div className="a-card__body"><AdminEmptyState variant="compact" title={localCopy.reviewEmpty} text={zh ? "送審的住宿與文章會出現在這裡。" : "Stays and pages sent for review appear here."} /></div>
            )}
          </Card>

          <Card title={localCopy.workspacesTitle} description={localCopy.workspacesText}>
            <Grid cols={2}>
              {workspaceCards.map((card) => {
                const Icon = card.icon;
                return <ActionTile href={card.href} icon={<Icon />} key={card.href} text={card.text} title={card.title} trailing={<ArrowRight />} />;
              })}
            </Grid>
          </Card>
        </Stack>

        <Card
          title={localCopy.readinessTitle}
          description={localCopy.readinessText}
          actions={<ButtonLink href="/admin/readiness" size="sm" variant="ghost" icon={<ArrowRight />}>{zh ? "完整檢查" : "Full check"}</ButtonLink>}
        >
          <Stack>
            <Progress label={`${localCopy.readinessProgress} · ${readyCount}/${readiness.length}`} max={readiness.length} tone={readyCount === readiness.length ? "success" : "warning"} value={readyCount} />
            <ul className="a-checklist">
              {readiness.map((item) => (
                <li key={item.title}>
                  <Link href={item.href}>
                    <span className={`a-checklist__mark a-tone--${item.ok ? "success" : "warning"}`}>{item.ok ? <Check /> : <CircleDashed />}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <span className="a-checklist__text">{item.text}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Stack>
        </Card>
      </div>
    </Page>
  );
}
