# Slowfield Stays 第一版實作清單

這份清單用來對照目前第一版功能狀態。人工檢查細節請看 [QA 交付檢查清單](QA_HANDOFF.md)。

## 狀態說明

- `已完成`：目前 codebase 已實作。
- `待 QA`：已實作或大致完成，但還需要瀏覽器/API/正式服務驗證。
- `不在第一版`：刻意排除，不應在第一版上線前擴大 scope。

## 母子網站 / 多站管理

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| Site model 支援 parent/template/child metadata | 已完成 | 包含 parent、template、version、settings。 |
| 一鍵建立 child site | 已完成 | 後台 site form 支援從 template 建立。 |
| Clone-once 獨立編輯 | 已完成 | UI 已說明 child site 不會持續同步 template。 |
| 後台 site switcher 與 site-isolated context | 已完成 | 目前站點由 `admin-site` cookie 控制。 |
| 每站權限管理 | 已完成 | Site permissions 頁面已加入權限邊界說明。 |
| Domain / slug resolution | 待 QA | 需要用多個 slug/domain 做瀏覽器與 API 驗證。 |

## 前台官網

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| 首頁 Hero、精選住宿、入口、newsletter | 已完成 | 包含 announcement popup 支援。 |
| 品牌介紹頁 | 已完成 | CMS content type 與 public route 已存在。 |
| Dining services | 已完成 | CMS content type 與 public route 已存在。 |
| Selected activities | 已完成 | CMS content type 與 public route 已存在。 |
| Travel journal | 已完成 | CMS content type 與 public route 已存在。 |
| Media coverage | 已完成 | CMS content type 與 public route 已存在。 |
| PR contact | 已完成 | Public route 與 inquiry routing 已存在。 |
| Careers | 已完成 | Public route 與 inquiry routing 已存在。 |
| Franchise inquiry | 已完成 | Public route 與 inquiry routing 已存在。 |
| 中英文 UI 切換 | 已完成 | 只切換 UI 文案；CMS data 不自動翻譯。 |
| 桌機/平板/手機瀏覽器視覺 QA | 待 QA | Readiness 已加入 Viewport browser QA 勾選區。 |

## 住宿頁與訂房需求

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| 住宿列表卡片 | 已完成 | 包含圖片、資訊、CTA 與篩選。 |
| 住宿詳情圖片與 gallery | 已完成 | 支援 hero / gallery 類內容。 |
| 房型、價格、設施、FAQ、地址 | 已完成 | 由後台 stay form 管理。 |
| MAP / LINE / Facebook / Instagram 欄位 | 已完成 | Site/stay 設定支援前台聯絡資訊。 |
| Related content / stay discovery | 已完成 | CMS related stay references 已存在。 |
| BookingRequest model / API / 後台 queue | 已完成 | 第一版維持 inquiry-first。 |
| 狀態更新、內部備註、CSV 匯出 | 已完成 | 後台 booking queue 支援營運處理。 |
| 即時庫存、付款、正式訂單、取消規則 | 不在第一版 | 第一版刻意不做。 |

## CMS 與後台

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| CMS page list / create / edit | 已完成 | 支援 content type、slug、summary、body、cover image。 |
| Preview / review / publish / archive | 已完成 | 後台 UI 已提供發布流程。 |
| Banner 管理 | 已完成 | 包含 preview / edit route。 |
| SEO / OG 欄位 | 已完成 | 仍需 public output QA。 |
| Category / tag / related stay metadata | 已完成 | 基礎欄位已存在。 |
| Announcement / popup output | 已完成 | Public popup component 已存在。 |
| Announcement management QA | 待 QA | 需確認 active date / display mode 行為。 |
| Media library | 已完成 | 支援 upload、copy URL、delete、alt readiness、filters。 |
| 非工程使用者操作提示 | 已完成 | Dashboard、CMS、stays、inquiries、media、users、roles、permissions 已加入 guidance。 |
| Readiness 集中檢查頁 | 已完成 | 包含 system signals、工程命令、SEO/法遵、viewport QA、handoff summary。 |

## Newsletter 與 Email

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| 每站 SMTP 設定 UI | 已完成 | Email settings 頁含 readiness checks。 |
| Subscriber 管理 | 已完成 | 支援 email、name、groups。 |
| Campaign drafts | 已完成 | 後台可建立 subject、body、target groups。 |
| Queue creation | 已完成 | Campaign 可排入寄送。 |
| Queue processing | 已完成 | 後台可處理 pending sends。 |
| Delivery records | 已完成 | Campaign delivery count 與 queue records 已存在。 |
| Public subscribe / unsubscribe API | 已完成 | Unsubscribe token flow 已存在。 |
| Retry / failed / skipped 行為 | 待 QA | Backend tests 已涵蓋，仍需 SMTP provider 實測。 |
| Bulk-send throttling policy | 待 QA | 取決於 provider 限制，正式上線前需確認。 |

## SEO、追蹤與法遵

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| Metadata helpers | 已完成 | SEO module 支援 site/page metadata 與 JsonLd helpers。 |
| Sitemap / robots routes | 已完成 | Routes 已存在。 |
| Cookie / GDPR settings fields | 已完成 | Site settings form 已包含欄位。 |
| GA / ad code settings fields | 已完成 | Site settings form 已包含欄位。 |
| Readiness SEO/Tracking/Compliance 檢查 | 已完成 | 後台 Readiness 可看到目前 site 的設定完成度。 |
| 前台實際輸出 QA | 待 QA | 需用瀏覽器確認 head/script/banner/popup 實際輸出。 |

## 上線前建議檢查順序

1. 在 `Admin > Readiness` 先看 blockers。
2. 跑完工程命令並在 Readiness 勾選。
3. 用 Viewport browser QA 檢查桌機、平板、手機。
4. 用兩個 site 測試多站資料隔離。
5. 檢查 SEO、OG、JsonLd、sitemap、robots、GA/ad code、Cookie/GDPR、popup。
6. 用內部測試名單完成 SMTP/newsletter 實測。
7. 依 [Production runbook](PRODUCTION_RUNBOOK.md) 確認部署、備份、SMTP provider limit。
## CMS Block Editor Addendum

| Item | Status | Notes |
| --- | --- | --- |
| Block-based article layout | Done | Pages support heading, paragraph, image, video URL, quote, CTA, and spacing blocks. |
| Short-video URL embeds | Done | First version supports Instagram, TikTok, YouTube, and YouTube Shorts URLs. |
| Legacy body fallback | Done | Existing plain-text body content remains available when no blocks are saved. |
| Local video file upload | Pending | mp4/mov upload, transcoding, compression, and CDN delivery are intentionally out of scope. |
