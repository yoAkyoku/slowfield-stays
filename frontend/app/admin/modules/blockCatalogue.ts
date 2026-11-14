/**
 * What each block is called in the editor, and what it is for.
 *
 * Two things were wrong with the names this replaces.
 *
 * First, there were two copies — one in HomepageBlockEditor, one in
 * PropertyBlockEditor — and they had drifted: the same block was 「精選內容」on
 * the homepage and 「精選住宿」on a villa page, 「路徑卡片」in one place and
 * 「探索路徑」in the other, 「步驟流程」and 「預約流程」. An editor moving between
 * the two could not tell they were the same thing.
 *
 * Second, most names described the first job the block was built for rather
 * than what it actually is. 「周邊景點」draws image-plus-caption cards of
 * anything; 「入住須知」is a numbered list; 「預約流程」is a step sequence;
 * 「精選住宿」pulls from any CMS category. An editor looking for "a numbered
 * list" had no way to guess it was filed under 入住須知, so blocks got rebuilt
 * out of 文字區塊 instead of being reused.
 *
 * So a name says what the block IS — its shape — and the hint says what it
 * suits, with the original use named there when it helps someone find it.
 */

/** [zh, en] display name, keyed by block type. */
export const BLOCK_LABELS: Record<string, [string, string]> = {
  hero_banner:     ["主視覺", "Hero"],
  search:          ["住宿搜尋列", "Stay Search Bar"],
  rich_text:       ["圖文段落", "Text & Image"],
  about:           ["圖文介紹（含亮點）", "Intro with Highlights"],
  editorial:       ["大圖焦點", "Full-width Feature"],
  feature_list:    ["圖示重點清單", "Icon Highlights"],
  feature_badges:  ["標籤徽章列", "Badge Row"],
  house_rules:     ["編號條列", "Numbered List"],
  flow:            ["編號步驟", "Numbered Steps"],
  rooms:           ["圖卡＋規格清單", "Cards with Specs"],
  attractions:     ["圖文卡片列", "Picture Cards"],
  partners:        ["標誌／品牌卡", "Logos & Brand Cards"],
  pathways:        ["導引卡片", "Signpost Cards"],
  stays:           ["內容集合", "Content Collection"],
  image_gallery:   ["圖片組", "Image Set"],
  gallery:         ["相片拼貼牆", "Photo Collage"],
  table:           ["表格", "Table"],
  faq_accordion:   ["摺疊問答", "Collapsible Q&A"],
  contact_info:    ["聯絡資訊", "Contact Details"],
  map:             ["地圖", "Map"],
  contact_form:    ["表單／預約入口", "Form or Booking CTA"],
  newsletter:      ["Email 訂閱", "Email Signup"],
  oembed:          ["外部內容嵌入", "Embedded Media"],
  video_text:      ["影片＋文字", "Video with Copy"],
  feature_hero:    ["主題大圖＋小項目", "Lead Image with Items"],
  alternating:     ["圖文交錯", "Alternating Rows"],
};

/** [zh, en] one line under the name in the palette. Says what the block does and,
 *  where the old name was the only clue, what it used to be called. */
