# Slowfield Stays — Feature Inventory

Exhaustive, testable inventory of the 慢域旅遊 / Slowfield Stays platform: one parent brand site at `/`, child villa sites at `/stays/{slug}`, Traditional Chinese + English, admin at `/admin`, Next.js 14 (App Router) frontend + FastAPI backend.

**How to read an entry.** Every item is numbered (`3.4`) and gives: what it does · where it is · how to exercise it · what correct looks like. Paths are relative to the repo root unless absolute.

**Test setup.** Backend on `http://localhost:8000` (API base `/api/v1`), frontend on `http://localhost:3000`. Locale is a cookie: `document.cookie = "site-locale=en; path=/"` then reload. The parent site resolves from the `Host` header; a villa can be forced anywhere with `?site={slug}` (see 1.2).

**Concurrency caveat.** Two agents were editing `frontend/app/admin/modules/blockForms.tsx`, `blockFields.tsx`, `PageBlockEditor.tsx` and `HomepageBlockEditor.tsx` while this was written. Every block field list in section 2 is derived from the **renderers** (the source of truth for what actually appears on the page). Where an admin form is expected to disagree, the entry says "verify after the in-flight edits land".

---

## 0. Section map

| § | Area | Items |
|---|---|---|
| 1 | Public routes & rendering | 1.1 – 1.24 (24) |
| 2 | Block types & config fields | 2.1 – 2.41 (42) |
| 3 | The bilingual layer | 3.1 – 3.22 (22) |
| 4 | Admin screens | 4.1 – 4.32 (32) |
| 5 | Site settings keys | 5.1 – 5.14 (14) |
| 6 | Search, filtering, forms | 6.1 – 6.15 (15) |
| 7 | SEO & metadata | 7.1 – 7.20 (20) |
| 8 | Backend API | 8.1 – 8.15 (15) |
| 9 | Coverage gaps & suspicious findings | 9.1 – 9.22 (23) |

**Total: 207 numbered items.**

---

## 1. Public routes & rendering

### 1.1 Route groups and file map

| URL | File | Notes |
|---|---|---|
| `/` | `frontend/app/(site)/page.tsx` | Parent homepage (blocks) |
| `/{category}` | `frontend/app/(site)/[category]/page.tsx` | Any CMS category listing |
| `/{category}/{identifier}` | `frontend/app/(site)/[category]/[identifier]/page.tsx` | CMS entry detail |
| `/page`, `/page/{identifier}` | `frontend/app/(site)/page/page.tsx`, `page/[identifier]/page.tsx` | Generic pages |
| `/privacy`, `/privacy/{identifier}` | `frontend/app/(site)/privacy/…` | Privacy pages |
| `/stays` | `frontend/app/(site)/stays/page.tsx` | Stay catalogue + search |
| `/stays/{slug}` | `frontend/app/(site)/stays/[slug]/page.tsx` **or** villa site | Middleware decides — see 1.2 |
| `/stays/detail/{slug}` | `frontend/app/(site)/stays/detail/[slug]/page.tsx` | Parent stay detail, never rewritten |
| `/contact` | `frontend/app/(site)/contact/page.tsx` | Enquiry form + contact blocks |
| `/property/{slug}` | `frontend/app/property/[slug]/page.tsx` | Villa homepage (rewrite target) |
| `/property/{slug}/{...pageSlug}` | `frontend/app/property/[slug]/[...pageSlug]/page.tsx` | Villa sub-pages + villa CMS detail |
| `/newsletter/unsubscribe` | `frontend/app/newsletter/unsubscribe/page.tsx` | Token-based unsubscribe |
| `/robots.txt` | `frontend/app/robots.ts` | |
| `/sitemap.xml` | `frontend/app/sitemap.ts` | |
| `/admin/preview/block` | `frontend/app/admin/preview/block/page.tsx` | Admin-token-gated block preview, no chrome |
| `/admin/preview/content/{id}` | `frontend/app/admin/preview/content/[id]/page.tsx` | Draft-aware CMS preview |

**Exercise:** hit each URL. **Correct:** every one renders without a 500; unknown slugs 404 (not a blank page).

### 1.2 Villa rewrite (`/stays/{slug}` → `/property/{slug}`)
`frontend/middleware.ts:100-128`. `/stays/{slug}/{rest}` is rewritten unconditionally (no dot in `rest`); bare `/stays/{slug}` calls `GET /api/v1/site/resolve?site={slug}` and rewrites only when `parent_site_id != null`.
**Exercise:** open `/stays/shamanya` and `/stays/{a-normal-stay-slug}`. **Correct:** the villa slug shows the villa's own header/footer chrome; the normal stay slug shows the parent stay detail page.

### 1.3 `/stays/detail/{slug}` escape hatch
`frontend/middleware.ts:93` explicitly excludes `/stays/detail/`. **Exercise:** for a stay whose slug also names a villa site, open `/stays/detail/{slug}`. **Correct:** the full parent stay detail (rooms, story, map) renders, and a "前往民宿官網 / Visit property website" link points at `/property/{slug}` (`(site)/stays/[slug]/page.tsx:94-102`).

### 1.4 `?site=` preview override
`frontend/middleware.ts:79-89`. Only a `[a-z0-9][a-z0-9-]*` value is accepted; it is per-request, never persisted; `/admin/*` is excluded except `/admin/preview/*`. Any stale `preview-site` cookie is actively cleared (`:153-155`).
**Exercise:** `/?site=shamanya`, then `/` in the same browser. **Correct:** first shows the villa's content on the parent chrome; second shows the parent site (no leak).

### 1.5 `x-site-slug` header is stripped from client input
`frontend/middleware.ts:71`. **Exercise:** `curl -H "x-site-slug: shamanya" http://localhost:3000/`. **Correct:** the parent site renders, not the villa.

### 1.6 Admin auth gate + JWT expiry
`frontend/middleware.ts:130-138`. No `admin-token` cookie → redirect `/admin/login`; expired JWT → redirect `/admin/login?expired=1` and cookie deleted. `/admin/login` and `/admin/reset-password` are exempt.
**Exercise:** open `/admin/stays` logged out. **Correct:** redirect to `/admin/login`. *(Do not attempt credentials.)*

### 1.7 Parent homepage — block list resolution
`frontend/app/(site)/page.tsx:49-96`. Reads `site.settings.homepage.blocks`. If absent/empty, falls back to `DEFAULT_BLOCKS` (`stays, about, gallery, articles(variant:feature), destinations, pathways, editorial`, `modules/home/HomepageBlocks.tsx:38-46`) and migrates legacy flat keys (`gallery_images`, `gallery_title`, `gallery_eyebrow`, `pathway_images`, `feature_image/_title/_body/_cta_label/_cta_href`).
**Correct:** a site that has never opened the block editor still gets `DEFAULT_BLOCKS`. Expect about five visible sections, not seven: `gallery` and `destinations` are in the list but render nothing until they have images or items (2.7, 2.12), which is correct behaviour, not a fault.

### 1.8 Parent homepage — built-in hero
`(site)/page.tsx:84,108-117`. `HomeHeroCarousel` renders **only when no `hero_banner` block exists at all** (enabled or not). Adding a disabled `hero_banner` block therefore removes the hero.
**Exercise:** add a `hero_banner` block and disable it. **Correct:** no hero at all (this is intentional per the code comment, but is a likely tester surprise — see 9.5).

### 1.9 Parent homepage — synthesised search block
`(site)/page.tsx:92-96`. If the saved block list contains no `search` block, one (`id: "search-bar"`, empty config) is inserted right after the hero (or at index 0).
**Correct:** the stay search bar appears on `/` even for a site that never added it.

### 1.10 Homepage announcement popup
`(site)/page.tsx:102`, data from `GET /api/v1/cms/announcements`. **Exercise:** publish an announcement with `display_mode: popup` inside its date window. **Correct:** a popup appears on `/` with a localised "read more" label.

### 1.11 Homepage JSON-LD
`(site)/page.tsx:100-101` emits `Organization` and `WebSite` (with a `SearchAction` targeting `/stays?destination={search_term_string}`) — `modules/seo.ts:190-226`. `WebSite.name` uses `settings.name_translations[locale]` if present.
**Exercise:** view-source, search `application/ld+json`. **Correct:** two blocks; `name` changes with the locale cookie.

### 1.12 `/{category}` resolution order
`(site)/[category]/page.tsx:27-38`. 1) `settings.pages[slug]` exists → use it. 2) legacy alias (`activities→activity`, `services→service`, `careers→career`, `media-coverage→media`) exists in `settings.pages` → use that. 3) if the raw slug (or its alias) names a known i18n content type, render anyway. 4) `notFound()`.
**Exercise:** `/journal`, `/activities`, `/media-coverage`, `/nonsense`. **Correct:** first three render a listing; the last 404s.

### 1.13 `/{category}/{identifier}` canonical redirect
`(site)/[category]/[identifier]/page.tsx:47-49`. When the page has a slug and the requested path differs from `page.public_path` (or `/{category}/{slug}`), the route `redirect()`s to the canonical path.
**Exercise:** open `/journal/{numeric-id}` for an entry that has a slug. **Correct:** 307/308 to `/journal/{slug}`. Same behaviour in `/page/[identifier]` (:47) and `/privacy/[identifier]` (:49).

### 1.14 CMS detail body: blocks win over plain body
`(site)/[category]/[identifier]/page.tsx:45,85-89`. If `body_blocks` is non-empty it is rendered by `ContentBlockRenderer`; otherwise `body` is split on `\n` into `<p>`s.
**Correct:** an entry with block content shows images/quotes/CTAs; a plain-text entry shows paragraphs. Never both.

### 1.15 `/page` and `/privacy` index pages
`(site)/page/page.tsx`, `(site)/privacy/page.tsx`. Both render `ContentListPage` with a hardcoded bilingual `COPY` object (title/intro/empty) that also feeds the metadata.
**Empty state:** `目前沒有一般頁面內容。` / `No general pages yet.` and `目前沒有隱私相關內容。` / `No privacy pages yet.`

### 1.16 Villa homepage
`frontend/app/property/[slug]/page.tsx:37-61`. Renders `settings.homepage.blocks` through `PropertyPageRenderer`.
**Empty state (`blocks` empty):** `<h1>{site name}</h1>` + `歡迎光臨，內容即將上線。` / `Welcome — content coming soon.` (`:54-58`).
**Correct:** `notFound()` when the slug is not a child site or the site is not `active` (`modules/siteVisibility.ts:17-24`).

### 1.17 Villa draft sites are not public
`modules/siteVisibility.ts:22-23`. A child site with `status` other than `active` (and not empty) is refused. **Exercise:** set a villa to `draft` in the admin, open `/stays/{slug}`. **Correct:** 404, not the template content.

### 1.18 Villa sub-page — block page
`property/[slug]/[...pageSlug]/page.tsx:158-199`. `settings.pages[pageKey]` with `page_type` other than `cms_list`.
Page-level hero from `hero_image`, `hero_title` (bilingual object), `hero_subtitle` (bilingual object), `hero_title_color`, `hero_subtitle_color`, `hero_height` (`small|medium|large|full` → CSS class `property-hero-banner--h-{v}`).
**Empty state:** if no hero and no blocks → `<h1>{page label}</h1>` + `內容即將上線。` / `Content coming soon.` If a hero exists but no blocks, only the hero renders.

### 1.19 Villa sub-page — CMS list page
`property/[slug]/[...pageSlug]/page.tsx:140-156`. `page_type: "cms_list"`, `content_type` (default `"news"`), plus `extra_content_types[]` folded in. The villa's slug is passed to the API so the **parent's** brand-wide posts whose `related_stay_ids` name this villa also appear.
**Exercise:** publish a parent-site `news` entry with the villa ticked in related stays; open `/stays/{slug}/news`. **Correct:** it appears in the villa's list, in the villa's chrome.

### 1.20 Villa CMS detail — three-way resolution
`property/[slug]/[...pageSlug]/page.tsx:127-137`: `resolvePage(contentType, id, villaSlug)` → `resolvePage("news", id, villaSlug)` → `resolveSharedPage(contentType, id, villaSlug)`. Plus a separate branch at `:112-120` for URL categories that are not villa page keys (e.g. `/stays/{slug}/media-coverage/{id}`), which maps back to the villa's own list key.
**Exercise:** click a shared parent post from a villa list. **Correct:** it opens at `/stays/{slug}/…` and does **not** 404 (this was the bug the code comments describe).

### 1.21 Villa page tombstones and hidden pages
`property/[slug]/[...pageSlug]/page.tsx:123-124` — unknown key or `deleted: true` → 404. `nav_hidden` / `footer_hidden` only affect menus, the route still works (`modules/property/types.ts:41-44`).
**Exercise:** tick NAV-hidden on a villa page. **Correct:** gone from the header, still reachable by URL.

### 1.22 Villa layout chrome
`frontend/app/property/[slug]/layout.tsx`. Header (`PropertyHeader`) with logo/site name, nav from `settings.nav` or derived from `settings.pages`, booking CTA from `settings.booking`, social icons, and a "回到慢域旅遊 / Back to Slowfield Stays" parent link (`:60-77`, overridable via `settings.parent_link.{label,href}`, default href `/`). Footer via `PropertyFooter` with `buildFooterNav` (falls back to the header nav when no page opts into FOOTER — `modules/property/types.ts:129-135`).
**Correct:** every villa page carries the villa's own header/footer, never the parent's.

### 1.23 Parent layout chrome
`frontend/app/(site)/layout.tsx`. Header (`SiteHeaderClient`), nav built by `buildNavLinks` (`:79-153`) from `settings.pages` + a bundled default set; footer grouped into 探索/Explore, 故事/Stories, 聯繫/Connect; footer newsletter; cookie consent banner; scroll-to-top FAB; GA/ads/head/body custom code injection.
**Exercise:** toggle NAV off + FOOTER on for one page. **Correct:** the link disappears from the header and stays in the footer (`:99-105,230`).

### 1.24 Site-wide error boundary
`frontend/app/(site)/error.tsx`. Client component; reads `site-locale` from `document.cookie` directly (`:25-33`), defaults to **en**.
**Exercise:** stop the backend and load `/` with `NEXT_PUBLIC_APP_ENV=production`. **Correct:** the bilingual "網站暫時無法使用 / Website unavailable" panel with a retry button. In non-production, `apiFetch` swallows failures and returns fallbacks instead (`modules/api.ts:148-165`).

---
## 2. Block types & config fields

### 2.0 How blocks are stored and rendered

Blocks are plain JSON — there is **no block table in the database** (confirmed: `backend/app/modules/cms/models.py` has no `Block`; page blocks live in the `pages.body_blocks` JSON column). They live in four places:

| Where | Shape | Renderer |
|---|---|---|
| `site.settings.homepage.blocks[]` (parent) | `{id, type, enabled?, config{}}` | `frontend/app/modules/home/HomepageBlocks.tsx` |
| `site.settings.homepage.blocks[]` (villa) | same | `frontend/app/modules/property/PropertyPageRenderer.tsx` |
| `site.settings.pages[key].blocks[]` (villa sub-pages; parent `/contact`; parent category pages) | same | `PropertyPageRenderer` / `modules/content/PageBlocks.tsx` |
| `page.body_blocks[]` (CMS entries) | `{id?, type, …flat fields}` | `frontend/app/modules/content/ContentBlockRenderer.tsx` |

The first three share one block vocabulary (2.3–2.27). `body_blocks` is a **separate, smaller vocabulary** (2.30–2.40).

**Exercise:** in the admin add each block type, save, reload the public page. **Correct:** the block appears. A `type` the renderer does not know renders `null` — silently, no error (see 9.4).

### 2.1 Universal per-block config — applies to EVERY block in the homepage/villa vocabulary

All non-bilingual. Read by `frontend/app/modules/blockStyle.ts:49-56` plus the two `BlockWrapper`s.

| key | type | effect |
|---|---|---|
| `enabled` | boolean | `false` hides the block (`HomepageBlocks.tsx:187`, `PropertyPageRenderer.tsx:125`, `ContentBlockRenderer.tsx:123`, `PageBlocks.tsx:224`) |
| `anchor` | string | becomes the wrapper element `id`, so a villa nav item with `link_mode:"anchor"` can scroll to it |
| `full_bleed` | boolean (strict `=== true`) | adds `property-block-full-bleed`. On villa pages the *unset* case adds `property-block-contained`; **on the homepage unset adds no class at all** (`HomepageBlocks.tsx:151-159`) |
| `_bgColor` | string, `#rgb`/`#rrggbb` **only** | full-viewport colour band; an invalid hex is ignored entirely |
| `_bgOpacity` | number 0–100 (default 100) | only used with `_bgColor`; clamped |
| `_fontSize` | CSS length matching `^\d{1,3}(\.\d+)?(px|rem|em|%)$` | anything else dropped (injection guard) |
| `_lineHeight` | unitless number, or CSS length | as above |
| `_textAlign` | `left|center|right|justify` | |
| `_padY` | number 0–400 (px) | written to **both** top and bottom — uneven vertical padding is not expressible |
| `_padX` | number 0–400 (px) | **replaces** the page gutter (sets `--gutter`); it does not add to it. With `_bgColor` set it becomes `calc(50vw - 50% + Npx)` |
| `_pairNext` | boolean | pairs this block with the next one into two columns |
| `_pairReverse` | boolean | swaps the columns (top/bottom in column mode) |
| `_pairDirection` | `"column"` | stacks the pair vertically |
| `_pairJoin` | boolean | on a block *after* a pair: stacks it into the pair's second column |

Editor padding presets (`blockStyle.ts:16-22`): 0 無/None, 32 緊湊/Tight, 56 標準/Normal, 88 寬鬆/Roomy, 120 很寬/Spacious.

**Exercise:** set `_padX` to 寬鬆 (88) on one homepage block. **Correct:** that block's side gutter is exactly 88px, not 88 + the site gutter.
**Exercise:** set `_bgColor` to `red` (a name, not hex). **Correct:** no colour band at all, and no broken full-bleed geometry.
**Exercise:** set `_pairNext` on a homepage block. **Correct:** it renders side by side with the next block — this used to be villa-only.

### 2.2 Bilingual notation used in this section

- **BI** — `{zh, en}` object; a plain string is also accepted and used for both. Resolved by `cfgT`/`pickT` (`modules/tr.ts:62,74`). Missing locale → the **other** locale → the hardcoded default.
- **BI-eyebrow** — `eyebrowT` (`modules/tr.ts:94`). Same, except a **present-but-empty** locale key resolves to `""`, so an eyebrow can actually be cleared. Every consumer guards with `{eyebrow && …}` so no empty node is left.
- **BI-local** — the block has its own `v[locale] || v.zh || v.en` helper rather than `tr.ts` (`BlockRooms`, `BlockImageGallery` captions, `BlockTable` cells). Practically identical; no cross-locale subtlety.
- **BI-combined** — one string carrying both languages, split on `·｜|` or the last-CJK boundary (`bilingual`, `localizeAmenity`). Used for **stay data**, not block config — the one block exception is `map` in `stays` mode.
- **RAW** — never localised: URLs, colours, numbers, enums, icon keys, phone/email/LINE ids, tag/facility filter values.

**The single most important rule for testers:** `title`, `heading`, `body` and friends **cannot be cleared** — emptying them restores the hardcoded default. Only `eyebrow` can be cleared. See 3.7.

---

### Homepage-only blocks

### 2.3 `hero_banner` — 主視覺 Hero / Hero Banner (villa label: 主視覺橫幅)
**Two different components for the same key.** Parent homepage → `modules/home/HomeHeroCarousel.tsx` (`HomepageBlocks.tsx:81-96`). Villa pages → `modules/property/blocks/BlockHeroBanner.tsx` (`PropertyPageRenderer.tsx:64`).

