/**
 * Showcase content for the parent brand site (Slowfield Stays 慢域旅宿).
 * Image fields take "real:<key>" or "ai:<key>" (see photos.mjs).
 *
 * Everything here is fictional: the brand, 禾境 (Hejing Villa) and its
 * address, prices and contacts, Moon Mist Villa and Reef House (described as
 * "in planning"). Place names in Yilan are real and used only as scenery.
 * Anything whose image has not been generated yet stays unpublished.
 */

const zhen = (zh, en) => ({ zh, en });
const rt = (id, heading, body, eyebrow) => ({ id, type: "rich_text", enabled: true, config: { heading, body, ...(eyebrow ? { eyebrow } : {}) } });
const gallery = (id, title, images, columns = 3) => ({ id, type: "image_gallery", enabled: true, config: { title, columns, images } });
const img = (src, zh, en) => ({ url: src, caption: zhen(zh, en) });

export const CONTACT = {
  email: "hello@slowfield.example",
  phone: "03-000-0000",
  line: "@slowfield",
  address: zhen("26950 宜蘭縣冬山鄉禾風路 1 號（禾境）", "No. 1, Hefeng Rd., Dongshan, Yilan 26950 (Hejing Villa)"),
};

/* ── Hero banners on the brand homepage ─────────────────────────────────── */
export const BANNERS = [
  {
    title: "把日子，過慢一點",
    subtitle: "宜蘭冬山的稻田與一池水，只屬於你們這一群人。",
    image: "real:pool_wide",
    fallback: "ai:celebration_setup",
    cta_label: "看看禾境",
    cta_href: "/stays/hejing",
    en: { title: "Let the days run slower", subtitle: "Dongshan's paddy fields and a pool that is yours alone.", cta_label: "Meet Hejing Villa" },
  },
  {
    title: "在稻田邊醒來",
    subtitle: "落地窗外是整片綠，早餐從一壺現煮咖啡開始。",
    image: "real:dining_field",
    fallback: "ai:rainy_day_yilan",
    cta_label: "包棟早餐與私廚",
    cta_href: "/dining",
    en: { title: "Wake up beside the rice fields", subtitle: "A wall of green outside, breakfast starts with fresh coffee.", cta_label: "Breakfast & private dining" },
  },
  {
    title: "夜裡，池畔的燈亮起來",
    subtitle: "KTV、撞球、麻將與一池星光，6 到 32 人的包棟夜晚。",
    image: "real:pool_night",
    fallback: "ai:dongshan_river_cycling",
    cta_label: "立即洽詢",
    cta_href: "/contact",
    en: { title: "At night, the pool lights up", subtitle: "Karaoke, billiards, mahjong and a starlit pool for 6 to 32.", cta_label: "Enquire now" },
  },
];

/* Hero banners on the Hejing Villa site (the API falls back to stock demo
   banners when a site has none, so the villa needs its own). */
export const CHILD_BANNERS = [
  {
    title: "禾境",
    subtitle: "宜蘭冬山輕奢泳池包棟，6 到 32 人的浮雲時光。",
    image: "real:pool_wide",
    cta_label: "查看房型與價格",
    cta_href: "/stays/hejing/pricing",
    en: { title: "Hejing Villa", subtitle: "A quiet-luxury pool villa in Dongshan, Yilan, for 6 to 32.", cta_label: "Rooms & rates" },
  },
  {
    title: "稻田就在窗外",
    subtitle: "早餐、午茶與晚餐，都對著一整片綠。",
    image: "real:dining_field",
    cta_label: "看看空間",
    cta_href: "/stays/hejing/space",
    en: { title: "Rice fields at the window", subtitle: "Every meal faces a wall of green.", cta_label: "See the spaces" },
  },
];

