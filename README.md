# 慢域旅宿 Slowfield Stays

[English](README.en.md) · Next.js 15 · React 19 · FastAPI · PostgreSQL · [MIT](LICENSE)

![Slowfield Stays 封面](docs/screenshots/cover.jpg)

這是一套多站點的民宿網站與內容管理系統：品牌官網、每間民宿各自的子站，以及一套共用的管理後台。

> 品牌、民宿、地址與聯絡方式都是虛構的；所有照片皆由 AI 生成（[圖片來源](docs/showcase/IMAGE_CREDITS.md)）。

---

## 前台

![首頁](docs/screenshots/front-01-home.jpg)

<table>
<tr>
<td width="50%"><img src="docs/screenshots/front-02-home-stays.jpg" alt="住宿搜尋與精選住宿"><br><sub>住宿搜尋與精選住宿</sub></td>
<td width="50%"><img src="docs/screenshots/front-04-home-pathways.jpg" alt="四個旅行入口"><br><sub>四個旅行入口</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/front-05-stays.jpg" alt="住宿總覽"><br><sub>住宿總覽</sub></td>
<td><img src="docs/screenshots/front-06-stay-detail.jpg" alt="住宿介紹"><br><sub>住宿介紹</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/front-07-villa-site.jpg" alt="民宿子站"><br><sub>民宿子站：自己的導覽、頁面與配色</sub></td>
<td><img src="docs/screenshots/front-08-villa-pricing.jpg" alt="房型與價格"><br><sub>房型與價格</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/front-03-home-about.jpg" alt="關於慢域"><br><sub>關於慢域</sub></td>
<td><img src="docs/screenshots/front-10-dining.jpg" alt="餐飲服務"><br><sub>餐飲服務</sub></td>
</tr>
</table>

![手機版](docs/screenshots/mobile.jpg)

## 後台

![儀表板](docs/screenshots/admin-01-dashboard.jpg)

<table>
<tr>
<td width="50%"><img src="docs/screenshots/admin-03-block-editor.jpg" alt="首頁區塊編輯"><br><sub>首頁區塊編輯與即時預覽</sub></td>
<td width="50%"><img src="docs/screenshots/admin-02-sites.jpg" alt="站群管理"><br><sub>站群管理：母站與民宿子站</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/admin-04-stay-editor.jpg" alt="住宿編輯"><br><sub>住宿編輯與完成度檢查</sub></td>
<td><img src="docs/screenshots/admin-05-article-editor.jpg" alt="文章編輯"><br><sub>文章編輯與 SEO 預覽</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/admin-06-media.jpg" alt="媒體庫"><br><sub>媒體庫</sub></td>
<td><img src="docs/screenshots/admin-07-bookings.jpg" alt="訂房請求"><br><sub>訂房請求與表單聯絡</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/admin-08-newsletter.jpg" alt="電子報"><br><sub>電子報編輯與預覽</sub></td>
<td><img src="docs/screenshots/admin-09-roles.jpg" alt="角色權限"><br><sub>角色與各站權限</sub></td>
</tr>
</table>

## 重點

- **多站點**：從範本建立民宿子站，建立後各自維護內容、頁面與 SEO。
- **區塊式頁面**：首頁與各頁由可排序的區塊組成，後台可即時預覽。
- **詢問型預訂**：旅客送出需求，由專人確認；後台處理狀態、備註並匯出 CSV。
- **內容與電子報**：文章、分類、橫幅、媒體庫、訂閱者與寄送佇列，以及一鍵取消訂閱。
- **共用 UI 元件**：後台所有畫面都使用同一套元件（`frontend/app/admin/ui`）。
- **中英雙語**：前台與後台都能切換語言，並附 SEO metadata、Open Graph 與網站地圖。

<details>
<summary><b>本機啟動</b></summary>

```bash
docker compose up -d db

cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]" && cp .env.example .env
alembic upgrade head && uvicorn app.main:app --reload

cd frontend
npm install && cp .env.example .env.local && npm run dev
```

| 網址 | 用途 |
| --- | --- |
| http://localhost:3000 | 前台網站 |
| http://localhost:3000/admin | 後台（第一個帳號由 `backend/.env` 的 `ADMIN_BOOTSTRAP_*` 設定） |
| http://localhost:8000/docs | API 文件 |

示範內容可用 [`scripts/showcase`](scripts/showcase/README.md) 匯入。示範圖片沒有放進 repo，請先依 [AI_IMAGE_PROMPTS.md](docs/showcase/AI_IMAGE_PROMPTS.md) 生成。

測試：`cd backend && pytest`，以及 `cd frontend && npm test && npm run typecheck`。部署方式請見 [DEPLOY.md](DEPLOY.md)。
</details>

<details>
<summary><b>專案結構</b></summary>

```text
frontend/app/(site)        品牌官網
frontend/app/property      民宿子站
frontend/app/admin         管理後台（ui/ 為共用元件）
backend/app/modules        auth · sites · stays · cms · media · bookings · inquiries · newsletter · email
scripts/showcase           匯入虛構示範內容
scripts/walkthrough-video  錄製前後台導覽影片
```
</details>