*Parent (`HomeHeroCarousel`)*
| field | type | bilingual |
|---|---|---|
| `images[]` | URL strings **or** `{url\|image_url, title, subtitle, translations}`. Non-empty → **replaces the CMS banners entirely** | RAW urls |
| `images[].title` / `.subtitle` | strings, but read through `trs()` | see next row |
| `images[].translations` | `{zh:{title,subtitle}, en:{…}, _style:{…}}` | **this is the bilingual channel** |
| `images[].translations._style.size` | `sm\|md\|lg\|xl` → `--hero-title-size` | RAW |
| `images[].translations._style.align` | `center\|right` (else left) | RAW |
| `images[].translations._style.valign` | `top\|bottom` (else center) | RAW |

*Villa (`BlockHeroBanner`)*: `title` **BI**, `subtitle` **BI**, `image` RAW URL, `images[]` RAW (strings or `{url}`), `height` RAW (`small` 320px / `medium` clamp(320,55vh,600) / `large` clamp(400,75vh,850) / `full` 100vh), `titleColor` RAW (unvalidated), `subtitleColor` RAW (unvalidated). Precedence: ≥2 `images` and <2 usable banners → block carousel; else CMS banners; else static `image || images[0]`.

**Exercise:** add ≥2 images, wait 6.5s. **Correct:** auto-advance with clickable dots (`aria-live` announcement); a single slide suppresses both. A `.mp4` URL renders an autoplaying muted looping `<video>`.
**Empty:** the parent hero never disappears (falls back to CMS banners, then to i18n copy). The villa hero renders an **empty styled section** rather than vanishing.
**Fixed, non-configurable on the parent hero** (`HomeHeroCarousel.tsx:113-122`): CTAs 預約入住/Reserve a stay → `/stays`, 品牌故事/Our story → `/brand`, and 向下探索/Scroll to explore.

### 2.4 `search` — 搜尋列 / Search Bar
`modules/home/blocks/BlockSearchBar.tsx`. **Homepage renderer only** — no case in `PropertyPageRenderer`.
Only config field: `title` **BI** (default 依你想要的旅行方式探索 / Find a stay that fits your mood). Every option list is derived server-side (see 6.2–6.6).
**Empty:** never disappears; with no stays the selects are simply empty.

### 2.5 `stays` — 精選內容 / Featured Collection (villa label: 精選住宿 / Featured Stays)
`modules/home/blocks/BlockStays.tsx`. Both renderers.

| field | type | bilingual |
|---|---|---|
| `source` | `"stays"` = catalogue, else a CMS `content_type` (default `"stays"`) | RAW |
| `limit` | number ≥1 (default 6) | RAW |
| `variant` | `grid\|list\|compact\|index\|feature\|showcase\|news` (default `grid`) | RAW |
| `eyebrow` | default `h.selected` — 慢域宅邸 / Selected homes (i18n) | **BI-eyebrow** |
| `headline` | default `h.headline` — 有性格的安靜去處 / Quiet places with character (i18n) | **BI** |
| `view_all_label` | default: `h.viewAll` for stays; 閱讀更多旅誌/Read more notes for journal; 查看更多/View all otherwise | **BI** |
| `rail` | boolean; auto-disabled below 3 cards | RAW |
| `show_tags` | boolean | RAW |
| `show_filter` | boolean → mounts `CardTagFilter` chips | RAW |
| `picked_tags[]` | string[] — **raw tag values, must match CMS tags exactly** | RAW |
| `extra_sources[]` | content_type[]; when set, chips become category names not entry tags | RAW |
| `pick_mode` | `"manual"` | RAW |
| `picked_ids[]` | number[] — stay or page ids, display order preserved | RAW |
| `filter_tag` | string, case-insensitive; **CMS sources only**, ignored in manual mode | RAW |

Card text is CMS-derived, not config: `trs(stay,"name"/"destination"/"summary")`, `tagsT()`, `localizeAmenity()` for amenity chips.
**Empty:** returns `null` when there are no matching stays/pages — the heading never appears alone.
**Exercise:** set `variant: "news"`. **Correct:** category filter chips appear above the cards regardless of `show_filter`.
Inline non-i18n literals: 全部/All, 閱讀更多/Read more, 民宿官網/Villa website, 立即訂房/Book now.

### 2.6 `articles`
`modules/home/blocks/BlockArticles.tsx`, **homepage renderer only** (`HomepageBlocks.tsx:73`). Present in `DEFAULT_BLOCKS` but **not** in either editor's `BLOCK_LABELS` — see 9.3.
`content_type` RAW (default `"journal"`), `limit` RAW (default 3), `variant` RAW (`grid|feature|news`), `filter_tag` RAW (lowercased, case-insensitive), `eyebrow` **BI-eyebrow** (default 旅遊札記 / Journal), `title` **BI** (default 旅途中的細節。 / Notes from the road.), `rail` RAW.
**Empty:** returns `null` when no articles match.

### 2.7 `gallery` — 相簿 / Photo Gallery
`modules/home/blocks/BlockGallery.tsx` → `HomePhotoGallery`. Both renderers.
`images[]` RAW (URL strings, falsy filtered, **max 8 rendered**), `eyebrow` **BI-eyebrow** (default `h.galleryEyebrow`), `title` **BI** (default `h.galleryTitle`). Grid class keyed to `count-{min(n,6)}`.
**Empty:** disappears when `images` is empty. No lightbox — plain `<img>` tiles.

### 2.8 `pathways` — 路徑卡片 / Pathway Cards (villa label: 探索路徑 / Pathways)
`modules/home/blocks/BlockPathways.tsx`. **Homepage renderer only** — offered in the villa editor but has no case in `PropertyPageRenderer` (see 9.2).
`items[]` — `{title` **BI**`, description` **BI**`, href` RAW (default `/`)`, image` RAW`}`; empty → the i18n `h.pathways` array (Dining / Activities / Journal / Franchise). `eyebrow` **BI-eyebrow**, `title` **BI**, `intro` **BI** — all i18n-defaulted.
A card with no `image` shows an auto index number `01`, `02`…
**Empty:** never disappears — renders the four bundled pathways.

### 2.9 `editorial` — 焦點版面 / Feature Panel
`modules/home/blocks/BlockEditorial.tsx`. Both renderers.
`image` RAW (its presence switches to a split layout), `image_position` RAW (`left`, else right), `eyebrow` **BI-eyebrow** (default `h.point`), `title` **BI** (default `h.pointTitle`), `body` **BI** (default `h.pointBody`), `cta_label` **BI** (default `""` — CTA hidden unless set, deliberately no i18n fallback), `cta_href` RAW (default `/experience`).
**Empty:** never disappears — shows the i18n manifesto copy with no CTA.

### 2.10 `about` — 品牌介紹 / About / Brand Story
`modules/home/blocks/BlockAbout.tsx`. Both renderers.
`image` RAW, `image2` RAW (enables a collage), `image_position` RAW, `eyebrow` **BI-eyebrow** (default 關於慢域 / About Select), `title` **BI** (default 我們選宿，不只是選房。 / We select stays, not just rooms.), `body` **BI** (split on `\n` into `<p>`), `caption` **BI**, `cta_label` **BI** (default 了解慢域體驗 / Read the experience), `cta_href` RAW (default `/experience`), `items[]` = `{icon` RAW`, icon_color` RAW`, label` **BI** (item dropped if empty)`, detail` **BI**`}`.
**Empty:** never disappears — shows the full hardcoded bilingual about copy.
**Side effect:** on a villa page, a paired `about`/`rich_text` block with no `items` is auto-filled with the first `flow` block's steps as feature items (`PropertyPageRenderer.tsx:146-155`).

### 2.11 `flow` — 步驟流程 / Step Flow (villa label: 預約流程 / Booking Flow)
`modules/home/blocks/BlockFlow.tsx`. Both renderers.
`steps[]` = `{title` **BI**`, text` **BI**`}` — step numbers `01`, `02`… are auto-generated from the index and are **not** configurable. `eyebrow` **BI-eyebrow**, `title` **BI**, `intro` **BI** — all defaulting to the i18n `h.bookingFlow*` copy.
**Empty:** never disappears — renders the bundled 3-step flow.
**Side effect:** the first `flow` block on a villa page supplies feature items to a paired text block **even when it is disabled** (`PropertyPageRenderer.tsx:131`). **Exercise:** hide the SPACE section on a villa. **Correct:** the paired block keeps its feature highlights.

### 2.12 `destinations` — 熱門目的地
`modules/home/blocks/BlockDestinations.tsx` (`HomepageBlocks.tsx:71`). **Homepage renderer only**; no `BLOCK_LABELS` entry in either editor (9.3).
`items[]` = `{name` **BI**`, description` **BI**`, image` RAW`, href` RAW (empty → a `<div>`, not a link)`}`, `eyebrow` **BI-eyebrow** (default 熱門目的地 / Popular destinations), `title` **BI** (default 選一個地方，慢慢待著。 / Choose a place. Stay a while.).
**Empty:** disappears when `items` is empty — the heading is never shown alone.

### 2.13 `newsletter` — 訂閱電子報 / Newsletter Signup
`modules/home/blocks/BlockNewsletter.tsx`. Both renderers. Client component, receives `siteSlug` as a prop.
`eyebrow` **BI-eyebrow** (default 慢域優惠 / SELECT OFFERS), `title` **BI** (default 訂閱慢域電子報 / Subscribe to our newsletter), `body` **BI** *(rendered as HTML through `safeHtml(…, {convertNewlines:true})` — the only config field anywhere rendered as HTML)*, `submit_label` **BI** (default 訂閱優惠訊息 / Subscribe), `text_color` RAW (**unvalidated** inline colour), `_bgColor` then legacy `bg_color` RAW, `full_bleed` RAW.
**Exercise:** enter an email, submit. **Correct:** POST `{NEXT_PUBLIC_API_URL}/newsletter/subscribe?site={siteSlug}` with `{email, name, groups:["public"]}`; button disables while sending; inline 感謝訂閱！ message.
**Empty:** never disappears.
**Note:** this block reads `_bgColor` itself *and* receives it again from `BlockWrapper`.

---

### Blocks shared by villa pages and the homepage

### 2.14 `rich_text` — 文字區塊 / Rich Text
`modules/property/blocks/BlockRichText.tsx`. Both renderers, `PageBlocks`, **and** `ContentBlockRenderer.tsx:124` (works inside a CMS article body).
`heading` **BI**, `eyebrow` **BI-eyebrow**, `body` **BI** (HTML or plain), `heading_color` RAW (via `safeCssColor`), `body_color` RAW, `image` RAW (side photo), `image_side` RAW (`left`, else right), `_listStyle` RAW (CSS class suffix), `_lineHeight` RAW, `_letterSpacing` RAW, legacy `items[]` = `{icon` RAW`, icon_color` RAW`, label` **BI**`, detail` **BI**`}`.
Body handling: HTML-looking input → `sanitizeRichHtml`; otherwise a line parser turns `1.`/`1)` runs into `<ol>` and `- * • · ● ▪ ◦ ‧` runs into `<ul>`, everything else into `<p>`, each escaped by `safeHtml`.
**Empty:** returns `null` when both `heading` and `body` are empty.
**Exercise:** paste `<script>alert(1)</script>` into the body. **Correct:** no script tag reaches the page.

### 2.15 `feature_list` — 特色亮點清單 / Feature List
`modules/property/blocks/BlockFeatureList.tsx`. Both renderers. The only block with a declared config type (`FeatureListConfig`, `:11`).
`eyebrow` **BI-eyebrow**, `heading` **BI**, `layout` RAW (`grid`, else `row`), `items[]` = `{icon` RAW (`icon:house|water|bed|sofa|leaf|pin|phone|mail|chat|paw`, or a literal glyph)`, icon_color` RAW (via `safeCssColor`)`, label` **BI** (item dropped if empty)`, detail` **BI**`}`.
**Empty:** returns `null` when no item has a label.

### 2.16 `image_gallery` — 圖片相簿 / Image Gallery (villa label: 多圖展示)
`modules/property/blocks/BlockImageGallery.tsx` → `LightboxGallery`. Both renderers.
`images[]` — URL strings **or** `{url, caption}` where `caption` is **BI-local**; `columns` RAW (clamped 1–4, default 2); `layout` RAW (`grid|collage|centered|carousel|scatter|overlap`, default `grid`); `galleryWidth` RAW (`narrow` 560 / `medium` 760 default / `wide` 960 px); `cardRatio` RAW (`4:3|1:1|3:4|16:9|3:2`; `""` = natural); `eyebrow` **BI-eyebrow**; `title` **BI**; `caption` **BI** (below the grid).
**Exercise:** click a tile. **Correct:** lightbox opens; Esc closes; ←/→ navigate; body scroll is locked; click zooms 2× with pointer drag-to-pan; counter reads `i/n`; prev/next hidden with a single image. Collage layout adds a scroll-linked parallax that is skipped under `prefers-reduced-motion`.
**Empty:** disappears when `images` is empty.

### 2.17 `rooms` — 房型／設施牆 / Rooms (villa label: 房型空間 / Rooms & Spaces)
`modules/property/blocks/BlockRooms.tsx`. Both renderers.
`eyebrow` **BI-eyebrow**, `title` **BI**, `items[]` = `{number` **BI-local** (default is localised: zh `A棟/B棟…`, en `Villa A/Villa B…`)`, name` **BI-local**`, images[]` RAW (strings or `{url}`)`, specs[]` = `{label` **BI-local**`, value` **BI-local**`}`}`.
**Exercise:** use the prev/next arrows and dots on a room card, then click the photo. **Correct:** no autoplay; the shared lightbox opens at the current index.
**Empty:** disappears when `items` is empty.

### 2.18 `faq_accordion` — 問答手風琴 / FAQ Accordion
`modules/property/blocks/BlockFaqAccordion.tsx`. Both renderers.
`eyebrow` **BI-eyebrow**, `title` **BI** (default 常見問題 / FAQ), `items[]` = `{question` **BI**`, answer` **BI** (HTML or plain)`}`.
**Exercise:** click two rows in turn. **Correct:** single-open accordion — opening the second closes the first; clicking the open one closes it; `aria-expanded` flips. Rows are numbered `Q1, Q2…`.
**Empty:** returns `null` unless at least one item has **both** a question and an answer.

### 2.19 `house_rules` — 入住須知 / House Rules
`modules/property/blocks/BlockHouseRules.tsx`. Both renderers.
`title` **BI** (default 入住須知 / House Rules), `eyebrow` **BI-eyebrow**, `items[]` = `{label` **BI** (item dropped if empty)`, detail` **BI**`}`.
**Correct:** items are numbered `01`, `02` (zero-padded), auto-generated.
**Empty:** disappears when no item has a label.

### 2.20 `table` — 表格 / Table
`modules/property/blocks/BlockTable.tsx`. Both renderers.
`title` **BI** (default 收費須知 / Pricing), `intro` **BI**, `notes` **BI** (split on `\n`), `columns[]` = `{label` **BI**`}`, `rows[][]` — 2-D array, each cell a string **or** `{zh,en}` (**BI-local**), legacy `items[]` = `{name` **BI**`, price` RAW`, capacity` RAW`, description` **BI**`}` with hardcoded bilingual headers 房型/價格/容量/說明.
**Correct:** the first column of each row is bolded.
**Empty:** returns `null` only when both `columns` and `rows` are empty (the legacy `items` branch populates them first, so an items-only block still renders).

### 2.21 `contact_info` — 交通聯繫 / Contact Info
`modules/property/blocks/BlockContactInfo.tsx`. Both renderers.
`title` **BI** (default 交通與聯繫 / Contact & Directions), `eyebrow` **BI-eyebrow**, `address` **BI**, `phone` RAW, `email` RAW, `line` RAW, `map_embed` RAW, `directions` **BI** (split on `\n`), `layout` RAW (`classic`, else `cards` default).
**LINE precedence — important.** `BlockContactInfo.tsx:14`: `const line = (siteLine && siteLine.trim()) || String(config.line ?? "")`. The **site-level** value wins. `siteLine` = `site.contact_config.line`, threaded in by `property/[slug]/page.tsx:52` and `[...pageSlug]/page.tsx:191`. On a villa that has a central LINE id, **editing the block's LINE id has no effect**. The homepage renderer threads no `siteLine` (`HomepageBlocks.tsx:123-127`), so there the block's own value is used.
**Map safety:** the `src` is regex-extracted from `map_embed` and rendered only when it matches `^https://(www\.)?(google\.com/maps|maps\.google\.com)\b`; anything else silently drops the map.
**Empty:** never disappears — renders a section with just the default `<h2>`.
Localised section labels: 地址/Address, 電話/Phone, 交通指引/Directions, 聯絡我們/Reach us, 如何抵達/How to arrive, 在 Google 地圖開啟 →/Open in Google Maps →. `Email` and `LINE` labels are literal in both languages.

### 2.22 `map` — 地圖 / Map
`modules/property/blocks/BlockMap.tsx` (async server component) → `LeafletMap` or a Google iframe. Both renderers.
`heading` **BI**, `eyebrow` **BI-eyebrow**, `caption` **BI**, `height` RAW (`short` 320 / `medium` 460 default / `tall` 620 px), `link` RAW (`^https?://`), `embed`/`map_embed` RAW (`embed` wins), `mode` RAW (`stays|pins|embed`), `markers[]` = `{name` **BI**`, desc` **BI**`, image` RAW`, link` RAW`, lat` RAW number`, lng` RAW number`, _stay` RAW flag`}` (a marker with non-finite lat/lng is dropped).
**There is no `zoom` config key.** Zoom is derived (`LeafletMap.tsx:111-113`): 1 marker → zoom 14; >1 → `fitBounds` with 42px padding; 0 valid markers → Yilan `[24.65, 121.78]` at zoom 11.
Mode selection: `usePins = mode==="pins" || mode==="stays" || (mode!=="embed" && markers.length>0)`. `mode:"stays"` awaits `getStays()` and builds one pin per published villa with `location_config.lat/lng`, labelled via **BI-combined** `bilingual(stay.name)` / `bilingual(stay.summary)`. Hand-made markers that duplicate an auto pin are de-duped.
**Exercise:** scroll over the map, then Ctrl/⌘+scroll. **Correct:** plain wheel scrolls the page; Ctrl+wheel zooms cursor-centred; a hint 按住 Ctrl 捲動以縮放 / Hold Ctrl + scroll to zoom appears. Popups open on hover *and* click and close on a 140ms timer.
**Empty:** returns `null` when pins mode has zero markers, or embed mode has no valid Google src.

### 2.23 `attractions` — 周邊景點 / Nearby Spots
`modules/property/blocks/BlockAttractions.tsx`. Both renderers.
`eyebrow` **BI-eyebrow**, `heading` **BI**, `caption` **BI**, `items[]` = `{name` **BI** (item dropped if empty)`, meta` **BI** (area/distance)`, desc` **BI**`, image` RAW`, link` RAW (must match `^https?://`, else dropped)`}`.
**Correct:** cards are numbered `01`, `02`; a card with a valid link becomes `<a target="_blank" rel="noopener noreferrer">`, otherwise a plain `<div>`.
**Empty:** disappears when no item has a name.

### 2.24 `partners` — 合作品牌 / Partner Brands
`modules/property/blocks/BlockPartners.tsx` → `PartnerGrid`. Both renderers, **and** `ContentBlockRenderer.tsx:131`.
`eyebrow` **BI-eyebrow**, `heading` **BI**, `caption` **BI**, `layout` RAW (`logos`, else `cards` default), `items[]` = `{name` **BI** (item dropped if empty)`, desc` **BI**`, detail` **BI** (newline-split into `<p>`)`, logo` RAW (`isSafeUrl`)`, image` RAW (`isSafeUrl`)`, href` RAW (`^https?://`)`}`.
**Exercise:** give one partner a `detail`. **Correct:** it becomes an expand-in-place accordion, one open at a time (了解更多/Read more → 收合/Close), with 前往官方網站 →/Visit the website → at the end. A partner without `detail` is a plain card, or an outbound link if it has `href`. A `logo` replaces the visible name and takes the alt text.
**Empty:** disappears when no item has a name.

