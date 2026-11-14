# QA 交付檢查清單

這份清單給人工驗收使用。開始檢查前，先進入後台 `Admin > Readiness`，那裡會集中顯示內容、系統、SEO、瀏覽器尺寸、工程命令與 QA 勾選狀態。

狀態建議：

- `待檢查`：尚未人工確認。
- `通過`：已在目前環境確認正常。
- `需修正`：發現問題，先記錄在 Readiness 的 QA 備註。

## 必跑命令

Backend:

```bash
cd backend
python -m pytest
python -m ruff check app tests
```

Frontend:

```bash
cd frontend
npm.cmd run build
npm.cmd run typecheck
```

如果 frontend typecheck 提示 `.next/types` 缺失，先跑 `npm.cmd run build`，再重跑 `npm.cmd run typecheck`。

## 後台 Readiness 檢查

| 項目 | 檢查內容 | 狀態 |
| --- | --- | --- |
| 準備度卡片 | Site、Content、Media、SMTP、Newsletter、Admin coverage 都沒有阻擋項。 | 待檢查 |
| System signals | Database、Media storage、Secret key、Frontend URL、SMTP 狀態正確。 | 待檢查 |
| Engineering verification | `pytest`、`ruff`、`build`、`typecheck` 都勾選完成。 | 待檢查 |
| SEO / Tracking / Compliance | SEO title、description、GA、Ad code、Cookie、GDPR、Social links 狀態符合目前站點。 | 待檢查 |
| Viewport browser QA | Desktop `1440 x 900`、Tablet `834 x 1112`、Mobile `390 x 844` 都已檢查。 | 待檢查 |
| QA note | 已記錄剩餘風險、瀏覽器覆蓋、SMTP 狀態與上線決策。 | 待檢查 |

## 前台官網 QA

| 區域 | 檢查內容 | 狀態 |
| --- | --- | --- |
| 首頁 | Hero、banner 輪播、精選住宿、品牌區塊、popup、newsletter signup 正常顯示。 | 待檢查 |
| 住宿列表 | 卡片圖片、地區、人數、價格、tag、篩選與 URL query 分享正常。 | 待檢查 |
| 住宿詳情 | 圖片牆、房型、價格、設施、FAQ、地址、詢價 CTA 正常。 | 待檢查 |
| 內容頁 | Brand、Dining、Activities、Journal、Media、PR、Careers、Franchise 頁面都可載入。 | 待檢查 |
| Contact | 一般聯絡、訂房、PR、徵才、加盟等 routing 選項可送出。 | 待檢查 |
| Newsletter | 訂閱與取消訂閱頁能連到 API，成功/失敗狀態清楚。 | 待檢查 |
| RWD | 桌機、平板、手機沒有文字重疊、圖片爆版、按鈕不可點。 | 待檢查 |
| 中英文切換 | 只切換 UI 文案；CMS 內容不會自動翻譯。 | 待檢查 |

## 後台管理 QA

| 區域 | 檢查內容 | 狀態 |
| --- | --- | --- |
| 登入 | 管理員登入、過期 session 重新登入、登出清 cookie 正常。 | 待檢查 |
| Dashboard | 營運摘要、快捷入口、目前站點資料正確。 | 待檢查 |
| Sites | 新增/編輯 site、建立 child site、template/parent 說明、站點切換正常。 | 待檢查 |
| Site permissions | 使用者站點權限可設定，非授權站點不應顯示資料。 | 待檢查 |
| CMS | Page/Banner 新增、編輯、預覽、送審、發布、封存正常。 | 待檢查 |
| Stays | 新增/編輯住宿、圖片、房型、設施、FAQ、SEO、預覽正常。 | 待檢查 |
| Media | 上傳、列表/grid 切換、搜尋、複製 URL、刪除檔案與 DB 記錄正常。 | 待檢查 |
| Booking requests | 前台訂房需求可建立，後台可改狀態、加內部備註、匯出 CSV。 | 待檢查 |
| Inquiries | 一般/PR/加盟/徵才等詢價可查詢、篩選、改狀態、匯出 CSV。 | 待檢查 |
| Newsletter | 新增 subscriber、建立 campaign、queue、process、retry failed 正常。 | 待檢查 |
| Email settings | SMTP 設定、readiness strip、test email 正常。 | 待檢查 |
| Users / Roles | 建立帳號、角色權限、登入分析、登入紀錄查詢正常。 | 待檢查 |

## 多站隔離 QA

至少建立兩個 site 後檢查：

1. 切換到 site A。
2. 在 site A 新增或編輯 CMS、住宿、媒體、詢價或 newsletter。
3. 切換到 site B，確認看不到 site A 的資料。
4. 從 template 建立 child site。
5. 修改 child site 的文字、圖片、SEO、聯絡資訊。
6. 回到 template site，確認 template 沒被 child site 覆蓋。
7. 用 `?site=slug` 檢查前台是否顯示正確站點資料。
8. 正式環境再用 domain/subdomain 檢查 site resolution。

## SEO、追蹤與法遵 QA

| 項目 | 檢查內容 | 狀態 |
| --- | --- | --- |
| Metadata | public page 的 title / description 來自 site/page SEO 欄位。 | 待檢查 |
| OG | Open Graph title、description、image 存在且分享預覽合理。 | 待檢查 |
| JsonLd | 結構化資料可以解析，沒有 malformed JSON。 | 待檢查 |
| Sitemap | `/sitemap.xml?site=slug` 包含預期公開頁。 | 待檢查 |
| Robots | `/robots.txt?site=slug` 回傳合理 crawler 規則。 | 待檢查 |
| GA | 有設定 GA ID 時才輸出 GA script；未設定時不輸出。 | 待檢查 |
| Ads | 有設定 ad code 時才輸出；未設定時不輸出。 | 待檢查 |
| Cookie/GDPR | Cookie/GDPR 文案顯示正常，不遮擋主要操作。 | 待檢查 |
| Popup | Announcement popup 依 active date / display mode 顯示。 | 待檢查 |

## Newsletter / SMTP QA

先用內部測試名單，不要直接寄正式名單。

1. 在 `Admin > Email settings` 設定 SMTP。
2. 確認 SMTP readiness 全部通過。
3. 寄一封 test email 到內部信箱。
4. 建立兩個內部 subscriber，放到同一個 test group。
5. 建立 campaign，target group 選 test group。
6. Queue campaign。
7. Process queue。
8. 檢查 delivery records 有 sent 記錄。
9. 點 unsubscribe link，確認 subscriber 之後會被 skipped。
10. 用錯誤 SMTP 或錯誤收件者測一次 failed/retry 流程。

## 第一版限制

- 不做即時庫存。
- 不做線上付款。
- 不做訂單取消規則。
- child site 是 clone-once，不會持續同步 template。
- CMS 內容不會自動翻譯。
- 大量寄信速度與限制取決於 SMTP provider。
- 正式部署、備份、監控需依 `docs/PRODUCTION_RUNBOOK.md` 另外執行。
## CMS Block Editor / Short Video QA

| Area | Check | Status |
| --- | --- | --- |
| Block editor | Add, delete, reorder, and save heading, paragraph, image, video URL, quote, CTA, and spacing blocks. | Pending |
| URL platforms | Verify YouTube, YouTube Shorts, Instagram Reels/posts, and TikTok URLs display safely. | Pending |
| Fallback | Unsupported URLs render as external link cards and do not break the article page. | Pending |
| Legacy content | Existing pages without blocks still render plain-text body paragraphs. | Pending |
| Responsive video | Embedded video/card layout does not overflow on mobile, tablet, or desktop. | Pending |
