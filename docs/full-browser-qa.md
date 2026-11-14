# 前後台瀏覽器 CRUD QA — 2026-10-11

狀態：進行中，尚未達到全功能通過。

## 環境與範圍

- 工作樹：codex/admin-ux-improvements；主 checkout 未修改。
- 本地入口 http://localhost:3313，前端 3314，後端 8313，全部 loopback。
- 使用新建的 in-memory SQLite 測試資料，未使用正式站資料庫。
- 真正應用程式 API 與模型；SMTP transport 改成本地 JSONL 收件匣，沒有寄送外部郵件。
- 使用者已授權隔離 QA 全域管理權限及本次 CRUD QA 資料永久刪除。

## 已實際操作的覆蓋

| 模組 | 瀏覽器驗證 | 未完成 |
|---|---|---|
| 標籤 | 新增、中英文更新、封存 | 還原、完整位置與跨站隔離 |
| 文章 | 新增、發布、公開內容、更新、刪除後 404、還原 | 多分類、卡片標籤、批次操作完整組合 |
| 住宿 | 新增、必填發布驗證、公開內容、更新、軟刪除與還原 | 房型完整 CRUD、設施與搜尋組合 |
| 媒體 | 上傳、改名、圖片載入、Banner/電子報引用 | 刪除與引用保護 |
| Banner | 新增、發布、更新、前台主視覺、軟刪除/還原 | 留白文案與所有進階設定 |
| 訂閱者 | 公開訂閱、後台新增/更新、軟刪除/還原 | 永久刪除、重複與退訂 |
| 電子報 | 新增、更新、圖片預覽、佇列、排程/取消、本地寄送捕捉、刪除/還原/永久刪除 | 多封批次、失敗重試、自動排程計時 |
| 子站 | 新增、名稱/聯絡更新、公開前台 | 刪除及完整設定 |
| 子站頁面 | 新增、富文字區塊保存、公開內容、導覽隱藏 | 刪除、排序完整驗證 |
| 一般詢問 | 公開提交、聯繫/報價/結案、刪除/還原/永久刪除 | 其他來源與負向條件 |
| 訂房請求 | 公開提交、CSV、軟刪除/永久刪除；住宿 ID 修復後 CSV=2 | 還原及全部状态流程 |
| 使用者 | 帳號清單、權限 modal、停用/啟用操作 | 新密碼建立須人工輸入、正確 fixture 角色隔離重測 |
| 角色 | 清單與權限格檢視 | 權限改動與跨站負向測試 |

## 本次修復與證據

1. 電子報排程/寄送 server action 成功後 redirect 被 catch 當成錯誤。改為返回結構化結果、刷新列表；排程與寄送已瀏覽器重測成功。
2. 既有電子報編輯改用與新增相同的富文字編輯器。保存後重新載入文字仍在，編輯與預覽圖片均正常載入。
3. 網站頁面預覽 modal 增加 dialog 語意、關閉名稱、Escape、焦點還原與基本焦點限制。關閉名稱與 Escape 已瀏覽器重測。
4. 住宿詢價連結的 stay query 未送進表單 payload。僅接受正整數並加入 stay_id；重測 CSV booking id=2 / stay_id=2。
5. QA fixture 原本所有使用者誤設全域角色，已修正 seed 文件；執行中的舊 fixture 尚未重啟，因此權限隔離不得列為通過。

新增的 4 項針對性回歸測試通過；分類相關測試共 33 項通過。最新分類修復 build 成功，本地前端已重新啟動。
完整回歸：前端 1666 通過（包含第 4 項分類回歸測試）；後端 413 通過。結果見相鄰 log。

## 目前阻礙與待釐清

- 網站頁面刪除原生確認之後，QA 分頁互動停滯；讀畫面正常，但多個分頁按鈕無反應。新分頁、重新載入、鍵盤操作皆試過；尚不能判定產品刪除失敗。已請使用者關閉卡住的本地分頁，正式站不操作。
- legacy root contact 設定儲存後出現在文章分類清單：已修復為有 blocks 的 legacy 頁面不當分類，明確 cms_list 保留；33 項測試通過，瀏覽器複驗待續。
- 文章標題更新多出 CRUD，需區分輸入工具競態與產品問題。
- SQLite 時區欄位丟失 offset；本地時間顯示與正式 Postgres 不等價，不據此宣稱正式站時區有誤。
- 真 SMTP、收件端 Email 相容性與排程 daemon 尚未驗證。

## 證據

視覺檔案位於 C:/Users/USER/.codex/visualizations/2026/09/29/01a0ed4b-f915-7e70-a2d6-763a43007ef1：

- full-browser-crud-results.json
- newsletter-schedule-qa.png
- newsletter-rich-edit-qa.png
- booking-purge-qa.png

CSV：C:/Users/USER/Downloads/form-contacts-2026-10-11 (1).csv。

此報告是進度紀錄，不是全站驗收結論；剩餘項目須繼續瀏覽器測試。


## 接續操作紀錄

- 重新取得瀏覽器、AX 與 Playwright 操作、顯示瀏覽器、Escape、確認視窗查詢與卡住分頁重新導向均已嘗試。文字輸入可變更，但按鈕沒有可確認的結果；卡住分頁仍逾時。未將嘗試操作列為 QA 通過。
- 已請使用者手動關閉本地 /admin/sites/3 分頁以恢復控制；未操作正式站分頁。
- 保留執行中的隔離 QA 資料，不重啟 fixture，權限隔離測試仍待完成。
- 最新完整前端回歸：1666 passed / 0 failed。


## 第二次接續驗證

- 新建本地瀏覽器分頁可以導向並讀取內容；寄送說明按鈕与網站切換仍未生效，原卡住分頁仍存在。未再次重複逾時操作。
- 隔離的新記憶體 fixture 以 FastAPI TestClient 執行 18 項權限 HTTP 檢查，全數通過。涵蓋 manager/editor/reader 全域角色及帳號讀取、主站與子站標籤資料隔離，以及主站/子站新增權限。這不替代瀏覽器驗收；正在執行的舊 fixture 尚未重啟。日誌：full-browser-qa-permissions-http.log。
- 瀏覽器文章工作台的顯示頁面選項僅有最新消息、慢域體驗。此觀察為 CRUD QA 子站，主站 legacy contact 案例仍待切站複驗。
- 實測 CSS 寬度 1440/1024/390px，整頁無水平溢出；手機 screenshot 顯示側欄遮蓋內容，因此介面美觀及側欄不能列為通過，需在正常互動狀態複驗。截圖：cms-mobile-qa-resume.png。已還原臨時 viewport。


## 新分頁與直接入口複驗

- 依使用者要求新增本地 QA 分頁，測試代理入口 3313 與前端直接入口 3314。兩者可載入頁面，但電子報寄送流程按鈕皆沒有顯示 modal；不可列為互動測試通過。
- JavaScript 與 webpack 資源 HTTP 200、Content-Type 正確，未觀察到 CSP 阻擋或 console error。尚未證實根因，不能將問題判定為產品 CRUD 缺陷。
- 主站文章工作台顯示頁面選項複驗：顯示頁面／慢域體驗／最新消息，沒有一般頁面或英文 slug 混入。
- 原卡住分頁的關閉指令仍逾時；新分頁沒有解除互動阻礙。瀏覽器 CRUD 驗收仍未完成。

## 2026-10-11 Browser QA resumed

The previous browser interaction blocker is resolved. Local site 3 page `crud-qa-resume` was created and reordered; reload preserved ordering. Added a rich-text block with heading CRUD QA 頁面內容驗證 and local QA body text, saved and reloaded successfully. Site page preview rendered the same heading/body and navigation/footer links. Tablet and Mobile preview controls worked; close removed the dialog.

Subscriber deleted-list entry and write permission gating were fixed. Browser soft-delete and restore passed. Mobile subscriber table now scrolls within its region at CSS width 390; table width 640 and region width 356; keyboard ArrowRight changed scrollLeft to 50. Permanent purge awaits fresh confirmation requested by automatic safety review.

Latest full frontend regression suite: 1668 passed, 0 failed. Latest production build passed. These are regression checks, not proof that all browser CRUD coverage is complete.

Media delete warning correctly reported two banner uses of CRUD QA 主圖.jpg. No permanent deletion performed. The inspected current newsletter draft has no images, so missing newsletter media usage is not established by that draft.

Evidence: page-crud-saved.png, page-crud-preview-mobile.png, subscriber-mobile-fixed.png in the session visualization folder.

### New confirmed defect: tag Restore rejected
Browser archive succeeded, Restore did not change the row. Backend logs confirmed PATCH /cms/tags/5/status returned 422 for restore. Root cause: endpoint used ContentStatusUpdate which excludes active, despite endpoint logic requiring active/archived. Added ContentTagStatusUpdate and assigned it to the endpoint. Added real HTTP archive/restore/invalid-status/permission regression; test_admin_ux_workflow.py: 4 passed. Running browser backend retains the previous loaded module; browser retest requires a separate fresh fixture or restart after preserving current QA data. Do not mark browser Restore passed yet.

## Further remaining QA — 2026-10-11

- Article id 13: changed title with fill (no extra CRUD suffix), selected experience and news, selected four topics including a custom topic and three card labels. Save/reload preserved all settings. News list prints all three card labels. Saved article preview renders heading/body/topics.
- Homepage news variant printed only card.tags[0]; fixed to render all labels. Browser verified all three after build/restart. Three copies in DOM are ScrollRail loop copies, not a source-deduplication defect; do not count them as duplicate articles.
- New isolated fixture uses backend 8315, frontend 3316, ingress 3315. Original QA 3313 data retained. Tag archive/Restore now passed through browser and reload.
- Duplicate subscriber creation overwrote existing name/groups/status. Changed admin POST to reject existing email with 409; HTTP regression passed. Browser new fixture confirmed existing name and QA group preserved. Error incorrectly returned to campaign list; frontend action now uses direct adminJsonRequest and subscriber return path; pending latest-build browser recheck.
- Browser permission checks on new fixture: editor main tags writable; users/roles/newsletter direct pages 403. Switching child displays 0 child tags, no create button; new article page has no Save. Reader main tag page has 0 Add, 0 Edit, 4 View; view modal no Save/archive controls. No permissions granted during this pass.
- Booking id 2 transitions new/contacted/quoted/closed passed, soft delete and Restore passed; dates/guests/closed state retained.
- Stay id 2: room name/description updated, second room QA 四人房 with price 12000/capacity4 created, save/reload passed. Search facility 戲水池 persisted and public search returned only this stay. Detail room tab data printed both rooms. Room removal remains untested pending permanent-deletion confirmation.
- Amenity WiFi rendered WiFi · WiFi on detail page; added explicit bilingual separator handling to localizeAmenity and regression. Added accessible room-remove/custom-amenity button names. Latest build/retest pending.
- Backend full suite from backend cwd: 415 passed, 2 deprecation warnings. Targeted frontend regressions: 9 passed. Prior full frontend 1668 passed predates the three latest tests/changes.

Still incomplete: permanent-delete cases awaiting fresh confirmation, complete batch article/newsletter tests, retry/scheduled daemon and real inbox compatibility, full advanced Banner/site settings combinations, new-user password entry (human), remaining responsive visual matrix.

## Batch send and responsive follow-up — 2026-10-11

- New fixture 3315 campaigns CRUD QA 批次 A and B: selected both, sent through local JSONL transport, UI reported both complete. Reload cleared queue; campaign list showed both sent, recipient count 1 each. Outbox had exactly one A and one B record addressed to qa-recipient@example.com. No external SMTP delivery.
- Duplicate subscriber error now remains on subscribers tab; existing name/group unchanged. Actual browser error was English. A Chinese flash mapping is added in source but not yet rebuilt.
- Stay amenity duplicate WiFi display fixed and browser retested after latest build.
- Responsive tag modal and tablet list inspected; page horizontal scroll did not exceed viewport. Requested viewport 390/820 was reported by browser as CSS 487/1025, so these observations must not be labeled exact 390/820 breakpoint acceptance. Viewport reset.
- Empty Chinese tag name blocked by native required validation, dialog remained open; no new record. English Summer search returned only summer tag, counter 1/4.
- Two sent campaign timestamps display 12:13 while browser send log is 20:13 Taipei. Needs diagnosis of timezone-less timestamps in SQLite fixture before classifying as a production defect.
- Screenshot evidence: newsletter-batch-send.png, newsletter-mobile-batch-list.png, tags-modal-mobile.png, tags-tablet.png.

Remaining: fresh-confirmation permanent purge; article batch operations; full advanced settings and frontend RWD matrix; retry failure/scheduler daemon; actual email client rendering; new-user credential entry by human. This remains an in-progress browser QA report.

## Article batch and Banner settings — 2026-10-11