### 2.25 `feature_badges` — 設施與服務 / Facilities & Services
`modules/property/blocks/BlockFeatureBadges.tsx`. Both renderers.
`title` **BI**, `eyebrow` **BI-eyebrow**, `items[]` = `{icon` RAW`, label` **BI**`, category` **BI**`}`.
`icon` is a **bare** name — no `icon:` prefix, unlike `feature_list` — from a 38-entry table (`BlockFeatureBadges.tsx:14`): `pool, pet, family, elderly, elevator, parking, wifi, bbq, ktv, chef, spa, gym, garden, view, mahjong, hotspring, kidpool, projector, tv, boardgame, gaming, ih, dishwasher, oven, microwave, fridge, coffee, minibar, water, utensils, outdoor_dining, crib, bathtub, sterilizer, toiletries, hairdryer, firstaid, extinguisher`. Unknown/empty → a diamond glyph.
**Correct:** badges group under `<h3>` category headings; uncategorised items come first. An item with an empty `label` still renders as a bare icon (unlike every other block, which drops it).
**Grouping caveat:** categories are keyed by the **localised** string, so a `{zh,en}` category groups correctly in both languages, but a combined "中文 English" category string would not.
**Empty:** disappears when `items` is empty.

### 2.26 `oembed` — 社群嵌入 / Social Embed
`modules/property/blocks/BlockOembed.tsx` (async server component). Both renderers, **and** `ContentBlockRenderer.tsx:139`.
`url` RAW (must pass `isSafeUrl`, **else the whole block returns `null`**), `caption` **BI** (also used as the iframe `title`), `embed_width` RAW (px, clamped 240–1600 → `--embed-max`), `embed_ratio` RAW (`16:9|4:3|1:1|4:5|9:16|auto` → `--embed-ratio`).
Resolution order: 1) Facebook `/videos`, `/reel`, `/watch` and `fb.watch` URLs are rewritten by hand to `facebook.com/plugins/video.php` — no Meta SDK script. 2) Everything else is fetched from `noembed.com/embed?url=…` server-side (1h revalidate). 3) Provider HTML goes through `sanitizeEmbedHtml` against the iframe host allow-list `www.youtube.com, youtube.com, player.vimeo.com, www.instagram.com, instagram.com, www.tiktok.com, www.facebook.com, platform.twitter.com, open.spotify.com` (exact host or `*.host`); iframe `src` must be `https://`; `referrerpolicy` is forced; `<script>` never survives.
**Exercise:** paste a YouTube URL, an Instagram post URL, and `javascript:alert(1)`. **Correct:** first two embed; the third makes the block vanish entirely.
**Fallback chain:** sanitised embed → provider thumbnail link → a plain `<a>` showing the raw URL. A valid URL never renders as nothing.

### 2.27 `contact_form` — 聯絡表單 / Contact Form
`modules/content/ContactFormBlock.tsx`. Both renderers (homepage passes no `siteLine`; villa pages do). Full field list in 6.9.

---

### 2.28 Block-type availability matrix

Labels: homepage editor `frontend/app/admin/(dashboard)/homepage/HomepageBlockEditor.tsx:63-88`; villa page editor `frontend/app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx:55-77`. **Both files are among the ones being edited concurrently — verify the label columns after the in-flight edits land.** The renderer columns come from the `switch` statements and are authoritative.

| key | zh / en label (homepage editor) | villa editor label | Homepage editor | Villa editor | Homepage renderer | Villa renderer |
|---|---|---|---|---|---|---|
| `hero_banner` | 主視覺 Hero / Hero Banner | 主視覺橫幅 / Hero Banner | ✅ | ✅ | ✅ `HomeHeroCarousel` | ✅ `BlockHeroBanner` |
| `search` | 搜尋列 / Search Bar | — | ✅ | ❌ | ✅ | ❌ |
| `rich_text` | 文字區塊 / Rich Text | 文字區塊 / Rich Text | ✅ | ✅ | ✅ | ✅ |
| `feature_list` | 特色亮點清單 / Feature List | same | ✅ | ✅ | ✅ | ✅ |
| `image_gallery` | 圖片相簿 / Image Gallery | 多圖展示 / Image Gallery | ✅ | ✅ | ✅ | ✅ |
| `rooms` | 房型／設施牆 / Rooms / Facilities | 房型空間 / Rooms & Spaces | ✅ | ✅ | ✅ | ✅ |
| `flow` | 步驟流程 / Step Flow | 預約流程 / Booking Flow | ✅ | ✅ | ✅ | ✅ |
| `stays` | 精選內容 / Featured Collection | 精選住宿 / Featured Stays | ✅ | ✅ | ✅ | ✅ |
| `gallery` | 相簿 / Photo Gallery | 相簿 / Photo Gallery | ✅ | ✅ | ✅ | ✅ |
| `pathways` | 路徑卡片 / Pathway Cards | 探索路徑 / Pathways | ✅ | ✅ | ✅ | ❌ **9.2** |
| `editorial` | 焦點版面 / Feature Panel | same | ✅ | ✅ | ✅ | ✅ |
| `about` | 品牌介紹 / About / Brand Story | same | ✅ | ✅ | ✅ | ✅ |
| `newsletter` | 訂閱電子報 / Newsletter Signup | 電子報訂閱 / Newsletter Signup | ✅ | ✅ | ✅ | ✅ |
| `faq_accordion` | 問答手風琴 / FAQ Accordion | same | ✅ | ✅ | ✅ | ✅ |
| `table` | 表格 / Table | same | ✅ | ✅ | ✅ | ✅ |
| `contact_info` | 交通聯繫 / Contact Info | same | ✅ | ✅ | ✅ | ✅ |
| `map` | 地圖 / Map | same | ✅ | ✅ | ✅ | ✅ |
| `attractions` | 周邊景點 / Nearby Spots | same | ✅ | ✅ | ✅ | ✅ |
| `partners` | 合作品牌 / Partner Brands | same | ✅ | ✅ | ✅ | ✅ |
| `contact_form` | 聯絡表單 / Contact Form | same | ✅ | ✅ | ✅ | ✅ |
| `feature_badges` | 設施與服務 / Facilities & Services | same | ✅ | ✅ | ✅ | ✅ |
| `house_rules` | 入住須知 / House Rules | same | ✅ | ✅ | ✅ | ✅ |
| `oembed` | 社群嵌入 / Social Embed | same | ✅ | ✅ | ✅ | ✅ |
| `destinations` | *(no label entry)* | *(none)* | ❌ | ❌ | ✅ | ❌ |
| `articles` | *(no label entry)* | *(none)* | ❌ | ❌ | ✅ | ❌ |

**Exercise:** for each row, add the block in the named editor, save, view the page. **Correct:** every ✅/✅ pair shows content. `pathways` on a villa page is expected to save and render nothing (9.2).

### 2.29 Block config forms
`frontend/app/admin/modules/blockForms.tsx` is the per-block-type config form registry (~3000 lines); `blockFields.tsx` holds the shared primitives — notably `getVal`/`setVal` (`:13,22`), which read `{zh,en}` objects and, on the first bilingual edit of a legacy plain string, **seed both locales with that string**. **All four block-editor files are in-flight; verify field-by-field parity with the renderer lists above after the edits land.**

---

### CMS article body blocks (`page.body_blocks`) — a separate, smaller vocabulary

Renderer: `frontend/app/modules/content/ContentBlockRenderer.tsx`. Editor: `frontend/app/admin/(dashboard)/cms/PageBlockEditor.tsx` (**in-flight**). Types declared at `frontend/app/modules/api.ts:77-86`. Every text field is **BI** via `pickT` and also accepts a legacy plain string. There is **no** `_bgColor`/`_padX`/pairing layer here.

### 2.30 `heading`
`level` RAW (`h2`|`h3`, default h2), `text` **BI**, `align` RAW (`left|center|right`). HTML-looking text passes through `sanitizeInlineHtml`. (`ContentBlockRenderer.tsx:144-155`)

### 2.31 `paragraph`
`text` **BI**, `align` RAW, `fontSize` RAW — a number (px, inline style; 16 is treated as default) or a legacy string (`small|base|large` → CSS class). A `<blockquote>` inside the text switches the wrapper from `<p>` to `<div>`. **Returns null when the text is empty.** (`:158-175`)

### 2.32 `image`
`url` RAW (**required** — no url, no render), `alt` **BI**, `caption` **BI**, `size` RAW (`full|wide|medium|small`). Alt falls back to the caption. (`:178-188`)

### 2.33 `image_grid`
`images[]` = `{url` RAW`, alt` **BI**`, caption` **BI**`}`, `columns` RAW (2|3|4, default 2), `gap` RAW (`tight|normal|wide`, default `normal`). Renders nothing when `images` is empty. (`:191-208`)

### 2.34 `columns`
New format: `items[]` = `{blocks: CmsContentBlock[], flex: number}` → `grid-template-columns: {flex}fr …`. Legacy: `left[]`/`right[]`/`ratio` (default `50-50`). **Nesting capped at depth 1** — a `columns` inside a `columns` renders nothing (`:211`). The editor also restricts in-column types to `paragraph, heading, image, video_embed, cta` (`PageBlockEditor.tsx:92-94`). (`:211-237`)

### 2.35 `video_embed`
`url` RAW (**required**), `title` **BI**, `caption` **BI**, `cover` RAW, `platform` RAW (stored, but the renderer re-derives it from the URL). With `cover` set → a click-through poster with a ▶ overlay. Otherwise a YouTube URL (`youtu.be/…`, `?v=`, `/shorts/`) becomes an `<iframe>`; Instagram/TikTok/unknown become a labelled link. An href failing `isSafeUrl` is replaced by `#`. (`:55-98, 240`)

### 2.36 `quote`
`text` **BI** (**returns null when empty**), `source` **BI** → `<cite>`. (`:243-261`)

### 2.37 `cta`
`label` **BI**, `href` RAW (**required and must pass `isSafeUrl` — otherwise the block renders nothing**), `style` RAW (`primary|outline|ghost`). Falls back to showing the href when the label is empty. (`:264-272`)

### 2.38 `spacer`
`size` RAW (`small|medium|large`, default `medium`). No text. (`:275`)

### 2.39 Foreign blocks inside an article body
`rich_text` (2.14), `partners` (2.24) and `oembed` (2.26) — saved in the homepage/villa format `{type, enabled, config{…}}` — are also rendered here (`ContentBlockRenderer.tsx:124-141`). The editor names them 圖文段落/Rich text, 合作品牌/Partner brands, 社群嵌入/Social embed (`PageBlockEditor.tsx:167-171`) but has **no config form for `oembed`**.
**Exercise:** put a `partners` block in an article body. **Correct:** it renders on the public article page.

### 2.40 `enabled: false` inside an article body
`ContentBlockRenderer.tsx:123` checks `enabled === false` **before** every type branch. **Exercise:** hide a body block in the editor. **Correct:** it disappears from the public page for every type, including foreign ones.

### 2.41 Editor layout templates
`PageBlockEditor.tsx:145-152`: 上圖下文/Image over text, 左圖右文/Image left, 左文右圖/Image right, 多圖＋文字/Gallery + text, 影片＋文字/Video + text. Each inserts a preset block combination. **Exercise:** click 左圖右文. **Correct:** a `columns` block with a text column then an image column, flex 5/5.

---
## 3. The bilingual layer

This is the section to read if the question is *"what does an English visitor actually see when only Chinese was written?"*. The short answer differs by content type — see the summary table at 3.20.

### How the locale is chosen

### 3.1 Locale resolution — three steps
`frontend/app/modules/i18n.ts:5-17`. Synchronous, called from ~70 places.
1. Cookie `site-locale` — `"zh"` or `"en"`. Whatever the visitor last chose.
2. Request header `x-site-default-locale` — the site's `default_locale`, published by the middleware.
3. **`"en"`** — the final hardcoded fallback.
**Exercise:** clear cookies, open `/` on a site whose `default_locale` is `zh`. **Correct:** Chinese. **Exercise:** stop the backend, clear cookies, open `/`. **Correct:** English (step 2 fails, step 3 applies).

### 3.2 How step 2 gets its value
`frontend/middleware.ts:25-38,142-148`. The middleware calls `GET /api/v1/site/resolve` (with the incoming `Host`, plus `?site=` for a villa) and copies `default_locale` into `x-site-default-locale`. Cached with `next: { revalidate: 300 }` — **a change to `default_locale` can take up to 5 minutes to take effect** for cookie-less visitors. Skipped entirely on `/admin*`.
**Correct:** an admin change to Default Locale shows up on a fresh incognito window within 5 minutes.

### 3.3 The language toggle
`frontend/app/modules/LanguageToggle.tsx:26-30`. A dropdown offering 中文 / English. Selecting one writes `document.cookie = "site-locale={zh|en}; path=/; max-age=31536000; SameSite=Lax"` (**1 year**) then calls `router.refresh()`.
**Exercise:** switch to English on `/journal/some-article`. **Correct:** the same URL re-renders in English — **the URL never changes**. There is no `/en/…` prefix, no `?lang=`, and no `hreflang` alternate. Consequence: one URL serves both languages, so a shared link opens in the recipient's own cookie language, and Google indexes whichever version it was served (see 7.14).
The button label shows the *current* locale (`EN` or `中文`), not the target.

### 3.4 Locale on error pages
`frontend/app/(site)/error.tsx:25-33` reads `site-locale` from `document.cookie` directly and defaults to **`"en"`** — it does not consult the site default. **Correct:** a cookie-less visitor to a Chinese-first site sees the English error panel. Known, minor.

---

### The resolvers

All in `frontend/app/modules/tr.ts`. There are seven, plus two combined-string helpers.

### 3.5 `trs(item, field, locale)` — CMS/DB records — `tr.ts:11-20`
Reads `item.translations[locale][field]`; if that is missing **or empty**, returns the item's own base column.
**Used for:** page `title`/`summary`/`body`, stay `name`/`destination`/`region`/`summary`/`story`, banner `title`/`subtitle`.
**English visitor, Chinese-only content:** sees the **Chinese** text. There is no hiding and no placeholder.
**Exercise:** create a journal entry with a Chinese title and no English translation; open `/journal/{slug}` in EN. **Correct:** the Chinese title renders, in the English chrome.

### 3.6 `pickT(val, locale, fallback)` — `{zh,en}` config values — `tr.ts:62-72`
An object → `obj[locale]` → **the other locale** → `fallback`. A non-empty plain string → itself. Anything else → `fallback`.
**English visitor, Chinese-only:** sees the **Chinese** value (cross-locale borrow).
**Exercise:** fill a block's `title` in zh only; view in EN. **Correct:** the Chinese title shows.

### 3.7 `cfgT(config, key, locale, fallback)` — `tr.ts:74-82`
`pickT` applied to `config[key]`. **A missing key and a present-but-empty string are indistinguishable — both return `fallback`.**
**Consequence, and the single most common tester surprise:** you **cannot clear** a `title`/`heading`/`body`/`caption`/`cta_label`. Emptying it in the admin restores the block's hardcoded default. Only `eyebrow` can be cleared (3.8).
**Exercise:** empty a `flow` block's title and save. **Correct:** the page shows the bundled 慢慢挑選，由真人確認。 / Choose slowly. Confirm with a person. (`i18n.ts:814`) — this is by design, not a save failure.

### 3.8 `eyebrowT(config, locale, fallback)` — `tr.ts:94-116`
Exists precisely to fix 3.7 for eyebrows. Rules:
- key **absent** → `fallback` (the block's built-in label).
- key present, object, **locale key present** (even as `""`) → that value, empty included. **Clearing works, and clears only that language.**
- key present, object, locale key **absent** → the other locale.
- key present, plain string → that string.
Callers render the element only when the result is non-empty, so nothing is left holding space.
**Exercise:** clear the Chinese eyebrow of a block whose English eyebrow still has text; view both languages. **Correct:** zh shows no eyebrow; en still shows its English one. (With `cfgT` the English text would have leaked onto the Chinese page.)

### 3.9 `tagsT(item, locale)` — page tags — `tr.ts:30-44`
Reads `translations[locale].tags`, accepting either an array **or** a comma-separated string (the admin field is free text), trims and drops empties. If the result is empty, falls back to the untranslated `item.tags`.
**English visitor, Chinese-only tags:** sees the **Chinese** tags — a page keeps showing its tags rather than none.
**Exercise:** set `translations.en.tags = "Pool, Sea view"` on an entry; view a card in EN. **Correct:** two chips, `Pool` and `Sea view`.

### 3.10 `localizeAmenity(s, locale)` — combined strings — `tr.ts:128-141`
For values stored as one string carrying both languages, e.g. `"14 米中庭泳池 Courtyard Pool"`. Splits at the **end of the last CJK run**, strips trailing CJK punctuation from the Chinese half, and returns the requested half.
Guards: no CJK at all → the string unchanged (`"Wi-Fi"`). No Latin letters in the tail → the string unchanged (`"泳池"`).
**Display-only.** The full original string stays as the form/filter value, or the backend's amenity match breaks.
**Exercise:** on a stay with amenity `"24 小時管家 24h Butler"`, view the amenity grid in EN. **Correct:** `24h Butler`. In zh: `24 小時管家`.
**Known limitation:** the English half may start with a digit (the split is at the last CJK character), which is intentional.

### 3.11 `bilingual(s, locale)` — `tr.ts:149-159`
Prefers an explicit ` · `, `｜` or ` | ` separator; both halves must be non-empty. Otherwise falls back to `localizeAmenity`.
**Used for:** stay `house_rules`, `location_config.address`, room name/description, map pin names.
**Exercise:** a house rule stored as `"禁止吸菸 · No smoking"`. **Correct:** EN shows `No smoking`, zh shows `禁止吸菸`.

### 3.12 `bilingualOr(s, locale, fallback)` — `tr.ts:168-173`
`bilingual()`, plus: empty → `fallback`; **and in EN, a result containing no Latin letter → `fallback`**. Used only for stay SEO title/description.
**English visitor, Chinese-only SEO title:** does **not** see the Chinese — it falls back to `trs(stay,"name",locale)`. This is the one place where Chinese is deliberately *not* leaked into an English page.
**Exercise:** set a stay's SEO title to `慢域宅邸` only; open `/stays/{slug}` in EN and view the `<title>`. **Correct:** the stay's name, not `慢域宅邸`.

### 3.13 `shortAmenity(s, locale, rules)` — `tr.ts:182-216`
Three-step chip label: 1) admin rules from `settings.amenity_short` (`{match, zh, en}`, case-insensitive substring); 2) a built-in 13-entry keyword table (包棟/Whole Villa, 泳池/Pool, 湯池/Hot Spring, KTV, 麻將/Mahjong, Switch, 桌遊/Board Games, 烤肉/BBQ, 管家/Butler, 私廚/Private Chef, 慢域餐桌/Private Dining, 手作早餐/Breakfast, 寵物友善/Pet Friendly); 3) `localizeAmenity`.
Display-only — the submitted filter value is always the full original string.
**Exercise:** a stay tag `"14 米中庭泳池 Courtyard Pool"` on `/stays/{slug}` in EN. **Correct:** the chip reads `Pool`, and clicking it navigates to `/stays?tag=14%20米中庭泳池%20Courtyard%20Pool`.

### 3.14 `getVal` / `setVal` — the admin side — `frontend/app/admin/modules/blockFields.tsx:13,22`
`getVal` returns `obj[locale]` and **does not** borrow the other locale — the editor shows a genuinely empty box for an untranslated field, which is correct for editing.
`setVal` preserves the other locale, and on the **first bilingual edit of a legacy plain string it seeds BOTH locales with that string**.
**Exercise:** take a block whose `title` is a legacy plain Chinese string, switch the editor to EN, type nothing, then edit the zh field. **Correct:** `title` becomes `{zh:"新值", en:"舊的中文"}` — the English field is now pre-filled with Chinese and must be corrected by hand. This is a real content-quality trap; note it for the client.
`PageBlockEditor.tsx:118-141` has its own identical pair (`getLocalVal`/`setLocalVal`) for `body_blocks`.

### 3.15 Site name
`resolveSiteName` (`(site)/layout.tsx:18-21`, `(site)/page.tsx:12-15`, `modules/property/types.ts:175-178`). `settings.name_translations[locale] || site.name`. **No cross-locale borrow** — a missing English name falls straight to the DB `name` column.

