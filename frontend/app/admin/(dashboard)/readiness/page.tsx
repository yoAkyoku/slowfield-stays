import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  CircleDashed,
  Monitor,
  ShieldCheck,
  Smartphone,
  Tablet,
  TerminalSquare
} from "lucide-react";
import { getLocale } from "../../../modules/i18n";
import { AdminFlashes } from "../../modules/AdminFlash";
import ReadinessReportActions from "./ReadinessReportActions";
import {
  ActionTile,
  Badge,
  ButtonLink,
  Callout,
  Card,
  DescriptionList,
  Field,
  FormActions,
  Grid,
  ListRow,
  ListRows,
  Page,
  PageHeader,
  Select,
  StatCard,
  Textarea,
  Toolbar,
  buttonClass
} from "../../ui";
import "./readiness.css";
import {
  AdminForbiddenError,
  getAdminBanners,
  getAdminEmailSettings,
  getAdminMediaSummary,
  getAdminPagesAll,
  getAdminProfile,
  getAdminSites,
  getAdminSystemReadiness,
  getAdminStays,
  getAdminUsers,
  getNewsletterCampaigns,
  getNewsletterSubscribers,
  hasPermission
} from "../../modules/adminApi";
import SubmitButton from "../../modules/SubmitButton";
import { updateQaNoteAction, updateQaStatusAction } from "../../modules/readinessActions";
import { adCodeSetting, noticeSummary, socialLinksSetting } from "../../modules/readinessSettings";

type ReadinessItem = {
  title: string;
  text: string;
  ok: boolean;
  href: string;
};