- Fresh fixture 3315 article IDs 12 and 8: selected two drafts, batch soft-delete confirmation displayed count 2; deleted list contained exactly both. Individually restored with confirmation, active list retained draft, page category, topics and card label.
- Article 12 submitted for review, overview showed 待審. Changed to published and saved; /news contained article and /news/qa-12 rendered heading/body/navigation/related articles. Status action returned to CMS overview rather than preserving list context; workflow improvement remains to inspect.
- Banner 1: changed title size small, alignment left, shadow soft, background #123456, title-role size 32px. Saved/reloaded; left, #123456, 32px persisted. Down-explore text remained empty after save/reload.
- Browser tab accessibility label changes to 標題（已設定） once overridden; test must use current aria label, not visible bullet text.
- Responsive capability did not produce requested dimensions on QA tab this pass (actual CSS width 755); exact breakpoint verification remains incomplete. Reset viewport.
- Newsletter time discrepancy source: campaign payload returns raw DateTime; SQLite may strip timezone. This is a local-fixture hypothesis, not confirmed production failure.
- Evidence: article-batch-restored.png, article-public-mobile.png (actual 755px, filename is not dimension proof), banner-advanced-persisted.png.

## Failure retry, scheduled protection and verified responsive sizes — 2026-10-11

- Added third loopback-only fixture: backend 8317/frontend3318/ingress3317, preserving original3313 and3315 records. Optional local fail-once marker and scheduler-enable marker; transport still JSONL, no SMTP. Third fixture was reset once to load backend fix; two original fixture datasets retained.
- Browser failure injection established actual failed delivery; original SendPanel said sent successfully despite failed1. Fixed processCampaignAction to retain backend counters via adminJsonDataRequest; UI now reports queue sent/failed/skipped numbers, not campaign-specific success (backend processes site queue).
- Browser retest: failure log explicitly printed sent0/failed1/skipped0 and retry instruction. Retry returns to send tab. Initial retry workflow requeued then processed successfully with exactly one outbox success. Second retry was automatically drained by enabled local scheduler.
- Scheduler integration uncovered future scheduled deliveries being sent during another queued campaign's site-wide sweep. Added query exclusion for scheduled campaigns before claim. Real database regression tests10passed. Full backend416passed2warnings. Full frontend1673passed; latest production build passed.
- Corrected browser fixture retest: CRUD QA 同站待寄 sent before21:10; CRUD QA 到點前保護 remained scheduled, no outbox record before due. After21:10 it became sent; outbox had exactly one record each. Local scheduler control marker removed after test.
- Exact viewport control calibrated (OS zoom scales requested size): requested312x675 gives CSS390x844; requested656x944 gives CSS820x1180. Actual dimensions recorded. CSS390 send center/campaign list and homepage no document horizontal overflow; homepage no completed broken images. CSS820 tag page no document overflow. Viewport reset. These are selected pages, not complete frontend/backend RWD acceptance.
- SQLite timestamp display still8hours behind expectedTaipei; raw naive DateTime payload remains suspected. Not classified as confirmed production defect.
- Screenshots: newsletter-failure-feedback-fixed.png, newsletter-before-due-protected.png, newsletter-after-due-sent.png, send-center-css390.png, homepage-css390.png, tags-css820.png.

Still pending: permanent purges awaiting confirmation; full site/advanced setting combinations; remaining RWD/visual pages; actual email-client compatibility and human credential-entry cases. No all-site acceptance claim.

## Site footer and SEO browser QA — 2026-10-11

- Isolated local fixture at localhost:3317 only; no production database or SMTP used.
- Site 1 footer brand title, left copy and Chinese copyright saved through UI. Reloaded editor retained copyright and public homepage rendered all three exact test strings.
- English copyright saved separately. Public language menu switched to English and footer rendered `© 2026 CRUD QA English Copyright`; Chinese brand/copy fallback remained as expected with English fields blank.
- Site Chinese SEO title and description saved through UI. Public DOM verified document title and og:title `CRUD QA 搜尋標題 | 本地 QA 主站`, description exact saved text.
- Desktop site page manager inspected at actual 1600 x 900; document scrollWidth 1587, no document horizontal overflow.
- Responsive viewport control did NOT apply in this continuation: requested 390 CSS target remained actual 1600 x 900 after two attempts. This is tool/environment evidence, not responsive acceptance. `site-settings-css390.png` is misnamed desktop evidence and must NOT be used as mobile proof. Override reset.
- Browser evidence: footer-public-persisted.png, footer-english-persisted.png under current visualization proof root.
- Outstanding: complete verified mobile/tablet matrix, remaining settings workflows, credential handoff and pending permanent deletion confirmation. Full browser acceptance remains incomplete.

## Remaining settings and responsive QA — 2026-10-12

- Restarted isolated fixture 8317, frontend3318, ingress3317 after prior processes stopped. Memory database reset; prior evidence remains historical, not current fixture data.
- Actual CSS viewport verified 390x844 and820x1180. Site settings mobile scrollWidth377; email settings tablet807. Six additional mobile pages (content-pages, publishing, users, roles, media, stays) document widths390/377 without document horizontal overflow. Saved screenshots and visually inspected their first screens; this is not full-page/full-CRUD acceptance.
- Search guest range UI changed first range3–5 to2–4, saved; public English dropdown showed2–4guests; selecting it navigated /stays?region=&destination=&guests=2 and returned fixture stay. All other ranges preserved.
- Email From nameCRUD QA Sender and dailycap25 saved/reloaded. No credentials changed. Send-test action attempted, but final outcome was not established; do not mark send-test pass.
- Logout and existing credential login passed. Login analytics rendered success recordmanager@example.com/127.0.0.1, unmatchedemailfilter yielded empty, Reset restored row.
- Roles first load hit AdminDataError(/roles) network catch; fullreload recovered. Root cause not proven, do not claim a production code fix for this.
- Mobile roles selector labels overlapped/cropped. Added compact two-column role tab CSS in globals.css. Browser verification pending.
- Normal rebuild encountered repeated external Google font ECONNRESET. Interrupted build; local-only scripts/local-qa-font-mock.cjs created using next/font test hook and Windows Times font. QA mock build is pending. This artifact must never be deployed or used as real-font visual acceptance. Site frontend temporarily stopped for rebuild. Backend/ingress retained.
- Evidence: site-settings-verified-css390.png, search-range-public-css390.png, email-settings-css820.png, login-audit-reset-css820.png, qa-{content-pages,publishing,users,roles,media,stays}-verified390.png. Proof root is current visualization session.
- Remaining: restart frontend after build, retest role selector, complete tablet/editor/full-page matrix, real-font build and acceptance, remaining credential/purge cases with required human action-time confirmation. Overall browser QA is incomplete.

## Role mobile repair, homepage workflow and email test feedback — 2026-10-12

- Offline QA font build completed (exit0); frontend restarted at3318, ingress3317/backend8317 retained. Fonts are Windows Times fixtures through NEXT_FONT_GOOGLE_MOCKED_RESPONSES; no production-font or deployment acceptance inferred.
- Roles390px: six labels render in two columns, each~144px with equal client/scroll widths; no clipping and document width377. Reader role switch, CMS search, Grid/Tags view passed. No permissions were changed. Evidence roles-fixed-verified390.png.
- Homepage authored a local Text & Image block, heading CRUD QA 首頁圖文 and body CRUD QA 首頁內容，驗證手機編輯與存檔。. Undo twice cleared title/body; Redo twice restored. Arrange mode moved it before News; save/reload retained order and public homepage showed exact text.
- Referenced existing local QA media6ec2823cdaeb48169af2b6c8f60c2bb0.jpg. Natural width1280. Verified CSS390/820/1440: document scrollWidth390/807/1427, image~334x250 /709x532 /442x331. Mobile/tablet stack, desktop two columns visually checked. This authored short-copy case is not full acceptance of all production About content and font settings.
- Visibility: hide/save removed public heading (count0); show/save restored count1. Block retained after reload. No permanent removal performed.
- Email test initially returned422 for empty SMTP host (expected validation) but transient redirect feedback was not observable. Added EmailTestPanel with persistent inline status/alert, pending button/input disabling, retained recipient and connection failure handling. New testEmailSettingsResult returns AdminResult instead of redirect; legacy action retained. Added Chinese empty-host guidance.
- Browser failure: SMTP host is empty rendered inline, recipient retained, alert remained after8seconds; CSS390 document377. Chinese switch showed 測試信未寄出 / 尚未設定 SMTP 主機，請先填寫寄送設定並儲存。.
- Browser success: configured only local QA smtp.gmail.com host, fake fromaddress, enabled localsettings; no password entered. All SMTP transport remains capture_email JSONL, no SMTP socket/external email. UI Test email sent and outbox one matching Slowfield Stays CMS email test recipient qa-recipient@example.com. Restored empty host/fromaddress and disabled delivery afterward; Sent today1 is the captured localtest.
- Regression: initial direct Node invocation omitted project resolver and failed to load extensionless imports; corrected project tsResolve invocation12 targetedpass. Latest full frontend1674passed0failed. Latest QA mock buildexit0. Logs full-browser-qa-frontend-email-feedback-zh.log and full-browser-qa-email-feedback-zh-build.log.
- New files/changes: EmailTestPanel.tsx, emailActions.ts, email-settings/page.tsx, flashMessage.ts, browserQaRegressions.test.mts; earlier globals.css role mobile repair.
- Evidence in current visualization root: roles-fixed-verified390.png, homepage-image-tablet-view.png, homepage-image-desktop-view.png, homepage-image-mobile-view.png, email-test-success-persistent.png, email-test-failure-visible390.png, email-test-failure-zh390.png.
- Remaining: real-font visual/build validation, long-copy About variants, additional editor/tablet/full-page matrix and remaining CRUD/security-sensitive operations that need action-time authorization/credential handoff. Overall full browser acceptance remains incomplete. Latest frontendserver10108/backend57841/ingress11265. Viewport reset; tab14 retained for continuation.

## Continuation and subscriber lifecycle — 2026-10-13

- Previous local processes were no longer running; browser localhost3317 initially returned connection refused. Restarted existing isolated SQLite-memory harness8317, frontend3318 and loopback ingress3317. Fixture reset; previous runtime edits are historical evidence only. Current sessions backend60979/frontend79959/ingress3550.
- Browser public footer subscription crud-qa-1013@example.com showed success; admin subscribers list contained exactly one matching record, public group. Edited name CRUD QA 1013 and status unsubscribed; saved row reflected both. Explicit new public subscription restored subscribed status, preserved name, and total remained2.
- Soft deletion confirmation explicitly states recoverable. Confirmed via fresh AX button129; active list shrank to1, deleted list showed exact QA record. Restore completed; deleted list empty, active list2 with same name/group/status. No permanent deletion performed.
- Responsive subscriber list actual390x844 and820x1180, document scrollWidth390/820. Phone table provides horizontal scroll within its container; tablet all columns visible. Edit modal visually fits both dimensions; no role=dialog found (accessibility follow-up needed). Proof Temp/qa-subscriber-1013-mobile.png.
- Contact page seed contains only newsletter subscription, no inquiry form; this fixture cannot establish contact-form submission acceptance until a form is configured.
- Prepared new account CRUD QA 1013 Reader / crud-qa-reader-1013@example.com / reader / main site. Password blank; no account submitted. Human password-entry/submission handoff requested per browser policy. Proof Temp/qa-account-handoff-1013.png. Tab3 retained, viewport reset.
- Full QA remains incomplete: outstanding account/permission lifecycle, permanent deletion cases, real-font long-copy homepage/editor matrix and configured public contact forms. Existing real-font build was reused; no new code/build/test-suite run in this continuation.

## Subscriber dialog accessibility follow-up — 2026-10-13

- Existing backend fixture confirmed live by browser: two subscribers retained. No database restart.
- Edit modal Escape closed and returned focus to originating Edit button. Source confirmed native dialog/showModal; absence of explicit role attribute is not a defect. Earlier [role=dialog] selector alone was insufficient evidence.
- Confirmed native dialog had no aria-label/aria-labelledby and X button no accessible name. Added subscriber-edit-title heading ID, aria-labelledby on dialog, bilingual Close subscriber editor aria-label on X.
- QA real-font cached build completed exit0 (full-browser-qa-subscriber-dialog-build.log); frontend restarted session21602 on3318. Backend60979/ingress3550 retained.
- Reloaded browser: getByRole(dialog,name=編輯訂閱者).count()=1; close button announced 關閉編輯訂閱者. Clicking it removed dialog (count0). Screenshot C:/Users/USER/AppData/Local/Temp/qa-subscriber-dialog-fixed-1013.png. Tab5 retained.
- No all-site acceptance claimed. Human credential handoff, permanent purge, configured public contact form and remaining real-font RWD/editor matrix still outstanding.

## Configured contact form and inbox presentation — 2026-10-13