### 3.16 Nav labels — parent site
`(site)/layout.tsx:108-128`. Order: `pages[key].label[locale]` → **the bundled `DEFAULT_LABELS[key]` for this locale** → `label.zh` → `label.en` → the key.
The bundled default deliberately comes **before** the other language: page management writes an object as soon as *either* field is touched, so renaming only the Chinese label used to put 精選住宿 in the English nav when `Stays` was sitting right there.
A plain-string label is one label the admin chose for both languages and overrides the bundled default.
**Exercise:** rename 精選住宿 to 慢域住宿 and leave English blank; view the nav in EN. **Correct:** `Stays` (the bundled default), not 慢域住宿.
Bundled labels: stays 精選住宿/Stays · brand 品牌介紹/Brand · dining 餐飲服務/Dining · activity 精選活動/Activities · experience 慢域體驗/Experience · journal 旅遊札記/Journal · news 慢域消息/News · service 服務項目/Services · contact 聯繫我們/Contact · franchise 民宿加盟/Franchise · pr PR 聯絡/PR · media 媒體報導/Media · career 人才招募/Careers · privacy 隱私政策/Privacy (`(site)/layout.tsx:55-70`).
Group headings: 探索/Explore, 故事/Stories, 聯繫/Connect (`:221-225`).

### 3.17 Nav labels — villa sites
`modules/property/types.ts:152-166`. `pageLabel`: no label at all → **the raw page key**. Object → `label[locale] ?? label.en ?? key`. `navLabel` behaves the same. **There is no bundled default set for villas** — an untranslated villa page shows the bare key (e.g. `experience`) in that language.
`bookingLabel` (`:168-172`) defaults to 立即預約 / Book Now.

### 3.18 Consent copy is deliberately NOT cross-locale
`(site)/layout.tsx:193-202`. `cookie_notice` / `gdpr_notice`: `settings[locale]` → **the bundled bilingual default for this locale**. It never borrows the other language, because consent text has to be understood before it is agreed to.
**Exercise:** fill the Chinese cookie notice only; view in EN. **Correct:** the bundled English notice (`We use cookies and similar technologies…`), **not** the Chinese one.
**Villa sites have no bundled default** (`property/[slug]/layout.tsx:44-52`) — an unset notice yields `""` and the banner is suppressed entirely. Villa notices *do* borrow the other locale (`o[locale] || o.zh || o.en`), unlike the parent. Inconsistency worth flagging (9.8).

### 3.19 Hardcoded UI copy
Two families, both locale-correct but only one centrally editable:
- **i18n dictionary** (`modules/i18n.ts`, `t(locale)` at `:2460`, `publicUiText(locale)`): used by `editorial`, `flow`, `gallery`, `pathways`, `stays` block defaults, all `/stays` catalogue copy, all content-category titles/eyebrows/intros/empty states, the unsubscribe page, the newsletter panels.
- **Inline `zh ? "…" : "…"` ternaries** scattered in components: `about`, `articles`, `destinations`, `newsletter`, `search` block defaults; the villa "內容即將上線 / Content coming soon" empty states; 回到{list} / Back to {list}; 聯繫我們 / Contact Us; every villa block's default heading (常見問題/FAQ, 入住須知/House Rules, 收費須知/Pricing, 交通與聯繫/Contact & Directions).
**Exercise:** switch language on any page. **Correct:** no untranslated English string appears in the Chinese view and vice versa, *except* content the client wrote in one language only.

---

### 3.20 What an English visitor sees when only Chinese was written — by content type

| Content | Resolver | English visitor sees |
|---|---|---|
| Page/article title, summary, body | `trs` | **The Chinese text** |
| Page tags | `tagsT` | **The Chinese tags** |
| Stay name, destination, region, summary, story | `trs` | **The Chinese text** |
| Banner title/subtitle | `trs` | **The Chinese text** |
| Block `title`/`heading`/`body`/`caption`/`cta_label` | `cfgT` → `pickT` | **The Chinese text** (cross-locale borrow) |
| Block `eyebrow` | `eyebrowT` | **The Chinese text** if the `en` key is absent; **nothing** if `en` is present and empty |
| Stay amenities / house rules / address | `localizeAmenity` / `bilingual` | The English half if the string carries one; otherwise **the whole Chinese string** |
| Stay tag chips | `shortAmenity` | An English short label if a rule matches; otherwise the English half; otherwise **Chinese** |
| Stay **SEO title/description** | `bilingualOr` | **NOT the Chinese** — falls back to the stay name / summary / story excerpt |
| CMS entry **SEO title/description** | `cmsEntrySeo` | `translations.en.seo_*` → the flat `seo.title` (usually Chinese) → the entry title |
| Parent nav label | `buildNavLinks` | The **bundled English label** (e.g. `Stays`) — never the Chinese one, for the 14 known keys |
| Villa nav / page label | `pageLabel` | **The Chinese label**, or the bare key if no label exists |
| Site name | `resolveSiteName` | The DB `name` column |
| Cookie / GDPR notice (parent) | `localizedNotice` | The **bundled English default** — never the Chinese one |
| Cookie / GDPR notice (villa) | `localizedNotice` | **The Chinese text** (villa borrows; parent does not) |
| Villa hero title/subtitle (`pages[k].hero_title`) | inline `[locale] \|\| zh \|\| en` | **The Chinese text** |
| Contact inquiry types | inline `[locale] ?? zh ?? en` | **The Chinese text** |
| Search facility / type / guest labels | `searchOptions.ts:42-52` | **The Chinese label** (`label[locale] \|\| label.zh \|\| label.en`) |

**One-line summary for the client:** everywhere except SEO metadata, the parent nav, and the parent cookie/GDPR notice, an English visitor **falls back to the Chinese text** rather than seeing a gap. Nothing is ever hidden for being untranslated.

### 3.21 A page can be half-translated
Because every field resolves independently, an entry with an English title and a Chinese body renders exactly that: English heading, Chinese paragraphs.
**Exercise:** translate only the title of a journal entry. **Correct:** `/journal/{slug}` in EN shows the English `<h1>` above Chinese body copy. Expected behaviour, not a bug — but it is the failure mode the client should be shown.

### 3.22 The admin's own language
The admin has its own locale toggle (`(dashboard)/layout.tsx`), and each block/CMS editor has a per-field **edit locale** switch that decides which half of a `{zh,en}` pair you are typing into. Switching the edit locale does **not** change what the public site shows. **Exercise:** switch the block editor's locale to EN and type; save; view the public site in zh. **Correct:** the Chinese value is unchanged.

---
## 4. Admin screens

All under `/admin`. `(dashboard)` is a Next.js route group and **does not appear in the URL**.

### 4.1 Sign-in
`frontend/app/admin/login/page.tsx` + `login/LoginForm.tsx:25`. Email + password → `POST /api/v1/auth/login`. Also a "forgot password" mode → `POST /auth/forgot-password` (the reset link is echoed in the response **only when `APP_ENV=local`**).
**Correct:** an unauthenticated `/admin/stays` redirects here; a bad password shows an error and writes a `LoginAudit` row visible at 4.24. *Do not attempt credentials during testing.*

### 4.2 Session storage
`frontend/app/admin/modules/authActions.ts:10-34`. Cookie **`admin-token`** — httpOnly, sameSite=lax, path=/, maxAge **43200s (12h)**, `secure` in production. The JWT is never readable by JS. Current site = cookie **`admin-site`** (httpOnly, 30d), set by `adminSiteCookie.ts:7`. `logoutAction` (`:37`) deletes both.
**Note the mismatch:** the backend JWT itself is valid for **7 days** (`backend/app/core/config.py:16`) while the cookie expires in 12 hours. In practice the cookie wins.
**Correct:** after 12h the cookie is gone → redirect to `/admin/login`. An expired JWT inside the window redirects to `/admin/login?expired=1` (`frontend/middleware.ts:130-134`).

### 4.3 Password reset
`/admin/reset-password?token=…` — `reset-password/ResetPasswordForm.tsx:21`. `new_password` + confirm, min 8 → `POST /auth/reset-password`, then redirect to login. Tokens are single-use, SHA-256-hashed in the DB, 30-minute TTL.

### 4.4 The admin proxy (not a screen)
`/admin/api/proxy?path=…&site=…` — `frontend/app/admin/api/proxy/route.ts:37`. Client components call this instead of the backend directly; it reads the httpOnly `admin-token` and adds `Authorization: Bearer` + `X-Site-Slug`.
Guards: path allow-list `["/admin/", "/media", "/auth/me"]` (`:19`); rejects `..`, `//`, `@`; requires an `Origin` header on POST/PUT/PATCH/DELETE and checks it against `Host`; 401 → deletes the cookie.
**Exercise:** `curl "http://localhost:3000/admin/api/proxy?path=/etc/passwd"`. **Correct:** rejected (401 without a cookie, 403/400 with one).

### 4.5 Dashboard shell & permission-gated nav
`(dashboard)/layout.tsx:11,29-43`. Sidebar entries appear only with the matching permission: `/admin/sites` needs `sites:read` **or** `site_users:read`; `/admin/homepage` `cms:read`; `/admin/stays` `stays:read`; `/admin/cms` `cms:read`; `/admin/media` `media:read`; `/admin/booking-requests` + `/admin/inquiries` `inquiries:read`; `/admin/newsletter` `newsletter:read`; `/admin/users` + `/admin/login-audits` `global_users:read`; `/admin/roles` `roles:read`; `/admin/email-settings` `site_users:read`.
**Exercise:** sign in as an `editor` (site permissions `stays:*`, `cms:*`, `media:*`, `inquiries:read`, `newsletter:read`). **Correct:** Users, Roles, Login audits and Email settings are absent from the sidebar and 403 if typed.

### 4.6 `/admin` — overview
`(dashboard)/page.tsx:47`. Read-only: site-scoped counts (new inquiries, in review, published stays, successful logins), a review queue, workflow steps, and the readiness summary. Without `site_users:read` it redirects to the first readable section (`:59-65`).
**Public surface:** none.

### 4.7 `/admin/readiness` — launch checklist
`(dashboard)/readiness/page.tsx:276`. Gate `site_users:read`. Six computed **content** cards (`:306-323`):
1. Site network — `sites.length > 0`
2. Published public content — published stays **and** banners **and** pages all > 0
3. Media library — any asset
4. SMTP readiness — `is_enabled && smtp_host && from_email && has_password`
5. Newsletter baseline — any subscriber **and** any campaign
6. Admin coverage — any active user

Plus: **System signals** straight from `GET /admin/readiness` (`database`, `media_storage`, `secret_key`, `frontend_url`, `smtp`); **Engineering verification** — 4 manual ticks for `pytest`, `ruff check app tests`, `npm run build`, `npm run typecheck`; **SEO/tracking/compliance** — 7 presence checks (`seo_defaults.title`, `seo_defaults.description`, `settings.ga_id`, `settings.ad_code`, `settings.cookie_notice`, `settings.gdpr_notice`, `settings.facebook || settings.instagram`); **Viewport QA** — 3 ticks with links to `/`, `/stays`, `/contact`; **QA run sheet** — 4 groups × 3 items; **Blockers**, **handoff summary** (copy/print), and a **launch decision** select (`pending|ready|conditional|blocked`) + free-text note.
Ticks persist to `site.settings.qa_status[key]`; the note/decision to `qa_note`/`qa_decision` (`readinessActions.ts`).
**Correct — with two known exceptions:** the "Ad code" and "Social links" rows can never turn green (9.6).

### 4.8 `/admin/homepage` — parent homepage blocks
`(dashboard)/homepage/page.tsx:17` + `HomepageBlockEditor.tsx` (**in-flight**). Gate `cms:read`.
Drag-reorder, enable/disable (eye icon), edit each block's config, live per-block preview via `/admin/preview/block`. Saves to `settings.homepage.blocks`, `settings.homepage.seo.{title,description}` (bilingual), and `settings.name_translations`.
**Public surface:** the homepage `/`.
**Exercise:** reorder two blocks, save, reload `/`. **Correct:** the order matches.

### 4.9 `/admin/sites` — site list
`(dashboard)/sites/page.tsx:8`. Root site + child sites, edit links, delete button, "New Child Site" when `sites:write`.
**Public surface:** the villa network / `/stays/{slug}`.

### 4.10 `/admin/sites/new` — create a villa
`sites/new/NewSiteForm.tsx:60-84`. Bilingual `name`, `slug` (pattern-validated), `status`, `default_locale`, `template_site_id` (which existing site to copy pages/blocks/rooms from); `parent_site_id` is set to the root automatically.
**Exercise:** create a site from a template with status `draft`, then open `/stays/{new-slug}`. **Correct:** 404 — draft villas are not public (1.17).

### 4.11 `/admin/sites/[id]` — the site editor (7 tabs)
`sites/[id]/SitePageEditor.tsx` (**in-flight**). Gate `site_users:read`; read-only when the API returns `_can_edit: false`. Every field and the settings key it writes is in section 5. Tabs: 1 基本資料/Site Settings · 2 頁面管理/Pages · 3 權限管理/Permissions · 4 SEO · 5 字型/Typography · 6 搜尋/Search · 7 進階/Advanced.
Tabs 1 and 4–7 submit one big form (`updateSiteAction`); tabs 2 and 3 fire their own actions immediately.
**Note:** all tabs except 2 and 3 stay mounted with `display:none` so an unsaved tab is not blanked on submit — a change on tab 7 survives a save made while looking at tab 1.

### 4.12 `/admin/sites/[id]` tab 2 — 頁面管理 / Pages
`SitePageEditor.tsx:1198`. No form fields; every control saves on its own (300ms debounce, 3 retries).
- **Drag-reorder** → `settings.pages[key].sort_order`.
- **NAV checkbox** → `nav_hidden` (inverted) + `visible`. **FOOTER checkbox** → `footer_hidden` + `visible`. Independent.
- **Preview** → an in-app iframe modal at desktop/tablet/mobile widths.
- **Edit** → `/admin/homepage` for the root homepage row, else `/admin/sites/{id}/pages/{key}`.
- **Delete** → default pages are tombstoned `{deleted:true, visible:false}`; custom pages call `deletePropertyPageAction`. The homepage row cannot be deleted.
- **New/Edit page modal** → writes `pages[key].label[locale]` and the slug; renaming a slug rewrites the `settings.pages` key **and** any `settings.nav[].key`. On the root site a new page also creates a CMS page (`content_type = slug`, `layout=page`, `status=draft`).
**Public surface:** the header nav, the footer columns, and which `/{category}` routes resolve.
**Exercise:** untick NAV, leave FOOTER ticked. **Correct:** the link vanishes from the header and stays in the footer (1.23).

### 4.13 `/admin/sites/[id]` tab 3 — 權限管理 / Permissions
`SitePageEditor.tsx:824`. Lists users with a site role. Search/role/status filters, CSV export. Add an existing global user with a role (`admin`/`editor`) → `addSiteUserAction`; change role → `updateSiteUserRoleAction`; remove → `removeSiteUserAction` (all `PATCH /admin/sites/{id}/users/{uid}`, `role: null` = unlink).

### 4.14 `/admin/sites/[id]/pages/[pageKey]` — villa page block editor
`sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx` (**in-flight**). Gate `cms:read`; write needs `cms:write`.
Writes `settings.pages[key]` (or `settings.homepage` when `pageKey === "homepage"`): `blocks`, `seo`, `show_cms_list`, `list_layout`, `label{zh,en}`, `link_mode` (`page`/`anchor`) + `anchor`, `hero_image`, `hero_title{}`, `hero_subtitle{}`, `hero_title_color`, `hero_subtitle_color`, `hero_height`.
`propertyPagesActions.ts` re-fetches the live site before writing, so a stale posted snapshot cannot clobber another editor's work.
**Public surface:** `/stays/{slug}` and `/stays/{slug}/{pageKey}`.

### 4.15 `/admin/cms` — content pages & banners
`(dashboard)/cms/page.tsx:36`. Gate `cms:read`; write needs `cms:write`. Four tabs: overview / pages / banners / issues. Filters: `visibility` (active/deleted/all), `status`, `category`, `q`, `page`. Row actions: publish · review · draft · archive · delete (soft) · restore; bulk delete.
**Public surface:** every `/{category}/{identifier}` entry, plus the homepage hero banners.

### 4.16 `/admin/cms/pages/new` · `/admin/cms/pages/[id]/edit`
`cms/PageForm.tsx` → `PageFormEditor.tsx`. Fields: bilingual `title`/`summary`/body (into `translations`), `slug`, `content_type`, `layout` (hidden), `sort_order`, `tags`, `body_blocks` (`PageBlockEditor`, **in-flight**), `related_stay_ids`, cover image, `status`, and `seo_title`/`seo_description`/`seo_canonical` with a live `SeoPreview`. Delete/restore on the edit screen.
**Public surface:** the entry at `/{category}/{slug}` and its card in listings.
**Exercise:** tick a villa in Related Stays on a parent `news` entry. **Correct:** it appears on `/stays/{villa}/news` (1.19).

### 4.17 `/admin/cms/banners/new` · `/admin/cms/banners/[id]/edit`
`cms/BannerFormEditor.tsx`. Bilingual `title`/`subtitle`, image, link, `sort_order`, `status`, plus `_style` (title size / align / valign) packed into `translations`.
**Public surface:** the homepage hero carousel at `/` — and, via `getBannersForSite`, a villa's `hero_banner` block.

### 4.18 `/admin/stays` — stay catalogue
`(dashboard)/stays/page.tsx:26`. Gate `stays:read`; write needs `stays:write`. Three tabs (overview/list/issues), filters `visibility`, `status`, `destination`, `keyword`, `page`. Row actions: publish/review/draft/archive/delete/restore, bulk delete, preview.
**Note:** publishing is gated server-side by `_require_publishable_stay` (`backend/app/modules/admin/routes.py:571`) — an incomplete stay is refused.

### 4.19 `/admin/stays/new` · `/admin/stays/[id]/edit`
`stays/StayEditor.tsx` (**in-flight**). The full stay record: `name`, `slug`, `destination`, `region`, `summary`, `story`, bilingual `translations`, `hero_image_url`, `booking_url`, `sort_order`, `base_price`, `max_guests`, `status`, `amenities` (free-text display copy), `facilities` (canonical search values), `room_types`, `images`, `tags`, `faq`, `house_rules`, `location_address`, `location_map_url`, `location_map_embed`, `location_lat`, `location_lng`, `social_line`/`social_fb`/`social_ig`, `seo_title`, `seo_description`, `seo_canonical`, `seo_og_image`.
**Public surface:** the card on `/stays`, the detail page `/stays/{slug}` (or `/stays/detail/{slug}`), and any `map` block in `stays` mode (which needs `location_lat`/`location_lng`).
**Note:** `amenities` and `facilities` are different things — `facilities` is what the search filter matches exactly; `amenities` is the display copy that the filter also substring-matches (`backend/app/modules/stays/routes.py:60-79`).

### 4.20 `/admin/preview/stays/[id]` · `/admin/preview/banners/[id]`
Read-only in-chrome previews of a stay hero + story, and of a banner hero, each with an Edit link back.

### 4.21 `/admin/media` — media library
`(dashboard)/media/MediaLibraryView.tsx:72` + `MediaUploadModal.tsx`. Gate `media:read`; write `media:write`. Grid/list toggle, search, date-from/to, type filter (all/image/video), multi-select bulk delete, copy URL, upload and delete via the proxy.
Server guards (`backend/app/modules/media/routes.py:26-50,72,128-145`): extension allow-list, **10 MB cap**, magic-byte check, and SVGs rebuilt from an element/attribute allow-list. Files land at `storage/media/{uuid}{ext}` and are served with `Content-Security-Policy: sandbox; default-src 'none'` and `X-Content-Type-Options: nosniff`.
**Exercise:** upload an SVG containing `<script>`. **Correct:** the stored file has no script; requesting it directly cannot execute anything against the admin origin.