const copy = {
  en: {
    kicker: "Launch readiness",
    title: "Pre-publish operating check",
    text: "Use this page before handoff or production deploy. It checks whether the selected site has enough content, delivery setup, and admin coverage to be operated safely.",
    score: "Ready items",
    needsWork: "Needs work",
    open: "Open",
    passed: "Ready",
    missing: "Needs setup",
    sections: {
      site: ["Site network", "At least one site exists and can be selected in the back office."],
      content: ["Published public content", "Published banners, pages, and stays are available for the public website."],
      media: ["Media library", "Images are uploaded through the media library instead of relying on external placeholders."],
      email: ["SMTP readiness", "Email delivery is enabled with sender, host, and saved password."],
      newsletter: ["Newsletter baseline", "Subscribers and campaigns exist for sending tests before production."],
      users: ["Admin coverage", "There is at least one active admin account for handoff and support."]
    },
    systemTitle: "System signals",
    environment: "Environment",
    systemLabels: {
      database: "Database",
      media_storage: "Media storage",
      secret_key: "Secret key",
      frontend_url: "Frontend URL",
      smtp: "SMTP"
    },
    checklistTitle: "Manual QA still required",
    checklist: [
      "Open public pages on desktop and mobile.",
      "Send one booking request and one general inquiry.",
      "Send an SMTP test email to an internal mailbox.",
      "Check sitemap, robots, title, description, canonical, and OG preview.",
      "Create or switch to a child site and verify content isolation."
    ],
    qaTitle: "QA run sheet",
    qaText: "These checks still require a person or browser session. Work through them after the automated readiness cards are green.",
    reportTitle: "Handoff summary",
    reportText: "Copy this summary into the deployment ticket or print it for launch review.",
    print: "Print",
    copy: "Copy summary",
    copied: "Copied",
    reportLabels: {
      site: "Site",
      environment: "Environment",
      readiness: "Readiness",
      qa: "QA",
      systemBlocked: "System blockers"
    },
    blockersTitle: "Open blockers",
    blockerGroups: {
      content: "Content readiness",
      system: "System signals",
      qa: "Manual QA"
    },
    noBlockers: "No open blockers in this group.",
    noteTitle: "QA note",
    noteText: "Record the release decision, residual risks, browser coverage, or deployment handoff notes for this site.",
    notePlaceholder: "Example: Desktop and mobile pages passed. SMTP test pending provider credentials. Recheck OG preview before launch.",
    noteSave: "Save note",
    noteEmpty: "No QA note has been recorded yet.",
    decisionTitle: "Launch decision",
    decisionLabels: {
      pending: "Pending",
      ready: "Ready to launch",
      conditional: "Conditional launch",
      blocked: "Blocked"
    },
    routeTitle: "Browser QA routes",
    routeText: "Open these pages during desktop and mobile QA. Public links use the selected site slug for local preview.",
    routeGroups: {
      public: "Public",
      admin: "Admin",
      seo: "SEO"
    },
    qaGuideTitle: "What QA means here",
    qaGuideText: "QA is the final quality check before launch. It confirms that existing features are usable, stable, isolated by site, and ready to hand off.",
    qaGuideItems: [
      ["Not new feature work", "Do not expand scope during QA. Record issues, fix launch blockers, and keep the release focused."],
      ["Browser and operation checks", "Open the real pages, submit forms, update admin records, switch sites, and verify mobile layouts."],
      ["Launch decision evidence", "Use the checklist, blockers, note, and launch decision so the handoff has a clear record."]
    ],
    qaGroups: [
      {
        title: "Public website",
        items: [
          "Home, stays, detail, content pages, contact, newsletter subscribe and unsubscribe load correctly.",
          "Desktop and mobile layouts have no overlapping text or broken gallery/banner framing.",
          "Chinese/English toggle changes interface copy only; CMS data remains unchanged."
        ]
      },
      {
        title: "Admin operations",
        items: [
          "Login, dashboard, site switching, CMS publish flow, stays, media, inquiries, bookings, newsletter, email settings, users and roles work.",
          "Create, edit, preview, publish, archive, export, upload, copy URL, delete and status-update actions are tested.",
          "Flash alerts appear clearly and do not navigate away from create/edit forms unexpectedly."
        ]
      },
      {
        title: "Isolation and SEO",
        items: [
          "Use at least two sites and confirm content, media, stays, inquiries and newsletters are isolated.",
          "Confirm child-site creation copies the template once and does not overwrite the source.",
          "Check title, description, canonical, OG, JsonLd, sitemap, robots, GA/ad snippets, Cookie/GDPR and popup behavior."
        ]
      },
      {
        title: "Email sending",
        items: [
          "Send one SMTP test email to an internal mailbox.",
          "Create a small internal newsletter group, queue one campaign, process the queue and inspect delivery records.",
          "Open an unsubscribe link and confirm the subscriber is skipped in future sends."
        ]
      }
    ]
  },
  zh: {
    kicker: "上線檢查",
    title: "正式發布前營運檢查",
    text: "交付或部署前先看這一頁。它會檢查目前網站是否具備基本內容、寄信設定與管理帳號，避免上線後才發現資料或設定不完整。",
    score: "已就緒項目",
    needsWork: "待補項目",
    open: "前往",
    passed: "已就緒",
    missing: "需設定",
    sections: {
      site: ["網站網路", "至少已有一個網站，且後台可以切換目前網站。"],
      content: ["公開內容", "首頁 Banner、內容頁與住宿資料已有發布項目。"],
      media: ["媒體庫", "圖片已透過媒體庫上傳，不依賴外部 placeholder。"],
      email: ["SMTP 狀態", "Email 發送已啟用，且寄件人、SMTP host、密碼都已設定。"],
      newsletter: ["Newsletter 基礎", "已有訂閱者與活動，可在正式發送前做測試。"],
      users: ["管理帳號", "至少有一個啟用中的管理員帳號可交付與支援。"]
    },
    systemTitle: "系統信號",
    environment: "環境",
    systemLabels: {
      database: "資料庫",
      media_storage: "媒體儲存",
      secret_key: "Secret key",
      frontend_url: "前台網址",
      smtp: "SMTP"
    },
    checklistTitle: "仍需人工 QA",
    checklist: [
      "用桌面與手機打開公開頁面。",
      "送出一筆住宿詢價與一筆一般聯絡表單。",
      "寄一封 SMTP 測試信到內部信箱。",
      "檢查 sitemap、robots、title、description、canonical 與 OG 預覽。",
      "建立或切換一個子網站，確認內容隔離正確。"
    ],
    qaTitle: "QA 執行清單",
    qaText: "這些項目仍需要人工或瀏覽器實測。建議先讓上方 readiness 卡片通過，再依序跑完這份清單。",
    reportTitle: "交付摘要",
    reportText: "可將這段摘要複製到部署 ticket，或列印給上線審查使用。",
    print: "列印",
    copy: "複製摘要",
    copied: "已複製",
    reportLabels: {
      site: "網站",
      environment: "環境",
      readiness: "準備度",
      qa: "QA",
      systemBlocked: "系統阻擋項"
    },
    blockersTitle: "未完成明細",
    blockerGroups: {
      content: "內容準備度",
      system: "系統信號",
      qa: "人工 QA"
    },
    noBlockers: "此分類目前沒有未完成項目。",
    noteTitle: "QA 備註",
    noteText: "記錄此站的上線結論、剩餘風險、瀏覽器覆蓋範圍或部署交接事項。",
    notePlaceholder: "例：桌機與手機頁面已通過。SMTP 測試待業主提供正式憑證。上線前再檢查 OG 預覽。",
    noteSave: "儲存備註",
    noteEmpty: "目前尚未記錄 QA 備註。",
    decisionTitle: "上線決策",
    decisionLabels: {
      pending: "待確認",
      ready: "可上線",
      conditional: "有條件上線",
      blocked: "暫緩上線"
    },
    routeTitle: "瀏覽器 QA 路由",
    routeText: "桌機與手機 QA 時可直接從這裡開啟頁面。公開頁會帶目前 site slug 方便本機預覽。",
    routeGroups: {
      public: "前台",
      admin: "後台",
      seo: "SEO"
    },
    qaGuideTitle: "這裡的 QA 是什麼",
    qaGuideText: "QA 是上線前的品質檢查，用來確認既有功能真的可用、穩定、多站隔離正確，並且可以交付營運。",
    qaGuideItems: [
      ["不是新增功能", "QA 階段不要擴大需求；只記錄問題、修正上線阻擋項，讓第一版範圍保持清楚。"],
      ["瀏覽器與操作驗收", "實際打開頁面、送表單、更新後台資料、切換網站，並檢查手機版畫面。"],
      ["留下上線依據", "透過勾選清單、未完成明細、QA 備註與上線決策，讓交付紀錄清楚可追。"]
    ],
    qaGroups: [
      {
        title: "公開官網",
        items: [
          "首頁、住宿列表、詳情頁、內容頁、聯絡表單、newsletter 訂閱與取消訂閱都能正常載入。",
          "桌面與手機版沒有文字重疊，Hero、Banner、Gallery 圖片比例正常。",
          "中英文切換只改介面文案，不改 CMS 內容資料。"
        ]
      },
      {
        title: "後台操作",
        items: [
          "登入、Dashboard、網站切換、CMS 發布流程、住宿、媒體、表單聯絡、newsletter、Email 設定、帳號與角色都可操作。",
          "新增、編輯、預覽、發布、封存、匯出、上傳、複製網址、刪除與狀態更新都要測過。",
          "Flash alert 顯示清楚，新增或編輯後不會意外跳離表單。"
        ]
      },
      {
        title: "多站隔離與 SEO",
        items: [
          "至少用兩個 site 測試，確認內容、媒體、住宿、表單聯絡與 newsletter 不會互相混入。",
          "建立子網站後確認只複製一次版型，不會覆蓋模板來源站。",
          "檢查 title、description、canonical、OG、JsonLd、sitemap、robots、GA/ad code、Cookie/GDPR 與 popup。"
        ]
      },
      {
        title: "Email 發送",
        items: [
          "寄一封 SMTP 測試信到內部信箱。",
          "建立內部測試 newsletter 群組，queue 一個 campaign，process queue 後檢查 delivery records。",
          "打開 unsubscribe link，確認之後寄送會跳過該訂閱者。"
        ]
      }
    ]
  }
};