- Existing isolated backend retained. Through UI added contact_form block to main contact page, title CRUD QA 聯絡表單, inbox 本站（本地 QA 主站）, source 企劃合作. Saved; public /contact rendered exact heading and fields.
- Blank submit focused required name with browser validation. Valid QA sender/subject/message submitted; public gratitude and Again button shown. Admin inbox contained exactly one new record, source partnership, matching subject/message/name/email. Status changed New to Contacted and retained after frontend rebuild/reload.
- Found display defects: raw partnership shown in Chinese inbox, and general inquiry inherited backend default2guests displayed as actual stay requirement. Added inquiryPresentation helpers: bilingual known-source labels, unknown code preserved; guests rendered only when booking/stay/date context establishes stay intent. Storage schema and recorded values unchanged.
- Two targeted regression tests pass. Build full-browser-qa-inquiry-presentation-build.log exit0. Frontend49307 on3318, backend60979/ingress3550 retained. Full frontend regression session73460 still running at last checked handle; not marked passed.
- Browser reload confirmed source summary and row now企劃合作, no2位 on general contact, status已聯繫. Proof Temp/qa-inquiry-fixed-mobile-1013.png. Actual390px inbox scrollWidth377; public contact390 scrollWidth390 and820 scrollWidth807. Visual screenshots inspected; native invalid-email bubble appeared and invalid field remained. No public submit of invalid data claimed.
- Public success proof Temp/qa-contact-success-1013.png. Viewport reset and tab5 retained. Full QA remains incomplete (new account human credential step, permanent purge gates, booking/contact variations and remaining real-font editor/RWD matrix).

## Inbox lifecycle, CSV and phone/LINE search — 2026-10-13

- Frontend full regression session73460 completed exit0:1683passed/0failed, duration530657ms (full-browser-qa-inquiry-presentation-tests.log). This is automated regression, not all-site browser acceptance.
- Browser inquiry1 progressed Contacted to Quoted to Closed. Reload confirmed Closed and dashboard active0/closed1.
- Actual telephone keyword0912345678 incorrectly returned0rows despite matching visible record. API predicates only covered name/email/subject/message; frontend narrowing cannot recover rows omitted by API. Added phone and line_id ILIKE escaped clauses to both Inquiry/BookingRequest predicates. Authored SQLite execution plus existing escaping tests:12passed. Existing live backend60979 still imports pre-fix code; browser revalidation after controlled backend reload/recreated UI fixture remains required. No false browser-pass claim.
- CSV download via UI succeeded at C:/Users/USER/Downloads/form-contacts-2026-10-13.csv. Read header/row confirmed exact QA sender, phone, kind=inquiry, status=closed, source=partnership and message. Found subject missing from export; added subject header so original subject is preserved. Latest CSV code requires rebuild/browser export recheck; prior CSV proves pre-fix omission.
- Reset search restored1row. No permanent deletion performed. Remaining scope preserved: browser keyword/CSV revalidation, CRUD/purge/account/permission gates and full RWD/editor matrix.

## Search and CSV browser revalidation — 2026-10-13

- Controlled reload of isolated backend reset memory fixture; old QA runtime records are historical. Backend72848 on8317, frontend30043 on3318, ingress3550 retained. CSV build full-browser-qa-inquiry-csv-build.log exit0.
- Browser recreated contact_form on main contact page, 本站 recipient, CRUD QA 搜尋複驗 heading. Submitted CRUD QA 搜尋案例 / qa-search@example.com with phone0912345678 and LINE qa_line_1013, subject主旨匯出驗證, unrelated body只在聯絡欄位提供查詢字串。. Public success and admin row confirmed.
- Phone keyword and LINE keyword each independently returned exact1row (getByRole row filtered by QA name count1); neither keyword occurred in name/subject/message. This completes browser revalidation of Inquiry phone/LINE path. Booking path has SQLite tests but still needs browser fixture.
- UI CSV exported C:/Users/USER/Downloads/form-contacts-2026-10-13 (1).csv. Import-Csv confirmed kind/name/phone/line_id/subject/message exact expected values, including formerly missing subject. This completes latest CSV fix browser recheck.
- Soft delete removed row from active list; deleted status filter showed1record, with original values. Opened Permanent delete confirmation for only CRUD QA 搜尋案例; no purge submitted. Fresh action-time confirmation requested via async question under browser policy; waiting for human answer. Proof Temp/qa-inquiry-purge-ready-1013.png, tab5 retained.
- Goal remains active: permanent purge/account credential and permission gates, booking variants, remaining full real-font RWD/editor matrix. No overall completion claim.

## Booking form date order, retention and approved inquiry purge — 2026-10-13

- UI switched existing contact block to booking form and saved; public form displayed check-in/out and guests. Browser booking phone0922222222 and LINE qa_booking_line each returned exact1row in inbox, completing live booking-path search revalidation.
- Found real date-order failure: check-in2026-11-02/check-out2026-11-01/guests4 submitted successfully and persisted in booking inbox. Added create-only Pydantic date validators to InquiryCreate/BookingRequestCreate, reject checkout<=checkin when both supplied. Read models share field base but do not reject legacy invalid dates, so existing bad rows remain viewable. Regression initially4failed/4passed; fixed10targetedpass. Full backend426passed/2warnings (full-browser-qa-booking-dates-backend-tests.log).
- Frontend added bilingual role=alert date error before POST. First browser retest exposed React form action resets inputs even on rejected client validation. Replaced action binding with native onSubmit preventDefault and FormData callback to retain values on failure. Latest retention build exit0; frontend41720 on3318. Contact/inquiry frontend subset52passed.
- Browser final: invalid dates show specific error, name/email/both dates/guests4 remain populated. Changing only checkout to2026-11-03 submitted successfully; inbox exact QA 日期保留 row2026-11-02—2026-11-03/4guests. Existing live backend72848 has NOT been reloaded for new create validators; schema/full backend tests prove code validation but live direct API recheck remains pending. Backend not restarted to preserve purge object while awaiting approval.
- User action-time approval received for only deleted inquiry CRUD QA 搜尋案例 / qa-search@example.com / subject主旨匯出驗證. Re-read tab5 confirmation named exactrecord, clicked confirmed permanent delete. Reloaded deleted view0/0, no restore/purge row. No other record permanently deleted. Proof Temp/qa-inquiry-purge-complete-1013.png.
- Date retention proof Temp/qa-booking-date-retained-1013.png. Tabs5/6 retained, no viewport override used. Goal remains active; remaining account/permission gates, other purge modules and real-font/editor/RWD coverage not completed.

## Live date API and real-font tag tablet repair — 2026-10-13

- Started additional isolated memory QA backend8319/session10063 with new schema code, leaving existing browser fixture8317 unchanged. Loopback HTTP POST to both inquiries and booking-requests: checkout before/equal checkin returned422 with exact date-order error; checkout after checkin returned201. Sandbox socket access was denied initially; authorized loopback escalation succeeded. Stopped extra backend after six requests. This completes runtime HTTP validation of the date code, without resetting browser QA data.
- Real-font tags viewport verified1440/820/390. Heading font stack includes Cormorant Garamond/Noto Serif TC from existing official font cache build. Desktop width1427 at1440; tablet807 at820; mobile377 at390.
- Tablet search field measured150.09px height (minimum42) versus ordinary desktop. Cause: inherited flex-basis180px becomes vertical basis at max820 while prior mobile grid fix applied only<=767. Added scoped768–820 grid layout and flex:none labels. Existing responsive regression3pass; build full-browser-qa-tag-tablet-build.log exit0.
- Browser rebuilt/reloaded820: search height41.99px, full-width search followed by two side-by-side selects and full-width apply button; no document overflow. Mobile search43.997px. Native sidebar hydration briefly rendered transition state; stable computed sidebar right0/offscreen and mobile menu returned; transient screenshot not accepted as stable failure.
- Add-tag modal at390: bounding width369.99,height572.11,top136,bottom708 within844; no modal vertical overflow (client570=scroll570), close button worked and returned focus to Add tag. No tag record created in this visual test.
- Proof Temp/qa-tags-realfont-1440.png and Temp/qa-tags-tablet-fixed-820.png. Viewport reset, tab6 retained. Current frontend66104 on3318; old browser backend72848/ingress3550 retained. Other modules/RWD/editor and human credential/permission/purge cases remain outstanding; goal active.

## Article editor, labels, publish and copy link — 2026-10-13

- Existing backend/browser fixture remained live. Opened QA draft article12 from overview. Actual tablet820 scrollWidth807; mobile390 scrollWidth377. These measure editor document overflow only, not all controls/visual acceptance.
- UI card-label modal selected親子 alongside宜蘭; updated summary CRUD QA 文章摘要：平板與手機編輯、卡片標籤保存及預覽驗證。. Saved then reload: summary exact, card-label button宜蘭、親子 and card preview both labels retained.
- Mobile immediate-preview opened, device radio手機 selectable, close worked. Screenshot unexpectedly shows mostly blank/offscreen content while DOM dialog bounds top28,bottom816 within844. Direct tab screenshot corroborated visual issue; cause not proven. Do NOT mark preview mobile visual acceptance passed; saved qa-article-preview-mobile-1013.png is failure/uncertain evidence, not deliverable proof.
- Published article12 through UI; saved status已發布. Public homepage card showed宜蘭+親子 with exact new summary and correct /news/qa-12 link. Opened public article: title/body/related rows visible, actual390 scrollWidth390. Public screenshot qa-article-published-390-1013.png visually inspected.
- Copy link clicked on article public page; clipboard compared privately to exact http://localhost:3317/news/qa-12, true; UI button changed Copied. No clipboard contents outside this comparison exposed.
- No code changes this continuation. Viewport reset; tab6 retained public article. Remaining preview discrepancy, full editor controls/matrix, human credential/permission and other module purge cases not completed. Goal remains active.

## Article preview focus and screenshot-coordinate diagnosis — 2026-10-13

- Fresh tab7 reproduced default viewport screenshot showing only modal bottom despite dialog DOM top28/bottom816 inside390x844. Source confirmed article preview claims aria-modal but previously called useOverlay without trapFocus; opening focus remained outside modal.
- Added previewPanelRef wired to modal/useOverlay trapFocus, createPortal to document.body and draft maxWidth100%/minWidth0. Build full-browser-qa-article-preview-build.log exit0; current frontend32466 on3318. Shared preview/overlay tests31passed; new caller wiring testsarticlePreviewModal3passed. Initial test-file write used incorrect doubled frontend path; corrected before successful test run.
- Portal alone did not change anomalous default screenshot. Explicit screenshot clip comparison established coordinate scaling: browser request312x675 yields effective390x844 (1.25). clip y=scrollY/1.25,width312,height675 produces full390x844 image consistent with dialog DOM; clip using unscaled current scrollY reproduced cropped bottom. This is screenshot capture-coordinate evidence, not proof the website's modal was offscreen. Supersedes prior mobile visual uncertainty for this verified viewport.
- Browser actual mobile390: draft clientWidth=scrollWidth282; device radio手機 selected. Draft screenshot full modal visible, no horizontal clipping. Saved-version radio loaded actual /admin/preview/content/12 iframe with title/summary/tags/body. Proof Temp/qa-article-preview-verified-390.jpg and Temp/qa-article-saved-preview-verified-390.jpg.
- Keyboard: opening focus moved to draft-source radio; Tab from Close wrapped to first source radio; Shift+Tab from first source radio wrapped to Close; Escape removed dialog/count0 and returned focus to Preview button. This verifies real caller focus trap, beyond shared-hook tests.
- Viewport reset; tab7 retained. No article data modified. Goal remains active for remaining editor/device matrix, other module CRUD/purge and human credential/permission cases; not all-site acceptance.

## Existing reader role and cross-site negative QA — 2026-10-13

- Used existing authored reader@example.com/local-qa login, no new credentials/access created. Logout/login passed. Sidebar omitted stays/media/users/roles management modules.
- Main tags read-only: Add tag count0/Edit count0, View buttons present, permission note僅檢視. Direct article12 edit URL rendered檢視文章 with disabled fields/status and no Save button (count0). Direct /admin/roles rendered403需要權限.
- Switched to existing child site via UI. Immediate snapshots preceded server-action reload; later authoritative selected valueqa-child/header本地QA子站 and list0/0 confirmed completion. Child tags contained no parent4tags. Direct child-scope parent article12 URL returned找不到頁面. No cross-site leakage observed in these specific paths, not a blanket all-endpoint security claim.
- Found stale tag list hint instructing read-only user to Edit. Changed bilingual paragraph based on canWrite to View/details/usage and cannot edit. This source change is pending rebuild/browser revalidation; no visual-pass claim for new wording.
- Proof Temp/qa-reader-child-tags-1013.jpg. Restored existing manager login; current UI主站/QA manager Manager verified. Tab7 retained. Goal active: new-account human password case, permission modification gate, remaining purge modules and wider editor/settings/RWD combinations.