### 4.22 `/admin/booking-requests`
`(dashboard)/booking-requests/page.tsx:36`. Gate `inquiries:read` (403 without it). Read + status change only (`new|contacted|quoted|closed`). Filters `keyword`, `status`; paginated; CSV export. Shows check-in/out, guests, room type, contact details, admin note.
**Public surface:** the inbox for the `/contact?stay=…` and booking-mode `contact_form` submissions.
**Note:** `BookingRequest` has **no `deleted_at`** — there is no delete/restore here, unlike inquiries.

### 4.23 `/admin/inquiries`
`(dashboard)/inquiries/page.tsx` (**in-flight**). Gate `inquiries:read`; write `inquiries:write`. Filters `keyword` (server-side LIKE across fields), `status`, `date_from`, `date_to`, `visibility`. Actions: status change, soft delete, restore. CSV export — values are passed through `_csv_safe` to block spreadsheet formula injection (`backend/app/modules/admin/routes.py:425`).
**Public surface:** the inbox for `/contact` and every non-booking `contact_form`.
**Exercise:** submit an inquiry with a name of `=cmd|'/c calc'!A1`, then export the CSV. **Correct:** the cell is prefixed/quoted, not a live formula.

### 4.24 `/admin/newsletter` — four tabs
`(dashboard)/newsletter/page.tsx:21`. Gate `newsletter:read` (403 without it). `?tab=` selects the panel.
- **Compose** (`panels/ComposePanel.tsx:77`) — `subject`, `target_groups`, `recipient_scope` radio (`self` vs `self+children`), WYSIWYG `body`.
- **Send** (`panels/SendPanel.tsx:15`) — process now, schedule at a date+time, unschedule, retry failed.
- **Subscribers** (`panels/SubscriberPanel.tsx:21`) — search, add, edit (email/name/status/groups), soft delete + restore.
- **Campaigns** (`panels/CampaignsPanel.tsx:14`) — archive list with keyword and date filters.
Also `/admin/newsletter/new` (standalone compose) and `/admin/newsletter/[id]` (edit subject/groups/body; Queue button while `status === "draft"`; read-only once sent).
**Scheduling:** a backend loop ticks every 60s and promotes due campaigns (`backend/app/main.py:19,61-76`). **Exercise:** schedule a campaign one minute out. **Correct:** it moves to sending within ~60s without anyone pressing anything.
**Dead route:** `/admin/newsletter/subscribers/[id]/edit` is an unconditional redirect stub.

### 4.25 `/admin/email-settings`
`(dashboard)/email-settings/page.tsx:9`. Gate `site_users:read` (403 without it). Per-site SMTP: `is_enabled`, `smtp_host`, `smtp_port` (1–65535), `smtp_username`, `smtp_password`, `from_name`, `from_email`, `reply_to`, `use_tls`, `daily_cap`. A second form sends a test message to `to_email`.
**Public surface:** all outbound mail — inquiry/booking staff notices and the newsletter.
**Note:** the test send is recorded as a delivery, so it **counts against the daily cap**.

### 4.26 `/admin/users` · `/admin/users/new`
Gate `global_users:read`; write `global_users:write`. List with keyword/status filters, role editor, activate/deactivate (with confirm), and an effective-permissions view. New user: `name`, `email`, `password` (min 8), `role`, `site_slug`, plus extra-permission checkboxes.

### 4.27 `/admin/roles`
`(dashboard)/roles/RolesTabView.tsx`. Gate `roles:read`; write `roles:write`. One tab per role with a permission checkbox matrix; `super_admin` is locked to `"*"`. Dirty-state save bar.
Permission keys (`backend/app/modules/admin/routes.py:44-57`): global `sites:read/write`, `global_users:read/write`, `roles:read/write`; site `stays:read/write`, `cms:read/write`, `media:read/write`, `inquiries:read/write`, `newsletter:read/write`, `site_users:read/write`; plus the literal `*`.
Default bundles: `super_admin`/`owner` → `["*"]`; `admin` → all 12 site permissions; `editor` → `stays:*`, `cms:*`, `media:*`, `inquiries:read`, `newsletter:read`.

### 4.28 `/admin/login-audits`
`(dashboard)/login-audits/page.tsx:86`. Gate `global_users:read` (403 without it). Read-only: filters by email keyword, IP, result, date range; table plus a time-series chart and top-IPs chart. **Global, not site-scoped.**
**Note:** the recorded IP is `request.client.host`, **not** `CF-Connecting-IP` — behind Cloudflare every row will show the edge IP. (The rate limiter *does* prefer `CF-Connecting-IP`; the audit does not.)

### 4.29 `/admin/account`
Own profile; change password (`current_password`, `new_password` min 8); a modal listing your own effective permissions grouped. No permission gate.

### 4.30 `/admin/preview/block` (unchromed)
`admin/preview/block/page.tsx:36`. Renders **one** block with the real front-end renderer (`homepage` or `property`, allow-listed by `modules/previewRenderer.ts:20`), config base64-encoded in the query so **unsaved** edits preview. Behind the admin token; carries no admin chrome.
**Exercise:** pass `?renderer=evil`. **Correct:** silently falls back to `homepage`. Pass a truncated `cfg`. **Correct:** previews as an empty block, no error page.

### 4.31 `/admin/preview/content/[id]` (unchromed)
`admin/preview/content/[id]/page.tsx:19`. Draft-aware full preview of a CMS page using the real `ContentBlockRenderer` plus the site's fonts/theme.
**Correct:** a `draft` entry renders here and 404s on the public route.

### 4.32 Shared admin widgets worth exercising
- `RichTextEditor.tsx` — contentEditable toolbar: bold/italic/underline/strike, ordered+unordered lists, align L/C/R, link/unlink, quote, image insert, colour + highlight, font size (11px steps), block format P/H2/H3/H4, undo/redo, clear formatting. Output sanitised by `sanitizeRichHtml`/`sanitizeInlineHtml`.
- `historyStack.ts` — undo/redo, limit 60, 700ms coalescing, Ctrl/Cmd+Z, Shift+Z, Ctrl+Y; suppressed inside text-entry targets.
- `DraftPagePreview.tsx` / `BlockLivePreview.tsx` — stacked same-origin iframes at `/admin/preview/block`, config base64 in the query (capped at ~6000 JSON chars — **a very large block config silently exceeds this and previews empty**), auto-grown to document height.
- `AdminFlash.tsx` — nonce-keyed toasts; `adminUtils.stampedRedirect` appends `_t=` so a repeated identical save still re-fires the message.
- `SeoPreview.tsx`, `StatusActions`, `StatusBadge`, `QualityBadge`, `BulkSelectForm`, `AdminSopButton` (inline how-to popovers).

---

## 5. Site settings keys

Everything below lives in the `sites.settings` JSON column. The backend imposes **no schema**; it strips `{api_keys, webhooks, smtp, secrets, internal}` from the public `/site/resolve` response (`backend/app/modules/sites/routes.py:22`) and otherwise passes the bag through. The admin write path is `frontend/app/admin/modules/siteActions.ts`.

**Type key:** BL = bilingual `{zh,en}` (a plain string is also accepted).

### 5.1 Identity & header
| key | type | what it does | read at | edited at |
|---|---|---|---|---|
| `name_translations` | BL | bilingual site/villa display name; falls back to the `name` column | `(site)/layout.tsx:19`, `property/types.ts:176`, backend `newsletter/routes.py:68` | Site editor tab 1, Site Name (zh/en) |
| `logo_url` | string URL | header logo (both chromes) | `(site)/layout.tsx:252`, `property/[slug]/layout.tsx:90` | tab 1, Logo Image |
| `header_logo_only` | bool | hide the site-name wordmark beside the logo | `(site)/layout.tsx:253` | tab 1 checkbox |
| `header_auto_hide` | bool | header slides away on scroll-down; **off = sticky** | `(site)/layout.tsx:259`, `SiteHeaderClient.tsx:66-72` | tab 1 checkbox |

**Exercise:** tick 隱藏導覽列 and scroll down 200px. **Correct:** the header slides away and returns on scroll-up; unticked, it never hides.

### 5.2 Tracking & custom code
| key | type | what it does | read at |
|---|---|---|---|
| `ga_id` | string | Google Analytics / GTM / AW id. **Rejected unless it matches `^(G\|UA\|GTM\|AW)-[A-Za-z0-9-]+$`** | `(site)/layout.tsx:181-182`, `property/[slug]/layout.tsx:54` |
| `ads_code` | string | inline ad/remarketing JS; **only emitted if it contains none of `<>"'`** | `(site)/layout.tsx:183,273` |
| `head_code` | string | custom `<head>` HTML, sanitised by `ServerHeadCode` | `(site)/layout.tsx:203` |
| `body_code` | string | custom body HTML (sanitised by `sanitizeCustomCode`) or, if it has no `<>"'`, inline JS | `(site)/layout.tsx:204,274` |

All four edited on tab 7 進階. **Exercise:** put `<script>alert(1)</script>` in `ads_code`. **Correct:** nothing is emitted (the `<` check rejects it).

### 5.3 Legal / consent
| key | type | what it does | read at |
|---|---|---|---|
| `cookie_notice` | BL or string | cookie-consent banner copy | `(site)/layout.tsx:201`, `property/[slug]/layout.tsx:52` |
| `gdpr_notice` | BL or string | GDPR paragraph inside the banner | `(site)/layout.tsx:202` |
| `footer_notice` | BL or string | legal/IP notice above the © row — **villa footer only** | `modules/property/PropertyFooter.tsx:43` |

Edited on tab 7 as separate zh/en fields. Parent falls back to a bundled bilingual default; **villas have no default** and suppress the banner when unset (3.18).

### 5.4 Typography & layout
| key | type | what it does |
|---|---|---|
| `font_preset` | enum `classic\|editorial\|modern\|warm\|resort\|coastal\|boutique\|elegant\|script\|kai` | legacy quick preset; used only when `font_config` is absent (`fontPresets.ts:173`) |
| `font_config.title_cjk` / `.title_latin` / `.body_cjk` / `.body_latin` | string face keys | granular `--font-title` / `--font-body` (`fontPresets.ts:170-178`). Defaults `cormorant` / `serif` / `serif` / `serif` |
| `type_scale.{h1\|h2\|h3\|h4\|body\|small}.{size,weight,line,font}` | strings | per-level `--type-*` CSS vars; each value re-validated in `siteActions.ts:369-401` |
| `layout.gutter` | `narrow\|normal\|wide` or px | `--gutter` side margin |
| `layout.section_gap` | `tight\|normal\|roomy` or px | `--section-y` |
| `layout.ui_scale` | number, **dropped unless 0.85–1.4** | `--ui-scale` |

All on tab 5 字型. `layout` applies on villa sites too — `property/[slug]/layout.tsx` spreads `layoutVars` alongside `fontVars` and `typeScaleVars`.
**Exercise:** switch `font_preset` to `kai`. **Correct:** the whole site's Chinese text (headings, body and UI) changes to 霞鶩文楷; other presets only vary the Latin display face.

### 5.5 Search options
| key | type | what it does | fallback when absent |
|---|---|---|---|
| `search_facilities` | `{value, label:BL}[]` | 服務設施 chips in the search bar | the 10 bundled `SERVICE_FACILITIES` (`searchOptions.ts:14-25`) |
| `search_types` | `{value, label:BL}[]` | 民宿類型 filter, matched against stay **tags** | **`[]` → the control is omitted entirely** |
| `search_guest_ranges` | `{value:"3"…, label:BL}[]` | 人數 ranges → the `guests` lower bound | `GUEST_RANGES` = 3 / 6 / 9 / 13 |
| `search_guest_ranges_unit` | BL | **dead — written but never read** (9.7) | — |
| `amenity_short` | `{match, zh, en}[]` | keyword → short bilingual chip label | the built-in 13-entry table, then `localizeAmenity` |
| `contact_inquiry_types` | `{value, label:BL, note:BL}[]` | the inquiry-type dropdown on `/contact` | `copy.contact.routingOptions` (bundled i18n) |

`search_*` are on tab 6 搜尋. **`amenity_short` and `contact_inquiry_types` have no admin editor any more** — the values are preserved on save rather than cleared (`siteActions.ts:53-68,459-480`), so they can only be changed in the database.
**Exercise:** clear `search_types` in the admin. **Correct:** the 類型 dropdown disappears from the search bar entirely (it does not render empty).

### 5.6 Contact & social
| key | type | notes |
|---|---|---|
| `contact_phone` | string | **admin-only** — read back by the site editor and the readiness meter; **no public renderer** |
| `social_instagram` / `social_facebook` / `social_threads` / `social_tiktok` | string URL | header + footer icons |
| `social_line` | string | mirrored automatically from the Contact LINE field into `settings.social_line` (`siteActions.ts:140`) |
| `social_links` (nested object) | `{instagram, facebook, …}` | legacy shape, still merged |
| flat `instagram`/`facebook`/`line`/`threads`/`tiktok`/`twitter`/`youtube`/`linkedin` | string URL | legacy flat shape, still read |

`resolveSocialLinks` (`modules/socialLinks.ts:22-38`) reads **every key from every shape** — nested `social_links`, then flat `key`, then `social_{key}` — so adding one to the form is enough. Only `^https?://` URLs reach an `href` (`httpOnly`, `:42`).
The Contact Email / LINE ID fields on tab 1 write to the top-level `contact_config`, not into `settings`.
**Exercise:** set only the LINE ID. **Correct:** a LINE icon appears in the header and footer, linking to `https://line.me/R/ti/p/%40handle`.

### 5.7 SEO
| key | type | notes |
|---|---|---|
| `seo_og_image` | string URL | default `og:image` when a page supplies none; validated by `isSafeUrl`, ≤500 chars |
| `homepage.seo.title` / `.description` | BL | homepage meta — edited in the **homepage** editor, not the site editor |
| `pages.{key}.seo.title` / `.description` / `.og_image` | BL / BL / string | per-page meta |

The site-wide `seo_defaults.title` / `.description` are top-level columns, not `settings`; they are edited on tab 4.

### 5.8 `pages` — the per-page config map
Read by `(site)/layout.tsx:84`, `property/[slug]/layout.tsx:29`, `modules/seo.ts:72`, `modules/content/CategoryPage.tsx`, `(site)/contact/page.tsx:39`, `property/[slug]/[...pageSlug]/page.tsx:22-26`.

| sub-key | type | effect |
|---|---|---|
| `label` | BL or string | nav/footer link text (3.16, 3.17) |
| `sort_order` | number | nav order. Default **50** on the parent, **99** in the admin sidebar |
| `nav_group` | `explore\|stories\|connect` | which footer column |
| `nav_pinned` | bool | show in the top header bar. Default: `stays`, `activity`, `journal` |
| `nav_hidden` | bool | hide from the header; the route still works |
| `footer_hidden` | bool | hide from the footer; independent of `nav_hidden` |
| `visible` | bool | `false` hides it and **404s the villa route** |
| `deleted` | bool | tombstone for a removed default page; 404s |
| `page_type` | `blocks\|cms_list` | renderer choice on villa sub-pages |
| `content_type` | string | CMS filter for `cms_list` |
| `extra_content_types` | string[] | extra categories folded into one list page |
| `blocks` | PropertyBlock[] | the page's block content |
| `seo.{title,description,og_image}` | BL/BL/string | per-page metadata |
| `hero_image` | string URL | page hero background |
| `hero_title` / `hero_subtitle` | BL | hero copy |
| `hero_title_color` / `hero_subtitle_color` | hex string | hero text colours |
| `hero_height` | `small\|medium\|large\|full` | 320px / 55vh / 75vh / 100vh |
| `link_mode` | `page\|anchor` | nav item routes to a page, or scrolls to a homepage block |
| `anchor` | string | the target block's `config.anchor` when `link_mode:"anchor"` |

**Exercise:** set a villa page to `link_mode:"anchor"` with `anchor:"space"`, and set `config.anchor = "space"` on a homepage block. **Correct:** the nav item links to `/stays/{slug}#space` and scrolls, instead of opening a sub-page.

### 5.9 `homepage`
`homepage.blocks[]` (1.7), `homepage.seo.{title,description}` (7.2). Legacy flat keys still read when `blocks` is empty: `gallery_images`, `gallery_title`, `gallery_eyebrow`, `pathway_images`, `feature_image`, `feature_title`, `feature_body`, `feature_cta_label`, `feature_cta_href` (`(site)/page.tsx:49-78`). None of these have a current editor.

### 5.10 Villa-only keys with no reachable editor
`nav` (`NavItem[]`, overrides `buildNavFromPages`), `booking` (`{phone, line, cta_label:BL, cta_href}`), `parent_link` (`{label:BL, href}`). All read at `property/[slug]/layout.tsx:30,31,64` but the only writer, `propertyPagesActions.updatePropertySettingsAction`, has **no call sites in the repo** — the villa settings form that fed it no longer exists. They can only be changed in the database (9.7).

### 5.11 Legacy hero keys with no editor
`hero_{contentType}` — `hero_stays`, `hero_contact`, `hero_journal`, `hero_news`, … A string URL used as the fallback behind `pages[key].hero_image`. Read at `modules/content/CategoryPage.tsx:66`, `ContentListPage.tsx:21`, `(site)/stays/page.tsx:73`, `(site)/contact/page.tsx:33`. **No writer anywhere.**

### 5.12 Backend-written keys
`qa_status` (`Record<string,bool>`), `qa_note` (string), `qa_decision` (`pending|ready|conditional|blocked`) — written by `PUT /admin/readiness/qa` and `/qa-note`, read back by the readiness screen and the dashboard.

### 5.13 Reserved private namespaces
`api_keys`, `webhooks`, `smtp`, `secrets`, `internal` — stripped from every public `/site/resolve` and `/site/children` response. Nothing writes them today.
**Exercise:** `curl "http://localhost:8000/api/v1/site/resolve"` and inspect `settings`. **Correct:** none of those five keys is present even if they exist in the DB.

### 5.14 Defaults when the whole bag is missing
`getCurrentSite()` (`modules/api.ts:246-262`) returns a hardcoded fallback site with `settings: {}` when the API is unreachable and `NEXT_PUBLIC_APP_ENV !== "production"`. **Exercise:** stop the backend in dev and load `/`. **Correct:** the site renders with default blocks and bundled copy rather than erroring.

---
## 6. Search, filtering, forms

### 6.1 The stay search bar — where it appears
`frontend/app/modules/StaySearchBar.tsx:239`. A plain `<form action="/stays">` **GET** — no JS submit, no `page` param. All controls are click-only custom listboxes writing hidden inputs. It appears on `/stays` (`(site)/stays/page.tsx:109`) and on the homepage via the `search` block (2.4).
**Exercise:** disable JavaScript. **Correct:** the form still submits (it is a real GET form), though the custom dropdowns will not open.

### 6.2 縣市 / County → `region`
Options from `buildLocationGroups(allStays, locale)` (`modules/stayLocations.ts:25-54`) — distinct `stay.region` values from the **unfiltered** catalogue, so the option list never shrinks to the filtered set. The submitted **value is always the Chinese** the stay is filed under; the **label** is `trs(stay,"region",locale)`.
**Backend:** case-insensitive **substring** match (`backend/app/modules/stays/routes.py:105-110`).

### 6.3 地區 / District → `destination`
Districts of the chosen county only; **disabled until a county is picked**, and reset when the county changes (`StaySearchBar.tsx:130,136-140`). The county prefix is stripped from the district label at both ends (`stayLocations.ts:32-41,61-70`).
**Backend:** case-insensitive substring match.
**Exercise:** pick 宜蘭縣, then switch to 台東縣. **Correct:** the district selection clears.

### 6.4 類型 / Type → `tag`
Options from `typeOptions(locale, site.settings)` = `settings.search_types` **only** — there is no built-in list, so **the field is hidden entirely when unconfigured** (`searchOptions.ts:69-71`).
**Backend:** exact lowercase membership in `stay.tags` (`routes.py:113-114`).

### 6.5 人數 / Guests → `guests`
`guestOptions()` = `settings.search_guest_ranges` ?? `GUEST_RANGES` (lower bounds 3 / 6 / 9 / 13).
**Backend:** `stay.max_guests >= guests` (`routes.py:111-112`).

