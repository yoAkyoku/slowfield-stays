# 後台 UX 嚴格本地 QA

日期：2026-10-11
工作樹：codex/admin-ux-improvements

## 範圍與資料

在隔離工作樹測試，使用本地記憶體 SQLite、自建文章與標籤資料。未使用正式站資料庫。前端以 Next production build 在 localhost:3313 執行，後端 localhost:8313。

## 瀏覽器驗收

8 個頁面：工作入口、文章列表、文章標籤、分類／顯示頁面、文章編輯、首頁編輯、Banner 新增、發布待辦。

每頁檢查 320、390、約 767、1024、1280、1600 CSS px，共 48 組。約 767 的實際寬度是 767.5，記錄 innerWidth 為 767。全部通過頁面水平溢出與可見表單控件超出視窗檢查，字體載入完成。

另外人工檢查桌面與平板列表、手機工作入口、首頁區塊設定、Banner 進階設定、搜尋無結果、長標籤換行，以及 modal 開啟、Escape 關閉與焦點回復。

| 發現 | 修正與複驗 |
| --- | --- |
| 手機標籤列表原本約 980px 寬，編輯入口超出畫面 | 使用可用容器寬度切換列表與卡片；手機單欄、平板適合時雙欄，操作入口可見 |
| 平板文章表格欄位擁擠、操作區被裁切 | 同樣改為依容器寬度切換卡片，加入欄位標示與文章專屬勾選名稱 |
| 手機標籤篩選區約 748px 高 | 修正直向 flex basis 與排列；複驗約 228px 高 |
| 概覽與區塊設定出現工程代碼 | 改用既有中文用途名稱 |
| Modal 狀態欄與關閉按鈕尺寸不一致 | 最小 44px 操作尺寸，統一邊框、內距；手機文字輸入／選單 16px |
| 待辦數字、標題與間距不整齊 | 整理標題計數、內距與換行；首頁平板設定面板前方留白縮減 |

320×600 長標籤編輯 modal 複驗：視窗位於可視區域內，內容區可獨立捲動，底部操作可見；5 個文字輸入／選單均為 16px。66 字中文與 82 字英文標籤可正常換行。

## 程式驗證

- 前端完整測試：1,662 通過，0 失敗。
- 後端完整測試：413 通過，2 項既有相依套件棄用警告。
- TypeScript、ESLint、Next production build 通過。
- git diff --check 通過。
- 原工作目錄 HEAD 保持 7e0626e09942eb7252c88ce103f495b344c234c4；未合併、推送或部署。

## 證據

- 矩陣：C:/Users/USER/.codex/visualizations/2026/09/29/01a0ed4b-f915-7e70-a2d6-763a43007ef1/admin-ux-strict-qa-matrix.json
- 桌面標籤 modal：C:/Users/USER/.codex/visualizations/2026/09/29/01a0ed4b-f915-7e70-a2d6-763a43007ef1/admin-ux-tag-modal-final.png
- 平板文章操作：C:/Users/USER/.codex/visualizations/2026/09/29/01a0ed4b-f915-7e70-a2d6-763a43007ef1/admin-ux-articles-tablet-final.png
- 測試與建置紀錄：docs/strict-qa-tests.log、docs/strict-qa-backend.log、docs/strict-qa-build.log。

## 結論與驗證邊界

上述主要後台流程已完成本地視覺、操作與 RWD 複驗。測試使用 Chromium 視窗模擬，未包含實體手機／平板、Safari、Firefox、完整正式站內容或正式部署後驗收，也未驗證 standalone 壓縮部署包。一般內容管理者的學習成本仍需實際使用者操作觀察，不能僅由自動測試證明。