## 2026-10-13 continuation — account and readiness
- Latest read-only tag hint build completed successfully (full-browser-qa-tag-readonly-hint-build.log); reader browser verification remains pending.
- Account profile is display-only; only password change is editable. No credentials changed. Permission modal Escape closed and restored focus to View. Found unnamed icon close button and unnamed dialog; added localized close label and useId-backed aria-labelledby. Rebuild started; browser verification pending.
- Readiness QA note saved and persisted after reload: full acceptance remains in progress; decision retained pending. No QA/readiness checkboxes marked complete.
- Copy summary initially displayed success while tool clipboard returned prior article URL. Fresh browser retry confirmed clipboard contains current local site and pending decision, no prior article URL. Treat initial discrepancy as timing/tool observation; repeat now passes.
- Legacy booking URL rendered matching status/keyword row; final redirected URL and booking-only separation remain unverified.
- Existing approved single QA inquiry permanent purge completed and recycle list empty. Approval consumed for that record only.
- Screenshot qa-readiness-notes-1013.jpg shows delivery summary, not notes; do not use as note persistence visual evidence.
- Full route/CRUD/RWD coverage remains incomplete; no production DB or outgoing SMTP used.

## 2026-10-13 account/read-only modal completion
- Account modal build completed exit0. Initial restricted frontend session20818 listened3318 but host TCP and ingress connections timed out. Preserved backend72848 data and ingress3550, restarted frontend with authorized host access; browser access recovered. This was local process connectivity, not a confirmed product defect.
- Browser account native dialog named 權限 count1 and close button count1, click closes dialog count0. Found shared close copy called 關閉通知; changed to specific bilingual 關閉權限視窗 / Close permissions.
- Existing reader login: latest tag-list hint explicitly View/details/usage and no write access. Opened View and found modal heading still Edit with update instructions. Corrected both conditional canWrite. No data/permission change.
- Latest build full-browser-qa-readonly-modal-build.log exit0; frontend20791 on3318. Browser reader modal named 檢視「親子」 count1, old Edit dialog count0, Save tag count0. Intro says view-only labels/status/article usage; readonly note visible. Close works.
- Restored manager via existing fixture login and verified QA manager Manager. Account latest close button 關閉權限視窗 count1 and closes normally. Screenshot Temp/qa-account-permissions-fixed-1013.jpg; tab10 retained for continuation.
- Legacy subscriber edit route rendered subscriber list successfully; final URL change not proven (read location still legacy path). Do not claim complete redirect URL acceptance.
- Static remaining defect candidate: legacy booking route appends kind=booking, merged inquiries page currently ignores kind. Needs mixed inquiry/booking browser fixture and correction/validation.
- Full-site QA still incomplete: remaining CRUD purge/user credential/permission gates, full route/device and editor/settings matrix. No production data or external SMTP touched.

## 2026-10-13 legacy redirects and inbox kind
- Account modal effective mobile viewport390x844: dialog x11/right370,top148/bottom696; body clientWidth=scrollWidth349, vertical scroll1557/422. Close returned focus to View. Tablet819x1180 dialog within viewport, body width510=scroll510. A subsequent override yielded821x1180; Escape closed and restored View focus. Temporary viewport reset. Screenshot capture remained visibly scaled with blank space inconsistent with CSS geometry; do not call visual device acceptance passed from those images.
- Found QA ingress urllib auto-following upstream redirects: browser rendered target while URL remained legacy path. Changed harness to preserve redirects and bypass environment proxy for explicit loopback. Restarted only ingress87193; backend data retained. Browser old booking URL now /admin/inquiries?status=new&keyword=qa_booking_line&kind=booking. Supersedes previous final-URL uncertainty for this booking case.
- Created one isolated general inquiry fixture through local API (not browser CRUD evidence), name CRUD QA 類型篩選 / qa-kind-filter@example.com. Initial source contact rejected422; corrected supported website source returned201.
- Browser /admin/booking-requests redirected kind=booking but showed general inquiry alongside2bookings. Confirmed actual product defect: kind ignored by merged inbox.
- Fixed validated booking/inquiry kind filtering; preserve kind hidden field in search form; visible scope note plus Reset to all. Added3 source wiring regressions, combined inbox tests10passed. Build full-browser-qa-inquiry-kind-build.log exit0; frontend98392.
- Browser retest kind=booking rows exactly2bookings, general fixture absent, explicit scope note. Search qa_booking_line retained kind in URL and returned1booking. Reset URL /admin/inquiries, all3rows returned, scope note absent. Proof Temp/qa-inquiry-kind-reset-1013.jpg.
- Current sessions backend72848/ingress87193/frontend98392; tab10 retained, manager login retained. Fixture created for filter validation not purged; no permanent-delete approval reused.
- Remaining full QA account credential/permission operations, other CRUD purge gates, all-page/device visual coverage and remaining editor/settings combinations. Overall goal incomplete.

## 2026-10-13/14 password recovery and privacy detail
- Added explicit remaining acceptance matrix docs/full-browser-qa-remaining.md. Verified current source51page templates:37admin/14public. Historical coverages separated from still-required flows/device visual acceptance and human gates.
- Browser missing-token /admin/reset-password: invalid-link warning visible, Reset button disabled; Back returned /admin/login. No new password entered. Forgot-password invalid Email focused email and invalid state true; no success notice.
- Nonexistent qa-no-account-1013@example.com and existing manager@example.com each returned same generic recovery notice. Live backend recorded both POST200; manager2site links prevent relay selection, so no password-reset delivery acceptance claimed. Transport remains local capture/no external SMTP.
- Language switch exposed real defect: surrounding UI English but prior success notice Chinese. Changed LoginForm to message keys rendered from current labels, including failure keys and live status/alert semantics. New3tests passed, build full-browser-qa-login-feedback-build.log exit0. Browser English recovery then switch Chinese updated same notice immediately; screenshot Temp/qa-login-feedback-locale-fixed-1013.jpg.
- Prepared fresh account handoff on tab10 /admin/users/new: CRUD QA 1013 Reader, crud-qa-reader-1013@example.com,reader/main; password empty, not submitted. Requested human entry and final submission per browser credential rule; no password requested in chat. Screenshot Temp/qa-new-account-handoff-current-1013.jpg. Do not infer account created until UI verified.
- Privacy browser list contained Privacy Policy linking /privacy/privacy. Clicking returned /privacy listing and hid article body. Confirmed unconditional identifier===CATEGORY redirect in detail route, while index only lists cards; real content-unreachable defect.
- Removed name-only redirect; preserve redirect for resolved canonical mismatch. Added3route wiring guards, combined login/privacy6passed. Build full-browser-qa-privacy-detail-build.log exit0; frontend56527. Backend72848/ingress87193 preserved.
- Browser after rebuild clicked original privacy-list link. URL wait initially timed out, then authoritative URL /privacy/privacy and H1/summary/body rendered, canonical exactly http://localhost:3317/privacy/privacy. Back to list returned /privacy. Screenshot Temp/qa-privacy-detail-fixed-1014.jpg. This completes this fixture privacy detail navigation/content/metadata case, not all privacy/RWD combinations.
- Tab10 human account handoff and tab11 privacy list retained. No new credentials or production data used; no all-site acceptance. Remaining scopes listed in matrix.

## 2026-10-14 public labels, privacy responsive and navigation
- Browser privacy listing displayed internal privacy code twice (blank-image placeholder and tag fallback), detail eyebrow also raw privacy. Changed list fallbacks to localized copy.title and privacy detail fallback to localized Privacy/隱私政策, preserving authored CMS title/body.
- New2label wiring guards + privacy3guards5passed. Build full-browser-qa-public-labels-build.log exit0; frontend85790. Browser rebuilt card now contains隱私政策 twice, original Privacy Policy title and summary unchanged; detail eyebrow隱私政策.
- Recalibrated screenshot provider: current viewport request312x675 =>effective390x844. Default screenshot has oversized blank right/bottom canvas; explicit clipwidth312,height675 gives correct390x844. For a scrolled document use clipy=scrollY/1.25; usingy0 while scrolled reproduced a phantom top strip from offscreen skip link. DOM skip link bottom-14 (correctly outside viewport); corrected clip removes strip. Capture artefact, not product layout defect.
- Actual privacy detail mobile390 scrollWidth390/body350=scroll350; tablet820x1180 scrollWidth820; desktop1440x900 scrollWidth1427. Screenshots for all3 inspected, body/buttons no overlap or horizontal clipping. Footer inspected on mobile with second scrolled capture, tablet full-height and desktop scrolled capture. This is current short privacy fixture acceptance, not all CMS copy variants or all pages.
- Mobile public menu13links, each~52px high and342px wide; dialog390wide/scroll390,801height within844. Close focus initially onX; Tab fromlast Contact link wraps toClose; Escape closes and restoresMenu trigger. Saved qa-public-menu-390-1014.jpg.
- Back to top moved scrollY338 to9 then0; normal smooth-scroll completion verified. Its accessible name remains English Back to top in Chinese UI, localization follow-up candidate, not claimed fully translated.
- Missing privacy identifier rendered中文404/return-home/stays links; metadata title找不到頁面 | 本地QA主站, robots noindex,follow +noindex. Return-home rendered homepage successfully.
- Proofs Temp/qa-privacy-list-labels-390-1014.jpg,qa-privacy-detail-{390,820,1440}-1014.jpg,qa-privacy-footer-{390,1440}-1014.jpg. Default oversized capture not accepted as device proof.
- Viewport reset; tab11 homepage retained and tab10 human account form retained. No password read/entered/submitted, no record purge or production operation.
- Complete QA still pending named matrix items (CRUD/security human gates, other page/editor/settings/device cases). Goal remains active.

## 2026-10-14 article blocks, CTA shape and saved SEO ID
- General /page list current fixture empty-state heading/body rendered normally; generic detail with actual authored page fixture remains pending. Did not claim generic-page CRUD merely by testing an article.
- Through browser created article13 CRUD QA 區塊組合1014 (experience) with heading CRUD QA內容標題, paragraph with Bold toolbar, outline CTA /contact, and2-column block with one paragraph each. Saved draft, reload retained both columns; published through UI, public listing linked /experience/13.
- Browser public heading/paragraph/both columns present. Bold actual B node/fontWeight700. CTA class is-outline and href/contact; clicking reached local contact form. This verifies heading/rich paragraph/button/columns paths, not image/grid/video/brand/template cases.
- Found persisted slug-empty SEO preview still draft-id while real URL uses13. Added optional pageId to SeoPreview, supplied by PageFormEditor, dependency includespageId; canonical/custom slug remain priorities. New2wiringguards pass, build full-browser-qa-saved-id-preview-build.log exit0. Browser reload SEO preview exactly http://localhost:3317/experience/13.
- Viewport scope finding: capability applied to latest editor tab12 (CSS390), old public tab11 stayed1600. Closing editor did not retarget. New public tab13 from known article link became current target; CSS390/820/1440verified. Do not treat earlier requested mobile on tab11 as mobile evidence.
- Current article13 columns: mobile390 stacked with equal x40/width310 and distinct y529/622; tablet820 side-by-side x73/420 equalwidth315/samey468; desktop1440 side-by-side x374/730 equalwidth324/samey572. Doc scrollWidths390/807/1427. Screenshots inspected for all3.
- Visual defect: public outline CTA inherited11px underlined-link base and no padding, though editor preview has padded button. Added content-block-cta padded theme button shape,44px minheight,role font-size13default,maxwidth/wrap; variant hover colours retained separately. New2CSSguards plus2SEOguards4pass; build full-browser-qa-content-button-build.log exit0. Browser phone outline CTA~178x44,padding10px24px,font13,radius6, nooverflow. Only outline style visually verified in this case; primary/ghost variants still require browser checks.
- Full current frontend regression completed exit0:1701pass/0fail,198testfiles,none nested; log full-browser-qa-frontend-latest-1014.log. Automated result does not prove all-site browser acceptance.
- UI follow-up candidates: button-style options still English Primary/Outline/Ghost; column summary says2blocks. Rich text editable DIV has no role/aria label; mouse input and saving work. These are explicit UX/accessibility gaps, not allfixed claim.
- Latest runtime frontend75693/backend72848/ingress87193. Temp proofs qa-article-cta-fixed-390-1014.jpg and qa-article-blocks-{390,820,1440}-1014.jpg. Viewport reset; oldpublic11/editor12closed, public13 retained; human account form10 retained untouched. Article13 remains local test record.
- Goal remains incomplete; required image/grid/video/brand/templates,remaining settings/device cases and human credential/permission/purge gates unchanged.