### 6.6 服務設施 / Facilities → repeated `amenity`
`serviceOptions()` = `settings.search_facilities` ?? the 10 canonical `SERVICE_FACILITIES`. When neither exists it falls back to catalogue-derived amenities labelled by `shortAmenity()`.
**Multi-select:** one hidden `<input name="amenity">` per selection; the panel stays open while you pick (`StaySearchBar.tsx:173,185-199`). The server rebuilds the query with `params.append` (`(site)/stays/page.tsx:41`).
**Backend:** **OR** across selections, matched against the stay's ticked `facilities` exactly **or** as a substring of the display `amenities` copy (`routes.py:60-79,115-118`).
**Exercise:** select two facilities. **Correct:** the result count is **greater than or equal to** selecting one — never fewer. Verify: `/stays?amenity=KTV&amenity=湯池` returns stays with KTV **or** 湯池.

### 6.7 Full search verification
`/stays?region=宜蘭縣&destination=冬山鄉&guests=6&amenity=KTV&amenity=湯池`. **Correct:** results are in Yilan/Dongshan, `max_guests >= 6`, and have KTV or 湯池. In EN the dropdowns read "Yilan / Dongshan / Pool / 6–8 guests" but **the URL still carries 宜蘭縣 / 戲水池** — the value is always Chinese so the backend match works.
**Empty result:** `(site)/stays/page.tsx:123-127` → 目前沒有符合篩選條件的住宿。 / No stays match the current filters. The search bar stays above with the chosen values re-populated.
**Results grid:** `StaysLoadMore.tsx:25-54` — 9 initially, +9 per click. Cards route to `/stays/detail/{slug}` when the slug belongs to a child site, else `/stays/{slug}`.

### 6.8 Enquiry form on `/contact`
`frontend/app/(site)/contact/InquiryForm.tsx`.
Fields (`:112-138`): `subject` (optional, max 120, prefilled from `?subject=`), **`name` required, minLength 2**, `phone` (optional), **`email` required, `type=email`**, `message` (textarea, **not required**). Client validation is native HTML only — no trimming check, no phone format.
Payload (`:50-67`): always sends `check_in:null`, `check_out:null`, `guests:1` (hardcoded — the API rejects `guests:0`); `source` from `?source=` matched against the routing options, else the first option; `stay_id` from `?stay=`.
**Routing (`:73-78`):** `POST {API}/booking-requests` when `?stay=` is present, else `POST {API}/inquiries`, always with `?site={slug}&host={host}` so the right tenant owns the row.
Stored as an `Inquiry` or `BookingRequest` row with `status:"new"`; the booking path also emails staff via the site's `reply_to`/`from_email`.
Success UI (`:88-104`): checkmark + 已收到您的訊息… / message-received copy + a 再寫一封 button. Error: 送出失敗，請再試一次或改由 LINE 聯絡。 Both bilingual via `t(locale).contact`.
**Exercise:** `/contact?stay=3&subject=包棟詢問&source=pr`. **Correct:** subject prefilled, POST goes to `/booking-requests`, `source` forced to `booking`.
**Exercise:** submit a >2000-character message. **Correct:** 422 from the API → the red error line (the constraint is `message ≤ 2000`, `subject ≤ 200`, `name` min 2, valid email).
**Note:** this form has **no honeypot field** (unlike the block form); the backend just receives `website:""`.

### 6.9 The `contact_form` block
`frontend/app/modules/content/ContactFormBlock.tsx`.
Config: `eyebrow`/`title`/`subtitle`/`submit_label`/`line_label`/`cta_label` all **BI** via `cfgT`; `display` RAW (`"cta"` → renders LINE + booking buttons only, no form); `form_type` RAW (`"booking"`); `inquiry_types` (overrides the bundled 6-item bilingual list); `site` RAW (the villa slug, needed inside `/stays/{slug}` pages); `line` RAW.
Fields (`:211-260`): hidden honeypot `website`; `source` select (non-booking only); **`name` required min 2**; **`email` required**; `phone`; `line_id`; `message`. With `form_type:"booking"` it also shows `check_in`, `check_out` (date) and `guests` (number, min 1, default 2), and **the type select disappears**.
Routing (`:155-160`): `/booking-requests` when booking, else `/inquiries`, with `?host=` from `window.location.host` and `?site=` from `config.site`.
**Exercise:** fill the off-screen `website` input via devtools and submit. **Correct:** the success UI is shown but **nothing is stored** — the backend returns a fake 201 with `id: 0` (`backend/app/modules/inquiries/routes.py:26-36`, `bookings/routes.py:31-44`).
**Exercise:** set `form_type:"booking"`. **Correct:** dates + guests appear, no type select, POST hits `/booking-requests`.

### 6.10 Newsletter — four entry points, one endpoint
All `POST {API}/newsletter/subscribe?site={slug}` with `{email, name, groups}`.
- **Footer** (`modules/newsletter/FooterNewsletter.tsx`) — email only, `name:""`. Success 訂閱成功，感謝你。 / You're subscribed — thank you. Error 送出失敗，請稍後再試。 with `role="alert"`. On **every page**.
- **`/contact` panel** (`(site)/contact/SubscribePanel.tsx`) — optional `name` + required `email`, values trimmed. On success the **form is replaced** by a check icon + confirmation, `role="status"`.
- **`newsletter` block** (2.13) — email only, config-driven copy.
- **`NewsletterSignup.tsx`** — name + email; success/error render as a `<p>` under the button, the form is **not** replaced.

Backend (`backend/app/modules/newsletter/routes.py:17-49`): rate-limited 5/60s, site-scoped, email lower-cased and trimmed; a new row gets `unsubscribe_token = secrets.token_urlsafe(32)`; an existing subscriber is **reactivated** and their name/groups updated. Returns 201 `{ok:true, status:"subscribed"}`.
**There is no double opt-in and no confirmation email** — "success" only means a row was written.
**Exercise:** subscribe the same address twice. **Correct:** both show success; the second flips a previously unsubscribed row back to `subscribed`.
**Deliberate:** the `/contact` page's enquiry submit and subscribe submit are **separate buttons** — one submit must not imply both consents (`contact/page.tsx:79-82`).

### 6.11 Unsubscribe
`/newsletter/unsubscribe?token=…` — `frontend/app/newsletter/unsubscribe/page.tsx:26-56` + `UnsubscribeForm.tsx`.
No token → 此退訂連結缺少 token。 and no button. With a token → one button → `POST {API}/newsletter/unsubscribe?token=…` (no body). Success reads `site_name` from the JSON and shows a done panel with a checkmark, a 退訂對象 row naming the site, and the confirmation copy. Failure → 無法退訂，此連結可能已過期或無效。
Backend (`routes.py:52-70`): looks the subscriber up **by token only** — no email needed, tokens are globally unique across sites — sets `status="unsubscribed"`, and returns a `site_name` that prefers `settings.name_translations[zh|en]` over `site.name`.
**The page is `noIndex`** (`page.tsx:20`) because the URL is only meaningful with a subscriber's token on it.
**Exercise:** click twice with the same token. **Correct:** both return 200 and show the done panel (the token is not consumed). A garbage token → 404 → the error copy.
**Not rate-limited** — unlike subscribe (9.10).

### 6.12 Content listing facets
`frontend/app/modules/content/ContentFacets.tsx`. Two modes decided by the **data, not a flag** (`:30-36`): a facet **with** an `href` navigates (parent site category pages); a facet **without** one filters in place (villa index pages, `property/[slug]/[...pageSlug]/page.tsx:229-250`).
- **Search box** (`:154-173`) — client-side, matches title + summary + tags, case-insensitive, with a clear "X".
- **Tag list** (`:232-265`) — only for the active facet; counts per tag; first **8** shown (`TAG_LIMIT`), then 更多標籤 (n) / 收合標籤.
- **Keyboard:** Arrow/Home/End walk the facet list.
- **Status line** — `visible/total` plus a 清除 button that clears query, tag and active facet.
- Filtering **forces a plain grid** even when the layout is magazine or featured (`:144`) — deliberate.
**Exercise:** type a nonsense query. **Correct:** the count reads `0/N`, 沒有符合的內容。 / Nothing matches that. appears, and 清除 restores the full list.
**Facet visibility:** a category is listed only if it has entries **and** (`visible !== false && nav_hidden !== true`), or it is the current one (`CategoryPage.tsx:96-103`). Sorted by `pages[key].sort_order` (default 99), then label.

### 6.13 Load-more
`LoadMoreGrid.tsx:38` — 6 initially, +6 per click. `JournalMagazineGrid.tsx:33` — 9 initially, +9. `StaysLoadMore.tsx:25` — 9, +9.
**已載入全部內容 / All content loaded** appears only when `items.length > initialCount`. **Correct:** with exactly ≤ the initial count there is no button *and* no done-label.

### 6.14 Empty states, per surface
| Surface | Empty text |
|---|---|
| `/stays` with filters | 目前沒有符合篩選條件的住宿。 / No stays match the current filters. |
| Category page, no entries | the per-category bundled `empty` string (e.g. 目前尚無消息，敬請期待。) |
| Category page, unknown type | 內容即將上線。 / Content is coming soon. |
| Facet/search filtered to nothing | 沒有符合的內容。 / Nothing matches that. |
| `/page` | 目前沒有一般頁面內容。 / No general pages yet. |
| `/privacy` | 目前沒有隱私相關內容。 / No privacy pages yet. |
| Villa homepage, no blocks | `<h1>{site name}</h1>` + 歡迎光臨，內容即將上線。 / Welcome — content coming soon. |
| Villa sub-page, no hero and no blocks | `<h1>{label}</h1>` + 內容即將上線。 / Content coming soon. |
| Villa CMS list, no entries | 暫無內容。 / No content yet. |

### 6.15 ScrollRail (horizontal carousels)
`modules/content/ScrollRail.tsx`. Used by `articles`, `stays`, `NewsCategoryFilter`, `CardTagFilter`, and the gallery carousel — **not** by category pages.
Arrows appear only when the content overflows. A true infinite loop is achieved by rendering the children ×3 **client-side after mount** and re-centering on scroll; step = one card width + 20px. `ResizeObserver` + `MutationObserver` keep the arrow state correct when a filter changes the list.
**Exercise:** view-source (SSR HTML). **Correct:** exactly one copy of each card — the tripling is client-only, so crawlers do not see duplicated content.

---

## 7. SEO & metadata

Builder: `frontend/app/modules/seo.ts:124-175` (`buildMetadata`). Every route below calls it.

### 7.1 Base URL and the canonical chain
`seo.ts:23-27`: `NEXT_PUBLIC_SITE_URL` → `FRONTEND_URL` → `http://localhost:3000`, with trailing slashes stripped.
`buildMetadata` sets `alternates.canonical = absoluteUrl(canonical) ?? absoluteUrl(path)`.
**Exercise:** check any page's `<link rel="canonical">` in a deployed environment. **Correct:** it points at the real domain, not `localhost:3000`. (`NEXT_PUBLIC_SITE_URL` is not set on the server, which is why `FRONTEND_URL` is in the chain.)

### 7.2 Universal `buildMetadata` behaviour
- **Title:** `title.includes(siteName) ? title : "{title} | {siteName}"` — the site name is never doubled.
- **Description:** `description || site.seo_defaults.description`.
- **og:image:** `image` → `settings.seo_og_image`, each passed through `isSafeUrl` and absolutised; emitted at 1200×630. Twitter card becomes `summary_large_image` when an image exists, otherwise `summary`.
- **og:type:** `"website"` by default; `"article"` on every CMS-entry detail route.
- **Robots:** `noIndex` → `{index:false, follow:true}`. Otherwise `{index:true, follow:true}` plus googleBot `max-image-preview:large`, `max-snippet:-1`.
**Exercise:** view-source on any page. **Correct:** exactly one canonical, one og:image (or none), and a `robots` meta consistent with the table at 7.15.

### 7.3 `/` — parent homepage
`(site)/page.tsx:17-36`.
Title: `settings.homepage.seo.title[locale]` → first banner title (`trs`) → `seo_defaults.title` → resolved site name.
Description: `homepage.seo.description[locale]` → first banner subtitle → `seo_defaults.description`.
Image: the first banner's `image_url` → `settings.seo_og_image`. Canonical `/`. Type `website`. Indexable.
**Exercise:** fill only the English homepage SEO title; view `<title>` in zh. **Correct:** the English title (via `cfgT`'s cross-locale borrow) — verify with the client whether that is wanted.

### 7.4 `/{category}` — category listings
`(site)/[category]/page.tsx:40-72`.
Title: `settings.pages[key].seo.title[locale]` → the page label (`label[locale] || label.zh || label.en`) → the i18n category title → the content_type string.
Description: `pages[key].seo.description[locale]` → **the category's own i18n intro** (deliberately not `seo_defaults`, which made every listing describe itself identically).
Image: `pages[key].seo.og_image` → `settings.seo_og_image`. Canonical `/{category}`. Indexable.
An unresolvable category with known i18n copy still gets a title/description; otherwise `noIndex` with the "not found" title.

### 7.5 `/{category}/{identifier}` — CMS entry
`(site)/[category]/[identifier]/page.tsx:11-27`, and identically `/page/{id}` and `/privacy/{id}`.
Title: `translations[locale].seo_title` → the flat `seo.title` → `trs(page,"title",locale)`.
Description: `translations[locale].seo_description` → flat `seo.description` → `trs(page,"summary")` → `excerpt(trs(page,"body"), 160)`.
Image: flat `seo.og_image` → `page.cover_image_url` → `settings.seo_og_image`.
Canonical: flat `seo.canonical` → `page.public_path` → `/{category}/{slug||id}`. **Type `article`.**
**Exercise:** fill only the English `seo_description` on an entry; view the meta description in EN and zh. **Correct:** EN shows the English one; zh shows the flat/Chinese one. (Before `cmsEntrySeo`, both showed the flat copy — `seo.ts:92-104`.)
**Note:** `og_image` and `canonical` are **not** per-locale — only title and description are.

### 7.6 `/stays` — catalogue
`(site)/stays/page.tsx:10-26`. Title: `pages.stays.seo.title[locale]` → `copy.stays.headline`. Description: `pages.stays.seo.description[locale]` → `copy.stays.intro`. Image: `pages.stays.seo.og_image` → `settings.seo_og_image`. Canonical `/stays`. Indexable.

### 7.7 `/stays/{slug}` — parent stay detail
`(site)/stays/[slug]/page.tsx:16-34`.
Title: `bilingualOr(stay.seo.title, locale, trs(stay,"name"))` — **an English visitor never gets a Chinese-only SEO title** (3.12).
Description: `bilingualOr(stay.seo.description, locale, trs(stay,"summary"))` → `excerpt(trs(stay,"story"))`.
Image: `stay.seo.og_image` → `stay.hero_image_url`. Canonical: `stay.seo.canonical` → `/stays/{slug}`. Type `website`.
Missing stay → `noIndex` with the "not found" title.
**JSON-LD:** `LodgingBusiness` with name, description, image, url, `PostalAddress` (`addressLocality`/`addressRegion`), `amenityFeature[]` from `stay.amenities` (**the raw combined strings, not localised**), and `priceRange: "TWD {base_price}+"`.

### 7.8 `/stays/detail/{slug}`
`(site)/stays/detail/[slug]/page.tsx:20-34`. Identical to 7.7 **except the canonical points at `/stays/detail/{slug}`**, and `stay.seo.canonical` is **not** consulted.
**Exercise:** compare the two canonicals for a stay whose slug also names a villa. **Correct:** `/stays/{slug}` → the villa site's metadata; `/stays/detail/{slug}` → the stay's, self-canonical.

### 7.9 `/contact`
`(site)/contact/page.tsx:10-24`. Title `pages.contact.seo.title[locale]` → `copy.contact.title`. Description likewise → `copy.contact.intro`. Canonical `/contact`. **JSON-LD:** `ContactPage`.

### 7.10 `/property/{slug}` — villa homepage (served at `/stays/{slug}`)
`property/[slug]/page.tsx:9-35`.
Title: `settings.homepage.seo.title[locale]` → the resolved villa name.
Description: `homepage.seo.description[locale]` → the first banner's subtitle (`trs`) → `seo_defaults.description`.
Image: the first banner's `image_url` → `settings.seo_og_image`. **Canonical `/stays/{slug}`** (not `/property/…`). Type `website`.
Unknown/draft slug → `noIndex` with the localised "not found" title — otherwise the 404 would have worn the root layout's title and been indexable.

### 7.11 `/property/{slug}/{pageKey}` — villa sub-page
`property/[slug]/[...pageSlug]/page.tsx:76-89`.
Title: `pages[key].seo.title[locale]` → `"{page label} | {villa name}"`.
Description: `pages[key].seo.description[locale]` → **the page's own `hero_subtitle`** → `seo_defaults.description`. (The hero subtitle sits before `seo_defaults` precisely because a villa's six or seven sub-pages were all handing Google the same one-liner.)
Image: `pages[key].hero_image`. Canonical `/stays/{slug}/{pageKey}`.

### 7.12 Villa CMS entry
`property/[slug]/[...pageSlug]/page.tsx:57-73`. Same `cmsEntrySeo` chain as 7.5, canonical `/stays/{slug}/{...pageSlug}`, **type `article`**. **JSON-LD:** `Article` with headline, description, image, url.

### 7.13 `/newsletter/unsubscribe`
`noIndex: true` (`page.tsx:20`), title/description from `publicUiText(locale).unsubscribe`.

### 7.14 There are no `hreflang` alternates
`buildMetadata` sets only `alternates.canonical` — no `alternates.languages`, and there is no `/en/` URL prefix (3.3). One URL serves both languages depending on a cookie.
**Consequence to report to the client:** Google indexes whichever language it was served (the site default, since a crawler has no cookie), and the other language is not discoverable as a separate document. **Correct** as implemented; flagged as a limitation, not a bug (9.11).

### 7.15 Robots, per route
| Route | index |
|---|---|
| `/`, `/{category}`, `/{category}/{id}`, `/page*`, `/privacy*`, `/stays`, `/stays/{slug}`, `/stays/detail/{slug}`, `/contact`, `/property/*` | **yes** |
| Any route whose entity was not found (unknown stay, unknown villa, unknown page) | **no** (`noIndex: true, follow: true`) |
| `/newsletter/unsubscribe` | **no** |
| `/admin/*` | not blocked by `robots.txt` — protected by the auth middleware only (9.12) |

### 7.16 `/robots.txt`
`frontend/app/robots.ts`. `force-dynamic`. Emits `User-agent: * / Allow: /`, a `sitemap:` pointing at `{siteUrl}/sitemap.xml`, and `host`. `siteUrl` = `https://{site.domain}` when the domain is set and is not `localhost`, else `NEXT_PUBLIC_SITE_URL`.
**Exercise:** `curl http://localhost:3000/robots.txt`. **Correct:** the sitemap URL uses the site's real domain.

### 7.17 `/sitemap.xml`
`frontend/app/sitemap.ts`. `force-dynamic`, `revalidate = 3600`. Contains:
- 15 static routes with hand-set priorities (`/` 1.0, `/stays` 0.9, `/experience` and `/activities` 0.8, `/dining` `/journal` `/news` 0.7, `/brand` `/contact` `/services` 0.6, `/media-coverage` `/pr` 0.4, `/careers` `/franchise` 0.3, `/privacy` 0.2).
- Every published stay at `/stays/{slug}`, priority 0.85.
- Every CMS page at `buildContentHref(page)`, priority by content_type (activity/news 0.7, dining 0.65, journal 0.65, service 0.6, brand 0.55, else 0.5).
- Every child site: `/stays/{slug}` plus a **hardcoded** list of eight sub-pages `about, space, experience, pricing, contact, faq, news, articles` (`sitemap.ts:9`).
**Exercise:** rename a villa page key or add a custom one. **Correct:** villa sub-pages come from each site's real `settings.pages` via `sitemapPageKeys`, so a custom page is listed and a villa with no pages contributes none.

