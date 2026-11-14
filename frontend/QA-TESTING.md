# QA Testing Plan — Slowfield Stays Admin Panel

## Block Editor System

The admin panel has two block editors with shared architecture:

| Editor | Route | Block Types |
|---|---|---|
| **Homepage Editor** | `/admin/homepage` | flow, stays, gallery, pathways, editorial, about, faq_accordion, table, contact_info, contact_form, feature_badges, oembed |
| **Page Editor** | `/admin/sites/[id]/pages/[pageKey]` | rich_text, image_gallery, faq_accordion, table, contact_info, contact_form, feature_badges, oembed, about, editorial, gallery, pathways, flow |

---

## 1. Block Thumbnails (BlockThumb)

Each block should show a data-responsive thumbnail preview in the canvas area.

### Homepage Editor — 12 block types

| Block Type | Label | Thumbnail Shows |
|---|---|---|
| `flow` | 步驟流程 | Step cards with title text or skeleton placeholders |
| `stays` | 精選內容 | Grid of stay image thumbnails or skeleton cards |
| `gallery` | 相簿 | Actual uploaded images or placeholder grid |
| `pathways` | 路徑卡片 | Card list with titles or skeleton lines |
| `editorial` | 焦點版面 | Image + body text (or skeleton), layout matches config |
| `about` | 品牌介紹 | Image (or skeleton) + body text + CTA button label |
| `faq_accordion` | 問答手風琴 | FAQ question text with ▸ indicators |
| `table` | 表格 | Column headers + data rows (actual text from config) |
| `contact_info` | 交通聯繫 | Address text, phone number, map embed indicator |
| `contact_form` | 聯絡表單 | Form title, field skeletons, submit button, Booking/Inquiry label |
| `feature_badges` | 特色標籤 | Pill badges with icon + label from config |
| `oembed` | 社群嵌入 | Play icon + URL preview |

### Page Editor — 13 block types

| Block Type | Label | Thumbnail Shows |
|---|---|---|
| `rich_text` | 文字區塊 | Text line widths derived from content length |
| `image_gallery` | 多圖展示 | Actual uploaded images or placeholder grid |
| `faq_accordion` | 問答手風琴 | FAQ question text with ▸ indicators |
| `table` | 表格 | Column headers + data rows (actual text from config) |
| `contact_info` | 交通聯繫 | Address text, phone number, map embed indicator |
| `contact_form` | 聯絡表單 | Form title, field skeletons, submit button, Booking/Inquiry label |
| `feature_badges` | 特色標籤 | Pill badges with icon + label from config |
| `oembed` | 社群嵌入 | Play icon + URL preview |
| `about` | 品牌介紹 | Image (or skeleton) + body text + CTA button label |
| `editorial` | 焦點版面 | Image + body text, layout matches config |
| `gallery` | 相簿 | Actual uploaded images or placeholder grid |
| `pathways` | 探索路徑 | Card list with titles or skeleton lines |
| `flow` | 預約流程 | Step cards with title text or skeleton placeholders |

### Thumbnail Test Checklist

- [ ] Add each block type via the palette — thumbnail appears immediately
- [ ] Fill in config data — thumbnail updates to show actual content (not just skeletons)
- [ ] Blocks with images show actual image thumbnails when URLs are set
- [ ] `about` block shows CTA label text when configured
- [ ] `table` block shows column headers and row data
- [ ] `contact_info` block shows address and phone when configured
- [ ] `contact_form` block shows "Booking" or "Inquiry" label based on form_type
- [ ] `oembed` block shows pasted URL under the play icon
- [ ] `feature_badges` shows icon emoji + label text for each badge
- [ ] Switching between two blocks of the same type shows correct data (no stale state)

---

## 2. Block Config Forms (Inspector Panel)

Each block has a config form in the right-side inspector panel.

### Config Form Checklist