## 2026-10-14 images, grids and partner editing
- Browser article13 added image block from existing local QA asset/storage/media/6ec2823cdaeb48169af2b6c8f60c2bb0.jpg, alt CRUD QA本地圖片,caption CRUD QA圖片說明,sizeMedium. Media picker empty-state Noimages andClose worked; no new upload claimed.
- Added2image grid,sameQAimage twice withdistinctalt/captions,gapWide. Saved/reload retained imagealt/caption/size. Public3images allcomplete/natural1280x853. Browser actual390/820/1440 docwidth390/807/1427; screenshots inspected, no stretching/overflow; cover crop16:10 is renderer geometry. This tests one source aspect/2columns, not allgridcounts/gaps/portraitassets.
- Added partners block title/intro/newbrand1. Typing brandname immediately collapsed the row andremoved inputfields. Diagnosed RepeatedRows null-follow-default recomputed !hasContent during typing. Saved currentpartialname beforecontrolledfrontendrebuild.
- Changed initial expansion toboolean choice once,newrows explicitlytrue,move/remove statealignmentretained. New3wiringguards pass. Build full-browser-qa-repeat-edit-build.log exit0; frontend32735. Browsernewbrand2 name fill left aria-expanded=true,brandinput1/photoURLfields2 remainvisible. Saved photo/summary/details/officialwebsitehttp://localhost:3317/contact.
- Public partner block actually uses inline card expansion, not modal; prior commentary anticipated modal beforeinspection. Browser expand exposed exact authored detail/link; collapse hid detail. Officialsite target_blank opened nativeIABtab14 withcorrectlocalcontactform. Inspected thenclosed; noformsubmit.
- Partner1missinglogo/photo fallsbacktextname,partner2photoanddetailrendered. Effective390/820/1440 pages no horizontaloverflow; inspectedthreebrandcaptures. NoLogo-wall orbrandreorder/removal acceptanceclaimed.
- Full currentfrontendregressionexit0:1704pass/0fail (full-browser-qa-repeat-edit-full-tests.log). LatestbuildusesofficialcachedfontsQA hook,notnormaldeploymentfontdownload.
- Proofs Temp/qa-article-images-{390,820,1440}-1014.jpg andqa-article-brands-{390,820,1440}-1014.jpg.
- Viewportscopeagain: closingnativepopup14 didnotretargetcapability,old13stayed390despiterequest820. Createdfreshlocalpublic15fromknownURLandverified820/1440beforecapture. Old13closed; retained15publicand10humanaccount. Viewportreset; backend72848/ingress87193preserved.
- OverallQAincomplete:video/templates,remainingvariant/settings/devicecases,richtextaccessibility/localizationgaps,andhumancredential/permission/purgegates. No productiondata,externalSMTP,newcredentialsorpermanentdeletionused.

Visual follow-up from inspected brand820/1440 captures: the name-only first brand card stretches to the full expanded neighbor height, leaving a large empty white rectangle. No overflow, but this fallback is not aesthetically accepted yet; fix and recheck before calling partner visual QA complete.


## 2026-10-14 partner height and actual YouTube playback
- Fixed known card fallback blank rectangle by align-items:start on cards-layout grid, keeping logos-layout unchanged. New1CSSguard plus3repeat-edit guards4pass; build full-browser-qa-partner-height-build.log exit0. Frontend34227/backend72848/ingress87193 retained.
- Browser expanded neighboring brand2: name-onlybrand1 now59px at820 and71px at1440,neighbor456/448 respectively. Screenshots inspected, white stretched rectangle gone; natural-height compact card. Docwidth1427at1440, no horizontaloverflow. Proof qa-brand-height-fixed-{820,1440}-1014.jpg.
- UI article13 added video_embed block, YouTubeURL https://www.youtube.com/watch?v=M7lc1UVf-VE,title CRUD QA YouTube嵌入,caption CRUD QA影音說明,coverblank. First click during hydration hadnoeffect; inspectedloadedstate then clickedsemantically, blockadded once. Savedpublishedarticle.
- Publiciframe src https://www.youtube.com/embed/M7lc1UVf-VE,titleexact,allowFullscreen present; no external-provider login entered. Scrollintoviewloaded GoogleforDevelopers EmbeddedWebPlayerCustomization sample. ActualUIplaybacktested, not merely srcinspection.
- Initial mute selector disappeared when player controls auto-hid; readfreshstate, showedcontrols. Successfulmute+play then video DOM readyState4,errornull,pausedfalse,currentTime59.49; nextcurrentTime72.49. UIkeyboardk paused at72.52,mutedtrue. Stopverified. This is one real publicYouTube sample, not Instagram/TikTok playback acceptance.
- Mobile390x844 iframe310x174.375 (16:9),docwidth390; tablet820x1180 iframe~662x372.3,docwidth807. Captionvisible; mobile screenshotinspected. Desktopvideo visual capture/cover/external-link cases still pending.
- Proof Temp/qa-article-video-390-1014.jpg. Article13nowhas persistedYouTube sample. Publictab15retained,account10humancredentialformretained untouched; viewportreset.
- Latest targeted4passandbuildpass; lastfullfrontend1704predatesnewCSSguard, no newfull-suiteclaim. Goalstillactive: otherblockvariants/templates,settings/routes/devicecases andhumancredential/permission/purgegates.

## 2026-10-14 cover mode and left-image template editor
- Browser article13 video cover set to existinglocalQAimage,saved/reloadedexactURL. Publiciframecount0,coverimagecomplete/natural1280,target_blankandhrefexactoriginalYouTube watchURL. Clickopenedtab16withcorrectvideotitle/URL; closedafterverification. Mobile390cover screenshotinspected (qa-video-cover-390-1014.jpg). No new YouTube login or play claimed for watchpage.
- Left-image/right-text preset added ninthblock:2columnitems(image+paragraph). Mobile nested image toggle matchedvisible but width0,parent114px; click/Enterfailed. Diagnosed inlineJSgrid ratio overriding narrowCSS when viewport state failed tosync. Removed useNarrowViewport helper and movedwide ratios to--pbe-column-tracks consumedbyCSS; mobile1frstylesheetnowauthoritative.
- New2guards pass,build full-browser-qa-column-editor-build.logexit0. Savedpresetbeforecontrolledfrontendrebuild. Firstretargetedreloadwasactual278px,rootbuttonswidth0: excludedfrom390acceptance. Freshownedtab17 calibrated390x844/doc377; gridonecolumn246.55px,nestedimageheader97.6px,clickaria-expandedtrue. Filledtemplate image/alt/captionandrightparagraph,saved/reloadretained. Initialreloadclick NoNode errorresolvedwithfreshnodeinspection andsemanticclick; no productnodefailureclaimed.
- Publictemplateimagecomplete/natural1280,phone imageaboveparagraph,desktop1440 image~324px/paragraph~324pxinadjacentcolumns,doc1427. Inspectedqa-template-public-{390,1440}-1014.jpg. This verifies left-image/right-copy preset,notallpresets.
- Mobileminiheaderstillcrampeddespitefunctionalwidth97.6. Addedminiheaderwrap,full-rowpreview,followingactionsrowcanwrap. New2guards plus2responsiveguards4pass; build full-browser-qa-mini-header-build.logexit0. Browser390previewheader205.6px,correctsavedalt,photothumbnailreadable/actionsseparate. Screenshotqa-mini-header-fixed-390-1014.jpginspected.
- Fullcurrentfrontendregressionexit0:1709pass/0fail(full-browser-qa-mini-header-full-tests.log). Priorcolumnonlyfull1707passsuperseded. These are automated regressionchecks,not all-site browserQA.
- RemainingUXcandidate: rootcolumnsummarystillhasEnglishblocks and crampedratio/countinmobileheader; RichTextDIVrole/labelgapandotherlocalizedoptionsstillunresolved. Remainingblockpresets/platform/variantsandfullsettings/device/humangatespreserved.
- Latestfrontend98387/backend72848/ingress87193retained. Tab17articleeditorandtab10humancredentialformretained,viewportreset. Article13persisted9blocks; nootherrecordpurge,productiondataorcredentialchanges.

## 2026-10-14 continuation: top-image / lower-text article preset
- Browser UI added the top-image / lower-text preset to local article 13, filled an existing isolated local image, alt text, caption and paragraph, saved, then reloaded the editor. The paragraph survived reload.
- Public /experience/13 displays the image, caption and paragraph in that order. Effective viewport 1600 x 900; document has no horizontal overflow. This case does not cover tablet/mobile or the other outstanding presets.
- Screenshot: C:/Users/USER/AppData/Local/Temp/qa-top-image-template-1600-1014.jpg.
- Existing human password handoff tab retained untouched. Production tab untouched. Full browser acceptance remains incomplete.

## 2026-10-14 continuation: left-text / right-image and visibility history
- Browser UI added left-text / right-image preset to article 13, filled paragraph, existing local image, alt and caption, then saved. A collapsed parent summary omitted child alt text; this alone was not a persistence failure.
- Hide -> Undo gave zero Show-block controls and enabled Redo; Redo restored one hidden block. Saved hidden state, public article had neither target paragraph nor target image. Returned editor retained hidden state. Restored visibility and saved; public paragraph and image returned with image complete/naturalWidth > 0.
- Actual desktop viewport 1600x900: paragraph left 453.75,width324; image left809.74,width324. No document horizontal overflow. Screenshot qa-left-text-template-1600-1014.jpg in Windows Temp. Other presets and tablet/mobile coverage remain outstanding.
- Production and human credential handoff tabs untouched. Complete browser QA remains active.

## 2026-10-14 continuation: responsive left-text and multi-image preset
- Left-text / right-image public layout verified at actual 820x1180 and 390x844: tablet side by side, mobile stacked text then image, no document horizontal overflow. Screenshots qa-left-text-template-820-1014.jpg and qa-left-text-template-390-1014.jpg in Windows Temp visually inspected.
- Browser UI added multi-image + text preset to article 13 with two local images, alt/captions and paragraph. Saved and reloaded editor; paragraph persisted. Public article shows exactly two target images and one target paragraph. At 1600x900 both images loaded and aligned in two columns (width332 each), no horizontal overflow. Screenshot qa-multi-image-template-1600-1014.jpg visually inspected.
- Multi-image tablet/mobile, video-text preset and remaining acceptance matrix still pending. No production changes or credential handoff interaction.

## 2026-10-14 continuation: multi-image RWD and video-text preset
- Multi-image preset public page checked at actual820x1180 and390x844. Both target images loaded; two columns retained, caption/text readable, no document horizontal overflow. Screenshots qa-multi-image-template-820/390-1014.jpg visually inspected.
- Browser UI added video-text preset to article13 with official YouTube demo URL, local cover, title/caption and paragraph. Save and editor reload retained paragraph. Public target link href is https://www.youtube.com/watch?v=M7lc1UVf-VE; local cover loaded. Actual1600x900 and390x844 have no horizontal overflow; screenshots qa-video-text-template-1600/390-1014.jpg visually inspected.
- This preset case covers cover-link rendering only, not in-place playback or a fresh external click. Other platform variants, video-text tablet, and other matrix gaps remain. Temporary viewport reset; production and human credential handoff untouched.

## 2026-10-14 continuation: video tablet and login audit filters
- Video-text cover preset actual820x1180 visually inspected, no horizontal overflow (qa-video-text-template-820-1014.jpg).
- Login audit browser filter reader +127.0.0.1 +success +2026-10-13 both dates returned3 reader success records. Failed filter returned empty. Year trend labels changed to month buckets; Today IP period action exercised, not an independent time-zone accuracy proof.
- Found reset inconsistency: results restored7records but uncontrolled status select still showed Failed. Fixed form key from the five query filter values so navigation remounts defaults. Build full-browser-qa-login-filter-build.log exit0; restarted frontend session40568, preserving backend memory DB.
- Browser regression: Failed -> Filter empty -> Reset now selected All statuses/value empty, table8rows including header. Screenshot qa-login-filter-reset-fixed-1014.jpg visually inspected. Full suite not rerun for this small repair; empty filtered wording still says no records yet and needs improvement. Remaining full QA matrix stays incomplete.

## 2026-10-14 continuation: login audit narrow filters
- Actual390x844 browser found all five filter fields crushed to25.65px despite no document overflow. Later max1100 CSS overrode the original max640 one-column rule. Fixed tablet to two tracks and final max640 override to one track.
- Fixed filtered empty-state wording to No matching records with adjust/reset instruction instead of No records yet.
- Build full-browser-qa-login-rwd-build.log exit0; frontend restarted session18330 with backend fixture preserved. Browser390 field widths345.52px each, no document overflow; screenshot qa-login-mobile-fixed-1014.jpg visually inspected. Failed filter displays the new matching-empty heading. Actual820 viewport two tracks370.755px each with no document overflow (full tablet visual still pending).
- Publishing task navigation deferred while fixing this verified usability failure. Overall acceptance still incomplete; production and human credential handoff untouched, viewport reset.

## 2026-10-14 continuation: publishing tasks
- Browser publishing list initially2drafts,13content issues,0review. First draft Edit opened article8 with matching title; Preview opened /admin/preview/content/8 and correct draft body. Banner task opened banner1; View all13 opened CMS issues tab.
- Completed article13 cover issue through browser editor using existing local QA image; saved and reloaded, URL persisted. Returning publishing list now12issues and article13 absent. This proves result feedback for this cover task, not all issue types.
- Actual390x844 publishing first screen no document horizontal overflow, screenshot qa-publishing-mobile-1014.jpg visually inspected. Banner anchor changed URL #banners and subsequent scroll advanced; bottom screenshot was captured before smooth-scroll settled and is not accepted visual evidence. Tablet/full-list visuals remain pending.
- Production and human credential handoff untouched, viewport reset. Full QA remains incomplete.