/* ── Stays on the brand site ────────────────────────────────────────────── */
export const STAYS = [
  {
    slug: "villa-hejing",
    name: "禾境 Hejing Villa",
    destination: "冬山",
    region: "宜蘭",
    summary: "宜蘭冬山稻田間的雙棟泳池包棟別墅，14 米中庭泳池、影音娛樂與管家式接待，6 至 32 人。",
    story:
      "「禾」是稻禾，「境」是一方自成的天地。禾境由宜蘭在地建築師設計，A、B 兩棟純白建築圍著一座 14 米的中庭泳池，四周是冬山的稻田。\n\n白天在池畔讀書、在田邊散步，晚上點亮泳池燈，客廳有戲院級 KTV、撞球與電動麻將。從預訂到退房，都有慢域管家協助安排早餐、私廚、慶生佈置與在地行程。",
    hero: "real:exterior_field",
    images: ["real:pool_wide", "real:exterior_dusk", "real:living_white", "real:dining_field", "real:room_king", "real:bath_tub", "real:pool_night", "real:kids_room", "real:billiards", "real:breakfast_spread"],
    base_price: 18800,
    max_guests: 32,
    tags: ["包棟", "泳池", "親子友善", "寵物友善", "宜蘭"],
    amenities: ["14 米中庭泳池", "戲院級 KTV", "Netflix 影音", "電動麻將桌", "撞球桌", "兒童遊戲區", "美式烤爐", "高速 Wi-Fi", "免費停車 10 格", "電梯"],
    facilities: ["田野早餐", "管家私廚", "寵物友善", "長者友善", "慶生佈置"],
    room_types: [
      { name: "A 棟・單棟包棟", price: 18800, capacity: 12, description: "雙人房 ×2、四人房 ×2，標準入住 12 人，可加床至 16 人。" },
      { name: "B 棟・單棟包棟", price: 18800, capacity: 12, description: "雙人房 ×2、四人房 ×2，另有撞球桌與飛鏢機。" },
      { name: "AB 雙棟・全區包棟", price: 36800, capacity: 24, description: "包下整座 Villa 與中庭泳池，含加床最多 32 人。" },
    ],
    faq: [
      { question: "入住與退房時間？", answer: "入住 15:00 後，退房 11:00 前；如需提早入住或延後退房，請於預訂時告知管家。" },
      { question: "可以帶寵物嗎？", answer: "可以。每組入住可攜帶 2 隻以內的毛孩，請事先告知以便準備備品。" },
      { question: "附近有停車位嗎？", answer: "館外提供 10 格免費戶外停車位。" },
    ],
    house_rules: ["包棟單棟標準入住 12 人，加床上限 16 人（每人加 NT$1,300）", "雙棟最多 32 人", "22:00 後請降低戶外音量，尊重鄰里安寧", "室內全面禁菸"],
    location: { address: "宜蘭縣冬山鄉禾風路 1 號", city: "宜蘭縣", town: "冬山鄉", lat: 24.6335, lng: 121.7785 },
    status: "published",
    en: {
      name: "Hejing Villa",
      summary: "A twin-villa pool retreat among Dongshan's rice fields, for 6 to 32 guests.",
      story: "Two white buildings by a Yilan architect frame a 14-metre courtyard pool in Dongshan's paddy fields, with a theatre-grade karaoke lounge, billiards, mahjong and butler-style hosting.",
    },
  },
  {
    slug: "moon-mist-villa-puli",
    name: "月霧山居 Moon Mist Villa",
    destination: "埔里",
    region: "南投",
    summary: "埔里海拔 600 公尺的茶園間，兩房一廳的木造山居，適合想安靜過夜的兩到四人。",
    story: "早上被茶園的霧叫醒，泡一壺日月潭紅茶等霧散；晚上燒柴爐，看滿天星。月霧山居是慢域旅宿規劃中的山間系列，房型與開放時間將於官網公布。",
    hero: "ai:moon_mist_hero",
    images: ["ai:moon_mist_hero", "ai:moon_mist_room"],
    base_price: 6800,
    max_guests: 4,
    tags: ["山居", "茶園", "雙人", "南投"],
    amenities: ["柴燒暖爐", "茶席", "觀星露台", "手作早餐"],
    facilities: ["手作早餐", "茶席體驗"],
    room_types: [{ name: "山居雙人房", price: 6800, capacity: 2, description: "木造雙人房，窗外是茶園。" }],
    location: { address: "南投縣埔里鎮", city: "南投縣", town: "埔里鎮", lat: 23.9925, lng: 120.9905 },
    status: "needs-ai",
    en: { name: "Moon Mist Villa", summary: "A two-room timber retreat in Puli's misty tea hills." },
  },
  {
    slug: "reef-house-fengbin",
    name: "礁岸之家 Reef House",
    destination: "豐濱",
    region: "花蓮",
    summary: "花蓮豐濱海岸第一排的白色包棟，落地窗面向太平洋，後院就是潮間帶。",
    story: "從石梯坪往北五分鐘，一棟低調的白色房子。整面落地窗只看得見海，退潮時走進後院的礁岩潮間帶，傍晚划獨木舟回來。礁岸之家是慢域旅宿規劃中的東海岸系列。",
    hero: "ai:reef_house_hero",
    images: ["ai:reef_house_hero", "ai:reef_house_room"],
    base_price: 12800,
    max_guests: 8,
    tags: ["海景", "包棟", "花蓮"],
    amenities: ["海景落地窗", "獨木舟", "戶外淋浴", "烤肉區"],
    facilities: ["海景早餐"],
    room_types: [{ name: "海景包棟", price: 12800, capacity: 8, description: "三房兩廳，每間房都看得到海。" }],
    location: { address: "花蓮縣豐濱鄉", city: "花蓮縣", town: "豐濱鄉", lat: 23.5975, lng: 121.5215 },
    status: "needs-ai",
    en: { name: "Reef House", summary: "A white villa on Hualien's Fengbin coast with its own reef." },
  },
];

/* ── Rooms on the Hejing Villa child site (replace the demo rooms) ───────── */
export const CHILD_ROOMS = [
  {
    slug: "hejing-pool-villa",
    name: "A 棟・單棟包棟",
    summary: "雙人房 ×2、四人房 ×2，客廳有戲院級 KTV 與電動麻將，推開門就是中庭泳池。",
    hero: "real:pool_wide",
    images: ["real:pool_wide", "real:living_white", "real:room_king", "real:bath_tub", "real:mahjong"],
    base_price: 18800,
    max_guests: 16,
  },
  {
    slug: "hejing-garden-suite",
    name: "B 棟・單棟包棟",
    summary: "與 A 棟對稱的格局，另有撞球桌與飛鏢機，面向稻田的用餐區最適合早餐。",
    hero: "real:dining_field",
    images: ["real:dining_field", "real:billiards", "real:room_twin", "real:room_window", "real:kitchen_round"],
    base_price: 18800,
    max_guests: 16,
  },
  {
    slug: "hejing-whole-villa",
    name: "AB 雙棟・全區包棟",
    summary: "包下整座 Villa 與中庭泳池，24 至 32 人的家族旅行、公司出遊或婚禮前夜。",
    hero: "real:exterior_field",
    images: ["real:exterior_field", "real:pool_night", "real:living_tv", "real:kids_room", "real:bbq"],
    base_price: 36800,
    max_guests: 32,
  },
];

