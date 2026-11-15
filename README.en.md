# Slowfield Stays

[繁體中文](README.md) · Next.js 15 · React 19 · FastAPI · PostgreSQL · [MIT](LICENSE)

![Slowfield Stays cover](docs/screenshots/cover.jpg)

A multi-site website and CMS for a boutique-stay brand. It has a brand site, a site for each villa, and one shared back office.

> The brand, villas, addresses and contacts are all fictional, and every photo is AI-generated ([image credits](docs/showcase/IMAGE_CREDITS.md)).

---

## Public site

![Home](docs/screenshots/front-01-home.jpg)

<table>
<tr>
<td width="50%"><img src="docs/screenshots/front-02-home-stays.jpg" alt="Search and featured stays"><br><sub>Search and featured stays</sub></td>
<td width="50%"><img src="docs/screenshots/front-03-home-about.jpg" alt="About the brand"><br><sub>About the brand</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/front-11-home-news.jpg" alt="Latest news"><br><sub>Latest news</sub></td>
<td><img src="docs/screenshots/front-12-home-map.jpg" alt="Map with a marker for each stay"><br><sub>Map with a marker for each stay</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/front-04-home-pathways.jpg" alt="Four ways in"><br><sub>Four ways in</sub></td>
<td><img src="docs/screenshots/front-16-home-gallery.jpg" alt="Photo wall"><br><sub>Photo wall</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/front-14-brand.jpg" alt="Brand page"><br><sub>Brand page</sub></td>
<td><img src="docs/screenshots/front-15-contact.jpg" alt="Contact: enquiry form beside the newsletter"><br><sub>Contact: enquiry form beside the newsletter</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/front-05-stays.jpg" alt="Stays"><br><sub>Stays</sub></td>
<td><img src="docs/screenshots/front-06-stay-detail.jpg" alt="Stay detail"><br><sub>Stay detail</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/front-07-villa-site.jpg" alt="Villa site: its own nav, pages and theme"><br><sub>Villa site: its own nav, pages and theme</sub></td>
<td><img src="docs/screenshots/front-08-villa-pricing.jpg" alt="Rooms and pricing"><br><sub>Rooms and pricing</sub></td>
</tr>
</table>

![Mobile](docs/screenshots/mobile.jpg)

## Admin

![Dashboard](docs/screenshots/admin-01-dashboard.jpg)

<table>
<tr>
<td width="50%"><img src="docs/screenshots/admin-03-block-editor.jpg" alt="Block editor"><br><sub>Block editor with live preview</sub></td>
<td width="50%"><img src="docs/screenshots/admin-02-sites.jpg" alt="Sites"><br><sub>Brand site and villa sites</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/admin-04-stay-editor.jpg" alt="Stay editor"><br><sub>Stay editor with a completeness check</sub></td>
<td><img src="docs/screenshots/admin-05-article-editor.jpg" alt="Article editor"><br><sub>Article editor with SEO preview</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/admin-06-media.jpg" alt="Media library"><br><sub>Media library</sub></td>
<td><img src="docs/screenshots/admin-07-bookings.jpg" alt="Booking requests"><br><sub>Booking requests and inquiries</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/admin-08-newsletter.jpg" alt="Newsletter"><br><sub>Newsletter editor and preview</sub></td>
<td><img src="docs/screenshots/admin-09-roles.jpg" alt="Roles"><br><sub>Roles and per-site permissions</sub></td>
</tr>
</table>

## Highlights

- **Multi-site:** villa sites are created from a template, and each one then keeps its own content, pages and SEO.
- **Block pages:** the home page and other pages are built from reorderable blocks, with a live preview in the admin.
- **Inquiry-first booking:** guests send their dates and staff confirm by hand, with status, notes and CSV export.
- **Content and newsletter:** articles, categories, banners, a media library, subscribers and a send queue, with one-click unsubscribe.
- **One UI kit:** every admin screen is built from the same components (`frontend/app/admin/ui`).
- **Bilingual:** both the public site and the admin switch between Chinese and English, and pages carry SEO metadata, Open Graph tags and a sitemap.

<details>
<summary><b>Run locally</b></summary>

```bash
docker compose up -d db

cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]" && cp .env.example .env
alembic upgrade head && uvicorn app.main:app --reload

cd frontend
npm install && cp .env.example .env.local && npm run dev
```

| URL | What |
| --- | --- |
| http://localhost:3000 | Public site |
| http://localhost:3000/admin | Admin (the first account comes from `ADMIN_BOOTSTRAP_*` in `backend/.env`) |
| http://localhost:8000/docs | API docs |

To load the demo content, run [`scripts/showcase`](scripts/showcase/README.md). The images are not in the repo, so generate them first from [AI_IMAGE_PROMPTS.md](docs/showcase/AI_IMAGE_PROMPTS.md).

Tests: `cd backend && pytest`, and `cd frontend && npm test && npm run typecheck`. Deployment is covered in [DEPLOY.md](DEPLOY.md).
</details>

<details>
<summary><b>Structure</b></summary>

```text
frontend/app/(site)        brand site
frontend/app/property      villa sites
frontend/app/admin         back office (ui/ is the shared kit)
backend/app/modules        auth · sites · stays · cms · media · bookings · inquiries · newsletter · email
scripts/showcase           seeds the fictional demo content
scripts/walkthrough-video  records the walkthrough videos
```
</details>