## 2026-10-14 continuation: article placement multi-category mismatch
- Browser catalogue showed Experience7 / News12 articles. Experience Manage articles initially returned only1 article (2table rows incl header), because CMS filterPages compared only content_type and omitted secondary categories.
- Fixed cmsConsoleData filterPages to use shared articleCategories(page). Build full-browser-qa-multi-category-build.log exit0. Frontend session39097 preserves backend fixture.
- Browser after reload Experience8table rows incl header =7articles; News13rows =12articles, matching catalogue counts. Experience View layout opened /admin/sites/1/pages/experience with correct heading.
- Screenshot qa-category-filter-fixed-1014.jpg visually inspected. Other catalogue RWD/full combinations and full regression suite remain pending; full goal incomplete. Production and human credential handoff untouched.

## 2026-10-14 continuation: tag usage links and empty filters
- Browser expanded Family usage locations;12article links were clicked individually and each editor title matched expected article12 through1. Current fixture has no content-collection tag-use link, so that branch remains unverified.
- Search nonexistent tag returned count0/4 and Find no matching tags with Clear filters; clearing restored list. Unused shortcut listedSummer/123; Review names listed123 only; search input reset empty.
- Actual390x844 expanded usage list has no document horizontal overflow. Screenshot qa-tag-usage-mobile-1014.jpg visually inspected; full-column/mobile action accessibility not yet claimed. Other tag Yilan usage links and collection fixtures pending.
- Viewport reset; production and human account-password handoff untouched. Overall QA incomplete.


## 2026-10-14 continuation: collection tag fixture
- Browser homepage collection selected Family in modal, saved page settings, reloaded and found Family selected. Tag usage gained Collection filter chip and Collection selection: Homepage. Usage=filters returned exactlyFamily1/4.
- Public homepage excluded article13 (noFamily tag,0matching links), included article12 (Family,1matching link). This proves selected topic actually affects public collection; existing unfiltered article13 had been visible.
- Found UX gap: collection usage is a paragraph only, without return-to-editor link. Source confirmed TagRow filterBlocks rendering paragraphs; link improvement not yet implemented, remains next action.
- Screenshot qa-tag-collection-usage-1014.jpg inspected. Fixture homepage remains Family-filtered; production untouched. Full QA incomplete, tabs retained for continuation.

## 2026-10-14 continuation: collection placement editor link
- Tags TagRow now receives current authorized site ID (only when site_users:read) and renders collection selection locations as links to that site's page editor. Keeps text-only for accounts lacking page-management access; no permission grants.
- Build full-browser-qa-tag-placement-build.log exit0. Complete frontend regression1709passed0failed, full-browser-qa-followup-full-tests.log exit0. Frontend session26517.
- Browser Family collection link href /admin/sites/1/pages/homepage; initial immediate post-reload click did not navigate, fresh observed-state retry did. Destination editor correct, Latest News block opens with Family still selected. Screenshot qa-tag-placement-link-result-1014.jpg inspected.
- Link targets page, does not auto-open exact block when a page has several collections. Other site/page and read-only combinations still pending. Full browser QA incomplete; human credential handoff and production untouched.

## 2026-10-14 continuation: collection OR / empty / clear
- Browser modal added Summer to existing Family, saved, public article12 present and untagged13 excluded; reloaded editor showed Family+Summer. Since fixture Summer has no articles, this distinguishes OR from AND.
- Unchecked Family leaving Summer, saved; public collection had no matching cards and whole collection section omitted. No-match behavior observed, not declared appropriate for every layout.
- Checked No filter (all topics cleared), saved. Public restored article13 plus8other article links;9links and9unique hrefs (news+experience sources dedup). Article13 card click opened correct public detail.
- Screenshot qa-collection-reset-1014.jpg inspected. Homepage fixture restored unfiltered state. Production and human handoff untouched; full matrix remains incomplete.

## 2026-10-14 continuation: public stay search
- Browser homepage county Yilan enabled district Dongshan. Selected13+ guests, Explore navigated stays with region/destination/guests13 and no-results message. Guest placeholder cleared guest constraint; matching QA stay returned, geographic filters retained.
- Cleared county via placeholder; district cleared/disabled. Submitted URL region=&destination=&guests=, QA stay returned. This covers one county/district fixture, not changing among multiple counties.
- Actual390x844 listbox inside viewport (left45.64,right344.36), no document horizontal overflow; screenshot qa-stay-search-mobile-1014.jpg inspected. Empty image on stay reflects known incomplete QA fixture, not asserted production defect. Facilities and other widths remain pending.
- Viewport reset; production/human credential handoff untouched. Full QA incomplete.

## 2026-10-14 continuation: amenity filtering / stay detail
- Browser selected KTV; URL amenity=KTV and no matching stays. Multi-select trigger is Selected1, not KTV text. Clicking selected KTV again cleared it; Explore removed amenity parameter and QA stay returned.
- Stay detail link navigated /stays/detail/qa-villa, correct name/location/price/capacity. Google map iframe loaded; map external interactions not tested. Actual820x1180 no horizontal overflow; screenshot qa-stay-detail-820-1014.jpg inspected, missing photo/rooms are known fixture limits.
- Send inquiry link opened /contact?stay=1. Found potential functional gap: contact form did not display selected stay, message blank, no hidden stay input. Need inspect source/submit pathway before concluding whether server uses URL context. No inquiry submitted in this case; next action diagnosis.
- Production/human credential handoff untouched, viewport reset. Full QA incomplete.

## 2026-10-14 continuation: stay inquiry persistence verified
- Source ContactFormBlock parses window.location.search on submit and adds stay_id; absence of hidden input did not prove a data loss.
- Browser submitted local booking contact from /contact?stay=1: CRUD QA 住宿關聯1014,qa-stay-context@example.com, datesNov5-Nov6,phone0933333333,QAmessage. Success notice appeared. Admin inbox search returned one correct record.
- Browser CSV export C:/Users/USER/Downloads/form-contacts-2026-10-13 (2).csv inspected exact QA row:stay_id1/check_in2026-11-05/check_out2026-11-06. Thus relation retained; no realSMTP (local transport harness).
- Confirmed UX gap remains: public contact form and admin list don't show selected stay name. Next action improve readable stay context, not repair already-working persistence. Screenshot qa-stay-inquiry-persisted-1014.jpg inspected. New QA record retained; no purge approval reused.
- Production/human credential handoff untouched. Full acceptance incomplete.

## 2026-10-14 continuation: inquiry state lifecycle and dates
- Local QA booking row qa-stay-context@example.com transitioned New->Contacted->Quoted->Closed through browser buttons; editor reload retainedClosed. No outbound message was sent; these are internal status updates.
- DateFrom/To2026-10-14 returned0/4 with clear-filter guidance. Both dates2026-10-13 plusClosed returned exactlyone matching QArow. This verifies inclusive same-day filtering against fixture records, not timezone boundary or pagination.
- Found UX regression/limitation: state update redirects to unfiltered inbox, losing keyword search. Data update works but filter preservation remains next repair. Prior selected-stay-name visibility gap also remains.
- Screenshot qa-inquiry-closed-dates-1014.jpg visually inspected at actual1440x900. Viewport reset; production and human password handoff untouched. Full acceptance incomplete.

## 2026-10-14 continuation: inquiry status filter preservation
- Status server actions accept optional return URL restricted to exact /admin/inquiries or its query. Inbox binds current keyword/status/dates/kind/visibility/page. Other delete/restore actions unchanged.
- Build full-browser-qa-inquiry-return-build.log exit0 after correcting helper import; frontend session44418, backend fixture preserved. Full regression suite not rerun for this patch.
- Browser searched qa-date-retention@example.com with datesOct13-Oct13, clickedContacted; target row changed, list remained1record and URL retainedkeyword/dates, rather than unfiltered4records. Screenshot qa-inquiry-filters-retained-1014.jpg inspected. General inquiry branch/status-filter-exclusion/page variants still pending.
- Production and human credential handoff untouched, viewport reset. Stay-name visibility gap and full QA matrix remain incomplete.

## 2026-10-14 continuation: general inquiry return filters and tablet
- Browser qa-kind-filter@example.com New filter initially1record; Contacted action retainedkeyword/status=new and correctlyreturned0/1 with matching-empty message. Changed filterContacted returned updatedtarget. Reset clearedstatus/date and showed4records. Verifies general inquiry action branch as well as expected exclusion after state change.
- Actual820x1180 inbox no document horizontal overflow, filter widths301/176/125/301. Screenshot qa-inquiries-tablet-1014.jpg inspected. Narrow date field/full table horizontal reach and complete mobile workflow remain to assess; no blanket visual acceptance.
- State updates internalonly; no external communications. Production/human credential handoff untouched, viewport reset. Full QA incomplete.

## 2026-10-14 continuation: inbox tablet spacing
- Scoped CSS tablet721-1180 metrics2columns and filters2equalcolumns; narrower layouts retainonecolumn. Metric min-height removed at<=1180,heading34px/wrap to reduce blank height.
- Build full-browser-qa-inquiry-tablet-build.log exit0; frontend session15618. Actual820x1180 metric tracks368.75each and bothdateinputs306.29px, no horizontal document overflow. Actual390x844 metrics/filter onecolumn, no document overflow. Screenshots qa-inquiries-tablet-fixed-1014.jpg and qa-inquiries-mobile-fixed-1014.jpg inspected.
- Full table mobile actions and all variants still pending; no complete visual acceptance claim. Full test suite not rerun for latestCSS patch. Production/human credential handoff untouched,viewport reset.

## 2026-10-14 continuation: tablet sidebar settling
- Sidebar right edge75px immediately after viewport change was in-flight transform; later authoritative DOM right0/left-271.99, fully offscreen. Screenshot qa-inquiries-tablet-settled-1014.jpg inspected after settling; earlier overlapping sidebar captures are not accepted stable-layout evidence.
- Actual820px drawer opened as dialog, focus Toggle. Escape removeddialog and focused Open menu. Immediate reopen+click during animation unexpectedly navigated admin home; stable observed dialog retry clicked Publishing and destination /admin/publishing,dialog0. Rapid-animation interaction robustness remains worth checking; only settled navigation accepted.
- Full QA incomplete; no source change this case. Production/human password handoff untouched.

## 2026-10-14 continuation: publishing tablet bottom
- Initial viewport override yielded586px; did not count as820tablet. Recalibrated and verified actual820x1180. Initial immediate click was ignored; navigation was accepted only after fresh state.
- Publishing Manage all banners reached CMS tab=banners; back and Banner anchor settled scroll882.5, bottom card/links visible. Open banner reached banner1 edit with correct heading. Screenshot qa-publishing-tablet-bottom-1014.jpg inspected; complete bottom issue rows and actions legible, no document horizontal overflow.
- This supplements first-screen cases; pending-review populated state, long titles and phone bottom remain pending. No source changes. Production/human credential handoff untouched,viewport reset. Full QA incomplete.

## 2026-10-14 continuation: populated review queue
- Article8 browser Draft->Review saved; publishingReview1,Draft1 andcorrectarticle8. Actual390x844 no document horizontal overflow; Reviewanchor settled and screenshot qa-publishing-review-mobile-1014.jpg inspected.
- First review Edit openedarticle8,statusreview. ChangedbackDraft,saved; publishing Review0,Draft2. Fixture restored. This verifies populatedreview andcountupdates,notallroleapprovalpermissions.
- Production/humancredentialhandoff untouched,viewportreset. Full QA incomplete.

## 2026-10-14 continuation: duplicate subscription and invalid unsubscribe
- Footer invalid-email browser nativevalidation typeMismatchtrue,validfalse. Subscribed existing qa-recipient@example.com returned success; admin1/1subscriber,no duplicate. However fixture prior QA group nowpublic after publicsubscribe: potential operational group overwrite, next diagnosis required. No realSMTP.
- /newsletter/unsubscribe no token showed missing-token note,no action. InvalidQA token displayedbutton; clicked and showed expired/invalid error,not success. Screenshot qa-unsubscribe-invalid-1014.jpg inspected. Valid unsubscribe and restoring QAgroup pending; new credentials not involved.
- Production/humanpasswordhandoff untouched. Full QA incomplete.