### 7.18 Structured data summary
| Route | JSON-LD |
|---|---|
| `/` | `Organization` + `WebSite` (with a `SearchAction` → `/stays?destination={term}`) |
| `/stays/{slug}` and `/stays/detail/{slug}` | `LodgingBusiness` |
| `/{category}/{id}`, `/page/{id}`, `/privacy/{id}` | `Article` |
| Villa CMS entry | `Article` |
| `/contact` | `ContactPage` |

### 7.19 The `excerpt()` fallback
`seo.ts:112-122`. Flattens whitespace, cuts at 160 characters on a word boundary when one is near the limit (CJK has no spaces, so a hard cut with an ellipsis is used). Used only when an entry has neither an SEO description nor a summary — without it every such entry inherited the site-wide description and produced Search Console duplicate-description warnings.

### 7.20 Per-page SEO on the parent site
`pageSettingsSeo` (`seo.ts:67-80`) reads `settings.pages[key].seo.{title,description,og_image}` and resolves title/description with `pickT`. It is consumed by `/stays`, `/contact`, `/{category}`, `/page` and `/privacy`.
**Exercise:** fill the per-page SEO title for 品牌介紹 in the admin and open `/brand`. **Correct:** the `<title>` uses it. (It used to be written and ignored on the parent site.)

---

## 8. Backend API

FastAPI. Prefix **`/api/v1`** (`backend/app/core/config.py:13`, mounted `backend/app/main.py:114`).
`backend/build/lib/app/…` is a **stale packaged copy** and is not imported at runtime — ignore it.

### 8.1 System
- `GET /healthz` — public liveness probe. **Correct:** `{"status":"ok"}`.
- `GET /docs`, `GET /redoc` — **disabled when `APP_ENV=production`**. **Exercise:** with `APP_ENV=production`, `curl /docs`. **Correct:** 404.
- `GET /storage/media/{path}` — uploaded files, served with `Content-Security-Policy: sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'` and `X-Content-Type-Options: nosniff`.

### 8.2 Multi-tenant resolution
`backend/app/modules/sites/context.py:54` (`resolve_site`), in strict order:
1. **Explicit slug wins** — `?site=` query param or the `X-Site-Slug` header (`site or x_site_slug`, `:102`) matched on `Site.slug` where `status != "archived"`.
2. **Host header** — `normalize_host()` (splits on `,` then `:`, lowercases) matched against `Site.domain` **or** `Site.slug`.
3. **`www.`-insensitive fallback** — loads all non-archived sites and compares `canonical_domain`.
4. **Default site** — `ensure_default_site()` returns/creates slug `slowfield`, domain `localhost`.
Admin routes deliberately pass `host=None` (`admin/routes.py:105,409`) so the admin is driven purely by slug.
**Exercise:** `curl -H "Host: localhost" "http://localhost:8000/api/v1/site/resolve?site=shamanya"`. **Correct:** the villa, not the parent — the slug wins.
**Caveat to note:** every failure path swallows the exception and returns an **unpersisted in-memory `Site(id=1, …)`** (`context.py:36-38,67-69,90-92`), so a DB hiccup silently degrades into serving default-site content rather than erroring (9.14).

### 8.3 Rate limiting
`backend/app/core/rate_limit.py` — in-process sliding window keyed by `CF-Connecting-IP` → `request.client.host` → `"unknown"`. 429 on exceed. **Per-process and in-memory** — it does not hold across workers or restarts.

| Limiter | Threshold | Applied to |
|---|---|---|
| login | 10 / 60s | `POST /auth/login` |
| password reset | 5 / 60s | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| public form | 10 / 60s | `POST /booking-requests`, `POST /inquiries` |
| booking form | **3 / 300s** | `POST /booking-requests` (stacked) |
| inquiry form | 5 / 300s | `POST /inquiries` (stacked) |
| subscribe | 5 / 60s | `POST /newsletter/subscribe` |

**Not limited:** `POST /newsletter/unsubscribe`, `POST /auth/change-password`, `POST /auth/bootstrap-admin`, all media uploads, and **every admin route**.
**Exercise:** submit the booking form 4 times in 5 minutes. **Correct:** the 4th returns 429.

### 8.4 Auth model
Stateless HS256 JWT, payload `{"sub": user_id, "exp": now + 10080 min}` — **7 days** (`core/config.py:16`, `auth/security.py:20-22`). Sent as `Authorization: Bearer`. Passwords are `pbkdf2_sha256`. **No refresh token, no revocation list, no logout endpoint** — a token is valid until it expires; "logout" only deletes the browser cookie.
Two role layers, both JSON `permissions` arrays on the `roles` table: a **global** role (`AdminUser.role_id` — governs `sites:*`, `global_users:*`, `roles:*`) and a **per-site** role (`AdminUserSite{admin_user_id, site_id, role_id}`, unique on the first two). `"*"` in the *global* role is the super-admin bypass.
Login audit: every `POST /auth/login` writes a `LoginAudit{admin_user_id (null on unknown email), email, ip_address, success, created_at}` **before** the 401 is raised.
Password reset tokens store only a SHA-256 hash, are single-use, 30-minute TTL.

### 8.5 Public — Auth
| Endpoint | Auth | For |
|---|---|---|
| `POST /api/v1/auth/login` | public, limited | sign in; writes an audit row either way |
| `POST /api/v1/auth/forgot-password` | public, limited | issues a 30-min reset token, emails `{FRONTEND_URL}/admin/reset-password?token=…`; the URL is echoed in the response **only when `APP_ENV=local`** |
| `POST /api/v1/auth/reset-password` | public, limited | consumes a single-use token |
| `POST /api/v1/auth/change-password` | admin | rejects reuse of the current password |
| `GET /api/v1/auth/me` | admin | identity + **merged global + site permissions** for `?site=` |
| `POST /api/v1/auth/bootstrap-admin` | public but **403 in production** | idempotent bootstrap-admin creation |

### 8.6 Public — Sites
- `GET /site/resolve?host=&site=` — the resolved site's identity/theme/contact/seo plus `settings` **with the five private namespaces stripped**.
- `GET /site/children?host=&site=` — active, non-template child sites of the current site (or of its parent when the caller is itself a child).

### 8.7 Public — CMS
- `GET /cms/banners?site=` — published, non-deleted banners with a non-empty image, inside their date window. Falls back to a hardcoded `PUBLIC_BANNERS` seed on a DB error.
- `GET /cms/pages?content_type=&site=&stay=&ids=` — `stay` merges the **parent's** posts whose `related_stay_ids` name that villa (the mechanism behind 1.19); `ids` is comma-separated (an empty parse yields an empty list). Falls back to `PUBLIC_PAGES`.
- `GET /cms/pages/{slug}?site=` — one published page by slug.
- `GET /cms/pages/resolve/{category}/{identifier}?site=` — maps a URL category back to `content_type` via `CONTENT_CATEGORY_ALIASES` and looks the page up by numeric id **or** slug.
- `GET /cms/announcements?site=` — published announcements inside their `starts_at`/`ends_at` window.

### 8.8 Public — Stays
- `GET /stays?destination=&region=&guests=&tag=&amenity=(repeatable)&site=` — published stays for the resolved site, filtered in Python (6.2–6.6).
- `GET /stays/{slug}?site=` — one published stay with amenities, room types and images; 404 otherwise.

### 8.9 Public — Forms
- `POST /booking-requests` — `stay_id, room_type, name, email, phone, line_id, check_in, check_out, guests (1-20), message (≤2000), source, website (honeypot)`. Honeypot trip → a **fake 201 with `id: 0`**, nothing written. On success, emails staff.
- `POST /inquiries` — same shape plus `subject`, minus `room_type`. Same honeypot behaviour.
- `POST /newsletter/subscribe?site=` — `{email, name, groups[]}`; upserts per site, mints an `unsubscribe_token`.
- `POST /newsletter/unsubscribe?token=` — token-only lookup; flips status; returns the owning site's name/slug.
- `GET /inquiries` — **public and always returns `[]`.** A dead stub; the real listing is the admin route (9.15).

### 8.10 Public/admin — Media
- `GET /api/v1/media?site=` and `POST /api/v1/media` — **any active admin, no permission check** (`Depends(get_current_admin)` only). Upload validates extension, a **10 MB** cap and magic bytes, rebuilds SVGs from an allow-list, and stores as `storage/media/{uuid}{ext}`.
- `GET /admin/media` (`media:read`), `DELETE /admin/media/{id}` (`media:write`).
- `POST /admin/media` is registered by re-using the **public** handler (`admin/routes.py:2434-2441`), so it resolves the site from host/query rather than through `get_admin_site` (9.16).

### 8.11 Admin — the site guard
Every `/api/v1/admin/*` route carries a router-level `Depends(get_current_admin)` (`admin/routes.py:33`) plus its own `require_permission(...)`. The current site comes from `get_admin_site` (`:401`), which reads `?site=` or `X-Site-Slug` and **403s unless the admin has a direct `AdminUserSite` link** (super-admins exempt).
**Exercise:** as a villa-only admin, call `GET /api/v1/admin/stays?site=slowfield`. **Correct:** 403, not the parent's stays.

### 8.12 Admin endpoint groups
| Group | Endpoints | Permission |
|---|---|---|
| Dashboard | `GET /admin/dashboard` | auth only |
| Readiness | `GET /admin/readiness`, `PUT /admin/readiness/qa`, `PUT /admin/readiness/qa-note` | `site_users:read` / `:write` |
| Email settings | `GET`/`PUT /admin/email-settings`, `POST /admin/email-settings/test` | `site_users:read` / `:write` |
| Sites | `GET`/`POST /admin/sites`, `GET`/`PUT`/`DELETE /admin/sites/{id}`, `GET`/`PATCH /admin/sites/{id}/users[/{uid}]` | `sites:read`/`sites:write`/`site_users:*` |
| Stays | `GET`/`POST /admin/stays`, `GET`/`PUT /admin/stays/{id}`, `PATCH .../status`, `POST .../delete`, `POST .../restore` | `stays:read` / `stays:write` |
| CMS banners | `GET`/`POST /admin/cms/banners`, `GET`/`PUT /{id}`, `PATCH /{id}/status`, `POST /{id}/delete`, `POST /{id}/restore` | `cms:read` / `cms:write` |
| CMS pages | same six shapes under `/admin/cms/pages` (body blocks travel in `body_blocks`) | `cms:read` / `cms:write` |
| Announcements | `GET`/`POST /admin/cms/announcements`, `PUT /{id}` — **no delete route** | `cms:read` / `cms:write` |
| Inquiries | `GET /admin/inquiries` (`?q=` LIKE search), `GET /admin/inquiries/export.csv`, `PATCH /{id}/status`, `DELETE /{id}`, `POST /{id}/restore` | `inquiries:read` / `:write` |
| Booking requests | `GET /admin/booking-requests`, `GET .../export.csv`, `PATCH /{id}/status` — **no delete** | `inquiries:read` / `:write` |
| Newsletter | subscribers (list/create/update/delete/restore), campaigns (list/create/update/queue/schedule/unschedule/process/delete/restore), `POST /admin/newsletter/process`, `POST /admin/newsletter/retry-failed` | `newsletter:read` / `:write` |
| Users | `GET`/`POST /admin/users`, `PATCH /{id}/status`, `PATCH /{id}/role` | `global_users:*`, role change `site_users:write` |
| Roles | `GET /admin/roles`, `GET /admin/permissions`, `PATCH /admin/roles/{id}/permissions` | `roles:read` / `roles:write` |
| Audit | `GET /admin/login-audits` — **global, not site-scoped** | `global_users:read` |

### 8.13 Data model notes a tester needs
- **There is no `Block` table.** Homepage/villa blocks live in `sites.settings` JSON; CMS body blocks in `pages.body_blocks` JSON. Tables: roles, admin_users, login_audits, password_reset_tokens, booking_requests, pages, banners, announcements, email_settings, newsletter_subscribers, newsletter_campaigns, newsletter_deliveries, inquiries, media_assets, sites, admin_user_sites, stays, tags, amenities, room_types, stay_images.
- **Soft delete (`deleted_at`)** exists on: pages, banners, stays, inquiries, newsletter subscribers and campaigns. It does **not** exist on announcements or booking requests — those cannot be deleted at all through the API.
- **`Stay.facilities`** (JSON, canonical searchable values) is distinct from the `amenities` relation (free-text display copy). Both feed the amenity filter (8.8).
- **Site cloning** from a template deep-copies `settings`, `theme_config`, `contact_config`, `default_locale` — but deliberately **not** `seo_defaults`.
- **`PUT /admin/stays/{id}`** replaces amenities/room_types/images **wholesale**. **Exercise:** save a stay from the editor with one image removed. **Correct:** the row is gone, not orphaned.

### 8.14 CSV export safety
`GET /admin/inquiries/export.csv` and `/admin/booking-requests/export.csv` stream through `_csv_safe` (`admin/routes.py:425`) to block spreadsheet formula injection. **Exercise:** see 4.23.

### 8.15 The newsletter scheduler
`backend/app/main.py:19,61-76`. A background asyncio loop ticks every **60 seconds**, promoting due scheduled campaigns and sending them. Idempotent — a duplicate tick is a no-op; exceptions are caught so one bad sweep cannot kill the loop.

---

## 9. Coverage gaps, and things that look wrong

### Not covered / not verified

### 9.1 Nothing was executed
This inventory is derived entirely from reading the source. **No dev server was started, no page was loaded in a browser, and the admin was not logged into** (per the task constraints). Every "correct looks like" is an expectation derived from code, not an observed result. Testers should treat a disagreement as worth investigating in either direction.

### 9.1b Areas deliberately not enumerated
- **CSS/visual behaviour** — class names are quoted but no layout, spacing or responsive breakpoint was verified against a rendered page.
- **The block config *forms*** — `blockForms.tsx` (~3000 lines), `blockFields.tsx`, `PageBlockEditor.tsx`, `HomepageBlockEditor.tsx` and `PropertyBlockEditor.tsx` were all being edited concurrently. Section 2's field lists come from the **renderers**. A form field that exists but is not in section 2, or vice versa, is exactly the kind of drift to re-check once the edits land.
- **Email templates** — `backend/app/modules/email/service.py` was read only for its settings usage; the actual HTML of inquiry notices and newsletter sends was not inventoried.
- **Alembic migrations, `workers/`, `Caddyfile`, `docker-compose*.yml`, `seed_data.py`, `backend/scripts/seed_multisite.py`** — deployment and seeding are out of scope here.
- **`backend/tests/`** — the existing pytest suite was not catalogued.
- **Accessibility and performance** — not assessed.

### Things that look wrong

### 9.2 ~~`pathways` has no villa renderer~~ — RESOLVED, and the entry below is stale
`PropertyBlockEditor.tsx:73` lists `pathways: ["探索路徑", "Pathways"]`, but `PropertyPageRenderer.tsx:63-108` has **no `case "pathways"`** — it falls through to `default: return null`. An editor can add the block, configure it, save without error, and see nothing on the villa page. This is the exact failure mode the code comments elsewhere describe having fixed for seven other types (`HomepageBlocks.tsx:109-112`).
**Resolved.** All five `pathways` markers (eyebrow, title, intro, item title, item description) render on a villa page in both locales. Verified by a sweep that correctly still showed `destinations` and `articles` as villa-absent, so it discriminates.

### 9.3 `destinations` and `articles` render but cannot be added
Both have `case` branches in `HomepageBlocks.tsx` (`:71,73`) and `destinations` is not in `DEFAULT_BLOCKS` while `articles` is — yet **neither appears in `HomepageBlockEditor.BLOCK_LABELS`** (`:63-88`). An existing `articles` block (present in every default homepage) therefore renders but has no visible name or config form in the editor's add list.
**Verify after the in-flight edits land** — this may be exactly what is being changed.

### 9.4 Unknown block types fail silently
All three renderers end in `default: return null` / `return null` with no console warning. A typo in a `type`, or a block saved by a newer editor than the deployed renderer, produces a blank gap and no signal anywhere.
**Evidence:** `HomepageBlocks.tsx:130-131`, `PropertyPageRenderer.tsx:106-107`, `ContentBlockRenderer.tsx:277`, `PageBlocks.tsx:272-273`.

### 9.5 The parent homepage hero disappears when a *disabled* `hero_banner` block exists
`(site)/page.tsx:84`: `blocks.some((b) => b.type === "hero_banner")` — deliberately **not** filtered by `enabled`. The comment explains the reasoning (otherwise the toggle looks broken), but the observable result is that disabling the hero block removes the hero entirely rather than reverting to the built-in one. Worth confirming with the client that this is the intent.

### 9.6 Two readiness checks can never pass
`(dashboard)/readiness/page.tsx:404,421` read `siteSettings.ad_code`, but the admin writes **`ads_code`** (`siteActions.ts:96`) and the public layout reads `ads_code` (`(site)/layout.tsx:183`).
Same file `:407,424` read flat `siteSettings.facebook` / `siteSettings.instagram`, while the site editor writes **`social_facebook`** / **`social_instagram`** (`siteActions.ts:129-130`).
Result: the "Ad code" and "Social links" compliance rows are permanently red for any site configured through the site editor.

### 9.7 Settings that are written but never read, or read but not writable
- **Dead:** `search_guest_ranges_unit` — written at `SitePageEditor.tsx:1967` → `siteActions.ts:125`, read nowhere; the unit word is baked into the labels client-side.
- **Dead:** `settings.contact_phone` — written on tab 1, read only by the admin's own readiness meter. No public renderer.
- **Orphaned writer:** `propertyPagesActions.updatePropertySettingsAction` (writes `nav`, `booking`, flat `instagram`/`facebook`/`line`, villa `logo_url`) has **zero call sites** in the repo. `nav` and `booking` *are* read at `property/[slug]/layout.tsx:30-31`, so they are live settings with no reachable editor.
- **Read, no editor:** `amenity_short`, `contact_inquiry_types`, `parent_link.{label,href}`, `hero_{contentType}`, `homepage.gallery_*` / `pathway_images` / `feature_*`.

### 9.8 Cookie/GDPR notice fallback differs between parent and villa
Parent (`(site)/layout.tsx:193-202`): never borrows the other locale, and has a bundled bilingual default — deliberate, and documented in the code.
Villa (`property/[slug]/layout.tsx:44-52`): **does** borrow (`o[locale] || o.zh || o.en`) and has **no** default, so an unset notice suppresses the banner entirely.
A villa with a Chinese-only cookie notice therefore shows Chinese consent text to English visitors — the exact failure the parent's comment says was fixed.

### 9.9 ~~`layoutVars` is applied on the parent site only~~ — RESOLVED
`(site)/layout.tsx:242` spreads `layoutVars(site.settings)`. `property/[slug]/layout.tsx:80-87` spreads `fontVars` and `typeScaleVars` but **not** `layoutVars`. **Resolved:** the villa layout now spreads `layoutVars` too; `--gutter`, `--section-y` and `--ui-scale` are all present on a villa page.

### 9.10 `POST /newsletter/unsubscribe` is not rate-limited
`backend/app/modules/newsletter/routes.py:52`. Every other public POST is. Tokens are 32-byte URL-safe randoms so brute force is impractical, but the asymmetry is worth noting.

### 9.11 No `hreflang`, no per-language URLs
See 7.14. One URL serves both languages from a cookie. Crawlers see only the site-default language, and the other language has no canonical address of its own. Structural, not a regression — but it is the SEO consequence of the bilingual design and the client should know.

### 9.12 `robots.txt` does not disallow `/admin`
`frontend/app/robots.ts:12` emits `{ userAgent: "*", allow: "/" }` with no `disallow`. `/admin` is protected by the auth middleware, so nothing leaks, but admin URLs can still be crawled and appear as redirect chains.

### 9.13 ~~`sitemap.ts` hardcodes eight villa sub-page keys~~ — RESOLVED
`frontend/app/sitemap.ts:9`: `["about","space","experience","pricing","contact","faq","news","articles"]`. **Resolved:** `sitemapPageKeys` derives the keys from each site's own `settings.pages`.

### 9.14 The backend silently degrades to a phantom default site
`backend/app/modules/sites/context.py:36-38,67-69,90-92`. Every failure path in `resolve_site` catches the exception and returns an **unpersisted in-memory `Site(id=1, …)`**. A database problem therefore presents as "the site is showing the wrong content" rather than as an error, which is much harder to diagnose.