/* ── CMS entries per listing (parent site) ──────────────────────────────── */
export const PAGES = [
  // 精選活動
  {
    content_type: "activity", slug: "poolside-night-swim", title: "池畔夜泳與星空", cover: "real:pool_night",
    summary: "晚上八點，中庭泳池的燈亮起來。冬山田野沒有光害，抬頭就是星星。",
    blocks: [rt("a1", zhen("一池燈光，一片星空", "Pool lights and a sky full of stars"), zhen("禾境的中庭泳池在晚上點亮水下燈，池水是溫柔的藍。冬山的田野幾乎沒有光害，天氣好的夜晚，躺在池畔就能看到銀河的輪廓。\n\n泳池開放至 22:00；夜泳時請留意孩童安全，管家可協助準備浴巾與熱茶。", "Underwater lights turn the courtyard pool soft blue after dark, and Dongshan's fields have almost no light pollution. The pool is open until 22:00.")), gallery("a1g", zhen("夜晚的泳池", "The pool at night"), [img("real:pool_night", "夜間泳池", "Pool at night"), img("real:exterior_dusk", "傍晚亮燈的建築", "Dusk"), img("real:pool_floats", "白天的泳池", "By day")])],
    en: { title: "Night swim under the stars", summary: "At eight the pool lights come on; Dongshan's fields have no light pollution." },
  },
  {
    content_type: "activity", slug: "dongshan-river-cycling", title: "冬山河騎單車", cover: "ai:dongshan_river_cycling",
    summary: "從民宿出發騎 15 分鐘就接上冬山河自行車道，沿河一路騎到親水公園。",
    blocks: [rt("a2", zhen("沿著冬山河，騎到親水公園", "Along the Dongshan River"), zhen("冬山河自行車道平坦好騎，兩岸是稻田與水鳥。從禾境出發約 15 分鐘即可接上車道，往北騎到冬山河親水公園約 40 分鐘，適合全家一起。\n\n管家可代訂附近的單車租借，也可安排回程接送。建議清晨或傍晚出發，避開正午日曬。", "The flat riverside path is 15 minutes from the villa; ride north to the Dongshan River Water Park in about 40 minutes. We can book bikes and arrange a ride back."))],
    en: { title: "Cycling the Dongshan River", summary: "Fifteen minutes from the villa to the riverside cycle path." },
  },
  {
    content_type: "activity", slug: "meihua-lake-morning-walk", title: "梅花湖晨間環湖", cover: "ai:meihua_lake_morning",
    summary: "車程 12 分鐘，環湖步道一圈約 40 分鐘，早晨的湖面常有薄霧。",
    blocks: [rt("a3", zhen("在薄霧散去之前", "Before the mist lifts"), zhen("梅花湖因湖形像梅花而得名，環湖步道約 2.5 公里，平緩好走，長輩與推車都方便。清晨的湖面常有一層薄霧，走到湖心的吊橋最好拍。\n\n回程可以順路到附近的早餐店，再回民宿池畔曬太陽。", "A gentle 2.5 km loop, 12 minutes by car; mornings often bring a thin mist over the water."))],
    en: { title: "Morning walk at Meihua Lake", summary: "A 40-minute loop, 12 minutes away, often misty at dawn." },
  },
  {
    content_type: "activity", slug: "sanxing-scallion-farm", title: "三星蔥田：拔蔥、做蔥油餅", cover: "ai:sanxing_scallion",
    summary: "跟著蔥農下田拔三星蔥，再親手桿一張蔥油餅，孩子最喜歡的半日行程。",
    blocks: [rt("a4", zhen("一根蔥的旅行", "From field to pancake"), zhen("三星蔥以蔥白長、香氣足聞名。體驗農場會帶大家下田認識蔥、親手拔蔥，接著回到教室洗蔥、切蔥、桿麵皮，煎一張自己的蔥油餅。\n\n全程約 2 小時，需提前預約；管家可協助安排時段與交通。", "Pull Sanxing scallions with a local farmer, then roll and fry your own scallion pancake. About two hours; booking required."))],
    en: { title: "Sanxing scallion farm & pancakes", summary: "Pull scallions, then make your own scallion pancake." },
  },
  {
    content_type: "activity", slug: "luodong-night-market", title: "羅東夜市散步地圖", cover: "ai:luodong_night_market",
    summary: "車程 15 分鐘。卜肉、羊肉湯、包心粉圓，管家整理了一張不踩雷的清單。",
    blocks: [rt("a5", zhen("宜蘭人的晚餐清單", "What locals actually eat"), zhen("羅東夜市就在羅東運動公園旁，攤位集中好逛。管家最常推薦的幾樣：現炸卜肉、當歸羊肉湯、包心粉圓與三星蔥餅。\n\n週末人潮多，建議 18:00 前抵達；回程若不方便開車，可請管家預約計程車。", "Fifteen minutes away. Our shortlist: fried pork strips, angelica lamb soup, filled tapioca balls and scallion pancakes."))],
    en: { title: "Luodong Night Market walk", summary: "A no-miss list from our hosts, 15 minutes away." },
  },
  {
    content_type: "activity", slug: "villa-game-night", title: "包棟夜：KTV、撞球與麻將", cover: "real:billiards",
    summary: "不用出門也能玩一整晚：戲院級 KTV、撞球桌、電動麻將與 Switch。",
    blocks: [rt("a6", zhen("今晚哪裡都不去", "Staying in tonight"), zhen("客廳的家庭劇院可以唱 KTV、看 Netflix；B 棟有撞球桌與飛鏢機，A 棟有電動麻將桌。孩子在兒童遊戲區玩，大人在池畔聊天。\n\n為了鄰居，22:00 後請把音量放低；室內娛樂不受時間限制。", "Theatre-grade karaoke and Netflix in the lounge, billiards and darts in Building B, an automatic mahjong table in Building A.")), gallery("a6g", zhen("室內娛樂", "Indoor games"), [img("real:billiards2", "撞球", "Billiards"), img("real:mahjong", "電動麻將", "Mahjong"), img("real:living_tv", "家庭劇院", "Home theatre")])],
    en: { title: "Villa game night", summary: "Karaoke, billiards, mahjong and Switch without leaving the villa." },
  },

  // 餐飲服務
  {
    content_type: "dining", slug: "field-view-breakfast", title: "田野早餐", cover: "real:breakfast_spread",
    summary: "面向稻田的長桌，宜蘭在地水果、現烤麵包與現煮咖啡。",
    blocks: [rt("d1", zhen("早晨從一壺咖啡開始", "Breakfast facing the fields"), zhen("早餐擺在面向稻田的長桌上：當季宜蘭水果、現烤麵包與可頌、香腸與時蔬，搭配現煮咖啡、茶與果汁。\n\n包棟入住可加購早餐，每位 NT$350（6 歲以下免費），請於入住前三天告知人數與飲食需求。", "Seasonal Yilan fruit, fresh bread, sausages and vegetables, coffee, tea and juice. NT$350 per guest; book three days ahead.")), gallery("d1g", zhen("早餐", "Breakfast"), [img("real:breakfast_spread2", "田野早餐", "Field breakfast"), img("real:breakfast_plate", "早餐盤", "Breakfast plate"), img("real:coffee", "現煮咖啡", "Fresh coffee")])],
    en: { title: "Field-view breakfast", summary: "Local fruit, fresh bread and coffee at a table facing the paddies." },
  },
  {
    content_type: "dining", slug: "poolside-bbq", title: "池畔烤肉", cover: "real:bbq",
    summary: "美式烤爐、炭火與冰桶都準備好了，食材可自備，也可請管家代訂。",
    blocks: [rt("d2", zhen("傍晚的池畔，烤一爐肉", "Grill by the pool"), zhen("中庭泳池旁備有美式瓦斯烤爐與餐具。可以自備食材，也可以請管家代訂在地肉品與海鮮組合（4 人份 NT$2,800 起），我們會在你們抵達前備好。\n\n用畢請將烤網留在原位，清潔由我們處理。", "A gas grill by the pool; bring your own food or let us order a local meat & seafood set from NT$2,800 for four."))],
    en: { title: "Poolside barbecue", summary: "Grill ready by the pool; bring food or let us order it." },
  },
  {
    content_type: "dining", slug: "private-chef-dinner", title: "管家私廚晚宴", cover: "real:chef_prep",
    summary: "用三星蔥、宜蘭鴨賞與南方澳海鮮做一桌台菜，在民宿餐桌上吃。",
    blocks: [rt("d3", zhen("一桌宜蘭的味道", "A Yilan table"), zhen("合作主廚以在地食材設計 6 至 8 道台菜：三星蔥爆牛、鴨賞炒飯、南方澳鮮魚、當季蔬菜與甜湯。菜單會依季節與人數調整。\n\n每位 NT$1,500 起，10 人以上開放預約，請於入住 7 天前確認。", "Six to eight Taiwanese courses from Sanxing scallions, Yilan duck and Nanfang'ao seafood. From NT$1,500 per guest, groups of 10+.")), gallery("d3g", zhen("一起下廚也可以", "Or cook together"), [img("real:hotpot", "一起準備火鍋", "Hot pot together"), img("real:kitchen_round", "開放式廚房", "Open kitchen")], 2)],
    en: { title: "Private chef dinner", summary: "A Taiwanese feast from Yilan produce, served at the villa table." },
  },
  {
    content_type: "dining", slug: "evening-whisky-bar", title: "微醺夜：威士忌與精釀", cover: "real:whisky",
    summary: "宜蘭有座知名威士忌酒廠。晚上留一杯給自己，零食吧也有在地小點。",
    blocks: [rt("d4", zhen("留一杯給晚上的自己", "A glass for the evening"), zhen("管家可代訂宜蘭在地威士忌與精釀啤酒，配上零食吧的宜蘭小點：牛舌餅、鴨賞與花生糖。\n\n未滿 18 歲請勿飲酒；飲酒後請勿下水。", "We can order local whisky and craft beer, served with Yilan snacks from the snack bar. No swimming after drinking."))],
    en: { title: "Whisky & craft beer night", summary: "Local whisky and snacks for a slow evening." },
  },

  // 服務項目
  {
    content_type: "service", slug: "butler-hosting", title: "管家式接待", cover: "real:corridor",
    summary: "從訂房、入住到退房，同一位管家陪你安排早餐、私廚、行程與交通。",
    blocks: [rt("s1", zhen("一位管家，從頭到尾", "One host, start to finish"), zhen("慢域旅宿的團隊有 30 年飯店經驗。預訂後，會有一位管家透過 LINE 與你確認人數、餐飲、過敏與特殊需求；入住當天親自帶你認識房子，退房前再確認一次有沒有遺漏。", "One host from booking to check-out, via LINE: headcount, meals, allergies and special requests."))],
    en: { title: "Butler-style hosting", summary: "One host plans your meals, outings and transport." },
  },
  {
    content_type: "service", slug: "pet-friendly-stay", title: "毛孩友善", cover: "real:dog_bath",
    summary: "每組可帶 2 隻以內的毛孩，提供睡墊、碗與清潔備品。",
    blocks: [rt("s2", zhen("一起來旅行", "Bring them along"), zhen("我們準備了毛孩睡墊、餐碗、拾便袋與專用毛巾。為了下一組客人，請勿讓毛孩上床與進入泳池，並於入住前告知品種與數量。清潔費每隻 NT$500。", "Up to two pets per group; bedding, bowls and towels provided. NT$500 cleaning fee per pet."))],
    en: { title: "Pet friendly", summary: "Up to two pets per group, with bedding and bowls ready." },
  },
  {
    content_type: "service", slug: "family-friendly", title: "親子友善", cover: "real:kids_room",
    summary: "面向泳池的兒童遊戲區、嬰兒床、兒童餐具與泳池救生圈。",
    blocks: [rt("s3", zhen("孩子玩得開心，大人看得到", "Kids play, adults can see"), zhen("兒童遊戲區就在泳池邊的落地窗內，大人在客廳就看得到。可預借嬰兒床、澡盆、兒童餐椅與泳圈；民宿有電梯，推車進出方便。", "A play area right by the pool, cots, baby baths, high chairs and an elevator for strollers.")), gallery("s3g", zhen("親子空間", "For families"), [img("real:kids_room2", "兒童帳篷", "Play tent"), img("real:pool_family", "親子戲水", "Family swim")], 2)],
    en: { title: "Family friendly", summary: "A poolside play area, cots and kids' tableware." },
  },
  {
    content_type: "service", slug: "celebration-setup", title: "慶生與求婚佈置", cover: "ai:celebration_setup",
    summary: "氣球、花束、蛋糕與池畔燭光，告訴我們想給誰驚喜。",
    blocks: [rt("s4", zhen("把驚喜交給我們", "Leave the surprise to us"), zhen("從簡單的生日氣球（NT$1,500 起）到池畔燭光求婚佈置（NT$8,800 起），管家會先和你討論風格與時間，入住前備妥。蛋糕可代訂宜蘭在地甜點店。", "From birthday balloons (NT$1,500) to a candle-lit proposal by the pool (NT$8,800)."))],
    en: { title: "Celebrations & proposals", summary: "Balloons, flowers, cake and candles by the pool." },
  },
  {
    content_type: "service", slug: "shuttle-service", title: "車站接駁與包車", cover: "ai:shuttle_service",
    summary: "羅東、冬山火車站接駁，或包一台車把宜蘭玩一圈。",
    blocks: [rt("s5", zhen("不開車也能來", "No car needed"), zhen("羅東站、冬山站單程接駁每趟 NT$400（9 人座）。也可預約一日包車（8 小時 NT$4,500 起），由在地司機帶你去太平山、外澳或南方澳。", "Station transfers from NT$400 per trip; day charters from NT$4,500 for eight hours."))],
    en: { title: "Station transfers & charters", summary: "Station pick-ups or a driver for the day." },
  },
  {
    content_type: "service", slug: "in-villa-entertainment", title: "包棟娛樂設施", cover: "real:living_white",
    summary: "戲院級 KTV、Netflix、撞球、飛鏢、電動麻將與桌遊，全部免費使用。",
    blocks: [rt("s6", zhen("下雨天也不無聊", "Rainy days covered"), zhen("娛樂設施全部包含在房價內：家庭劇院 KTV、Netflix、Nintendo Switch、桌遊、撞球桌、飛鏢機與電動麻將桌。另備有零食吧與自選沐浴香氛。", "Everything is included: karaoke, Netflix, Switch, board games, billiards, darts and mahjong.")), gallery("s6g", zhen("設施", "Facilities"), [img("real:snack_shelf", "零食吧", "Snack bar"), img("real:amenity_shelf", "自選香氛", "Bath amenities"), img("real:tea_jars", "茶包吧", "Tea bar")])],
    en: { title: "In-villa entertainment", summary: "Karaoke, billiards, darts, mahjong and games, all included." },
  },

  // 旅遊專欄
  {
    content_type: "journal", slug: "yilan-slow-weekend", title: "宜蘭慢週末：冬山田園的兩天一夜", cover: "real:exterior_dusk",
    summary: "週六中午抵達、週日晚上回台北。我們排了一個不趕路的兩天一夜。",
    blocks: [rt("j1", zhen("第一天：抵達、游泳、夜市", "Day one"), zhen("13:00 抵達冬山，先在附近吃一碗米粉羹。15:00 入住，換上泳衣直接下水。傍晚到羅東夜市吃卜肉、羊肉湯，21:00 回民宿點亮泳池燈，躺著看星星。", "Arrive at one, swim at three, night market at dusk, stars by the pool after nine.")), rt("j2", zhen("第二天：早餐、騎車、回家", "Day two"), zhen("8:00 在稻田邊吃早餐，9:30 騎單車沿冬山河到親水公園。中午退房前再泡一次泳池，回程繞去三星買蔥油餅，傍晚上國道五號，避開最塞的時段。", "Breakfast by the fields, a ride along the river, one last swim, scallion pancakes for the road.")), gallery("j1g", zhen("這兩天", "The weekend"), [img("real:pool_hat", "下午的泳池", "Afternoon swim"), img("real:breakfast_spread", "田野早餐", "Breakfast"), img("real:rice_field_walk", "稻田邊的早晨", "Morning by the fields")])],
    en: { title: "A slow weekend in Dongshan", summary: "A two-day plan that never rushes." },
  },
  {
    content_type: "journal", slug: "travel-with-grandparents", title: "帶長輩出遊，為什麼我們推薦包棟", cover: "real:couple_field",
    summary: "電梯、無障礙浴室、不用排隊的早餐。帶爸媽出門，最需要的是不累。",
    blocks: [rt("j3", zhen("讓長輩不累的五件事", "Five things that help"), zhen("一、有電梯，行李與輪椅都方便。\n二、浴室有扶手與防滑地墊。\n三、早餐送到餐桌，不用排隊。\n四、客廳有麻將桌，長輩最喜歡。\n五、晚上不用出門，私廚做一桌台菜。\n\n入住前告訴管家長輩的需求，我們會先把房間安排在一樓或電梯旁。", "An elevator, grab bars, breakfast served at the table, a mahjong table and a private chef."))],
    en: { title: "Travelling with grandparents", summary: "Why a whole-villa stay is the least tiring choice." },
  },
  {
    content_type: "journal", slug: "rainy-day-in-yilan", title: "宜蘭下雨天，其實很好玩", cover: "ai:rainy_day_yilan",
    summary: "宜蘭一年有兩百天在下雨。這是我們整理的雨天行程。",
    blocks: [rt("j4", zhen("雨天的五個去處", "Five rainy-day ideas"), zhen("蘭陽博物館、宜蘭酒廠、羅東林業文化園區、國立傳統藝術中心，以及——哪裡都不去，在民宿唱一整天的 KTV。\n\n下雨的冬山很安靜，窗外的稻田會變成更深的綠。", "Museums, the wine factory, the forestry park, the traditional arts centre — or karaoke all day."))],
    en: { title: "Rainy days in Yilan", summary: "Yilan rains 200 days a year; here is what to do." },
  },
  {
    content_type: "journal", slug: "pets-weekend-in-yilan", title: "帶毛孩來宜蘭：兩天的友善地圖", cover: "real:dog_bath",
    summary: "可以一起進去的餐廳、可以奔跑的草地，以及一間可以一起睡的民宿。",
    blocks: [rt("j5", zhen("毛孩也能一起去的地方", "Pet-friendly spots"), zhen("冬山河親水公園的大草坪、梅花湖環湖步道，以及幾間有戶外座位的咖啡店都歡迎毛孩。回到民宿，我們準備好睡墊與碗，泳池則請讓毛孩在池邊休息。", "Riverside lawns, the Meihua Lake loop and cafés with outdoor seating; bedding and bowls at the villa."))],
    en: { title: "A pet-friendly weekend in Yilan", summary: "Where your dog is welcome, from lawns to cafés." },
  },
  {
    content_type: "journal", slug: "yilan-breakfast-map", title: "冬山・羅東早餐地圖", cover: "ai:yilan_breakfast_map",
    summary: "如果不在民宿吃早餐，管家推薦這幾家在地老店。",
    blocks: [rt("j6", zhen("在地人的早晨", "Local breakfasts"), zhen("米粉羹配炸肉、蔥油餅加蛋、豆漿配燒餅，以及一間開了四十年的饅頭店。大部分早上 6 點開到 10 點，賣完就收。", "Rice-noodle soup, scallion pancakes with egg, soy milk and a forty-year-old bun shop."))],
    en: { title: "A Dongshan & Luodong breakfast map", summary: "Old local breakfast shops our hosts love." },
  },
  {
    content_type: "journal", slug: "private-dinner-at-the-villa", title: "在民宿的餐桌上，吃一桌宜蘭", cover: "real:hotpot",
    summary: "不想出門的晚上，一起下廚煮火鍋，或請私廚來做一桌台菜。",
    blocks: [rt("j7", zhen("今晚在家吃", "Dinner in"), zhen("禾境的開放式廚房有大圓桌、電磁爐與全套鍋具，最適合一群人煮火鍋。想輕鬆一點，就請私廚用三星蔥、鴨賞與南方澳鮮魚做一桌台菜。", "A big round table and a full kitchen for hot pot, or a private chef for a Yilan feast."))],
    en: { title: "Dinner at the villa table", summary: "Hot pot together, or a private chef for the night." },
  },

  // 慢域消息
  {
    content_type: "news", slug: "2026-winter-weekday-offer", title: "冬季平日包棟 85 折", cover: "real:pool_side",
    summary: "2026/12/1–2027/2/28 週日至週四入住，單棟包棟 85 折，連住兩晚再送早餐。",
    blocks: [rt("n1", zhen("冬天，來冬山", "Come to Dongshan this winter"), zhen("活動期間週日至週四入住禾境，單棟或雙棟包棟享 85 折；連續入住兩晚，加贈全員田野早餐一次。\n\n不適用於春節與連續假期，請透過官方 LINE @slowfield 預約並註明「冬季平日」。", "15% off Sunday–Thursday stays, Dec 1 – Feb 28; two nights include breakfast for everyone."))],
    en: { title: "Winter weekdays: 15% off", summary: "Sunday–Thursday villa stays, Dec 1 to Feb 28." },
  },
  {
    content_type: "news", slug: "member-free-upgrade", title: "慢域會員：包棟免費升等", cover: "real:living_white",
    summary: "加入慢域會員，單棟包棟可免費升等加床與延後退房。",
    blocks: [rt("n2", zhen("加入會員", "Join"), zhen("加入官方 LINE @slowfield 並完成會員資料，即可在預訂時享免費加床 2 床（價值 NT$2,600）或延後退房至 13:00（擇一）。", "Join via LINE @slowfield for two free extra beds or a 1pm check-out."))],
    en: { title: "Members: free upgrade", summary: "Extra beds or late check-out for members." },
  },
  {
    content_type: "news", slug: "pet-friendly-rooms", title: "毛孩友善客房正式開放", cover: "real:dog_bath",
    summary: "應大家的要求，禾境開放毛孩同住，每組最多 2 隻。",
    blocks: [rt("n3", zhen("一起來吧", "Bring them along"), zhen("自 2026 年 10 月起，禾境開放毛孩同住。我們準備了睡墊、餐碗與清潔備品，請於訂房時告知品種與數量。", "From October 2026, up to two pets per group are welcome."))],
    en: { title: "Pet-friendly rooms are open", summary: "Up to two pets per group, from October 2026." },
  },
  {
    content_type: "news", slug: "hejing-ridge-2027", title: "禾境·山嵐：2027 籌備中", cover: "ai:ridge_concept",
    summary: "禾境品牌的第二座 Villa 正在規劃，將落腳宜蘭山區。",
    blocks: [rt("n4", zhen("下一座 Villa", "The next villa"), zhen("繼禾境之後，禾境品牌的第二座 Villa「山嵐」正在籌備。我們想做一間被山與雲包圍的房子，開幕時間與預訂方式將在官網與 LINE 公布。", "A second Hejing villa, among Yilan's mountains, is in planning; details will follow."))],
    en: { title: "Hejing Ridge: coming 2027", summary: "The second Hejing villa is in planning." },
  },

  // 品牌介紹
  {
    content_type: "brand", slug: "brand-story", title: "讓世界住進台灣在地的美好", cover: "real:brand_wall",
    summary: "慢域旅宿由擁有 30 年飯店經驗的團隊創立，以飯店級服務與在地生活美學，經營值得再回來的民宿。",
    blocks: [rt("b1", zhen("我們是誰", "Who we are"), zhen("慢域旅宿 Slowfield Stays 由擁有 30 年飯店管理經驗的團隊創立，專注於精品民宿的品牌經營與營運。\n\n我們相信，一間好民宿不只是房間漂亮，而是從訂房的第一則訊息開始，每個細節都有人用心照顧。", "A team with 30 years in hotels, running boutique stays with hotel-grade care.")), rt("b1b", zhen("跟著靈魂，放慢", "Slow down"), zhen("我們把這句話寫在禾境的牆上：跟著靈魂，放慢，讓世界跟得上你。", "Written on our wall: follow your soul, slow down, let the world catch up."))],
    en: { title: "Bringing Taiwan's quiet best to every stay", summary: "A team with 30 years in hotels, running stays worth returning to." },
  },
  {
    content_type: "brand", slug: "how-we-choose", title: "我們的選宿標準", cover: "real:exterior_sign",
    summary: "慢域的每一間房子，都要通過這五個問題。",
    blocks: [rt("b2", zhen("五個問題", "Five questions"), zhen("一、這裡安靜嗎？\n二、建築有自己的個性嗎？\n三、一群人住得舒服嗎？\n四、在地有值得推薦的事嗎？\n五、我們會想帶家人來住嗎？\n\n五題都是「是」，才會成為慢域的一員。", "Is it quiet? Does it have character? Is it comfortable for a group? Is there something local worth sharing? Would we bring our own family?"))],
    en: { title: "How we choose", summary: "Five questions every Select stay must pass." },
  },
  {
    content_type: "brand", slug: "our-team", title: "30 年飯店團隊", cover: "real:rice_field_walk",
    summary: "從五星飯店到田野民宿，我們把飯店的服務流程帶進每一間房子。",
    blocks: [rt("b3", zhen("把飯店的細節帶回家", "Hotel habits, villa scale"), zhen("我們的團隊來自國際連鎖飯店的客務、房務與餐飲部門。民宿的規模小，但床單的平整度、浴室的清潔標準與入住流程，我們都照飯店的規矩來。", "Our people come from international hotel chains; small scale, hotel standards."))],
    en: { title: "A 30-year hotel team", summary: "Hotel service habits brought to every villa." },
  },
];