export const BLOCK_HINTS: Record<string, [string, string]> = {
  hero_banner:     ["滿版大圖，兩張以上自動輪播；標題與副標可換行", "Full-bleed image; two or more become a carousel"],
  search:          ["縣市／地區／人數／設施的搜尋條（只有母站有住宿目錄可搜）", "Region / guests / facilities search (group site only)"],
  rich_text:       ["一段文字；加了側圖就變成左右分欄", "A block of copy; add a side image for two columns"],
  about:           ["圖＋標題＋內文＋亮點清單＋按鈕（原「品牌介紹」）", "Image, copy, highlight list and a button"],
  editorial:       ["上方一張大圖、下方標題與長文；也可改成圖片靠左或靠右（原「焦點版面」）", "A large image with the copy beneath it; or move the picture to either side"],
  feature_list:    ["圖示＋標題＋說明，橫排或多欄", "Icon, title and detail — in a row or a grid"],
  feature_badges:  ["圖示＋短標籤，可分組（原「設施與服務」）", "Small icon-and-label chips, optionally grouped"],
  house_rules:     ["01 / 02 / 03 的條列說明（原「入住須知」）", "A numbered run of short rules or notes"],
  flow:            ["依序編號的流程說明（原「預約流程」）", "A sequence of numbered steps"],
  rooms:           ["每張卡有照片輪播與規格表（原「房型空間」）", "Cards with a photo carousel and a spec table"],
  attractions:     ["圖＋名稱＋地區＋簡介＋連結的卡片（原「周邊景點」）", "Cards: picture, name, meta line, blurb and link"],
  partners:        ["Logo 牆或圖文卡，可展開詳細介紹（原「合作品牌」）", "A logo wall, or cards that expand for detail"],
  pathways:        ["幾張大卡片，各自連到一個去處（原「探索路徑」）", "A few large cards, each pointing somewhere"],
  stays:           ["從住宿目錄或任何 CMS 分類抓一批卡片（原「精選住宿」）", "Pulls cards from the stay catalogue or any CMS category"],
  image_gallery:   ["多張圖片：網格／輪播／拼貼／置中", "Several images: grid, rail, collage or centred"],
  gallery:         ["最多 8 張的拼貼版面", "A collage wall of up to eight photos"],
  table:           ["自訂欄列，可加前言與附註", "Your own columns and rows, with an intro and notes"],
  faq_accordion:   ["點開才展開的問答清單", "Questions that open on click"],
  contact_info:    ["地址／電話／Email／LINE／地圖／交通指引／多個通訊處（原「交通聯繫」）", "Address, phone, email, LINE, map, directions and offices"],
  map:             ["Google 嵌入，或自己標點的多點地圖", "A Google embed, or your own pinned map"],
  contact_form:    ["完整詢問表單，或只放一顆預約按鈕", "A full enquiry form, or just a booking button"],
  newsletter:      ["收 Email 的橫幅，底色與文字色可調", "An email capture band with its own colours"],
  oembed:          ["貼上網址嵌入 YouTube／IG／FB 等（原「社群嵌入」）", "Paste a URL to embed YouTube, Instagram, Facebook…"],
  video_text:      ["影片與文字同一區塊，可左右並列或影片在上", "A video and its copy as one unit — side by side or stacked"],
  feature_hero:    ["一張導言大圖，下方列出幾個短項目", "A lead picture with the short items it introduces beneath it"],
  alternating:     ["多組圖文，圖片逐列左右交替（插入或換位都不會亂）", "Picture-and-copy rows; the side alternates by position"],
};

/**
 * The collapsible groups in the inspector, named the same way in both editors.
 *
 * These had drifted too — the pairing controls were 「區塊並列」on the homepage
 * and 「並排配對」on a villa page — and two of them named a mechanism rather
 * than an outcome: 「區塊標記（tag）」is how you link to a place on the page, and
 * 「滿版（貼齊邊緣）」was a whole collapsible section wrapping a single switch
 * that belongs with the background it affects.
 */
export const INSPECTOR_GROUPS: Record<string, [string, string]> = {
  content:   ["版塊內容", "Block content"],
  text:      ["文字外觀", "Text appearance"],
  spacing:   ["間距與寬度", "Spacing & width"],
  surface:   ["背景與版寬", "Background & bleed"],
  pair:      ["與相鄰區塊並排", "Pair with the next block"],
  anchor:    ["錨點連結（#tag）", "Anchor link (#tag)"],
};

/** The label pair for a type, falling back to the raw key so an unknown block
 *  still names itself rather than rendering blank. */
export function blockLabel(type: string, zh: boolean): string {
  const pair = BLOCK_LABELS[type];
  return pair ? (zh ? pair[0] : pair[1]) : type;
}

export function blockHint(type: string, zh: boolean): string {
  const pair = BLOCK_HINTS[type];
  return pair ? (zh ? pair[0] : pair[1]) : "";
}

export function groupTitle(key: keyof typeof INSPECTOR_GROUPS, zh: boolean): string {
  const pair = INSPECTOR_GROUPS[key];
  return zh ? pair[0] : pair[1];
}
