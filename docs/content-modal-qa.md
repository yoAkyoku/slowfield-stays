# 後台頁面與 Modal QA — 2026-10-15

## 驗收狀態
本輪瀏覽器受先前 URL 安全政策阻擋。以下清單是原始碼盤點，並非實際點擊通過。所有頁面仍需在 390/820/1440px 完成視覺、鍵盤、溢出與 CRUD 驗收；不可用型別或單元測試替代。

## 已修復
- 內容模組表格名稱、狀態、使用量及用途標記字級一致，縮減過大列高。
- 使用位置展開區域限制高度；標籤表格加入捲動說明。
- 共用 content-tag-modal 標題、表單、進階區域與操作列統一尺寸；手機欄位單欄。
- 分類支援搜尋、全部/已選切換、摘要與清除後撤銷；隱藏搜尋結果不影響送出的已選值。

## 頁面盤點 — 瀏覽器待驗收
- [ ] `(dashboard)\account\page.tsx`
- [ ] `(dashboard)\booking-requests\page.tsx`
- [ ] `(dashboard)\cms\banners\[id]\edit\page.tsx`
- [ ] `(dashboard)\cms\banners\new\page.tsx`
- [ ] `(dashboard)\cms\categories\page.tsx`
- [ ] `(dashboard)\cms\page.tsx`
- [ ] `(dashboard)\cms\pages\[id]\edit\page.tsx`
- [ ] `(dashboard)\cms\pages\new\page.tsx`
- [ ] `(dashboard)\cms\tags\page.tsx`
- [ ] `(dashboard)\content-pages\page.tsx`
- [ ] `(dashboard)\email-settings\page.tsx`
- [ ] `(dashboard)\homepage\page.tsx`
- [ ] `(dashboard)\inquiries\page.tsx`
- [ ] `(dashboard)\login-audits\page.tsx`
- [ ] `(dashboard)\media\page.tsx`
- [ ] `(dashboard)\newsletter\[id]\page.tsx`
- [ ] `(dashboard)\newsletter\new\page.tsx`
- [ ] `(dashboard)\newsletter\page.tsx`
- [ ] `(dashboard)\newsletter\subscribers\[id]\edit\page.tsx`
- [ ] `(dashboard)\page.tsx`
- [ ] `(dashboard)\publishing\page.tsx`
- [ ] `(dashboard)\readiness\page.tsx`
- [ ] `(dashboard)\roles\page.tsx`
- [ ] `(dashboard)\sites\[id]\page.tsx`
- [ ] `(dashboard)\sites\[id]\pages\[pageKey]\page.tsx`
- [ ] `(dashboard)\sites\new\page.tsx`
- [ ] `(dashboard)\sites\page.tsx`
- [ ] `(dashboard)\stays\[id]\edit\page.tsx`
- [ ] `(dashboard)\stays\new\page.tsx`
- [ ] `(dashboard)\stays\page.tsx`
- [ ] `(dashboard)\users\new\page.tsx`
- [ ] `(dashboard)\users\page.tsx`
- [ ] `login\page.tsx`
- [ ] `preview\banners\[id]\page.tsx`
- [ ] `preview\block\page.tsx`
- [ ] `preview\content\[id]\page.tsx`
- [ ] `preview\stays\[id]\page.tsx`
- [ ] `reset-password\page.tsx`

## Modal 盤點 — 瀏覽器待驗收
- [ ] `app\admin\(dashboard)\account\AccountPermissionModal.tsx`
- [ ] `app\admin\(dashboard)\cms\categories\CategoryModal.tsx`
- [ ] `app\admin\(dashboard)\cms\tags\ContentTagModals.tsx`
- [ ] `app\admin\(dashboard)\content-pages\CreateWebsitePageModal.tsx`
- [ ] `app\admin\(dashboard)\content-pages\ListingCategoriesModal.tsx`
- [ ] `app\admin\(dashboard)\media\MediaUploadModal.tsx`

## 本輪檢查結果
- Next.js production build：exit 0；有 autoprefixer end 相容性提示，未作為瀏覽器相容性通過證據。
- 完整前端回歸：1731 passed / 0 failed，見 content-modal-qa-tests-final.log。
- 共用分類選擇器聚焦回歸：9 passed。
- 本地 standalone 前端已啟動 3322；未以瀏覽器確認入口連通或畫面。
- 沒有使用正式站資料庫、寄送郵件或操作正式站。

## 其他包含 dialog 的元件（補充盤點，待瀏覽器驗收）
- [ ] `frontend\app\admin\(dashboard)\newsletter\panels\SubscriberPanel.tsx`
- [ ] `frontend\app\admin\(dashboard)\users\UserPermissionLink.tsx`
- [ ] `frontend\app\admin\(dashboard)\users\UserRoleEditor.tsx`

## 2026-10-16 標籤 Modal 錯誤恢復
- 新增、儲存、封存與恢復採用回傳行內錯誤的 server action；HTTP 驗證失敗不再跳走。
- 名稱、英文、代碼、排序、狀態使用受控欄位，失敗保留輸入；成功有中文結果訊息。
- 封存/恢復不受未儲存欄位的瀏覽器驗證阻擋；保存與狀態操作共用 pending，避免重複送出。
- TypeScript noEmit 通過；既有 contentTagsManagement / categoryManagerUx 回歸通過。
- 此輪尚未重新 production build，現有本地預覽不代表這次變更。瀏覽器 QA 仍未完成。

## 2026-10-16 本地完整回歸結果
- 範圍：既有隔離本地回歸及最新 production build；未使用正式站資料庫，未修改正式站資料。
- 前端：1731 passed / 0 failed（local-qa-1016-frontend.log）。
- 後端：447 passed / 2 deprecation warnings（local-qa-1016-backend.log）。
- 最新建置：exit 0，編譯/型別檢查/37 頁產生完成（local-qa-1016-build.log）。
- 不代表逐頁或 Modal 瀏覽器驗收通過。先前 localhost URL 存取政策阻擋尚未解除，本輪未重試或繞過；桌機/平板/手機視覺、焦點、溢出及真實 CRUD 點擊仍待驗收。