/* Experience page (慢域體驗) body */
export const EXPERIENCE = {
  cover: "real:pool_hat",
  summary: "游泳、騎車、吃早餐、唱 KTV——慢域體驗是讓一群人一起慢下來的方式。",
  blocks: [
    rt("e1", zhen("慢域體驗", "The Select experience"), zhen("我們把在地值得做的事整理成行程：白天的田野與河岸、晚上的池畔與餐桌。管家會依人數、年齡與天氣幫你排好，你只要出現。", "Our hosts plan the day around your group, the season and the weather.")),
    gallery("e1g", zhen("一天的樣子", "A day here"), [img("real:breakfast_spread", "早餐", "Breakfast"), img("real:pool_wide", "午後的泳池", "Afternoon pool"), img("real:pool_night", "夜晚", "Evening")]),
  ],
};

/* ── Brand-site homepage ────────────────────────────────────────────────
   The block list the homepage editor would save. Image refs ("real:" / "ai:")
   are resolved to uploaded URLs by seed.mjs. */
const L = (zh, en) => ({ zh, en });
export const HOME_BLOCKS = [
  { id: "stays", type: "stays", enabled: true },
  {
    id: "about", type: "about", enabled: true,
    config: {
      images: ["real:exterior_dusk", "real:dining_field", "real:room_king"],
      image_position: "right",
      eyebrow: L("關於慢域", "About Slowfield"),
      title: L("我們選宿，\n不只是選房。", "We choose stays,\nnot just rooms."),
      body: L(
        "每一間慢域的房子，我們都先住過。看建築怎麼迎接早晨的光，看一桌人坐下來吃飯夠不夠寬，也看管家能不能在你開口之前就準備好。",
        "We stay in every house before it joins Slowfield. We look at how it takes the morning light, whether a whole table can sit down to dinner, and whether the host is ready before you ask.",
      ),
      items: [
        { icon: "icon:house", label: L("整棟只屬於你們", "The whole house is yours"), detail: L("一次只接待一組客人", "One group at a time") },
        { icon: "icon:leaf", label: L("30 年飯店團隊", "30 years in hotels"), detail: L("管家式接待，從抵達到退房", "Hosted from arrival to check-out") },
        { icon: "icon:water", label: L("住進風景裡", "Inside the landscape"), detail: L("稻田、茶園與海岸第一排", "Paddies, tea hills and the coast") },
      ],
      cta_label: L("了解慢域體驗", "The Slowfield experience"),
      cta_href: "/experience",
    },
  },
  {
    id: "news", type: "articles", enabled: true,
    config: {
      variant: "news", content_type: "news", limit: 3,
      eyebrow: L("最新消息", "Latest news"),
      title: L("這一季的慢域", "This season at Slowfield"),
    },
  },
  {
    id: "gallery", type: "gallery", enabled: true,
    config: {
      eyebrow: L("空間一瞥", "A look inside"),
      title: L("光、水，與一整片稻田", "Light, water and a field of rice"),
      images: ["real:pool_wide", "real:living_white", "real:breakfast_spread", "real:bath_tub", "real:pool_night", "real:rice_field_walk"],
    },
  },
  {
    id: "map", type: "map", enabled: true,
    config: {
      mode: "stays", height: "tall",
      eyebrow: L("在哪裡", "Where we are"),
      heading: L("三個地方，三種風景", "Three places, three landscapes"),
      caption: L("稻田邊的禾境、茶園裡的月霧山居、海岸第一排的礁岸之家。點選地圖上的標誌看每一間。", "Hejing by the paddies, Moon Mist in the tea hills, Reef House on the coast. Select a marker to see each one."),
    },
  },
  {
    id: "pathways", type: "pathways", enabled: true,
    config: {
      eyebrow: L("慢域之道", "The Slowfield way"),
      title: L("不只住宿，\n也是一套旅行入口。", "More than a stay."),
      intro: L("從餐桌、活動到旅行筆記，慢慢把這趟旅行排滿。", "Meals, things to do and travel notes to fill out the trip."),
      items: [
        { title: L("餐飲服務", "Dining"), description: L("田野早餐、池畔烤肉與管家私廚。", "Field-view breakfast, poolside BBQ and a private chef."), href: "/dining", image: "real:hotpot" },
        { title: L("精選活動", "Activities"), description: L("騎車、環湖、拔蔥，都在半小時內。", "Cycling, lake walks and scallion farms, all within half an hour."), href: "/activities", image: "ai:dongshan_river_cycling" },
        { title: L("旅遊專欄", "Journal"), description: L("我們自己走過的宜蘭路線。", "Yilan routes we have walked ourselves."), href: "/journal", image: "real:couple_field" },
        { title: L("慢域體驗", "Experience"), description: L("從第一則訊息到退房的每一步。", "Every step from the first message to check-out."), href: "/experience", image: "real:brand_wall" },
      ],
    },
  },
  {
    id: "journal", type: "articles", enabled: true,
    config: { variant: "feature", content_type: "journal", limit: 3 },
  },
  {
    id: "faq", type: "faq_accordion", enabled: true,
    config: {
      eyebrow: L("常見問題", "FAQ"),
      title: L("訂房前，大家最常問的事", "What guests ask before booking"),
      items: [
        { question: L("怎麼訂房？需要先付款嗎？", "How do I book? Do I pay up front?"), answer: L("送出日期與人數後，專人會在一天內以 Email 或 LINE 回覆可訂狀況與報價。確認後才需支付訂金，網站上不會直接扣款。", "Send your dates and group size. A person replies within a day with availability and a quote. A deposit is only due once you confirm; nothing is charged on the site.") },
        { question: L("包棟最少、最多可以住幾個人？", "How many people can stay?"), answer: L("禾境可接待 6 至 32 人；月霧山居適合 2 至 4 人；礁岸之家適合 4 至 8 人。每間都是一次只接待一組客人。", "Hejing takes 6 to 32 guests, Moon Mist 2 to 4, and Reef House 4 to 8. Each house hosts one group at a time.") },
        { question: L("可以帶寵物嗎？", "Can I bring my pet?"), answer: L("禾境設有毛孩友善客房，備有睡墊與餐碗，請在詢問時告知體型與數量。其他兩間目前不開放寵物入住。", "Hejing has pet-friendly rooms with beds and bowls; tell us the size and number when you enquire. The other two houses do not take pets yet.") },
        { question: L("有提供餐點嗎？", "Are meals included?"), answer: L("每間都含早餐。禾境另可加訂池畔烤肉、火鍋與管家私廚晚宴，請在入住三天前預約。", "Breakfast is included everywhere. At Hejing you can add a poolside BBQ, hotpot or a private-chef dinner, booked three days ahead.") },
        { question: L("入住與退房時間？", "When are check-in and check-out?"), answer: L("入住為下午 3 點後，退房為上午 11 點前。需要提早寄放行李或延後退房，可以先和管家確認。", "Check-in is from 3 pm and check-out by 11 am. Ask the host about early luggage drop or a late check-out.") },
        { question: L("取消或改期怎麼計算？", "What if I need to cancel or move dates?"), answer: L("入住 14 天前可免費改期一次；取消依距離入住的天數退還訂金，詳細比例會寫在報價信中。遇颱風等不可抗力可全額保留或退款。", "You can move dates once for free up to 14 days before arrival. Refunds depend on how close the stay is, and the quote spells out the scale. Typhoons and similar events are fully refundable or transferable.") },
      ],
    },
  },
  {
    id: "editorial", type: "editorial", enabled: true,
    config: {
      image: "real:pool_night",
      eyebrow: L("下一個假期", "Your next break"),
      title: L("找一個週末，把日子過慢一點。", "Pick a weekend and slow it down."),
      body: L("告訴我們日期與人數，由專人在一天內回覆，沒有機器人。", "Send us your dates and group size. A person replies within a day."),
      cta_label: L("瀏覽全部住宿", "Browse all stays"),
      cta_href: "/stays",
    },
  },
];