- [ ] **flow**: Steps array — add/remove/reorder steps, each with title/description (bilingual)
- [ ] **stays**: Stay IDs selector — pick stays from API
- [ ] **gallery**: Image URLs array — add/remove images via media picker
- [ ] **pathways**: Items array — title/description/link/image per card (bilingual)
- [ ] **editorial**: Title, body (bilingual), image upload, layout (image-left/image-right)
- [ ] **about**: Title, body (bilingual), image upload, CTA label + CTA link (bilingual)
- [ ] **faq_accordion**: Items array — question/answer pairs (bilingual)
- [ ] **table**: Columns array (label bilingual), rows array (string cells)
- [ ] **contact_info**: Address (bilingual), phone, email, map embed code, hours (bilingual)
- [ ] **contact_form**: Title/subtitle (bilingual), form_type (booking/inquiry), submit label
- [ ] **feature_badges**: Items array — icon (emoji), label (bilingual)
- [ ] **oembed**: URL input
- [ ] **rich_text** (page editor only): Body text (bilingual)
- [ ] **image_gallery** (page editor only): Image URLs array

### Config Form Behavior

- [ ] Switching between blocks updates the inspector to show the correct config
- [ ] Switching between two blocks of the same type shows correct data (`key={selected.id}`)
- [ ] Bilingual fields toggle between zh/en with the locale switcher
- [ ] Image fields open media picker and update correctly
- [ ] Array fields (steps, items, rows) support add/remove/reorder

---

## 3. Per-Block Styling Controls

Both editors support per-block visual styling in the inspector panel.

| Control | Config Key | Values |
|---|---|---|
| Font Size | `_fontSize` | 13px, 14px, 15px, 16px, 18px |
| Line Height | `_lineHeight` | 1.4, 1.5, 1.6, 1.8, 2.0 |
| Text Align | `_textAlign` | left, center, right |
| Background Color | `_bgColor` | Hex color picker |
| Background Opacity | `_bgOpacity` | 0–100 slider |

### Styling Test Checklist

- [ ] Each control appears in the inspector when a block is selected
- [ ] Changing font size updates the preview
- [ ] Changing line height updates the preview
- [ ] Text alignment buttons toggle correctly
- [ ] Background color picker sets hex value
- [ ] Opacity slider works 0–100
- [ ] Styling values persist after save and reload
- [ ] Full-width backgrounds render with `width: 100vw` pattern

---

## 4. Frontend Rendering

Both the root site renderer (`PageBlocks.tsx`) and property site renderer (`PropertyPageRenderer.tsx`) must render all block types.

### Root Site Blocks (PageBlocks.tsx)

Renders: flow, stays, gallery, pathways, editorial, about, rich_text, image_gallery, table, oembed, faq_accordion, contact_info, feature_badges, contact_form

### Property Site Blocks (PropertyPageRenderer.tsx)

Renders: rich_text, image_gallery, faq_accordion, table, contact_info, contact_form, feature_badges, oembed, about, editorial, gallery, flow, stays

### Rendering Test Checklist

- [ ] Each block type renders on the public site without errors
- [ ] `table` supports both new `columns/rows` format and legacy `items[]` format
- [ ] `contact_form` submits to correct API endpoint (booking-requests or inquiries)
- [ ] `contact_form` source values match backend regex: website, phone, email, line, other
- [ ] `oembed` embeds render (YouTube, Instagram, etc.)
- [ ] `faq_accordion` items expand/collapse
- [ ] `feature_badges` displays icon + label pills
- [ ] `contact_info` shows map embed if configured
- [ ] `BlockWrapper` applies per-block styling (_bgColor, _bgOpacity, _fontSize, _lineHeight, _textAlign)
- [ ] Background colors use full-width pattern (`width: 100vw; margin-left: calc(-50vw + 50%)`)

---

## 5. Save / Load Cycle

- [ ] Create blocks in the editor, save, reload page — all blocks persist
- [ ] Block order persists after drag-and-drop reorder
- [ ] Enabled/disabled toggle persists
- [ ] Per-block styling persists
- [ ] Config data (bilingual) persists correctly for both locales

---

## 6. Edge Cases

- [ ] Empty block (no config) — shows skeleton thumbnail, doesn't crash renderer
- [ ] Very long text — truncates in thumbnail, wraps in renderer
- [ ] Missing image URL — shows placeholder, not broken image
- [ ] Invalid oembed URL — graceful fallback
- [ ] Rapid block switching — no stale state or flash of wrong data
- [ ] Delete all blocks — editor shows empty state, save works
- [ ] 404 API responses — `apiFetch` returns fallback (not 500 error)
