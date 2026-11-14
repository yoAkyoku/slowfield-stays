# Slowfield Stays 測試文檔

> 涵蓋前台（公開網站）與後台（管理面板）的全部功能、操作流程與測試用表單資料。
> 適用於：手動回歸測試、QA 驗收、新成員上手、bug 重現步驟撰寫。

- **前台**：`http://localhost:3000`
- **後台**：`http://localhost:3000/admin`
- **後端 API**：`http://localhost:8000/api/v1`
- **預設管理員**：`admin@example.com` / `ChangeMe123!`

---

## 目錄

1. [環境準備](#1-環境準備)
2. [測試資料集](#2-測試資料集)
   - 2.1 [住宿（6 筆）](#21-住宿資料6-筆)
   - 2.2 [CMS 內容（6 筆）](#22-cms-內容6-筆)
   - 2.3 [使用者帳戶（5 筆）](#23-使用者帳戶5-筆)
   - 2.4 [子網站（3 筆）](#24-子網站3-筆)
   - 2.5 [詢價與預約](#25-詢價與預約)
   - 2.6 [電子報](#26-電子報)
3. [前台測試](#3-前台測試)
4. [後台測試](#4-後台測試)
5. [跨流程整合](#5-跨流程整合)
6. [回歸檢查清單](#6-回歸檢查清單)

---

## 1. 環境準備

### 1.1 啟動服務

```powershell
# 後端
cd D:\Worksapce\Projects\slowfield\backend
poetry run uvicorn app.main:app --reload --port 8000

# 前端（另一個終端）
cd D:\Worksapce\Projects\slowfield\frontend
npm run dev
```

### 1.2 健康檢查

| 項目 | URL | 預期 |
|---|---|---|
| 前台首頁 | http://localhost:3000 | 200 + 看到 hero |
| 後台登入 | http://localhost:3000/admin/login | 200 + 表單 |
| API 根 | http://localhost:8000/api/v1/sites | 200 + JSON 陣列 |
| API 文件 | http://localhost:8000/docs | Swagger UI |

### 1.3 瀏覽器語系切換

每頁右上「中文 / English」鈕應立即重整為對應語言。`cookies` 中 `site-locale` 會更新。

---

## 2. 測試資料集

### 2.1 住宿資料（6 筆）

> 入口：`/admin/stays → 新增住宿`

| # | 名稱（中／英） | Slug | 房型 | 容納人數 | 價格區間 | 地點 | 主圖 | 標籤 |
|---|---|---|---|---|---|---|---|---|
| 1 | 禾境 / Shamanya Cloud Bay | shamanya-cloud-bay | 海景套房 | 4 | NT$ 8,800–12,800 | 宜蘭縣頭城鎮 | `/sample/stays/cloud-bay-hero.jpg` | 海景, 雙人, 包棟 |
| 2 | 山霧伴月旅宿 / Misty Moon Retreat | misty-moon-retreat | 山景雙人房 | 2 | NT$ 5,600–7,200 | 南投縣魚池鄉 | `/sample/stays/misty-moon-hero.jpg` | 山景, 蜜月, 早餐 |
| 3 | 蘆葦島嶼之家 / Reed Island House | reed-island-house | 整棟包棟 | 8 | NT$ 18,000–24,000 | 屏東縣恆春鎮 | `/sample/stays/reed-island-hero.jpg` | 包棟, 親子, 戲水池 |
| 4 | 城際靜謐公寓 / Urban Stillness Suite | urban-stillness-suite | 都會套房 | 2 | NT$ 4,200–5,800 | 台北市大安區 | `/sample/stays/urban-still-hero.jpg` | 都會, 商務, 24h |
| 5 | 茶香林園民宿 / Tea Garden Lodge | tea-garden-lodge | 兩房一廳 | 4 | NT$ 7,800–9,800 | 新北市坪林區 | `/sample/stays/tea-garden-hero.jpg` | 山景, 茶園, 早餐 |
| 6 | 灘前木屋 / Driftwood Cabin | driftwood-cabin | 海邊獨棟 | 6 | NT$ 14,500–18,500 | 花蓮縣豐濱鄉 | `/sample/stays/driftwood-hero.jpg` | 海景, 包棟, 寵物 |

**每筆住宿的延伸欄位（在 `/admin/stays/[id]` 編輯）**：
- 簡述（中／英）：120 字內
- 詳細介紹（中／英）：500–1200 字
- 設施清單：勾選（Wi-Fi、停車、廚房、泳池、寵物友善、早餐、空調、洗衣）
- 圖片畫廊：至少 4 張
- 地址 + Google Maps 經緯度
- 退訂政策：彈性 / 一般 / 嚴格
- 入住須知（中／英）

### 2.2 CMS 內容（6 筆）

> 入口：`/admin/cms → 新增頁面`

| # | 標題（中／英） | Slug | 類型 | 狀態 | 摘要 |
|---|---|---|---|---|---|
| 1 | 春日花海特輯 / Spring Bloom Field Guide | spring-bloom-2026 | journal（多頁） | 已發布 | 全台 6 處最佳花季拍攝點，含交通建議 |
| 2 | 慢域夏季限定體驗 / Summer Limited Experiences | summer-2026 | experience（多頁） | 已發布 | 採果、潛水、夜間獨木舟等 12 項活動 |
| 3 | 全新品牌故事 / Our Brand Story | brand-story | brand（單頁） | 已發布 | 創辦人理念、團隊背景、過去 8 年里程碑 |
| 4 | 風光媒體報導匯整 / Press Coverage 2025–2026 | press-2026 | media（單頁） | 已發布 | 引用 ELLE、VOGUE、康健等 9 則報導 |
| 5 | 民宿加盟說明 / Franchise Information | franchise-info | franchise（單頁） | 草稿 | 加盟條件、權利義務、聯絡窗口 |
| 6 | 隱私權政策（2026 修訂版） / Privacy Policy 2026 | privacy-2026 | privacy（單頁） | 已發布 | GDPR + 個資法雙軌條款 |

**每筆 CMS 頁面的延伸欄位**：
- 封面圖片（建議 1600×900）
- SEO 標題（≤60 字）、SEO 描述（≤160 字）、OG image
- 內文：段落、圖片、引述、列表、CTA 按鈕（用 visual editor）
- 排序 / 顯示位置
- 翻譯：中、英兩版內文都填

### 2.3 使用者帳戶（5 筆）

> 入口：`/admin/users → 新增使用者`

| # | 姓名 | Email | 角色 | 狀態 | 用途 |
|---|---|---|---|---|---|
| 1 | 陳冠廷 | owner@slowfield.example | owner | active | 主擁有者 |
| 2 | 林宛蓁 | yilan-admin@slowfield.example | admin | active | 宜蘭子站管理員 |
| 3 | 吳承翰 | editor@slowfield.example | editor | active | CMS 編輯 |
| 4 | 黃詩涵 | marketing@slowfield.example | editor | active | 行銷／電子報 |
| 5 | 張志明 | legacy@slowfield.example | editor | archived | 測試封存狀態 |

### 2.4 子網站（3 筆）

> 入口：`/admin/sites → 新增網站`

| # | 名稱 | Slug | 網域 | 上層 | 主色 | 強調色 | 狀態 |
|---|---|---|---|---|---|---|---|
| 1 | Slowfield Stays（總站） | slowfield | slowfield.com | — | #2f4638 | #b78b58 | active |
| 2 | 禾境 | shamanya-cloud-bay | cloud-bay.staycation.com | 1 | #3a5b6e | #d7a35c | active |
| 3 | 山霧伴月旅宿 | misty-moon | misty-moon.staycation.com | 1 | #4a5a3d | #c2a572 | draft |

### 2.5 詢價與預約

> 由前台提交，後台 `/admin/inquiries`、`/admin/booking-requests` 接收

**詢價樣本**：
- 姓名：陳小芳
- Email：fang@example.com
- 電話：0912-345-678
- 主題：包棟詢價
- 訊息：「想詢問 7/15–7/17 灘前木屋包棟，8 人入住，是否能加床？」

**預約樣本**：
- 住宿：禾境
- 入住：2026/07/12
- 退房：2026/07/14
- 大人：2、小孩：1
- 加購：機場接送

### 2.6 電子報

> 入口：`/admin/newsletter`

**訂閱者樣本**：
- alice@example.com、bob@example.com、carol@example.com

**發送批次樣本**：
- 主題：「春日花海・限時 8 折」
- 預覽文字：「6 處秘境一次收藏」
- 排程：未來 24h 之後（測試排程）
- 對象：所有 active 訂閱者

---

## 3. 前台測試

### 3.1 首頁 `/`

| # | 操作 | 預期結果 |
|---|---|---|
| 3.1.1 | 載入首頁 | hero 區塊、推薦住宿、特色內容、頁尾全部顯示 |
| 3.1.2 | 點選右上語言切換 | 全頁文案中／英對應切換，URL 帶 locale |
| 3.1.3 | hero CTA 點擊 | 跳到 `/stays` 或 admin 設定的目的地 |
| 3.1.4 | 推薦住宿輪播 | 左右箭頭可換頁；點卡片進入 `/stays/[slug]` |
| 3.1.5 | scroll 到頁尾 | scroll-to-top FAB 出現；點擊回頂 |
| 3.1.6 | 訂閱電子報 | 輸入 email → 「訂閱成功」 toast；DB 多一筆 |

### 3.2 住宿列表 `/stays`

| # | 操作 | 預期結果 |
|---|---|---|
| 3.2.1 | 載入列表 | 顯示 6 筆測試住宿，皆有圖、名稱、價格區間 |
| 3.2.2 | 切「篩選」面板 | 顯示「人數 / 價格 / 標籤」欄位 |
| 3.2.3 | 篩選「容納 ≥ 6」 | 列表只剩 #3 蘆葦島嶼之家、#6 灘前木屋 |
| 3.2.4 | 篩選標籤「海景」 | 剩 #1、#6 |
| 3.2.5 | 清除篩選 | 6 筆全顯 |
| 3.2.6 | 切英文 | 名稱／簡述變英文 |

### 3.3 住宿詳細 `/stays/[slug]`

| # | 操作 | 預期結果 |
|---|---|---|
| 3.3.1 | 進入 `/stays/shamanya-cloud-bay` | hero、輪播、介紹、設施、地圖、CTA 都載入 |
| 3.3.2 | 點輪播下一張 | 圖片切換、無 flash |
| 3.3.3 | 點「我要詢價」 | 跳轉 / 開 modal `/contact?stay=...` |
| 3.3.4 | 提交詢價表單 | 200 OK + 確認頁；後台 `/admin/inquiries` 新增 |
| 3.3.5 | 在地圖點 marker | popup 顯示住宿名與地址 |
| 3.3.6 | 點「分享」 | 顯示 LINE/FB/Copy Link |

### 3.4 CMS 列表頁

| 路徑 | 內容 | 來源資料 |
|---|---|---|
| `/journal` | 春日花海特輯（#1） | content_type=journal 多頁 |
| `/experience` | 慢域夏季限定體驗（#2） | content_type=experience 多頁 |
| `/brand` | 全新品牌故事（#3） | content_type=brand 單頁 |
| `/media-coverage` | 媒體報導匯整（#4） | content_type=media 單頁 |
| `/franchise` | 民宿加盟說明（#5） | 草稿 → 應該 404 |
| `/privacy` | 隱私權政策 2026（#6） | content_type=privacy 單頁 |

**通用驗證**：
- 中／英切換
- 字體、間距、行高沒跑版
- 圖片 lazy load
- meta title / description 套用 SEO 欄位

### 3.5 聯絡 / 詢價 `/contact`

| # | 操作 | 預期結果 |
|---|---|---|
| 3.5.1 | 顯示表單（姓名 / Email / 電話 / 主題 / 訊息） | 全部欄位渲染 |
| 3.5.2 | 空白送出 | required 欄位紅框，無 POST |
| 3.5.3 | Email 格式錯誤 | 即時錯誤訊息 |
| 3.5.4 | 完整填寫送出 | 200 + 「已收到您的詢問」+ 後台收到 |
| 3.5.5 | 重新整理頁面 | 表單清空 |

### 3.6 訂閱與退訂

訂閱表單**嵌在前台首頁底部**（不是獨立路由），實作見 §3.1.6。
獨立路由只有 `/newsletter/unsubscribe?token=...`，接從發出的信件帶 token 進來。

| # | 操作 | 預期結果 |
|---|---|---|
| 3.6.1 | 首頁底部輸入 email → 訂閱 | POST `/newsletter/subscribe` 201 + UI「Subscribed.」 |
| 3.6.2 | `/newsletter/unsubscribe?token=xxx` 帶 token 進入 | 顯示退訂表單，提交後 UI 顯示「已退訂」 |
| 3.6.3 | `/newsletter/unsubscribe` 不帶 token | 顯示提示 token 缺失 |
| 3.6.4 | `/newsletter`（無子路徑） | **404**（沒有此路由，符合預期） |

### 3.7 動態分類 `/[category]`

| # | 操作 | 預期結果 |
|---|---|---|
| 3.7.1 | `/news` 進入 | 列出所有 `content_type=news` 已發布頁 |
| 3.7.2 | 點單篇 | 進入 `/news/[slug]` 詳細 |
| 3.7.3 | 不存在分類 e.g. `/foo` | 404 |

---

## 4. 後台測試

### 4.1 登入 / 登出 `/admin/login`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.1.1 | 帳密錯誤 | 紅色錯誤訊息，不轉址 |
| 4.1.2 | 帳密正確 | 跳 `/admin` 儀表板，cookie `admin-token` 寫入 |
| 4.1.3 | 連續錯誤 5 次 | 速率限制（依後端設定） |
| 4.1.4 | 已登入存取 `/admin/login` | 自動跳 `/admin` |
| 4.1.5 | 點側欄「登出」 | cookie 清除、回登入頁 |

### 4.2 儀表板 `/admin`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.2.1 | 載入後看到統計卡片 | 住宿數 / CMS / 訂閱 / 詢價 即時數字 |
| 4.2.2 | Quick actions 區 | 每張卡片可跳對應頁 |
| 4.2.3 | 「即將上架 / 最新詢價」清單 | 排序正確、空狀態文案合理 |

### 4.3 站群 `/admin/sites`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.3.1 | 載入頁 | 顯示 3 筆測試網站（含上下層關係） |
| 4.3.2 | 點根站「Slowfield Stays」 | 進 `/admin/sites/1` 編輯器，**右側無刪除按鈕** |
| 4.3.3 | 點子站 | 進編輯器，**右側有刪除按鈕** |
| 4.3.4 | 子站「編輯」「刪除」按鈕 | 兩按鈕大小相同 |
| 4.3.5 | 刪除子站 | 確認 modal → 真的從清單消失 |
| 4.3.6 | 「新增網站」 | 表單 → 填基本資料 → 列表新增一筆 |

### 4.4 站點編輯器 `/admin/sites/[id]`（4 分頁）

#### Tab 1 — 基本資料

| # | 操作 | 預期結果 |
|---|---|---|
| 4.4.1.1 | 填寫網站名稱、Slug、Logo、主色、強調色、聯絡資訊 | 即時更新預覽 |
| 4.4.1.2 | 狀態下拉 | 只有「公開 / 草稿 / 已歸檔」三項 |
| 4.4.1.3 | 點 sidebar「儲存網站」 | 跑 PUT `/sites/:id` → success flash |
| 4.4.1.4 | 連續儲存兩次 | **每次都出現 flash**（不只第一次） |
| 4.4.1.5 | 切到 tab 2/3/4 後按儲存 | 仍能存（hidden inputs 保留 tab1/4 欄位） |
| 4.4.1.6 | 切中／英 | 表單 label 跟著切 |

#### Tab 2 — 頁面管理

| # | 操作 | 預期結果 |
|---|---|---|
| 4.4.2.1 | 載入分頁（子站） | 表格顯示 14 個預設分類對應前台路由：stays / experience / brand / dining / activity / journal / news / service / media / pr / career / franchise / contact / privacy |
| 4.4.2.2 | 載入分頁（母站 / root） | 顯示「母站頁面為唯讀」提示橫條；無「+ 新增頁面」按鈕；每列操作欄顯示「唯讀」標籤；顯示開關 disabled |
| 4.4.2.3 | 已有 admin 頁面（含草稿） | 該分類的真實頁面取代預設項；其他分類照樣顯示預設 |
| 4.4.2.4 | 子站點「+ 新增頁面」 | Modal 跳出，欄位只有：頁面名稱、Slug、類型（單頁 / CMS 多頁） |
| 4.4.2.5 | Modal 內按 ESC 或點 backdrop | **modal 不會自動關閉**（必須按取消） |
| 4.4.2.6 | 填寫 → 創建 | POST `/cms/pages` → 201 → 表格**立即**多一筆（不用重整） |
| 4.4.2.7 | 切換顯示開關（子站） | 即時切換樣式（綠/灰） |
| 4.4.2.8 | 點「編輯」（子站） | Modal 預填該頁資料 |
| 4.4.2.9 | 點「刪除」+ 確認（子站） | 表格立即少一筆 |

#### Tab 3 — 權限管理

| # | 操作 | 預期結果 |
|---|---|---|
| 4.4.3.1 | 載入分頁 | 顯示已在本站的帳戶（filter `site_role !== ""`） |
| 4.4.3.2 | 搜尋姓名/email | 即時過濾 |
| 4.4.3.3 | 角色 / 狀態下拉篩選 | 角色：擁有者 / 網站管理員 / 內容編輯；狀態：啟用 / 已封存 |
| 4.4.3.4 | 點「+ 新增帳戶」 | Modal 跳出，下拉列出**不在本站**的所有 admin 使用者 |
| 4.4.3.5 | 下拉為空時 | 顯示提示 + 「前往帳號權限新增」連結到 `/admin/users` |
| 4.4.3.6 | 選使用者 + 角色 → 加入網站 | PATCH `/sites/:id/users/:user_id` → **表格立即多一筆**（不用重整） |
| 4.4.3.7 | 點該列「編輯角色」 | Modal 鎖定姓名/email，只改角色 → 立即更新 |
| 4.4.3.8 | 點「刪除」+ 確認 | PATCH role=null → **表格立即少一筆**（不用重整）；該人**仍在 /admin/users** |
| 4.4.3.9 | owner 列的「刪除」 | disabled（防止自鎖） |
| 4.4.3.10 | 點「匯出清單」 | 下載 `<slug>-accounts.csv`（含 BOM，Excel 不亂碼） |

#### Tab 4 — SEO 設置

| # | 操作 | 預期結果 |
|---|---|---|
| 4.4.4.1 | 填寫 Meta 標題、描述 | 即時字數提示 |
| 4.4.4.2 | 儲存後查看公開頁原始碼 | `<title>`、`<meta description>` 套用新值 |

### 4.5 首頁編輯器 `/admin/homepage`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.5.1 | 載入頁 | 左側 block 清單、右側 inspector |
| 4.5.2 | 拖拉 block 上下 | 順序更新 |
| 4.5.3 | 新增 block：hero / editorial / featured collection / flow / pathways / gallery | 按鈕點擊立即新增空 block |
| 4.5.4 | Featured Collection 選「住宿」source | 縮圖**即時換成真實住宿**圖片+名稱 |
| 4.5.5 | Featured Collection 改 limit=4 | 縮圖數量即時跟隨 |
| 4.5.6 | Editorial block 設圖片位置 left/right | 預覽切換 |
| 4.5.7 | Editorial CTA 留空 | 預覽不顯示按鈕；填字後顯示 |
| 4.5.8 | 刪除 block | 立即消失 |
| 4.5.9 | 儲存 → 前台 `/` 載入 | 順序與內容反映 |

### 4.6 住宿管理 `/admin/stays`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.6.1 | 載入列表 | 顯示 6 筆測試住宿，欄位齊全 |
| 4.6.2 | 批次選取 + 批次刪除 | 確認 → 全部移到「已封存」 |
| 4.6.3 | 從封存清單還原 | 回到 active |
| 4.6.4 | 點「+ 新增」 | 表單 → 必填驗證 → 提交 → 列表多一筆 |
| 4.6.5 | 編輯：圖片畫廊 | 從媒體庫選 / 上傳 / 拖排序 |
| 4.6.6 | 上下架切換 | 即時更新 status |
| 4.6.7 | 搜尋「禾境」 | 列表只剩 #1 |

### 4.7 CMS 管理 `/admin/cms`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.7.1 | 載入列表 | 顯示 6 筆 CMS 頁，欄位有：標題、Slug、類型、狀態 |
| 4.7.2 | 點編輯 | 進 `/admin/cms/[id]` visual editor |
| 4.7.3 | Visual editor：拖拉段落、插圖、CTA | 預覽即時更新 |
| 4.7.4 | 雙語切換 | 中／英內容各自編輯 |
| 4.7.5 | 草稿 → 已發布 | 前台對應 URL 變 200 |
| 4.7.6 | 已發布 → 草稿 | 前台對應 URL 404 |
| 4.7.7 | 刪除 + 還原 | 工作流同住宿 |
| 4.7.8 | banner 管理子頁 | 上傳 banner、設排程、上下架 |

### 4.8 媒體庫 `/admin/media`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.8.1 | 載入 | grid 顯示所有圖片 |
| 4.8.2 | 上傳新圖（拖拉 / 點選） | 進度條 → 完成後即時加入 grid |
| 4.8.3 | 搜尋檔名 | 即時過濾 |
| 4.8.4 | 點圖看詳情 | 顯示 URL、尺寸、大小、引用次數 |
| 4.8.5 | 刪除已被引用的圖 | 確認 modal 警示 |

### 4.9 預約管理 `/admin/booking-requests`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.9.1 | 載入列表 | 顯示所有預約，按狀態分頁（新進 / 處理中 / 已確認 / 已取消） |
| 4.9.2 | 點單筆 | 詳細頁顯示住宿、日期、人數、加購、聯絡資訊 |
| 4.9.3 | 改狀態 | 下拉切換 → 後端 PATCH → 列表即時更新 |
| 4.9.4 | 「回覆 Email」 | 開 mailto 或內建編輯器 |

### 4.10 詢價 `/admin/inquiries`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.10.1 | 載入列表 | 顯示前台所有送出的詢價 |
| 4.10.2 | 標記已讀 / 未讀 | 即時更新 |
| 4.10.3 | 標記已處理 | 移到「已完成」分頁 |
| 4.10.4 | 加註內部備註 | 儲存後重新整理仍在 |

### 4.11 電子報 `/admin/newsletter`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.11.1 | 訂閱者清單 | 顯示所有訂閱者、狀態、訂閱時間 |
| 4.11.2 | 匯出 CSV | 下載 UTF-8 BOM 檔 |
| 4.11.3 | 發送中心：新增發送批次 | 填主題、預覽文字、內文、對象 |
| 4.11.4 | **設置排程** | 選未來時間 → 排程顯示在隊列 |
| 4.11.5 | 立即發送 | 提交後狀態變「發送中」→「已完成」 |
| 4.11.6 | 取消排程中的批次 | 狀態回「草稿」 |

### 4.12 帳號權限 `/admin/users`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.12.1 | 載入列表 | 顯示 5 筆測試使用者 |
| 4.12.2 | 「新增使用者」 | 填 email、姓名、密碼、角色 → 列表多一筆 |
| 4.12.3 | 改角色 | 下拉 → PATCH → 即時更新 |
| 4.12.4 | 改狀態（active ↔ archived） | 即時切換 dot 顏色 |
| 4.12.5 | 重設密碼 | 寄信 / 顯示臨時密碼 |

### 4.13 角色權限 `/admin/roles`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.13.1 | 載入 | 顯示系統角色（owner / admin / editor） |
| 4.13.2 | 編輯權限 | 勾選 permissions → 儲存 |
| 4.13.3 | owner 角色 | permissions=`["*"]`，不可改 |

### 4.14 Email 設定 `/admin/email-settings`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.14.1 | SMTP 設定（host / port / user / pass / tls） | 儲存後可送測試信 |
| 4.14.2 | 發送測試信 | 收到 = 設定正確 |
| 4.14.3 | 模板列表 | 註冊、忘記密碼、詢價回覆⋯⋯各自可改主旨/內文 |

### 4.15 上線檢查 `/admin/readiness`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.15.1 | 載入 | 顯示檢查項目（DB / SMTP / Media / SEO / SSL） |
| 4.15.2 | 每項狀態 | 綠/黃/紅燈 + 說明 |
| 4.15.3 | 「重新檢查」 | 即時更新 |

### 4.16 登入分析 `/admin/login-audits`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.16.1 | 載入 | 表格列出最近登入紀錄（時間 / 帳號 / IP / 結果） |
| 4.16.2 | 篩選失敗 | 只剩失敗紀錄 |
| 4.16.3 | 匯出 CSV | 下載 |

### 4.17 帳號設定 `/admin/account`

| # | 操作 | 預期結果 |
|---|---|---|
| 4.17.1 | 改姓名 / Email | PATCH → 立即生效 |
| 4.17.2 | 改密碼 | 需驗證原密碼 |
| 4.17.3 | 啟用 2FA（若有） | QR code → 輸入 OTP 確認 |

### 4.18 頂部與側邊導航

| # | 操作 | 預期結果 |
|---|---|---|
| 4.18.1 | 桌面（>1100px） | 側邊欄完整展開，**topbar 無漢堡圖示** |
| 4.18.2 | 平板（820–1100） | 側邊欄縮成 icon |
| 4.18.3 | 手機（<820） | 側邊欄收起，topbar 左上出現漢堡按鈕 |
| 4.18.4 | topbar 標題 | **左對齊**，不在中央 |
| 4.18.5 | 中／英切換 | 全 admin UI 文案跟隨 |

---

## 5. 跨流程整合

### 5.1 從前台詢價到後台處理

1. 前台 `/contact` 送詢價
2. 後台 `/admin/inquiries` 收到、標記「處理中」
3. 改狀態「已回覆」
4. 重整列表：狀態正確、時間戳對

### 5.2 子站建立到 SEO 上架

1. `/admin/sites` 新增子站「茶香林園民宿」
2. tab2 新增頁面「about」
3. tab4 填 SEO 標題、描述
4. tab1 狀態改 active
5. 前台 `https://tea-garden.staycation.com` 可訪問且 meta 正確

### 5.3 帳號加入子站到登入存取

1. `/admin/users` 新增「林宛蓁」
2. `/admin/sites/2` tab3 「+ 新增帳戶」選她、角色 admin
3. 登出
4. 用林宛蓁登入 → 側邊欄「目前網站」選禾境 → 可進編輯器
5. 林宛蓁**無法**編輯 Slowfield Stays（root）

### 5.4 CMS 內容到前台呈現

1. `/admin/cms` 新增 journal 類型頁
2. 切草稿 → 已發布
3. 前台 `/journal/[slug]` 200，列表 `/journal` 也有
4. 改回草稿 → 兩者皆 404

### 5.5 媒體庫到首頁編輯器

1. `/admin/media` 上傳新 hero 圖
2. `/admin/homepage` Hero block 「從媒體庫選擇」→ 選新圖
3. 儲存
4. 前台 `/` 顯示新圖

---

## 6. 回歸檢查清單

每次部署前快速跑一次：

### 後台
- [ ] 4.1 登入登出
- [ ] 4.3 站群（新增、刪除子站、root 不可刪）
- [ ] 4.4.1 站點 tab1 儲存兩次都看到 flash
- [ ] 4.4.2 tab2 新增頁面立即出現
- [ ] 4.4.3 tab3 加入 / 刪除帳戶**不用重整**就更新
- [ ] 4.4.3 帳戶 picker 從 /admin/users 帶資料
- [ ] 4.4.3 owner 列刪除按鈕 disabled
- [ ] 4.5 首頁編輯器拖拉、Featured Collection 即時預覽
- [ ] 4.6 住宿新增 / 編輯 / 上下架
- [ ] 4.7 CMS 新增 / 編輯 / 上下架
- [ ] 4.8 媒體庫上傳
- [ ] 4.11 電子報排程
- [ ] 4.18 RWD 三斷點

### 前台
- [ ] 3.1 首頁、語言切換、訂閱
- [ ] 3.2 住宿列表 + 篩選
- [ ] 3.3 住宿詳細 + 詢價提交
- [ ] 3.4 6 個 CMS URL 全 200（草稿那筆應 404）
- [ ] 3.5 contact 表單驗證 + 送出

### Smoke
- [ ] DevTools console 無 error
- [ ] Network 無 4xx / 5xx
- [ ] Lighthouse Performance ≥ 80
- [ ] Mobile / Tablet 視窗無 overflow

---

## 附錄 A：常見問題快速重現

| 症狀 | 重現步驟 | 已知修法 commit |
|---|---|---|
| Site update failed | tab1 狀態選 review / published 後儲存 | `6bdba0f` + `902ccf1` 起：select 只開放 active/draft/archived |
| 連續儲存第二次無 flash | tab1 儲存 → 不離開頁面 → 再儲存 | `895708d`：flash 用 nonce 當 React key |
| 新增帳戶 405 Method Not Allowed | tab3 + 新增帳戶 → 加入網站 | `a28f4e1`：改用 PATCH 單一 endpoint |
| Modal 失焦關閉 | tab3 modal 中點外圍 | `486f31d`：modal 改 createPortal 到 body |
| 加 / 刪帳戶要重整 | tab3 操作後表格不變 | `6edca97`：accounts 改 derived（不用 useState） |
| 首頁 Featured Collection 是 skeleton | source 選住宿後縮圖空 | `已修`：HomepageBlockEditor 串 `/stays?site=` 即時抓 |

---

最後更新：2026/06/05  
維護者：後台開發團隊