### 9.15 `GET /api/v1/inquiries` is a public endpoint that always returns `[]`
`backend/app/modules/inquiries/routes.py:47`. Harmless today, but it is a public path named after private data — a future implementation there would expose inquiries.

### 9.16 ~~`POST /admin/media` bypasses the admin site guard~~ — RESOLVED, and it was the *public* route
**Resolved, but the entry named the wrong route.** `POST /admin/media` was already scoped with `get_admin_site`. The unguarded pair was the *public* `GET`/`POST /api/v1/media`, which checked only that the caller was some admin and took the site from `?site=` — so an admin linked to one villa could read, and upload into, any other tenant's library. Both now depend on `get_admin_site`, which lives in `admin/deps.py` so the media module can share it rather than keep a second copy of the tenant check. Verified: an admin linked only to `hejing` gets 201/200 on its own site and 403 on both others.

### 9.17 Admin cookie lifetime (12h) is shorter than the JWT (7 days)
`authActions.ts` sets `maxAge: 43200`; `core/config.py:16` issues a 7-day token. Since there is no revocation list, a token copied out of the cookie before it expires remains valid for the full week. Not exploitable through the browser (the cookie is httpOnly), but worth recording.

### 9.18 Login audits record the wrong IP behind a proxy
`backend/app/modules/auth/routes.py:72-82` records `request.client.host`. The rate limiter in the same codebase deliberately prefers `CF-Connecting-IP` (`core/rate_limit.py:25-30`). Behind Cloudflare or Caddy, every audit row will show the edge IP and the "top IPs" chart on `/admin/login-audits` will be meaningless.

### 9.19 Rate limiting is per-process and in-memory
`core/rate_limit.py:1-7` (the module's own docstring says so). With more than one uvicorn worker, the effective thresholds multiply by the worker count, and every limit resets on deploy.

### 9.20 First bilingual edit copies the Chinese into the English field
**Resolved.** `blockFields.tsx` (`setVal`) and `PageBlockEditor.tsx` (`setLocalVal`) each migrated a legacy plain string as `{en: value, zh: value}`; the second copy outlived the first fix, which is what having two implementations buys you. Both now delegate to `localizedValue.ts`, which files the old value under the language it was actually written in (`legacyValueLocale`) and leaves the other slot empty. **The content audit below still applies to anything already saved** — the fix stops new damage, it does not undo what earlier edits wrote. So the first time anyone edits a legacy field, the English slot is silently populated with Chinese — and because `cfgT` then finds a non-empty `en`, the English page stops falling back and starts showing that Chinese confidently. This is the most likely source of "English pages full of Chinese" reports and is worth a content audit.

### 9.21 Two broken admin links
- `readiness/page.tsx:787` links to `/admin/sites/{id}/edit` — **not a route** (the editor is `/admin/sites/{id}`).
- `sidebarNav.ts:154` links to `/admin/sites/{id}/settings` — **not a route**. The function containing it (`buildPropertyNavGroups`) currently has no callers.
- `/admin/newsletter/subscribers/[id]/edit` is a pure redirect stub.

### 9.22 Investigated and refuted
A `getPropertySites()` / `getPropertySite()` URL-separator bug was reported during research (backslashes instead of `/` in `modules/api.ts:268,281`). **This is false** — verified byte-for-byte: both use forward slashes. Recorded here so nobody re-opens it.

---

## 10. Found and fixed in the local test pass

Everything here was found by testing against a throwaway local stack
(`scripts/local-test-stack.sh`), not against production, and each has a
regression test. Listed because the shape of these bugs is the useful part:
with one exception they all *saved successfully* and then did nothing, or did
something different from what the admin asked for.

| # | What | Where |
|---|---|---|
| 10.1 | An unknown `?site=` slug served the default site's data with a 200 — on the admin paths too, so a typo silently edited another tenant | `sites/context.py` |
| 10.2 | Public `GET`/`POST /api/v1/media` let a villa-scoped admin read and upload into any tenant's library (see 9.16) | `media/routes.py`, `admin/deps.py` |
| 10.3 | A site created as **draft** was created **active** — `SiteCreate` had no `status` field, so the form's value was parsed away and the endpoint hard-coded `"active"`. A villa built as a draft was public, holding the template villa's content, from the moment it was created | `admin/routes.py` |
| 10.4 | The parent homepage hero rendered **no headline at all** in English when the slide's text lived only in `translations.zh` — `trs` gave up on an empty base column instead of borrowing | `modules/tr.ts` |
| 10.5 | Villa nav showed **bare URL keys** (`stays / about / experience`) in English when labels were filled in Chinese only; the booking CTA had the same fault and an English-only default | `modules/property/types.ts` |
| 10.6 | Renaming the brand changed the header, footer and © line everywhere but the `<title>` on every page except the homepage — the resolver was private to the homepage. Now resolved inside `buildMetadata`, so a route cannot forget | `modules/seo.ts` |
| 10.7 | The article editor's derived `body` was pinned to Chinese, and the canonical columns were filed under the **viewer's** admin UI language rather than the site's `default_locale` — so a Chinese `body` was written into `translations.en` and served to English readers | `cms/PageFormEditor.tsx`, `modules/blockText.ts` |
| 10.8 | CMS **detail** pages showed untranslated tags while the listing cards showed translated ones — four routes read `page.tags` directly instead of `tagsT` | four `[identifier]` routes |
| 10.9 | Newsletter signups from a villa **sub-page** were filed unattributed: the sub-page route did not pass `siteSlug` to the renderer (the villa homepage did) | `property/[slug]/[...pageSlug]` |
| 10.10 | Seed fixture: `region` (縣市) held townships and `destination` (地區) held counties — exactly reversed from what the search bar means by them | `seed_multisite.py` |
| 10.11 | Seed fixture: every stay had `facilities: []` while the search bar offered ten chips, so nine returned zero results on a catalogue that looked full | `seed_multisite.py` |

### 10.12 Still open, and it is a content job

`facilities` is almost certainly empty on **production** too — the column is
newer than the catalogue. Until each villa's facilities are ticked in the admin,
a visitor who uses the facility filter gets an empty results page. No code
change fixes this; 10.11 only fixes the local fixture.

---

## 11. Second pass — the remaining known defects

Section 10 was what the test pass found. This is the backlog that was known and
open at the end of it, now closed. Same pattern as before: most of these save
successfully and then do nothing.

| # | What was wrong | Where |
|---|---|---|
| 11.1 | `settings.contact_phone` was written by the site editor, counted by the readiness meter, and rendered **nowhere** — now in the footer beside the email, as a `tel:` link, and in the ContactPage JSON-LD | `(site)/layout.tsx`, `(site)/contact` |
| 11.2 | `search_guest_ranges_unit` reached the labels only if the ranges were also edited; changing just the word saved and showed nothing. Now substituted into the bundled defaults | `modules/searchOptions.ts` |
| 11.3 | Booking requests had **no delete route of any kind** — a spam or test booking stayed in the inbox permanently and could only be removed with psql. Now soft delete + restore + a deleted view, mirroring the enquiry inbox, with deleted rows excluded from the CSV export | migration `202608150001`, `admin/routes.py`, booking screen |
| 11.4 | Unknown block types returned `null` from all four renderers with no log anywhere — the failure mode behind a whole class of bugs here. Now warned once per renderer+type, naming both | `modules/unknownBlock.ts` |
| 11.5 | The admin cookie hardcoded 12 hours while the token it carried lasted 7 days. The cookie was the shorter of the two, so the session really ended at 12 hours — and a token that escaped the cookie stayed valid for another six and a half days. The cookie now derives its lifetime from the token's own `exp` claim | `admin/modules/authActions.ts`, `core/config.py` |
| 11.6 | Login audits recorded the reverse proxy's address, not the visitor's — the one field you reach for after a suspicious sign-in. The rate limiter already knew better; both now share one resolver | `core/rate_limit.py` |
| 11.7 | `POST /newsletter/unsubscribe` was the only public write with no rate limit | `newsletter/routes.py` |
| 11.8 | `robots.txt` allowed everything, so `/admin` was crawled into redirect chains | `app/robots.ts` |
| 11.9 | Two admin links pointed at routes that do not exist: readiness → `/admin/sites/{id}/edit`, sidebar → `/admin/sites/{id}/settings` | `readiness/page.tsx`, `sidebarNav.ts` |
| 11.10 | A **draft** villa 404'd at `/stays/{slug}` but rendered at `/?site={slug}` — one door locked, the one beside it open | `modules/siteVisibility.ts`, `(site)/layout.tsx` |
| 11.11 | `GET /admin/sites` looked ungated. It is deliberate — the SiteSwitcher needs it on every screen and the scope is enforced in the response — and is now documented as such rather than left to be re-reported | `admin/routes.py` |

### 11.12 Judged and left alone

- **No `hreflang` / no per-language URLs.** One URL serves both languages from a
  cookie. Adding hreflang without per-language URLs would be a lie to crawlers;
  giving each language its own URL is an architecture change, not a fix. It
  stays a known SEO limitation of the bilingual design.
- **Rate limiting is per-process and in-memory**, so the ceiling is
  `max_requests × workers`. Adequate for the single-worker compose deployment
  and now documented at the class; a shared store is needed before scaling out.

---

## 12. API audit — all 98 routes

Route table dumped from the running app and every route exercised against the
local stack, rather than read. Categories checked: authentication, tenant
scoping, permission enforcement, rate limiting, input validation, and how much
one request can ask for.

### Held up

- **75 `/admin/*` routes refuse an anonymous caller.** Swept every one: no
  exceptions.
- **Tenant scoping holds on every site-scoped route.** An admin linked only to
  `hejing` gets 403 on every `/admin/*` route with `?site=slowfield`
  or `?site=hejing-ridge`, including the newly added booking delete/restore.
- **Two deliberate exceptions, both correct.** `GET /admin/sites` is ungated
  because the SiteSwitcher needs it everywhere; the scope is enforced in the
  response (a villa admin sees exactly one site). `GET /admin/sites/{id}` and
  `GET /admin/users` carry inline guards rather than a dependency.
- **Every public write is capped and validated.** `/inquiries` 5/5min,
  `/booking-requests` 3/5min, `/newsletter/subscribe` 5/60s, `/auth/login`
  10/60s, `/newsletter/unsubscribe` 20/60s (added — see 11.7). Short names,
  malformed emails, oversized messages and `guests=0` all 422.
- **Public payloads carry no private settings.** `api_keys`, `webhooks`, `smtp`,
  `secrets` and `internal` are absent from `/site/resolve` and `/site/children`.
- **Production posture verified, not assumed.** `docker-compose.prod.yml` sets
  `APP_ENV: production` as an environment variable, which pydantic-settings
  ranks above the `.env` file — measured, because the container also carries an
  `.env` saying `local`. In that mode `/docs` and `/redoc` are not served,
  `POST /auth/bootstrap-admin` 403s, and the app refuses to start at all on a
  default `SECRET_KEY` or bootstrap credential. This closes the item T3 could
  not test.
- **`ids=` is parameterised and digit-only** — no injection surface.

### Fixed by the audit

| # | What | Where |
|---|---|---|
| 12.1 | `GET /admin/sites/{id}` answered 404 for a site that does not exist and 403 for one the caller may not see, so a scoped admin could enumerate which site ids exist across the whole network. Both are 403 now; a super-admin still gets the honest 404 | `admin/routes.py` |
| 12.2 | The public list endpoints had **no ceiling of any kind** and serialise every published row. Deliberately not paginated — the front end counts categories from the whole list, and a default page size would silently make those counts wrong — so they now carry a hard cap of 500 rows that **logs when it bites**, since a truncated list is otherwise indistinguishable from a short one | `core/limits.py`, `stays/routes.py`, `cms/routes.py` |
| 12.3 | `ids=` accepted an unbounded list — 5,000 entries built a 5,000-parameter `IN` clause. Capped at 200, far above the handful of related articles it exists for | `cms/routes.py` |

### Session length, unified

Now **7 days**, set in one place (`access_token_expire_minutes`) and followed by
the admin cookie, which reads the token's own `exp` claim. The cookie used to
hardcode 12 hours against a 7-day token: it was the shorter of the two, so the
session ended at 12 hours while the credential outlived it by six and a half
days.

**Correction to an earlier draft of this section.** It claimed production ran
120 minutes "per the deployed `.env`". That was wrong twice over: the server has
no `backend/.env`, and `backend/.dockerignore` excludes `.env*` so such a file
could never reach the image anyway. Production has always taken this value from
`config.py`, and it has always been 10080. The local `.env` that said 120 was a
development file, misread as production's.

**Effect of deploying this:** the admin session goes from an effective 12 hours
(cookie-limited) to a true 7 days. To shorten it, change this one value — it is
now the only number that decides.

---

## 13. Full codebase audit (readability, reuse, security, UI/UX, verification)

Scope: 263 frontend TS/TSX files (~45k lines), 50 backend Python files (~5.7k
lines), 33k lines of CSS. Generated output, dependencies and the user's
uncommitted files were left alone.

### Confirmed defects, fixed

| # | Sev | What | Where |
|---|---|---|---|
| 13.1 | P1 | **A rejected save discarded every unsaved change** in all admin editors except the CMS page editor. Every action redirects on failure as well as success, so the editor remounts seeded from the last *saved* content. A 422 from the stay publish guard is enough. Now a shared `useFormDraft` writes the form down before handing it over and restores it on failure, saying so — silent recovery would look identical to the save having worked | `useFormDraft.ts`, `SafeForm.tsx`, site + stay editors |
| 13.2 | P1 | **SMTP passwords could be stored in cleartext, silently.** `cryptography` was never a declared dependency — it arrived as a transitive extra of `python-jose`. Without it `encrypt_value` returned the plaintext unchanged, leaving one log line at import as the only trace. Now declared, and in production it raises rather than storing a secret in the clear | `pyproject.toml`, `core/crypto.py` |
| 13.3 | P2 | **Two dialogs could not be closed from the keyboard** — no Escape, no focus restore, no `role="dialog"`: the media upload modal and the related-stays picker | `MediaUploadModal.tsx`, `RelatedStaysPicker.tsx` |
| 13.4 | P2 | **Nested overlays unlocked each other.** Ten of eleven scroll locks reset `body.style.overflow` to `""` instead of the previous value, so closing a lightbox opened from behind the mobile menu let the page scroll behind the menu still on screen. One reference-counted lock now, which restores exactly what was there | `useOverlay.ts` + call sites |
| 13.5 | P2 | `resolveSiteName` existed **three times** — the precise shape of the `<title>` bug fixed in §10.6. Two copies removed | `(site)/layout.tsx`, `(site)/page.tsx` |
| 13.6 | P3 | The media delete path joined a database value onto a directory with no containment check. Keys are server-generated so this was defence in depth, but the check now lives beside the join | `media/routes.py` |

### Checked and clean — stated because "no finding" is a result

- **All 27 `dangerouslySetInnerHTML` sinks are sanitised.** The three that do not
  call `safeHtml` were each verified: `JsonLd` escapes `<` to `<`
  (no `</script>` breakout), `ServerHeadCode` rebuilds from an allow-list, the
  newsletter preview uses `sanitizeRichHtml`.
- **No SQL injection surface** — no raw SQL, no f-string queries; `ids=` is
  digit-only and parameterised.
- **No hardcoded secrets** anywhere in application code.
- **No SSRF** — the one outbound request takes its URL from operator config.
- **No silently swallowed backend exceptions**: one broad `except`, and it logs.
- **No request waterfall.** `getCurrentSite()` is called from 16 places;
  measured against the running backend, one homepage render produces **8 API
  requests, all distinct** — Next's per-render memoisation collapses them.
  Asserted by measurement, not from documentation.

### Judged and deliberately not changed

- `POST /admin/email-settings/test` returns the provider's error text
  (`SMTP error: …`). It is documented as intentional and it is the difference
  between an admin fixing their own provider config and filing a bug about a
  bare 500. The route is authenticated and site-scoped.
- The six element-level `onKeyDown` Escape handlers were left as they are: they
  act on a focused element with `stopPropagation`, which is a different job from
  the document-level overlay dismissal now shared.

### Verification

`tsc --noEmit` clean · frontend **136 tests** · backend **54 tests** ·
production build succeeds. Every behavioural fix carries a regression test.

**Not verified in a browser:** the two admin screens behind draft recovery. That
needs an admin login, and entering credentials is not something this assistant
does — the logic is covered by unit tests instead, and the screens are worth a
human pass.

---

## 14. Second audit pass — concurrency, blocking, trust boundaries

Different angles from §13, which covered injection, secrets, a11y and
duplication. This pass looked at what happens when two things run at once, what
blocks the event loop, and the one trust boundary §13 did not open.

### Confirmed defects, fixed

| # | Sev | What | Where |
|---|---|---|---|
| 14.1 | **P0** | **Subscribers received the same newsletter more than once.** `process_newsletter_queue` selected every `pending` delivery, sent them all, and only wrote status at the very end. Three callers can run it concurrently — the 60-second scheduler tick, the admin "process now" button, the per-campaign process route. Measured: three concurrent runs each took **the same 20 rows**. Rows are now claimed (`status='sending'`, committed) before the first send, with `FOR UPDATE … SKIP LOCKED`; the same measurement now gives 20/0/0 and an end-to-end run sends 20 emails with zero duplicates. Abandoned claims older than 15 minutes are reclaimed, so a crash mid-send cannot strand a queue | `email/service.py`, migration `202608150002` |
| 14.2 | P2 | **The admin proxy's path allow-list could be walked around.** It tested the raw string for `..`, which a percent-encoded traversal passes: `/admin/%2E%2E/%2E%2E/%2E%2E/docs` was allowed and resolved to `/docs`, outside the `/api/v1` base — on a request carrying the admin's bearer token. Nothing sensitive was reachable that way (`/docs` is off in production, `/storage/media` is public), so it was a control that did not hold rather than a live leak. Now the **resolved** pathname is checked, and encoded separators are rejected outright | `admin/api/proxy/route.ts` |
| 14.3 | P2 | **Blocking disk I/O inside async handlers.** A 10 MB upload wrote synchronously on the event loop, stalling every concurrent request for the duration; media delete did the same with `unlink`. Both now go through `asyncio.to_thread` | `media/routes.py`, `admin/routes.py` |
| 14.4 | P2 | **A 404 was Next's built-in page** — unbranded, English-only, no header, no footer, no way back into the site. A visitor who mistyped a URL had only the back button. Now a bilingual 404 inside the site chrome, with links home and to the stays list, plus a bare root fallback that renders without needing the API | `(site)/not-found.tsx`, `not-found.tsx` |

### Checked and clean

- **Email sending does not block the loop** — SMTP and the Cloudflare Worker
  transport both go through `asyncio.to_thread` already; the scheduler uses
  `asyncio.sleep`.
- **No per-row transactions** — no `commit()` inside any loop.
- **Indexes cover what the public queries filter on**: `site_id`, `slug`,
  `content_type`, `deleted_at`, `status`, `scheduled_at`, subscriber `email` and
  `unsubscribe_token`.
- **No leaked listeners or timers.** The one imbalance found
  (`LeafletMap.tsx`, 3 adds / 2 removes) is not a leak: the third is attached to
  the container Leaflet creates, and `map.remove()` in the cleanup takes the
  node with it.
- **The proxy's CSRF and auth handling is sound** — Origin is matched against
  Host on every mutating method, the token comes from an HttpOnly cookie and is
  never exposed to the client, and a backend 401 clears it.

### A false finding, retracted before it was reported

An early measurement of the 404 said it rendered an empty `<body>`. That was the
measurement, not the page: the response is an RSC stream whose content arrives
inside `<script>` blocks, and the extraction stripped scripts first. Confirmed
in a browser instead. The finding above (14.4) is the part that survived
checking — an unbranded default page — not "the 404 is blank".

### Verification

`tsc --noEmit` clean · frontend **142 tests** · backend **54 tests** ·
production build succeeds. The duplicate-send fix is proven in both directions:
the old query reproduced the duplication, the new one does not.