## 2026-10-14 continuation: newsletter group preservation repair
- Root cause _apply_signup assignedpayload.groups over existingsegments. Changed to stable dedupedunion(existinggroups,payloadgroups), retainingoperatorsegments and addingpublicsource. Admin explicitgroupediting remainsunchanged.
- New tests/test_newsletter_signup_groups.py verifies QA/VIP retained,publicaddedonce,repeatedsignupdedup,unsubscribed->subscribed,blankname/groupretention. Focused2passed. Fullbackendpytest exit0; exactsummary in full-browser-qa-newsletter-groups-backend-tests.log.
- Live backend72848 stilloldloadedcode; do not claim livebrowserrepair. Next deploytofreshisolatedQAbackend without resetting currentfixture and reproducepublicsignupgroups. Existingcurrentseedgroup remainspublic after earlierfailure; needs restoring QA for liveverification. No productionchanges.
- Fullgoal remainsactive/incomplete; humancredentialhandoff untouched.

## 2026-10-14 continuation: live browser group repair and unsubscribe
- Newisolatedmemorybackend8320 session57670;frontend3322 session93659;ingress3321 session38338. Original3317fixture/services preserved. Newbackendloadsalllatestsource,date/groupsrepairs. Same authoredseed, no productionDB/SMTP.
- Browserpublicsubscribeexistingseed QArecipient;adminone row,QA+publicgroupsretained. Validlocalfixturetokenunsubscribe successwithsiteidentity;adminUnsubscribed,groupsretained. Browserresubscribe restoredSubscribed,stillone row,QA/publiconceeach. Screenshotqa-resubscribe-groups-fixed-1014.jpg inspected at1440x900.
- Runtimefixverifiedforactive+unsubscribedexistingrow. Crosssite/deletedfreshconsent andothernewslettercases remain. Old3317backendstilloldcode; new3321recommendedforremaininglatestbackendchecks. Humanpasswordhandofftab10 remains3317untouched.
- Viewportreset;fullQAincomplete,productionuntouched.

## 2026-10-14 continuation: subscriber filters and forbidden create page
- On3321 QAgroupfilter1row; nonexistentsearch0/1 matching-empty; clearedsearchrestored. Switchchildreader newsletterlist403,no parentrecipientdisclosed.
- Directchild /admin/newsletter/new DID rendercomposeform, not403. No submission attempted; backendPOSTrequiresnewsletter:write. Fixed newpage to fetchprofile andthrowAdminForbiddenError unlessnewsletter:write beforefetchingmetadata. Notyetbuilt/browserverified; nextrequiredaction. Earlier intended403screenshotactuallyshowscomposeform, evidenceoffinding only.
- Switchedbackmain afterfinding, no rolegrants. Screenshotqa-newsletter-child-forbidden-1014.jpg labeldoesnotmean403passed. FullQAincomplete.

## 2026-10-14 continuation: create campaign permission browser fix
- Build full-browser-qa-newsletter-create-permission-build.log exit0,completefrontend1709passed0failed exit0 logfull-browser-qa-newsletter-create-permission-tests.log. Newfrontend3322session4959,backend8320preserved.
- BrowserchildReader /admin/newsletter/new now403Needspermission,no composeform. Screenshotqa-newsletter-create-forbidden-fixed-1014.jpg inspected. Immediatepostreloadsnapshot hadzeroheadingcountduringload (notacceptedindependentreloadproof). SwitchingbackmainManager restoredsavebutton1 on sameURL. No campaigncreated/permissiongranted.
- Original3317frontendusesoldloadedbuild;latestbrowserchecks3321. Fullmatrixstillincomplete,production/humancredentialhandoffuntouched.

## 2026-10-14 continuation: long campaign editor
- Browser3321 createdcampaign1 CRUD QA 長內容電子報1014,groupQA,12authoredparagraphs,noenqueue/nosend. Openedit and reload retainedfirst/lastparagraph. ImmediatepostreloademptyRTE wasloading,notloss; subsequentDOMverifiedboth.
- Actual390x844 RTEwidth286.20px,no documenthorizontaloverflow. Savedagainmobile,previewcontainsall12paragraphs. Screenshotqa-newsletter-long-mobile-1014.jpg inspected. Longtextreadable,fullbottom/otherwidths/multipleimages stillpending; realmailclientnottested.
- Production/humancredentialhandoff untouched,viewportreset. FullQAincomplete.

## 2026-10-14 continuation: newsletter image cursor issue
- Campaign1 insertImage withoutpriorRTEselection closedpopover butinserted0images. FocusRTE+CtrlEnd thenimageURL inserted1loaded1280pximage. Silentmissingselectioninsertion isverifiedUXbug,nextrepairrequired.
- Savedandreloaded retained1image andparagraph12. PreviewDOMtargetimage loaded atactual390x844,width297.36,right333.63,no documenthorizontaloverflow. Screenshotqa-newsletter-image-mobile-1014.jpg inspected. Noenqueue/sending,notrealmailclientproof.
- Production/humancredentialhandoffuntouched,viewportreset. FullQAincomplete.

## 2026-10-14 continuation: image insertion selection repair
- RichTextEditor openImage accepts only range whollywithinitseditor; otherwisecreatescollapsedendrange. Avoidsrestoringpageselectionoruninitializedcaret.
- Buildfull-browser-qa-rte-image-caret-build.log exit0,frontend3322session17728. BrowserreloadRTEfocusedfalse/images1,clickedimagewithoutfocusingbody,filledlocalURL=>images2,lastIMG. Saved/reloaded2images+paragraph12retained.
- Actual390x844 previewbothimagesloaded,width295.85,no documenthorizontaloverflow. Screenshotqa-newsletter-image-caret-fixed-1014.jpg inspected. Selection-in-middle/stale-dialogchanges andotherRTEinstancesremainpending. Fullsuite notrerunforthispatch.
- Noenqueue/realsend;production/humancredentialhandoffuntouched,viewportreset. FullQAincomplete.

## 2026-10-14 continuation: long dual-image preview widths
- Firstrequestedtablet yielded586x843,notaccepted820proof. Reappliedandverified820x1180; previewimagesloaded701.84px,no documenthorizontaloverflow. Screenshotqa-newsletter-two-images-820-1014.jpg inspected.
- Actual1440x900 editor683.59px,previewimages308.70pxloaded,no documenthorizontaloverflow. SavedexistingcontentthroughdesktopUI. Screenshotqa-newsletter-two-images-1440-1014.jpg inspected. Longpreviewrequirespage scrolling; screenshotdoesnotprovealltoolbarcontrols.
- Noenqueue/send,noexternalmailclientproof. Production/humancredentialhandoffuntouched,viewportreset. FullQAincomplete.

## 2026-10-14 continuation: dual-image local dispatch
- Campaign1queuebuilt1recipientQA;Sendcenterselected1campaign/1person. Verifiedharness_send_email_sync=capture_emailbeforedispatch. Browserimmediatesendcompleted1sent0failed0skipped,pending0.
- LastlocaloutboxJSONLrecipientqa-recipient@example.com,correctsubject,htmltrue,2imgtags,paragraph12retained,bothimageURLsabsolutehttp://localhost:3321/storage/media/6ec2823cdaeb48169af2b6c8f60c2bb0.jpg. ThisprovestransportHTMLimagesnotstripped,notexternalSMTP/accessibilityfrommailclient.
- Screenshotqa-newsletter-local-send-1014.jpg inspectedactual1440x900. Campaignnowprocessed,notdraft. Production/humanhandoffuntouched,viewportreset. FullQAincomplete.

## 2026-10-14 continuation: sent campaign history
- Browserlistcampaign1Sent,count1,senttimepresent. Detailread-only:noSavechanges/enqueuebuttons. ThisUIprotectsaccidentalresend,notbackendidempotencyproof.
- Searchbodyparagraph12matched;nonexistentsearch0/1 andmatchingemptymessage;Clearrestored1row.
- Native datefillchangedDOMwithoutReactfilterstate; ArrowUp committed2027-10-14 andreturned0/1,Clearrestored. Initial2026-10-14display mismatchnotconfirmedproductbug;needactualcommittedsame-day/timezoneboundarytesting. Sourceraw.slice(0,10)vsTaipeidisplay remainspotentialtimezonegap.
- Screenshotqa-newsletter-sent-history-1014.jpg inspected. Noadditionalsend;viewportreset,production/humanhandoffuntouched. FullQAincomplete.

## 2026-10-14 continuation: newsletter Taiwan date filter repair
- CampaignsPanel displayedtimestampswithformatDateTimeTaipei butfilteredraw.slice(0,10). ChangedfiltertositeDateKey(raw),samebusinesszone. NewnewsletterFilterDateZone.test.mts checksconsumeruseshelper andUTC15:59/16:01crossingTaipeimidnight. Focused10passed.
- Fullfrontendregressionexit0,summaryinfull-browser-qa-newsletter-date-full-tests.log. Newdaterepairnotyetrebuilt/livebrowserverified; nextrequiredstep. PriorUIdatefillissuewasautomationcommitlimitation,separatefromsourcezoneinconsistency.
- NoUIchangesperformedthisturn,production/humanhandoffuntouched. FullQAincomplete.

## 2026-10-14 continuation: newsletter date browser verification
- Buildfull-browser-qa-newsletter-date-build.log exit0; frontend3322session91685,backend8320unchanged. Native datefill required ArrowUp/ArrowDown tocommitReactonChange; finalfieldvaluesconfirmed,notDOM-onlyproof.
- SentdateOct13bothboundsreturned1/1; Oct14bothboundsreturned0/1matchingempty;Clearreturned1row. Screenshotqa-newsletter-date-filter-fixed-1014.jpg inspectedactual1440x900. Confirmsordinarysame-dayinclusivefilter;UTC/Taipeimidnightboundary remainsunittest-only,notbrowserfixture.
- Production/humanhandoffuntouched,viewportreset. FullQAincomplete.

## 2026-10-14 continuation: calendar navigation and mobile reach
- BrowserOctcalendarshowscampaign1atOct13 19:15,matchinglistdisplay. NextmonthNovlabel/noevents,PrevrestoresOct. Eventclickon390mobileopenscorrectcampaign1readonlydetail;Backcalendar.
- Actual390x844 documentnooverflow,grid560px insidecalendarsectionclient344/scroll588/overflowauto. Clickingrightmost31scrolledsectionleft230,confirmrightdatecanreach. Screenshotqa-newsletter-calendar-mobile-1014.jpg inspected. Sectionlacksregionlabel/tabIndex;keyboardscrollandclearvisualaffordancependingimprovement. Firstcolumns/header offscreenafterrightscroll isexpectedbutUXmustassess.
- Onlysententry,scheduled/multipleeventcasesnotcovered. Production/humanhandoffuntouched,viewportreset. FullQAincomplete.

## 2026-10-14 continuation: calendar isolated scroll repair
- WrappeddategridinlabelledregiontabIndex0,withmobileinstruction. Calendarouteroverflowhidden; inneroverflowauto. Header/navwrapmobile,keepmonthtoolbaroutsidegridscroll.
- Buildfull-browser-qa-calendar-scroll-build.log exit0;frontend3322session41317. Browser390x844 regionArrowRight=>scrollLeft50/focustrue;rightmost31=>inner244.17/outer0. Headerleft30.82/right346.68unchangedhorizontalposition,no documentoverflow. NextNov/BacktomonthOctcontrolsworkafterscroll.
- Screenshotqa-calendar-scroll-fixed-1014.jpg inspected. Fullfrontendregressionnotrerunforthispatch,tabletscheduledmultipleeventsremaining. Production/humanhandoffuntouched,viewportreset. FullQAincomplete.

## 2026-10-14 電子報行事曆與回收區補測
- localhost:3321 隔離資料：行事曆「19:15 CRUD QA 長內容電子報 1014」開啟正確詳情；分群 QA、寄送數1、寄送時間保留，返回列表正常。
- 透過具名確認視窗軟刪除，列表0/0，行事曆事件消失。回收區1/1且提供還原；還原後回收區0/0，行事曆事件重新出現，原寄送資訊未改變。未進行永久刪除或真實寄信。
- 桌機有效 viewport1600x900、文件無水平溢出；截图 Temp/qa-calendar-restored-1014.jpg。最新前端全套回歸日誌 full-browser-qa-calendar-full-tests.log，程序 exit0。全站剩餘驗收仍未完成。

## 2026-10-14 媒體主子站權限及上傳補測
- localhost:3321 主站媒體庫初始0；上傳既有隔離QA pool JPG，成功新增1筆，檔案 bfecfe96e1e94d05868ae2ef4d95f4b6.jpg。
- 改名 CRUD QA 媒體隔離 1014.jpg，保存及完整重載後名稱保留，圖片complete=true/natural1280x853。
- 目前帳號切到子站Reader：媒體入口消失，既有/admin/media顯示403；恢復主站後1筆圖片正常。這只證明無media權限角色隔離，不代表有讀權子站的資料範圍已驗收。
- 保留此QA圖片供後續刪除引用/RWD測試；未永久刪除。證據 Temp/qa-media-upload-renamed-1014.jpg。上傳chooser工具回應耗時異常，已完成選檔，未因此重啟服務。