export default async function AdminReadinessPage(
  props: {
    searchParams?: Promise<{ error?: string; notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const c = copy[locale];
  const profile = await getAdminProfile();
  if (!hasPermission(profile.permissions, "site_users:read")) throw new AdminForbiddenError();
  const [sites, stays, banners, pages, mediaSummary, emailSettings, subscribers, campaigns, users, system] = await Promise.all([
    getAdminSites(),
    getAdminStays(),
    getAdminBanners(),
    getAdminPagesAll(),
    getAdminMediaSummary(),
    getAdminEmailSettings(),
    getNewsletterSubscribers(),
    getNewsletterCampaigns(),
    getAdminUsers(),
    getAdminSystemReadiness()
  ]);
  const publishedStays = stays.filter((item) => item.status === "published").length;
  const publishedBanners = banners.filter((item) => item.status === "published").length;
  const publishedPages = pages.filter((item) => item.status === "published").length;
  const emailReady = Boolean(
    emailSettings.is_enabled &&
      emailSettings.smtp_host &&
      emailSettings.from_email &&
      emailSettings.has_password
  );
  const items: ReadinessItem[] = [
    { title: c.sections.site[0], text: c.sections.site[1], ok: sites.length > 0, href: "/admin/sites" },
    {
      title: c.sections.content[0],
      text: c.sections.content[1],
      ok: publishedStays > 0 && publishedBanners > 0 && publishedPages > 0,
      href: "/admin/cms"
    },
    { title: c.sections.media[0], text: c.sections.media[1], ok: mediaSummary.total > 0, href: "/admin/media" },
    { title: c.sections.email[0], text: c.sections.email[1], ok: emailReady, href: "/admin/email-settings" },
    {
      title: c.sections.newsletter[0],
      text: c.sections.newsletter[1],
      ok: subscribers.length > 0 && campaigns.length > 0,
      href: "/admin/newsletter"
    },
    { title: c.sections.users[0], text: c.sections.users[1], ok: users.some((item) => item.status === "active"), href: "/admin/users" }
  ];
  const readyCount = items.filter((item) => item.ok).length;
  const qaStatus = system.qa_status ?? {};
  const qaTotal = c.qaGroups.reduce((total, group) => total + group.items.length, 0);
  const qaDone = c.qaGroups.reduce(
    (total, group, groupIndex) =>
      total + group.items.filter((_, itemIndex) => qaStatus[`qa-${groupIndex}-${itemIndex}`]).length,
    0
  );
  const commandCopy =
    locale === "zh"
      ? {
          title: "工程驗證命令",
          text: "每次改 code 後、設定上線決策前，先跑完這些命令。只有目前分支本機通過時才勾選。",
          done: "已完成",
          pending: "需要執行",
          groups: [
            {
              title: "Backend",
              items: [
                ["Python tests", "cd backend && python -m pytest", "檢查 API、多站隔離、newsletter queue 與後台流程。"],
                ["Python lint", "cd backend && python -m ruff check app tests", "部署前檢查 import、格式與無效程式碼。"]
              ]
            },
            {
              title: "Frontend",
              items: [
                ["Next build", "cd frontend && npm.cmd run build", "確認前台與後台路由能以 production 模式編譯。"],
                ["Type check", "cd frontend && npm.cmd run typecheck", ".next/types 重新產生時，請在 build 後再跑。"]
              ]
            }
          ]
        }
      : {
          title: "Engineering verification",
          text: "Run these commands after code changes and before setting the launch decision. Mark them only when the current branch has passed locally.",
          done: "Completed",
          pending: "Run required",
          groups: [
            {
              title: "Backend",
              items: [
                ["Python tests", "cd backend && python -m pytest", "Checks API behavior, site isolation, newsletter queue, and admin flows."],
                ["Python lint", "cd backend && python -m ruff check app tests", "Catches import, style, and dead-code issues before deploy."]
              ]
            },
            {
              title: "Frontend",
              items: [
                ["Next build", "cd frontend && npm.cmd run build", "Confirms public and admin routes can compile for production."],
                ["Type check", "cd frontend && npm.cmd run typecheck", "Run after build if .next/types was regenerated."]
              ]
            }
          ]
        };
  const commandItems = commandCopy.groups.flatMap((group, groupIndex) =>
    group.items.map(([title, command, detail], itemIndex) => ({
      command,
      detail,
      group: group.title,
      key: `cmd-${groupIndex}-${itemIndex}`,
      title
    }))
  );
  const commandDone = commandItems.filter((item) => qaStatus[item.key]).length;
  const currentSite = sites.find((item) => item.slug === system.site.slug) ?? sites[0];
  const siteSettings = currentSite?.settings ?? {};
  // Resolved through the helpers rather than read inline: these four rows each
  // read a key the site editor does not write.
  const adCode = adCodeSetting(siteSettings);
  const socialLinks = socialLinksSetting(siteSettings);
  const cookieNoticeText = noticeSummary(siteSettings.cookie_notice, locale);
  const gdprNoticeText = noticeSummary(siteSettings.gdpr_notice, locale);
  const siteSeo = currentSite?.seo_defaults ?? {};
  const complianceCopy =
    locale === "zh"
      ? {
          title: "SEO / 追蹤 / 法遵輸出",
          text: "這裡只檢查目前站點是否有足夠資料可輸出；實際 head、script、Cookie banner 仍要用瀏覽器 QA 確認。",
          ready: "已設定",
          missing: "待補",
          edit: "編輯網站設定",
          open: "開啟測試",
          items: [
            { label: "SEO title", ready: Boolean(siteSeo.title), value: String(siteSeo.title ?? ""), detail: "搜尋結果與瀏覽器分頁標題。" },
            { label: "SEO description", ready: Boolean(siteSeo.description), value: String(siteSeo.description ?? ""), detail: "搜尋結果摘要與分享預覽的基礎描述。" },
            { label: "GA ID", ready: Boolean(siteSettings.ga_id), value: String(siteSettings.ga_id ?? ""), detail: "有設定才會在前台輸出 GA script。" },
            { label: "Ad code", ready: Boolean(adCode), value: adCode, detail: "廣告或再行銷碼，有設定才輸出。" },
            { label: "Cookie notice", ready: Boolean(cookieNoticeText), value: cookieNoticeText, detail: "前台 Cookie 提示文案。" },
            { label: "GDPR notice", ready: Boolean(gdprNoticeText), value: gdprNoticeText, detail: "隱私與資料使用告知。" },
            { label: "Social links", ready: Boolean(socialLinks), value: socialLinks, detail: "社群連結與分享檢查。" }
          ]
        }
      : {
          title: "SEO / tracking / compliance output",
          text: "This checks whether the selected site has enough data to render output. Browser QA still needs to confirm head tags, scripts, and the cookie banner.",
          ready: "Set",
          missing: "Missing",
          edit: "Edit site settings",
          open: "Open test",
          items: [
            { label: "SEO title", ready: Boolean(siteSeo.title), value: String(siteSeo.title ?? ""), detail: "Search result and browser-tab title." },
            { label: "SEO description", ready: Boolean(siteSeo.description), value: String(siteSeo.description ?? ""), detail: "Baseline copy for search snippets and share previews." },
            { label: "GA ID", ready: Boolean(siteSettings.ga_id), value: String(siteSettings.ga_id ?? ""), detail: "GA script only renders on the public site when this is set." },
            { label: "Ad code", ready: Boolean(adCode), value: adCode, detail: "Ad or remarketing snippets only render when configured." },
            { label: "Cookie notice", ready: Boolean(cookieNoticeText), value: cookieNoticeText, detail: "Public cookie banner copy." },
            { label: "GDPR notice", ready: Boolean(gdprNoticeText), value: gdprNoticeText, detail: "Privacy and data-use notice." },
            { label: "Social links", ready: Boolean(socialLinks), value: socialLinks, detail: "Social link and sharing checks." }
          ]
        };
  const complianceReady = complianceCopy.items.filter((item) => item.ready).length;
  const siteQuery = system.site.slug ? `?site=${encodeURIComponent(system.site.slug)}` : "";
  const viewportCopy =
    locale === "zh"
      ? {
          title: "瀏覽器尺寸 QA",
          text: "用同一組公開頁，在桌機、平板、手機尺寸確認文字不重疊、圖片比例正確、CTA 可點擊。",
          done: "已檢查",
          pending: "待檢查",
          open: "開啟前台",
          items: [
            {
              key: "desktop",
              title: "Desktop",
              size: "1440 x 900",
              detail: "檢查 hero、banner 輪播、住宿卡片、內容頁與表格寬度。",
              href: `/${siteQuery}`
            },
            {
              key: "tablet",
              title: "Tablet",
              size: "834 x 1112",
              detail: "檢查導覽、搜尋區、圖片牆和後台表格換行。",
              href: `/stays${siteQuery}`
            },
            {
              key: "mobile",
              title: "Mobile",
              size: "390 x 844",
              detail: "檢查 sticky CTA、表單欄位、語言選單、Cookie banner 不遮擋操作。",
              href: `/contact${siteQuery}`
            }
          ]
        }
      : {
          title: "Viewport browser QA",
          text: "Use the same public pages across desktop, tablet, and mobile widths to confirm text does not overlap, images are framed correctly, and CTAs remain tappable.",
          done: "Checked",
          pending: "Needs check",
          open: "Open public site",
          items: [
            {
              key: "desktop",
              title: "Desktop",
              size: "1440 x 900",
              detail: "Check hero, banner carousel, stay cards, content pages, and table width.",
              href: `/${siteQuery}`
            },
            {
              key: "tablet",
              title: "Tablet",
              size: "834 x 1112",
              detail: "Check navigation, search band, galleries, and admin table wrapping.",
              href: `/stays${siteQuery}`
            },
            {
              key: "mobile",
              title: "Mobile",
              size: "390 x 844",
              detail: "Check sticky CTAs, form fields, language menu, and cookie banner placement.",
              href: `/contact${siteQuery}`
            }
          ]
        };
  const viewportDone = viewportCopy.items.filter((item) => qaStatus[`viewport-${item.key}`]).length;
  const blockedSystemChecks = system.checks.filter((check) => check.status !== "ready");
  const qaNote = system.qa_note?.trim() ?? "";
  const qaDecision = system.qa_decision ?? "pending";
  const blockedContentItems = items.filter((item) => !item.ok);
  const uncheckedQaItems = c.qaGroups.flatMap((group, groupIndex) =>
    group.items
      .map((item, itemIndex) => ({
        group: group.title,
        item,
        key: `qa-${groupIndex}-${itemIndex}`
      }))
      .filter((item) => !qaStatus[item.key])
  );
  const reportSummary = [
    `${c.reportLabels.site}: ${system.site.name || "-"} (${system.site.slug || "-"})`,
    `${c.reportLabels.environment}: ${system.environment}`,
    `${c.reportLabels.readiness}: ${readyCount}/${items.length}`,
    `${c.reportLabels.qa}: ${qaDone}/${qaTotal}`,
    `${commandCopy.title}: ${commandDone}/${commandItems.length}`,
    `${complianceCopy.title}: ${complianceReady}/${complianceCopy.items.length}`,
    `${viewportCopy.title}: ${viewportDone}/${viewportCopy.items.length}`,
    `${c.reportLabels.systemBlocked}: ${
      blockedSystemChecks.length > 0 ? blockedSystemChecks.map((check) => check.key).join(", ") : "0"
    }`,
    `${c.decisionTitle}: ${c.decisionLabels[qaDecision]}`,
    `${c.blockerGroups.content}: ${
      blockedContentItems.length > 0 ? blockedContentItems.map((item) => item.title).join(", ") : "0"
    }`,
    `${c.blockerGroups.qa}: ${
      uncheckedQaItems.length > 0 ? uncheckedQaItems.map((item) => `${item.group} - ${item.item}`).join("; ") : "0"
    }`,
    `${c.noteTitle}: ${qaNote || c.noteEmpty}`
  ].join("\n");
  const qaRoutes = [
    {
      title: c.routeGroups.public,
      links: [
        ["/", `/${siteQuery}`],
        ["/stays", `/stays${siteQuery}`],
        ["/experience", `/experience${siteQuery}`],
        ["/contact", `/contact${siteQuery}`],
        ["/newsletter/unsubscribe", `/newsletter/unsubscribe${siteQuery}`]
      ]
    },
    {
      title: c.routeGroups.admin,
      links: [
        ["/admin/readiness", "/admin/readiness"],
        ["/admin/cms", "/admin/cms"],
        ["/admin/stays", "/admin/stays"],
        ["/admin/media", "/admin/media"],
        ["/admin/email-settings", "/admin/email-settings"],
        ["/admin/newsletter", "/admin/newsletter"]
      ]
    },
    {
      title: c.routeGroups.seo,
      links: [
        ["/sitemap.xml", `/sitemap.xml${siteQuery}`],
        ["/robots.txt", `/robots.txt${siteQuery}`],
        ["/brand", `/brand${siteQuery}`],
        ["/journal", `/journal${siteQuery}`],
        ["/media-coverage", `/media-coverage${siteQuery}`]
      ]
    }
  ];

  const decisionTone = qaDecision === "ready" ? "success" : qaDecision === "blocked" ? "danger" : "warning";
  const checkMark = (done: boolean) => (
    <span className={`a-checklist__mark a-tone--${done ? "success" : "neutral"}`} aria-hidden="true">
      {done ? <Check /> : <CircleDashed />}
    </span>
  );

  return (
    <Page className="readiness-page">
      <AdminFlashes notice={searchParams?.notice} error={searchParams?.error} copy={{ adminFlashClose: locale === "zh" ? "關閉通知" : "Close notification", adminFlashSuccess: locale === "zh" ? "已儲存" : "Saved", adminFlashError: locale === "zh" ? "無法更新" : "Update failed" }} />
      <PageHeader
        eyebrow={c.kicker}
        title={c.title}
        description={c.text}
        meta={
          <>
            <span>{c.reportLabels.environment}：<Badge>{system.environment}</Badge></span>
            <span>{c.decisionTitle}：<Badge tone={decisionTone} dot>{c.decisionLabels[qaDecision]}</Badge></span>
          </>
        }
      />

      <Grid cols={5}>
        <StatCard
          hint={`${items.length - readyCount} ${c.needsWork}`}
          icon={<CheckCircle2 />}
          label={c.score}
          tone={readyCount === items.length ? "success" : "warning"}
          value={`${readyCount}/${items.length}`}
        />
        <StatCard icon={<ClipboardCheck />} label="QA" tone={qaDone === qaTotal ? "success" : "neutral"} value={`${qaDone}/${qaTotal}`} />
        <StatCard icon={<TerminalSquare />} label={commandCopy.title} tone={commandDone === commandItems.length ? "success" : "neutral"} value={`${commandDone}/${commandItems.length}`} />
        <StatCard icon={<ShieldCheck />} label={complianceCopy.title} tone={complianceReady === complianceCopy.items.length ? "success" : "neutral"} value={`${complianceReady}/${complianceCopy.items.length}`} />
        <StatCard icon={<Monitor />} label={viewportCopy.title} tone={viewportDone === viewportCopy.items.length ? "success" : "neutral"} value={`${viewportDone}/${viewportCopy.items.length}`} />
      </Grid>

      <Grid cols={3}>
        {items.map((item) => {
          const Icon = item.ok ? CheckCircle2 : CircleDashed;
          return (
            <ActionTile
              href={item.href}
              icon={<Icon />}
              key={item.title}
              text={item.text}
              title={item.title}
              tone={item.ok ? "success" : "warning"}
              trailing={<Badge tone={item.ok ? "success" : "warning"}>{item.ok ? c.passed : c.missing}</Badge>}
            />
          );
        })}
      </Grid>

      <div className="a-split">
        <Card title={c.systemTitle} description={`${c.environment}: ${system.environment}`}>
          <ListRows>
            {system.checks.map((check) => (
              <ListRow
                aside={<Badge tone={check.status === "ready" ? "success" : "danger"} dot>{check.status === "ready" ? c.passed : c.missing}</Badge>}
                key={check.key}
                meta={check.detail}
                title={c.systemLabels[check.key as keyof typeof c.systemLabels] ?? check.key}
              />
            ))}
          </ListRows>
        </Card>

        <Card
          title={c.reportTitle}
          description={c.reportText}
          actions={
            <ReadinessReportActions
              copiedLabel={c.copied}
              copyLabel={c.copy}
              printLabel={c.print}
              summary={reportSummary}
            />
          }
        >
          <DescriptionList
            items={[
              { label: c.reportLabels.site, value: system.site.name || "-" },
              { label: c.reportLabels.environment, value: system.environment },
              { label: c.reportLabels.readiness, value: `${readyCount}/${items.length}` },
              { label: c.reportLabels.qa, value: `${qaDone}/${qaTotal}` },
              { label: c.reportLabels.systemBlocked, value: blockedSystemChecks.length },
              { label: c.decisionTitle, value: <Badge tone={decisionTone}>{c.decisionLabels[qaDecision]}</Badge> }
            ]}
          />
        </Card>
      </div>

      <Card
        title={c.blockersTitle}
        actions={<Badge tone={blockedSystemChecks.length > 0 ? "danger" : "success"}>{c.reportLabels.systemBlocked}: {blockedSystemChecks.length}</Badge>}
      >
        <Grid cols={3}>
          <div>
            <h3 className="a-subhead">{c.blockerGroups.content}</h3>
            {blockedContentItems.length > 0 ? (
              <ListRows>
                {blockedContentItems.map((item) => (
                  <ListRow aside={<ArrowRight />} href={item.href} key={item.title} meta={item.text} title={item.title} />
                ))}
              </ListRows>
            ) : (
              <p className="a-muted">{c.noBlockers}</p>
            )}
          </div>
          <div>
            <h3 className="a-subhead">{c.blockerGroups.system}</h3>
            {blockedSystemChecks.length > 0 ? (
              <ListRows>
                {blockedSystemChecks.map((check) => (
                  <ListRow key={check.key} meta={check.detail} title={c.systemLabels[check.key as keyof typeof c.systemLabels] ?? check.key} />
                ))}
              </ListRows>
            ) : (
              <p className="a-muted">{c.noBlockers}</p>
            )}
          </div>
          <div>
            <h3 className="a-subhead">{c.blockerGroups.qa}</h3>
            {uncheckedQaItems.length > 0 ? (
              <ListRows>
                {uncheckedQaItems.slice(0, 8).map((qaItem) => (
                  <ListRow key={qaItem.key} meta={qaItem.item} title={qaItem.group} />
                ))}
              </ListRows>
            ) : (
              <p className="a-muted">{c.noBlockers}</p>
            )}
          </div>
        </Grid>
      </Card>

      <Card title={c.qaGuideTitle} description={c.qaGuideText}>
        <Grid cols={3}>
          {c.qaGuideItems.map(([title, text], index) => (
            <div className="readiness-step" key={title}>
              <Badge tone="brand">{String(index + 1).padStart(2, "0")}</Badge>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          ))}
        </Grid>
      </Card>

      <Card
        title={commandCopy.title}
        description={commandCopy.text}
        actions={<Badge tone={commandDone === commandItems.length ? "success" : "neutral"}>{commandDone}/{commandItems.length}</Badge>}
      >
        <Grid cols={2}>
          {commandCopy.groups.map((group, groupIndex) => (
            <div key={group.title}>
              <h3 className="a-subhead">{group.title}</h3>
              <ul className="a-checklist">
                {group.items.map(([title, command, detail], itemIndex) => {
                  const key = `cmd-${groupIndex}-${itemIndex}`;
                  const done = Boolean(qaStatus[key]);
                  return (
                    <li key={key}>
                      <form action={updateQaStatusAction}>
                        <input name="key" type="hidden" value={key} />
                        <input name="done" type="hidden" value={done ? "false" : "true"} />
                        <SubmitButton className="readiness-toggle">
                          {checkMark(done)}
                          <span className="readiness-toggle__text">
                            <strong>{title}</strong>
                            <code>{command}</code>
                            <span className="a-checklist__text">{detail}</span>
                          </span>
                          <Badge tone={done ? "success" : "warning"}>{done ? commandCopy.done : commandCopy.pending}</Badge>
                        </SubmitButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Grid>
      </Card>

      <Card
        title={complianceCopy.title}
        description={complianceCopy.text}
        actions={
          <>
            <Badge tone={complianceReady === complianceCopy.items.length ? "success" : "neutral"}>{complianceReady}/{complianceCopy.items.length}</Badge>
            {/* The site editor is /admin/sites/{id}; there is no /edit below it, so
                this link 404'd on the one screen whose job is to tell you what is
                not set up yet. */}
            <ButtonLink href={currentSite ? `/admin/sites/${currentSite.id}` : "/admin/sites"} size="sm">
              {complianceCopy.edit}
            </ButtonLink>
            <ButtonLink href={`/${siteQuery}`} icon={<ArrowRight />} size="sm" variant="ghost">
              {complianceCopy.open}
            </ButtonLink>
          </>
        }
      >
        <ListRows>
          {complianceCopy.items.map((item) => (
            <ListRow
              aside={<Badge tone={item.ready ? "success" : "warning"}>{item.ready ? complianceCopy.ready : complianceCopy.missing}</Badge>}
              key={item.label}
              meta={
                <>
                  {item.detail} <code className="readiness-value">{item.value || "-"}</code>
                </>
              }
              title={item.label}
            />
          ))}
        </ListRows>
      </Card>

      <Card
        title={viewportCopy.title}
        description={viewportCopy.text}
        actions={<Badge tone={viewportDone === viewportCopy.items.length ? "success" : "neutral"}>{viewportDone}/{viewportCopy.items.length}</Badge>}
      >
        <Grid cols={3}>
          {viewportCopy.items.map((item, index) => {
            const done = Boolean(qaStatus[`viewport-${item.key}`]);
            const Icon = index === 0 ? Monitor : index === 1 ? Tablet : Smartphone;
            return (
              <div className="readiness-step" key={item.key}>
                <span className="readiness-step__head">
                  <Icon size={18} />
                  <Badge>{item.size}</Badge>
                </span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <Toolbar>
                  <ButtonLink href={item.href} icon={<ArrowRight />} size="sm">
                    {viewportCopy.open}
                  </ButtonLink>
                  <form action={updateQaStatusAction}>
                    <input name="key" type="hidden" value={`viewport-${item.key}`} />
                    <input name="done" type="hidden" value={done ? "false" : "true"} />
                    <SubmitButton className={buttonClass({ variant: done ? "secondary" : "ghost", size: "sm" })}>
                      {done ? <Check size={14} /> : null}
                      {done ? viewportCopy.done : viewportCopy.pending}
                    </SubmitButton>
                  </form>
                </Toolbar>
              </div>
            );
          })}
        </Grid>
      </Card>

      <Card title={c.routeTitle} description={c.routeText}>
        <Grid cols={3}>
          {qaRoutes.map((group) => (
            <div key={group.title}>
              <h3 className="a-subhead">{group.title}</h3>
              <ListRows>
                {group.links.map(([label, href]) => (
                  <ListRow aside={<ArrowRight />} href={href} key={href} title={label} />
                ))}
              </ListRows>
            </div>
          ))}
        </Grid>
      </Card>

      <div className="a-split">
        <Card title={c.noteTitle} description={c.noteText}>
          <form action={updateQaNoteAction} className="a-stack a-stack--md">
            <Field label={c.decisionTitle}>
              <Select name="decision" defaultValue={qaDecision}>
                <option value="pending">{c.decisionLabels.pending}</option>
                <option value="ready">{c.decisionLabels.ready}</option>
                <option value="conditional">{c.decisionLabels.conditional}</option>
                <option value="blocked">{c.decisionLabels.blocked}</option>
              </Select>
            </Field>
            <Textarea name="note" aria-label={c.noteTitle} defaultValue={qaNote} placeholder={c.notePlaceholder} />
            <FormActions>
              <SubmitButton className={buttonClass({ variant: "primary" })}>{c.noteSave}</SubmitButton>
            </FormActions>
          </form>
        </Card>

        <Callout icon={<AlertTriangle />} title={c.checklistTitle} tone="warning">
          <ul className="readiness-bullets">
            {c.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Callout>
      </div>

      <Card
        title={c.qaTitle}
        description={c.qaText}
        actions={<Badge tone={qaDone === qaTotal ? "success" : "neutral"}>{qaDone}/{qaTotal}</Badge>}
      >
        <Grid cols={3}>
          {c.qaGroups.map((group, groupIndex) => (
            <div key={group.title}>
              <h3 className="a-subhead">
                <span>{String(groupIndex + 1).padStart(2, "0")}</span> {group.title}
              </h3>
              <ul className="a-checklist">
                {group.items.map((item, itemIndex) => {
                  const key = `qa-${groupIndex}-${itemIndex}`;
                  const done = Boolean(qaStatus[key]);
                  return (
                    <li className={done ? "is-done" : ""} key={item}>
                      <form action={updateQaStatusAction}>
                        <input name="key" type="hidden" value={key} />
                        <input name="done" type="hidden" value={done ? "false" : "true"} />
                        <SubmitButton className="readiness-toggle">
                          {checkMark(done)}
                          <span className="readiness-toggle__text">{item}</span>
                        </SubmitButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Grid>
      </Card>
    </Page>
  );
}