/** Hero photo for each content section's index page (settings.hero_<type>). */
export const SECTION_HEROES = {
  brand: "real:exterior_field",
  dining: "real:breakfast_spread",
  activity: "ai:meihua_lake_morning",
  journal: "real:rice_field_walk",
  news: "real:pool_floats",
  service: "real:brand_wall",
  experience: "real:living_white",
};

/** 聯絡我們 on the brand site: a hero, the enquiry form, then how to reach us. */
export const CONTACT_PAGE = {
  hero_image: "real:brand_wall",
  hero_height: "medium",
  hero_title: L("聯絡我們", "Contact"),
  hero_subtitle: L("告訴我們日期與人數，由專人在一天內回覆。", "Send us your dates and group size. A person replies within a day."),
  hero_title_color: "#ffffff",
  hero_subtitle_color: "#ffffff",
  blocks: [
    {
      id: "contact-form", type: "contact_form", enabled: true,
      config: {
        layout: "split",
        eyebrow: L("詢問", "Enquiry"),
        title: L("想住哪一間？", "Which house would you like?"),
        subtitle: L("留下日期、人數與想知道的事，我們會以 Email 或 LINE 回覆。", "Leave your dates, group size and questions. We reply by email or LINE."),
      },
    },
    {
      id: "contact-info", type: "contact_info", enabled: true,
      config: {
        eyebrow: L("找到我們", "Find us"),
        title: L("慢域旅宿服務中心", "Slowfield Stays"),
        phone: CONTACT.phone, email: CONTACT.email, line: CONTACT.line,
        address: CONTACT.address,
        map_embed: '<iframe src="https://www.google.com/maps?q=%E5%AE%9C%E8%98%AD%E7%B8%A3%E5%86%AC%E5%B1%B1%E9%84%89&output=embed"></iframe>',
        directions: L(
          "服務時間：每日 09:00–21:00。\n自駕：國道五號羅東交流道下，約 10 分鐘。\n火車：羅東站下車，轉乘計程車約 10 分鐘。",
          "Open daily 09:00–21:00.\nBy car: 10 minutes from the Luodong exit of Freeway 5.\nBy rail: 10 minutes by taxi from Luodong Station.",
        ),
      },
    },
  ],
};