## 2026-10-14 媒體篩選與尺寸補測
- 搜尋不存在字串呈現空結果；搜尋 CRUD QA 媒體隔離 找到改名圖片。影片(0)為空，圖片(1)恢復；清單/方格可切換。
- 有效手機390x844/docWidth377，平板820x1180/docWidth807，未發現文件水平溢出。手機日期欄238px、複製/改名/刪除按鈕171px（清單測量）。
- 手机fullPage截圖出现sticky compositor錯位，不能作為整頁美觀通過；仍需正常分段截圖。平板證據 Temp/qa-media-tablet-1014.jpg 補償scrollY406.67/1.25；測後尺寸reset。影片空結果文案仍說圖片，列為待改善。

## 2026-10-14 內容管理表格改版
- 依使用者新要求精簡內容管理，文章/顯示頁面/標籤共享導航；顯示頁面改語意表格（名稱、文章數、管理文章、權限允許的版面編輯）。
- 標籤移除大型統計卡片、快捷用途卡及重複說明；保留搜尋/狀態/用途篩選、使用位置及新增/編輯modal。資料在手機維持表格並於容器橫向捲動。
- 初版瀏覽器3321已確認顯示頁面2筆、experience6/news12、標籤4筆、編輯modal正常。管理文章連結正確列出experience6筆，但分類下拉原只含主要分類；已修復為articleCategories所有分類。
- 聚焦回歸15/15通過。全套回歸曾因舊測試要求已刪列表大標題失敗，已更新該測試；此次全套中止，不能宣稱全套通過。
- 舊本地程序已無監聽，重新啟動隔離memoryQA：backend8320/session88814、frontend3322/session10677、ingress3321/session70310。先前記憶體CRUD案例已不在新進程，歷史紀錄保留作歷史證據。
最終版本建置exit0，前端session26822。瀏覽器category下拉包含慢域體驗/最新消息且value=experience；手機實測390px/doc377、表格720px/捲動容器344px、row=table-row，未產生文件溢出。最終圖 Temp/content-tags-table-final-1014.jpg。

## 2026-10-14 文章分類與網站頁面分離實作及驗收
- 使用者授權開始實作。新增 /admin/cms/categories；分類獨立存於settings.article_categories。原站點無registry時沿用舊列表頁分類，分類寫入/網站保存保留快照。一般設定保存不會增刪改分類。
- 內容分組只管理文章/文章分類/標籤；網站頁面移至網站與頁面分組。共用頁籤文章/文章分類/網站頁面/標籤；側欄分類頁不再同時標示文章工作台active。
- 網站頁面以表格管理，modal明確選收錄分類；一般頁面建立不再呼叫CMS文章新增。文章編輯器使用分類詞彙，實際列表頁預覽從頁面收錄來源計算，未對應列表時給明確提示。
- 實際UI：新增CRUD QA獨立分類（qa-independent）只增加分類，網站頁面維持2；新增CRUD QA一般介紹（qa-introduction）網站頁面增到3，分類維持3。一般頁面收錄分類為空、文章數0。
- 分類改名/封存/還原已操作，網站頁面名稱不被修改，原文章與列表仍保留。已封存自訂分类在既有文章保持中文名稱。
- 新聞頁可另外收錄news/experience/qa-independent，公開9篇文章連結無重複。自訂主分類文章1以/page/qa-1開啟，顯示CRUD QA獨立分類中文，回到列表href=/news。
- 子站Reader僅有自己的子站消息分類，不見主站qa-independent且新增按鈕0；未新增或擴張帳號權限。
- 手機390px文檔377px、表格560px在346px容器橫向捲動；平板820px文檔820px無整頁溢出。手機新增modal左右3.75/373.74px、高782.2px，均在390x844範圍內。
- 最新build exit0；前端完整1722/1722通過；後端完整435通過、2既有警告。測試日誌 category-separation-build.log / category-separation-frontend-full-tests.log / category-separation-backend-full-tests.log。
- 最終本地frontend3322 session18024；backend8320 session80053（最末中文預設名/排序小修以單元完整回歸驗證）；ingress3321 session70310。全部為隔離memoryQA，未接正式資料庫。
- 預覽截圖 Temp/category-separation-categories-1014.jpg、Temp/category-separation-website-pages-1014.jpg。相容與操作文件docs/category-page-separation.md。全站其他QA清單仍未完成。

## 2026-10-15 分類與頁面流程改善
- 網站頁面可直接以 modal 新增一般頁面或文章列表，列表直接選擇分類。
- 分類代碼自動產生，手動代碼收於進階設定；缺少入口的分類提供權限對應引導。
- 保存頁面後提供編輯版面及查看前台；新增頁面預設不加入導覽。
- Modal 使用受控欄位保留驗證失敗的輸入與勾選，顯示行內錯誤與儲存中狀態。
- 表格首欄固定，手機有區域水平捲動提示。
- 驗證：前端 1729 passed；後端 447 passed / 2 warnings；Next production build exit 0。
- 限制：瀏覽器 URL 安全政策阻擋本輪存取，最新實作的實際點擊、視覺及 RWD 未複驗；以上單元測試不等同瀏覽器驗收。全站 QA 仍未完成。

## 2026-10-17 舊正式站簡報問題的本地驗收

- 範圍：官網簡報的卡片輪播、分類／標籤新增、文章標籤與卡片標籤、前台主題篩選及設定結果確認。依使用者決定跳過「只從指定列表隱藏單篇文章」。本節不代表全站其他功能已完成 QA。
- 使用隔離 SQLite 記憶體 QA：後端 8320、前端工作樹 3322、入口 3321。未使用正式資料庫或寄送外部郵件。
- 瀏覽器可用後實測分類新增、自動網址代碼、重複代碼的行內錯誤與輸入保留、改名及封存；標籤新增、重載保留、改名及封存均成功。
- 建立本地測試列表 qa-topic-listing-1017，收錄 news 與本次 QA 分類。網址與分類不同時仍能取得親子／宜蘭標籤；符合數 9 篇已發布文章，展開清單亦為 9 篇。篩選顯示名稱改為「親子推薦」，儲存重載及前台均保留，前台選取後仍為 9 篇。
- 文章 11：測試長標題、清空卡片標籤後保存與前台重載，只有該篇卡片不印標籤；其他卡片保留宜蘭。改為草稿後前台移除該篇，其他文章仍顯示。最後恢復原標題、宜蘭卡片標籤、已發布狀態與空封面。
- 首頁本地 QA 集合切至最新消息卡＋橫向輪播。實測下一張、上一張及跨循環接點，落點對齊誤差小於 1px；卡片等高。長標題採兩行顯示且保留完整 title 提示。
- 實測 CSS viewport 390×844、820×1112、1440×900，文件寬分別為 390、807、1427，均無整頁橫向溢出。使用本地 stays-hero.jpg 測試真實圖片，手機 304.19×190.12、平板 240×150，均為 16:10，object-fit: cover。
- 實際視覺 QA 發現分類與新增網站頁面進階網址欄位未套用表單排版，已補 form-grid compact。手機分類 dialog 為 x10／寬369.99／高747.41，代碼欄高49.65、字體16px，位於390×844 viewport內。
- 測試：共用輪播修復後完整前端 1747 passed；後端分類／標籤 22 passed。最後兩個欄位排版調整後相關前端 29 passed，TypeScript 檢查通過。
- 證據存於 D:/Worksapce/Projects/slowfield/artifacts/ux-qa-1017/，包括桌機／平板／手機輪播、手機進階欄位視窗。新增的 CRUD QA 分類／標籤已封存，測試列表保留供複驗；未永久刪除資料。

## 2026-10-18 移除輪播半張卡片提示

- 使用者明確要求不再以邊緣半張卡片提示滑動。共用輪播預設桌機3欄、平板2欄、手機1欄，卡片寬度依容器扣除間距後完整分配。圖片相簿明確設定的桌機欄數保留，平板最多2欄、手機1欄。
- 改用 mandatory snap，使手動捲動停靠完整卡片；縮放導致尺寸改變時取消舊動畫並重新對齊，避免舊落點造成半張卡片。
- 相關輪播／相簿／手機回歸34項通過，TypeScript檢查通過。
- 本輪新版尚未完成瀏覽器視覺驗收：本地服務原先停止，已恢復隔離後端8320與前端3322；測試分頁停在連線失敗的 data: 錯誤頁，Browser Use URL政策拒絕取得分頁。未繞過政策。前一節的截圖與三尺寸結果僅對應修改前版本，不可用來證明本次完整分欄的視覺結果。

### 2026-10-18 後續瀏覽器複驗完成

- 重新取得既有本地分頁成功，使用隔離 QA 首頁，設定最新消息卡＋橫向輪播並儲存，前台重載成功。
- 實際 CSS viewport：1440×900 顯示3張、820×1112顯示2張、390×844顯示1張完整卡片。文件寬為1427／807／390，無整頁橫向溢出。
- 每次停止後檢查左右兩側卡片邊界（1px容差），桌機前進10次、後退9次；平板與手機各前進9次、後退1次，包含末張回首張的循環接點，皆無半張卡片。
- 不重載依序桌機→平板→手機→桌機，均重新對齊完整卡片。瀏覽器擷取的 error 訊息為空。
- 新證據：D:/Worksapce/Projects/slowfield/artifacts/ux-qa-1018/desktop-rail.jpg、phone-rail.jpg，另有三尺寸完整頁面截圖。此次 fixture 無文章封面，以預設佔位圖驗證卡片幾何；不據此宣稱原圖內容無裁切。圖片 cover 與標題行數仍沿用原設定。
- 已清除暫時 viewport override。本節僅驗收本次輪播完整分欄變更，不代表全站功能 QA 完成。

## 2026-10-18 待部署變更深度審核與修復

基準為工作樹 HEAD 7e0626e 的未提交變更與新增程式，包含後台 UX、分類／頁面分離、公開列表、電子報、輪播及部署腳本。未操作正式資料庫或部署。

### Standards／正確性

- P1：分類 key 原先可達120字，自動生成可達100字，但 PostgreSQL Page.content_type 為 VARCHAR(40)。已將分類 schema、UI 與文章輸入驗證限制為40字，自動產生預留9字碰撞後綴。新增欄位容量與長英文碰撞回歸測試。未找到專案 AGENTS／CONTRIBUTING／CODING_STANDARDS，未捏造標準違反。
- P1：打包腳本清除 NEXT_PUBLIC_API_URL 後，client bundle 會使用 localhost:8000 預設值，Compose 執行期變數無法更改已編譯的 NEXT_PUBLIC 值。改為建置時明確固定 /api/v1，清除字型 mock 與本機 storage rewrite；新增腳本回歸檢查。

### Spec／需求符合度

- P1：住宿子站多分類列表直接攤平各來源，導致相同文章重複。改為依ID去重後排序，補測根站與子站皆使用去重邏輯。
- P2：分類與網站頁面管理讀取預設上限200筆文章，統計會截斷。改用現有 getAdminPagesAll 完整分頁讀取，補測呼叫點與1001筆多批讀取。

### 最新驗證

- 完整前端1749項通過；完整後端449項通過，2項既有依賴棄用警告；TypeScript檢查通過。日誌：deep-review-frontend-tests.log、deep-review-backend-tests.log。
- 原生正式建置首次因字型下載憑證鏈失敗，使用 NODE_OPTIONS=--use-system-ca 保留TLS驗證後成功；無字型mock。BUILD_ID=7I5MnwyzZeQQIEW-bz4ji，日誌deep-review-build.log。
- 正式 standalone 輸出於本地3322啟動，內部API指向隔離8320；3321模擬Caddy同源入口。隔離fixture開啟 LOCAL_QA_DEEP_REVIEW=1：根站205篇文章、子站兩篇已發布及一篇草稿（皆雙分類）。這些fixture只在scripts啟動，不屬於正式資料或migration。
- 瀏覽器分類表格news=205、experience=103，網站頁面統計相同。子站雙分類列表只顯示206／207各一次，草稿208不公開；1440×900文件寬1427無橫向溢出。
- 正式編譯的分類modal可建立長英文名稱分類，自動key為quality-assurance-category-with，成功訊息及列表確認已保存；進階代碼欄maxlength=40。
- 在3321同源入口以crud-qa-deep-1018@example.com測試電子報訂閱，頁面顯示「訂閱成功，感謝你。」；擷取的瀏覽器error訊息為空。未寄送真實外部郵件。
- 截圖：D:/Worksapce/Projects/slowfield/artifacts/ux-qa-1018/categories-205.jpg、child-deduplicated.jpg、standalone-subscribe-success.jpg。已還原viewport override。
- 本輪確認的4項缺陷皆已修復並驗證。這不是全站所有資料變體、真實SMTP／Email客戶端、正式PostgreSQL端到端或正式環境驗收；其餘瀏覽器覆蓋狀況仍以full-browser-qa-remaining.md為準。此建置使用本地內部API環境，並非可直接傳送的已核對部署包；打包時應由修正後腳本重新建置。
