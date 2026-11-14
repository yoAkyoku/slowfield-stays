"""
Multi-site seed script — unique content per site
==================================================
Parent: Slowfield Stays (brand overview, all regions)
Child A: 禾境 Hejing Villa (宜蘭, coastal/pool theme)
Child B: 禾境·山嵐 Hejing Ridge (南投, mountain/forest theme)

Usage:
  cd backend
  pip install httpx
  python scripts/seed_multisite.py --api http://localhost:8000/api/v1 --email admin@example.com --password admin123
  python scripts/seed_multisite.py --api https://slowfield-api.onrender.com/api/v1 --email admin@example.com --password admin123 --skip-parent
"""

import argparse, httpx, sys

# ───────────────────────────────── images ─────────────────────────────────

I = {
    # --- Hero / Banner ---
    "hero_brand":   "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80",
    "hero_coastal": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80",
    "hero_mountain":"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=80",
    "hero2_brand":  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1800&q=80",
    "hero2_coastal":"https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=1800&q=80",
    "hero2_mountain":"https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1800&q=80",
    "hero3_brand":  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1800&q=80",
    "hero3_coastal":"https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?auto=format&fit=crop&w=1800&q=80",
    "hero3_mountain":"https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1800&q=80",
    # --- Stays ---
    "stay_pool":    "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
    "stay_ocean":   "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
    "stay_garden":  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    "stay_cabin":   "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1200&q=80",
    "stay_forest":  "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
    "stay_teahouse":"https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
    "stay_villa":   "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    "stay_loft":    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
    "stay_cliff":   "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
    # --- Content categories ---
    "surf":     "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=80",
    "kayak":    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
    "snorkel":  "https://images.unsplash.com/photo-1544919982-b61976f0ba43?auto=format&fit=crop&w=1200&q=80",
    "hike":     "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80",
    "tea":      "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=1200&q=80",
    "bamboo":   "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",
    "seafood":  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
    "noodle":   "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    "hotpot":   "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1200&q=80",
    "farmfood": "https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=1200&q=80",
    "spa":      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80",
    "car":      "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?auto=format&fit=crop&w=1200&q=80",
    "news1":    "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
    "news2":    "https://images.unsplash.com/photo-1504711434969-e33886168d6c?auto=format&fit=crop&w=1200&q=80",
    "journal1": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80",
    "journal2": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
    "journal3": "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    "brand1":   "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    "brand2":   "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
    "bike":     "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&w=1200&q=80",
    "star":     "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80",
    "sunrise":  "https://images.unsplash.com/photo-1500534314263-a834e29da4bd?auto=format&fit=crop&w=1200&q=80",
    "pottery":  "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1200&q=80",
    "fish":     "https://images.unsplash.com/photo-1545816250-e12bedaf89be?auto=format&fit=crop&w=1200&q=80",
    "hotspring":"https://images.unsplash.com/photo-1540202404-a2f29016b523?auto=format&fit=crop&w=1200&q=80",
    "waterfall":"https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=crop&w=1200&q=80",
    "firefly":  "https://images.unsplash.com/photo-1531512073830-ba890ca4eba2?auto=format&fit=crop&w=1200&q=80",
    "coffee":   "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80",
    "mochi":    "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1200&q=80",
    "market":   "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80",
}

# ───────────────────────────────── sites ──────────────────────────────────

SITES_DEF = [
    {   # index 0 = parent
        "name": "Slowfield Stays",
        "slug": "slowfield",
        "domain": "slowfield-web.onrender.com",
        "default_locale": "en",
        "primary_color": "#283d34", "accent_color": "#a56d43",
        "contact_email": "hello@slowfield.example", "contact_line": "@slowfieldstays",
        "seo_title": "Slowfield Stays — Private stays with a sense of place",
        "seo_description": "Curated intimate villas, mountain houses, and slow coastal retreats across Taiwan.",
        "is_template": True,
        "settings": {"instagram": "https://www.instagram.com/slowfieldstays/", "facebook": "https://www.facebook.com/slowfieldstays/", "line": "https://line.me/R/ti/p/@slowfieldstays"},
    },
    {   # index 1 = child A
        "name": "禾境 Hejing Villa",
        "slug": "hejing",
        "domain": "slowfield.example",
        "default_locale": "zh",
        "primary_color": "#2a3b55", "accent_color": "#c9a96e",
        "contact_email": "stay@slowfield.example", "contact_line": "@hejingvilla",
        "seo_title": "Hejing Villa 禾境｜宜蘭冬山輕奢泳池民宿",
        "seo_description": "宜蘭冬山的頂級泳池別墅，提供私人管家服務與在地文化體驗。",
        "settings": {"instagram": "https://www.instagram.com/hejingvilla/", "facebook": "https://www.facebook.com/hejingvilla/", "line": "https://line.me/R/ti/p/@hejingvilla"},
    },
    {   # index 2 = child B
        "name": "禾境·山嵐 Hejing Ridge",
        "slug": "hejing-ridge",
        "domain": "hejing-ridge.onrender.com",
        "default_locale": "zh",
        "primary_color": "#3b3228", "accent_color": "#8b6e4e",
        "contact_email": "ridge@slowfield.example", "contact_line": "@hejingridge",
        "seo_title": "Hejing Ridge 禾境·山嵐｜南投山間秘境民宿",
        "seo_description": "隱匿於南投山林間的獨棟別墅，遠離塵囂的慢活體驗。",
        "settings": {"instagram": "https://www.instagram.com/hejingridge/", "facebook": "https://www.facebook.com/hejingridge/", "line": "https://line.me/R/ti/p/@hejingridge"},
    },
]

# ═══════════════════════════════════════════════════════════════════════════
#  PER-SITE CONTENT
# ═══════════════════════════════════════════════════════════════════════════

# ---------- BANNERS (3 per site, all different) ----------

BANNERS = {
    "slowfield": [
        {"title": "Private stays with a sense of place", "subtitle": "A curated collection across Taiwan — mountains, coast, and countryside.", "image_url": I["hero_brand"], "cta_label": "Explore All Stays", "cta_href": "/stays", "sort_order": 0, "status": "published",
         "translations": {"zh": {"title": "有風格也有安靜尺度的旅宿", "subtitle": "精選台灣各地別墅、山居與海岸宅邸。", "cta_label": "探索住宿"}}},
        {"title": "Now Booking Summer 2026", "subtitle": "New properties in Taitung, Penghu, and the Alishan highlands.", "image_url": I["hero2_brand"], "cta_label": "View Collection", "cta_href": "/stays", "sort_order": 1, "status": "published",
         "translations": {"zh": {"title": "2026 夏季開放預訂", "subtitle": "台東、澎湖與阿里山高地的新物件。", "cta_label": "查看精選"}}},
        {"title": "Inquiry-first hospitality", "subtitle": "No instant booking — every stay begins with a conversation.", "image_url": I["hero3_brand"], "cta_label": "Our Story", "cta_href": "/brand", "sort_order": 2, "status": "published",
         "translations": {"zh": {"title": "詢問式待客之道", "subtitle": "不設即時預訂——每次住宿都從對話開始。", "cta_label": "品牌故事"}}},
    ],
    "hejing": [
        {"title": "禾境 · 遇見海與天的邊界", "subtitle": "宜蘭冬山的私人泳池別墅，推開門就是無際的蘭陽平原。", "image_url": I["hero_coastal"], "cta_label": "探索房型", "cta_href": "/stays", "sort_order": 0, "status": "published",
         "translations": {"en": {"title": "Hejing — Where Rice Meets Sky", "subtitle": "A private pool villa in Dongshan, Yilan with panoramic views.", "cta_label": "Explore Rooms"}}},
        {"title": "夏日限定 · 海風泳池派對", "subtitle": "每年六月至九月，專屬的池畔活動與在地海鮮晚宴。", "image_url": I["hero2_coastal"], "cta_label": "了解更多", "cta_href": "/activities", "sort_order": 1, "status": "published",
         "translations": {"en": {"title": "Summer Only — Poolside Party", "subtitle": "June to September: exclusive pool events and local seafood dinners.", "cta_label": "Learn More"}}},
        {"title": "包棟度假 · 全家的秘密基地", "subtitle": "最多可容納 12 人，附設兒童遊戲區與私人管家服務。", "image_url": I["hero3_coastal"], "cta_label": "預約包棟", "cta_href": "/contact", "sort_order": 2, "status": "published",
         "translations": {"en": {"title": "Whole-Villa Retreat — A Family Hideaway", "subtitle": "Up to 12 guests with kids play area and private butler service.", "cta_label": "Book Villa"}}},
    ],
    "hejing-ridge": [
        {"title": "山嵐 · 在雲霧中醒來", "subtitle": "南投鹿谷的獨棟山屋，被竹林與茶園環繞的慢活空間。", "image_url": I["hero_mountain"], "cta_label": "探索房型", "cta_href": "/stays", "sort_order": 0, "status": "published",
         "translations": {"en": {"title": "Ridge — Wake Up in the Clouds", "subtitle": "A standalone mountain house in Lugu, surrounded by bamboo and tea.", "cta_label": "Explore Rooms"}}},
        {"title": "秋冬限定 · 暖湯與星空", "subtitle": "十月起開放私人湯屋預約，搭配專業天文望遠鏡觀星。", "image_url": I["hero2_mountain"], "cta_label": "查看方案", "cta_href": "/activities", "sort_order": 1, "status": "published",
         "translations": {"en": {"title": "Autumn Special — Hot Springs & Stars", "subtitle": "Private hot spring baths from October, with professional stargazing telescopes.", "cta_label": "View Plans"}}},
        {"title": "茶席體驗 · 與茶農共度午後", "subtitle": "鹿谷在地茶師帶你走進百年茶園，品嚐高山烏龍。", "image_url": I["hero3_mountain"], "cta_label": "預約體驗", "cta_href": "/activities", "sort_order": 2, "status": "published",
         "translations": {"en": {"title": "Tea Ceremony — An Afternoon with Tea Farmers", "subtitle": "A local tea master guides you through century-old tea gardens.", "cta_label": "Book Experience"}}},
    ],
}

# ---------- STAYS (3 per site, all different) ----------

STAYS = {
    "slowfield": [
        {
            "slug": "cloud-villa", "facilities": ["戲水池", "烤肉區", "手作早餐"], "name": "雲端別墅 Cloud Villa", "destination": "冬山 Dongshan", "region": "宜蘭 Yilan",
            "summary": "A two-story pool villa overlooking the Dongshan River valley with Xueshan mountain views.",
            "story": "Built by a Taipei architect who wanted a retreat that felt like floating above the clouds.",
            "hero_image_url": I["stay_pool"], "base_price": 12000, "max_guests": 6, "status": "published",
            "tags": ["pool", "mountain-view", "family"],
            "amenities": ["Private Pool", "Mountain View", "Full Kitchen", "BBQ Area", "Free Parking", "Wi-Fi"],
            "room_types": [{"name": "Master Suite", "description": "King bed, panoramic view, private balcony.", "price": 8000, "capacity": 2}, {"name": "Garden Room", "description": "Twin beds, ground floor, pool access.", "price": 5000, "capacity": 2}],
            "images": [{"image_url": I["stay_pool"], "alt_text": "Cloud Villa pool", "sort_order": 0}, {"image_url": I["stay_garden"], "alt_text": "Cloud Villa garden", "sort_order": 1}],
            "faq": [{"question": "Is breakfast included?", "answer": "A local breakfast basket is provided each morning."}],
            "house_rules": ["No smoking indoors", "Quiet hours 22:00–08:00"], "location_config": {"address": "宜蘭縣冬山鄉"},
            "seo": {"title": "Cloud Villa — Pool Villa in Yilan", "description": "Private pool villa in Dongshan, Yilan."},
            "translations": {"zh": {"name": "雲端別墅", "summary": "俯瞰冬山河谷與雪山景觀的雙層泳池別墅。", "story": "由一位台北建築師打造，想要一處如漂浮在雲端般的度假空間。", "destination": "冬山", "region": "宜蘭"}},
        },
        {
            "slug": "forest-cabin", "facilities": ["湯池", "桌遊", "手作早餐"], "name": "林間小屋 Forest Cabin", "destination": "鹿谷 Lugu", "region": "南投 Nantou",
            "summary": "A Japanese-style wooden cabin surrounded by bamboo forest in Lugu tea country.",
            "story": "Rebuilt from a 60-year-old charcoal kiln house using traditional joinery techniques.",
            "hero_image_url": I["stay_cabin"], "base_price": 6800, "max_guests": 4, "status": "published",
            "tags": ["forest", "tea", "couples"],
            "amenities": ["Hot Spring Bath", "Tea Set", "Fireplace", "Forest Trail", "Wi-Fi"],
            "room_types": [{"name": "Cedar Room", "description": "Cypress soaking tub, Japanese-style.", "price": 6800, "capacity": 2}],
            "images": [{"image_url": I["stay_cabin"], "alt_text": "Forest Cabin exterior", "sort_order": 0}, {"image_url": I["stay_forest"], "alt_text": "Forest Cabin interior", "sort_order": 1}],
            "faq": [{"question": "How do we get there?", "answer": "GPS coordinates sent after booking."}],
            "house_rules": ["No smoking", "Check-in before 18:00"], "location_config": {"address": "南投縣鹿谷鄉"},
            "seo": {"title": "Forest Cabin — Bamboo Retreat in Nantou", "description": "Japanese cabin in Lugu bamboo forest."},
            "translations": {"zh": {"name": "林間小屋", "summary": "鹿谷茶鄉竹林中的日式木造小屋。", "story": "利用傳統榫卯工法，從六十年老碳窯改建而成。", "destination": "鹿谷", "region": "南投"}},
        },
        {
            "slug": "coastal-suite", "facilities": ["手作早餐", "寵物友善", "慢域餐桌"], "name": "海岸套房 Coastal Suite", "destination": "壽豐 Shoufeng", "region": "花蓮 Hualien",
            "summary": "Oceanfront suite with private beach access and unobstructed Pacific sunrise views.",
            "story": "Designed to make the ocean the centerpiece of every room.",
            "hero_image_url": I["stay_ocean"], "base_price": 9500, "max_guests": 4, "status": "published",
            "tags": ["ocean", "sunrise", "minimalist"],
            "amenities": ["Ocean View", "Private Beach", "Outdoor Shower", "Breakfast Included", "Bicycle"],
            "room_types": [{"name": "Sunrise Suite", "description": "Floor-to-ceiling ocean view, king bed.", "price": 9500, "capacity": 2}],
            "images": [{"image_url": I["stay_ocean"], "alt_text": "Coastal Suite ocean view", "sort_order": 0}, {"image_url": I["stay_cliff"], "alt_text": "Coastal Suite cliff", "sort_order": 1}],
            "faq": [{"question": "Is the beach swimmable?", "answer": "The cove is calm in summer."}],
            "house_rules": ["No smoking", "No loud music after 21:00"], "location_config": {"address": "花蓮縣壽豐鄉"},
            "seo": {"title": "Coastal Suite — Oceanfront in Hualien", "description": "Minimalist oceanfront suite in Hualien."},
            "translations": {"zh": {"name": "海岸套房", "summary": "面海套房，私人沙灘入口，太平洋日出無遮擋。", "story": "設計宗旨：讓海洋成為每個房間的主角。", "destination": "花蓮", "region": "壽豐"}},
        },
    ],
    "hejing": [
        {
            "slug": "hejing-pool-villa", "facilities": ["戲水池", "KTV", "電動麻將", "烤肉區"], "name": "禾境泳池別墅", "destination": "冬山", "region": "宜蘭",
            "summary": "15 米無邊際泳池、蘭陽平原全景視野，推開落地窗即是水天一色。",
            "story": "主人走遍峇里島與清邁，決定在家鄉冬山打造一座屬於台灣的度假別墅。",
            "hero_image_url": I["stay_pool"], "base_price": 15000, "max_guests": 8, "status": "published",
            "tags": ["泳池", "景觀", "家庭"],
            "amenities": ["無邊際泳池", "蘭陽平原景觀", "中島廚房", "BBQ 區", "兒童戲水池", "免費停車"],
            "room_types": [{"name": "天空套房", "description": "三樓主臥，180度景觀落地窗，獨立浴缸。", "price": 8000, "capacity": 2}, {"name": "池畔房", "description": "一樓，推門即達泳池，雙人床。", "price": 5500, "capacity": 2}, {"name": "家庭房", "description": "上下舖 + 雙人床，適合親子。", "price": 4500, "capacity": 4}],
            "images": [{"image_url": I["stay_pool"], "alt_text": "禾境泳池全景", "sort_order": 0}, {"image_url": I["stay_garden"], "alt_text": "禾境花園", "sort_order": 1}, {"image_url": I["stay_villa"], "alt_text": "禾境外觀", "sort_order": 2}],
            "faq": [{"question": "有提供早餐嗎？", "answer": "每日由在地小農配送新鮮早餐籃。"}, {"question": "可以帶寵物嗎？", "answer": "歡迎 10 公斤以下小型犬，需事先告知。"}],
            "house_rules": ["室內禁菸", "22:00 後請降低音量", "泳池使用請注意安全"], "location_config": {"address": "宜蘭縣冬山鄉"},
            "seo": {"title": "禾境泳池別墅｜宜蘭冬山", "description": "宜蘭冬山的頂級泳池度假別墅。"},
            "translations": {"en": {"name": "Hejing Pool Villa", "summary": "15m infinity pool with panoramic Lanyang Plain views — step outside to endless sky.", "story": "The owner traveled Bali and Chiang Mai, then decided to build a Taiwanese resort villa in his hometown of Dongshan.", "destination": "Dongshan", "region": "Yilan"}},
        },
        {
            "slug": "hejing-garden-suite", "facilities": ["湯池", "桌遊", "寵物友善"], "name": "禾境花園套房", "destination": "冬山", "region": "宜蘭",
            "summary": "獨立花園入口、露天浴缸、專屬香草花園，適合兩人的私密空間。",
            "story": "花園套房原是主人的香草溫室，改建後保留了大量植栽與自然採光。",
            "hero_image_url": I["stay_garden"], "base_price": 6800, "max_guests": 2, "status": "published",
            "tags": ["花園", "情侶", "浪漫"],
            "amenities": ["私人花園", "露天浴缸", "香草園", "咖啡機", "Wi-Fi"],
            "room_types": [{"name": "花園套房", "description": "獨立出入口，Queen 床，露天浴缸。", "price": 6800, "capacity": 2}],
            "images": [{"image_url": I["stay_garden"], "alt_text": "花園套房外觀", "sort_order": 0}],
            "faq": [{"question": "有停車位嗎？", "answer": "提供一個專屬停車位。"}],
            "house_rules": ["室內禁菸", "僅限入住房客使用"], "location_config": {"address": "宜蘭縣冬山鄉"},
            "seo": {"title": "禾境花園套房｜宜蘭冬山", "description": "宜蘭冬山的浪漫花園套房。"},
            "translations": {"en": {"name": "Hejing Garden Suite", "summary": "Private garden entrance, outdoor bathtub, and herb garden — an intimate space for two.", "story": "The garden suite was originally the owner's herb greenhouse, converted while preserving its abundant greenery and natural light.", "destination": "Dongshan", "region": "Yilan"}},
        },
        {
            "slug": "hejing-loft", "facilities": ["Switch", "桌遊", "手作早餐"], "name": "禾境閣樓", "destination": "冬山", "region": "宜蘭",
            "summary": "挑高五米的工業風閣樓，大面積天窗引入星光與晨曦。",
            "story": "由舊穀倉改建，保留原始鋼構屋架，搭配現代極簡家具。",
            "hero_image_url": I["stay_loft"], "base_price": 8500, "max_guests": 4, "status": "published",
            "tags": ["閣樓", "設計", "攝影"],
            "amenities": ["天窗", "投影設備", "黑膠唱盤", "咖啡吧台", "Wi-Fi"],
            "room_types": [{"name": "閣樓主臥", "description": "挑高空間，King 床，天窗觀星。", "price": 8500, "capacity": 2}, {"name": "沙發床區", "description": "一樓起居區可加床。", "price": 2000, "capacity": 2}],
            "images": [{"image_url": I["stay_loft"], "alt_text": "禾境閣樓內部", "sort_order": 0}],
            "faq": [{"question": "適合拍照嗎？", "answer": "非常適合，許多攝影師專程前來取景。"}],
            "house_rules": ["室內禁菸", "請愛惜傢俱"], "location_config": {"address": "宜蘭縣冬山鄉"},
            "seo": {"title": "禾境閣樓｜宜蘭冬山", "description": "宜蘭冬山的設計感穀倉閣樓。"},
            "translations": {"en": {"name": "Hejing Loft", "summary": "5-meter-high industrial loft with skylights for starlight and dawn.", "story": "Converted from an old granary, keeping the original steel frame paired with modern minimalist furniture.", "destination": "Dongshan", "region": "Yilan"}},
        },
    ],
    "hejing-ridge": [
        {
            "slug": "ridge-treehouse", "facilities": ["湯池", "桌遊", "寵物友善"], "name": "山嵐樹屋", "destination": "鹿谷", "region": "南投",
            "summary": "架高於樟樹林間的木構樹屋，四面環繞竹林與雲霧。",
            "story": "建築師花了三年研究如何在不傷害老樟樹的前提下，將房子融入樹冠層。",
            "hero_image_url": I["stay_cabin"], "base_price": 9800, "max_guests": 4, "status": "published",
            "tags": ["樹屋", "森林", "秘境"],
            "amenities": ["樹冠層觀景台", "壁爐", "手沖咖啡組", "森林步道", "Wi-Fi"],
            "room_types": [{"name": "樹冠套房", "description": "360度玻璃帷幕，雙人床，吊椅。", "price": 9800, "capacity": 2}, {"name": "地面小屋", "description": "獨立木屋，適合親子。", "price": 5500, "capacity": 2}],
            "images": [{"image_url": I["stay_cabin"], "alt_text": "山嵐樹屋外觀", "sort_order": 0}, {"image_url": I["stay_forest"], "alt_text": "山嵐樹屋森林", "sort_order": 1}],
            "faq": [{"question": "下雨天安全嗎？", "answer": "結構通過建築師認證，雨天更有氛圍。"}],
            "house_rules": ["禁菸", "尊重森林環境", "18:00 前入住"], "location_config": {"address": "南投縣鹿谷鄉"},
            "seo": {"title": "山嵐樹屋｜南投鹿谷", "description": "南投鹿谷的森林樹屋秘境。"},
            "translations": {"en": {"name": "Ridge Treehouse", "summary": "Elevated wood-frame treehouse surrounded by bamboo and mist.", "story": "The architect spent three years researching how to integrate the building into the canopy without harming the old camphor trees.", "destination": "Lugu", "region": "Nantou"}},
        },
        {
            "slug": "ridge-tea-house", "facilities": ["湯池", "慢域餐桌", "手作早餐"], "name": "山嵐茶寮", "destination": "鹿谷", "region": "南投",
            "summary": "日式茶室風格的獨棟小屋，附設私人湯屋與茶道空間。",
            "story": "主人師承京都裏千家茶道，將茶室美學帶回南投山間。",
            "hero_image_url": I["stay_teahouse"], "base_price": 7500, "max_guests": 2, "status": "published",
            "tags": ["茶道", "和風", "湯屋"],
            "amenities": ["私人湯屋", "茶道具組", "榻榻米", "庭園", "Wi-Fi"],
            "room_types": [{"name": "茶室", "description": "純日式榻榻米，檜木浴缸。", "price": 7500, "capacity": 2}],
            "images": [{"image_url": I["stay_teahouse"], "alt_text": "山嵐茶寮", "sort_order": 0}],
            "faq": [{"question": "有提供茶葉嗎？", "answer": "房內備有鹿谷在地凍頂烏龍，可自由品飲。"}],
            "house_rules": ["禁菸", "請脫鞋入室"], "location_config": {"address": "南投縣鹿谷鄉"},
            "seo": {"title": "山嵐茶寮｜南投鹿谷", "description": "南投鹿谷的日式茶道民宿。"},
            "translations": {"en": {"name": "Ridge Tea House", "summary": "Japanese-style standalone cottage with private hot spring and tea ceremony space.", "story": "The owner studied Urasenke tea ceremony in Kyoto, then brought tea room aesthetics to the mountains of Nantou.", "destination": "Lugu", "region": "Nantou"}},
        },
        {
            "slug": "ridge-stone-lodge", "facilities": ["烤肉區", "電動麻將", "KTV"], "name": "山嵐石屋", "destination": "鹿谷", "region": "南投",
            "summary": "以在地石材砌成的半穴居建築，冬暖夏涼的山中洞穴體驗。",
            "story": "靈感來自北歐的地窖酒莊，牆面使用溪石手工疊砌。",
            "hero_image_url": I["stay_forest"], "base_price": 6200, "max_guests": 4, "status": "published",
            "tags": ["石屋", "洞穴", "冬季"],
            "amenities": ["石砌壁爐", "地暖", "紅酒窖", "山景露台", "Wi-Fi"],
            "room_types": [{"name": "洞穴房", "description": "石砌拱頂，King 床，壁爐。", "price": 6200, "capacity": 2}, {"name": "露台房", "description": "獨立山景露台。", "price": 4800, "capacity": 2}],
            "images": [{"image_url": I["stay_forest"], "alt_text": "山嵐石屋外觀", "sort_order": 0}],
            "faq": [{"question": "夏天會很熱嗎？", "answer": "石材隔熱，室內常年維持 22-25 度。"}],
            "house_rules": ["禁菸", "壁爐使用請遵守指引"], "location_config": {"address": "南投縣鹿谷鄉"},
            "translations": {"en": {"name": "Ridge Stone Lodge", "summary": "A semi-underground stone building — naturally cool in summer, warm in winter.", "story": "Inspired by Nordic wine cellars, the walls are hand-stacked with river stones.", "destination": "Lugu", "region": "Nantou"}},
            "seo": {"title": "山嵐石屋｜南投鹿谷", "description": "南投鹿谷的石砌山中洞穴民宿。"},
        },
    ],
}

# ───────────────── PAGES: 10 per type × 3 sites = 180 unique ─────────────

def _p(slug, title, summary, body, ctype, cover):
    return {"slug": slug, "title": title, "summary": summary, "body": body, "content_type": ctype, "cover_image_url": cover, "status": "published", "seo": {"title": title, "description": summary[:160]}}

PAGES = {
  "slowfield": {
    "journal": [
        _p("slow-mornings", "Slow Mornings Across Taiwan", "How mornings feel different at every stay.", "Each property has its own dawn ritual...", "journal", I["journal1"]),
        _p("tea-country-notes", "Tea Country Notes", "Dispatches from the bamboo groves of Lugu.", "At 800 meters, the oolong unfurls differently...", "journal", I["journal2"]),
        _p("ocean-journal", "The Sound of the Pacific", "Why the east coast changes everyone.", "There is a moment before dawn when the ocean turns silver...", "journal", I["journal3"]),
        _p("night-sky-guide", "Night Sky Guide", "Stargazing from our mountain properties.", "Lugu township is among the darkest places on the island...", "journal", I["star"]),
        _p("seasonal-foraging", "Seasonal Foraging", "What grows wild around our stays.", "March brings wild ginger shoots along the trails...", "journal", I["bamboo"]),
        _p("rain-day-rituals", "Rainy Day Rituals", "Embracing rain at our retreats.", "The monsoon is the main event here...", "journal", I["journal1"]),
        _p("local-artisans", "Meeting Local Artisans", "Craftspeople behind our stays.", "Mr. Chen has made bamboo baskets for forty years...", "journal", I["pottery"]),
        _p("cooking-with-hosts", "Cooking with Our Hosts", "Farm-to-table meals prepared together.", "Every host has a signature dish...", "journal", I["farmfood"]),
        _p("sunrise-collection", "Sunrise Collection", "The best sunrise from each property.", "Cloud Villa sees it at 5:42 in June...", "journal", I["sunrise"]),
        _p("winter-retreats", "Winter Retreats", "Why cold season is our favorite.", "When it drops below 15 degrees, the hot spring becomes transcendent...", "journal", I["hotspring"]),
    ],
    "brand": [
        _p("our-philosophy", "Our Philosophy", "Why inquiry-first over instant booking.", "A conversation before arrival makes all the difference...", "brand", I["brand1"]),
        _p("founding-story", "The Founding Story", "How Slowfield Stays began.", "It started with a single villa in Yilan and a question...", "brand", I["brand2"]),
        _p("design-principles", "Design Principles", "How we choose our properties.", "Every property must be quiet, honest in materials, and have a view worth waking for...", "brand", I["brand1"]),
        _p("sustainability", "Sustainability Commitment", "Responsible hospitality.", "No disposable amenities. Local sourcing within 30km...", "brand", I["bamboo"]),
        _p("host-program", "Host Program", "How owners join the collection.", "Our hosts are curators of experience...", "brand", I["brand2"]),
        _p("brand-identity", "Brand Identity", "Our visual language.", "Forest green from bamboo groves, warm brown from local cedar...", "brand", I["brand1"]),
        _p("partnerships", "Partnerships", "Local artisan collaborations.", "Tea farmers, ceramicists, weavers, and chefs across Taiwan...", "brand", I["pottery"]),
        _p("guest-promise", "The Guest Promise", "What every guest can expect.", "Privacy. Genuine hospitality. No cookie-cutter experiences...", "brand", I["brand2"]),
        _p("our-team", "Our Team", "The people behind Slowfield Stays.", "Designers, hospitality veterans, and culture enthusiasts...", "brand", I["brand1"]),
        _p("awards", "Awards & Recognition", "Industry acknowledgments.", "Featured in Monocle, BRUTUS Taiwan, nominated for Design Hotels Award...", "brand", I["news1"]),
    ],
    "activity": [
        _p("sunrise-hike", "Sunrise Hike", "Dawn trek through Xueshan foothills.", "A 90-minute hike starting at 4:30 AM...", "activity", I["hike"]),
        _p("tea-ceremony", "Tea Ceremony", "Private session with a tea master.", "Learn gongfu cha with Master Lin...", "activity", I["tea"]),
        _p("bamboo-weaving", "Bamboo Weaving", "Basket-making with a village artisan.", "Spend an afternoon learning traditional bamboo weaving...", "activity", I["bamboo"]),
        _p("ocean-kayaking", "Ocean Kayaking", "Explore the Hualien coast.", "Paddle along the Qingshui Cliffs...", "activity", I["kayak"]),
        _p("farm-visit", "Organic Farm Visit", "Harvest seasonal produce.", "Visit the Chang family organic farm...", "activity", I["farmfood"]),
        _p("night-fishing", "Night Fishing", "Traditional night fishing.", "Squid fishing under the stars...", "activity", I["fish"]),
        _p("pottery-class", "Pottery Workshop", "Create ceramics with local clay.", "Make your own tea cup at Ms. Huang studio...", "activity", I["pottery"]),
        _p("cycling-tour", "Cycling Tour", "Ride through rice paddies.", "A 25km ride through Dongshan rice paddies...", "activity", I["bike"]),
        _p("hot-spring-tour", "Hot Spring Discovery", "Visit three natural springs.", "From wild riverside pools to Japanese-era bathhouses...", "activity", I["hotspring"]),
        _p("stargazing", "Stargazing Session", "Guided astronomy night.", "Professional telescope at the darkest point of the property...", "activity", I["star"]),
    ],
    "dining": [
        _p("mountain-breakfast", "Mountain Breakfast", "Farm-sourced morning meals.", "Eggs from the neighbor, fresh bread, local coffee...", "dining", I["farmfood"]),
        _p("seafood-bbq", "Coastal Seafood BBQ", "Fresh-catch barbecue by the beach.", "The fisherman delivers the morning catch...", "dining", I["seafood"]),
        _p("tea-pairing", "Tea Pairing Dinner", "Five courses paired with local teas.", "Each dish paired with a different Taiwanese tea...", "dining", I["tea"]),
        _p("wild-herb-cooking", "Wild Herb Cooking", "Forage and cook mountain ingredients.", "Gather wild herbs then prepare three dishes...", "dining", I["farmfood"]),
        _p("farm-to-table", "Farm-to-Table", "Long-table dinner in the field.", "A guest chef using ingredients from within 5km...", "dining", I["noodle"]),
        _p("mochi-making", "Mochi Making", "Traditional Hakka mochi.", "Pound and shape mochi with a wooden mortar...", "dining", I["mochi"]),
        _p("coffee-roasting", "Coffee Roasting", "Roast your own beans.", "Pick ripe cherries and roast at 600m elevation...", "dining", I["coffee"]),
        _p("night-market", "Night Market Tour", "Guided walk through Luodong.", "Stories behind each iconic stall...", "dining", I["market"]),
        _p("private-chef", "Private Chef", "In-villa dining experience.", "Menus tailored to your preferences...", "dining", I["seafood"]),
        _p("wine-evening", "Wine & Cheese Evening", "Taiwanese craft wines.", "Local aged cheeses on the terrace at sunset...", "dining", I["hotpot"]),
    ],
    "service": [
        _p("airport-transfer", "Airport Transfer", "Private car from Taipei airports.", "Door-to-door from TPE or TSA...", "service", I["car"]),
        _p("concierge", "Concierge", "Personal trip planning.", "Restaurant reservations, activity bookings, transport...", "service", I["spa"]),
        _p("babysitting", "Babysitting", "Certified childcare.", "In-villa childcare so parents can relax...", "service", I["car"]),
        _p("spa-massage", "In-Villa Spa", "Professional massage.", "Swedish, deep tissue, or Taiwanese massage...", "service", I["spa"]),
        _p("laundry", "Laundry Service", "Same-day wash and fold.", "Drop off by 9 AM, back by 6 PM...", "service", I["car"]),
        _p("pet-care", "Pet Services", "Amenities for traveling pets.", "Pet beds, treats, local dog-walker...", "service", I["spa"]),
        _p("photography", "Photography", "Professional photo session.", "2-hour session, 30+ edited images...", "service", I["car"]),
        _p("celebration", "Celebration Setup", "Special occasion decorations.", "Flowers, champagne, cake, personalized decor...", "service", I["spa"]),
        _p("grocery", "Pre-Arrival Groceries", "Stock your kitchen.", "Send your list, everything ready on arrival...", "service", I["farmfood"]),
        _p("bike-rental", "E-Bike Rental", "Electric bicycles.", "GPS tablets with curated cycling routes...", "service", I["bike"]),
    ],
    "news": [
        _p("summer-2026", "Summer 2026 Openings", "Three new properties this summer.", "Taitung, Penghu, and Alishan highlands...", "news", I["news1"]),
        _p("design-award", "Design Award Win", "Recognized for sustainable design.", "2026 Taiwan Architecture Award...", "news", I["news2"]),
        _p("chef-collab", "Chef Collaboration", "Michelin-starred chef joins.", "Chef Yamamoto creates a limited menu...", "news", I["news1"]),
        _p("booking-update", "Updated Booking", "Inquiry process improved.", "Response within 2 hours on business days...", "news", I["news2"]),
        _p("eco-cert", "Green Certification", "All properties eco-certified.", "Silver-level Green Hotel from Taiwan EPA...", "news", I["news1"]),
        _p("winter-special", "Winter Special Rates", "Early bird pricing.", "15% off for bookings before October 31...", "news", I["news2"]),
        _p("monocle-feature", "Monocle Feature", "International press coverage.", "Asia editor spent a week visiting...", "news", I["news1"]),
        _p("community-event", "Community Gathering", "Annual hosts and guests event.", "December 14 at Cloud Villa...", "news", I["news2"]),
        _p("app-launch", "Mobile App Coming", "Dedicated guest app.", "Rebook, seasonal recs, member-only stays...", "news", I["news1"]),
        _p("spring-menu", "Spring Dining Menu", "New seasonal menus.", "Wild mountain vegetables, strawberries, river fish...", "news", I["news2"]),
    ],
  },

  "hejing": {
    "journal": [
        _p("dawn-at-the-pool", "泳池邊的清晨", "五點半的水面倒映著蘭陽平原的天色。", "沒有人比泳池更早醒來。水面靜得像一面鏡子...", "journal", I["sunrise"]),
        _p("yilan-rain", "宜蘭的雨季日記", "在雨中泡湯，聽屋簷滴水聲入睡。", "宜蘭的雨不是阻礙，而是一種節奏...", "journal", I["journal1"]),
        _p("rice-field-walk", "稻田間的散步", "冬山河畔的金色稻浪，每年六月最美。", "從禾境步行十分鐘就能走進稻田小徑...", "journal", I["journal2"]),
        _p("local-market-diary", "冬山市場日記", "凌晨四點的魚市場、六點的豆漿攤。", "跟著管家去逛冬山在地市場...", "journal", I["market"]),
        _p("kids-summer", "孩子的暑假", "泳池、抓蟲、放風箏的無限暑假。", "禾境的暑假是不看手機的那種...", "journal", I["journal3"]),
        _p("starry-pool-night", "星空泳池夜", "關掉所有燈，在泳池裡看銀河。", "每月農曆初一前後，是最佳觀星夜...", "journal", I["star"]),
        _p("autumn-yilan", "宜蘭的秋天", "溫泉季開始、柿子紅了、山嵐低垂。", "九月的宜蘭開始有了涼意...", "journal", I["journal1"]),
        _p("chef-host-story", "管家阿姨的手路菜", "每一道菜都是她媽媽教的。", "管家林阿姨的拿手菜是三星蔥油餅...", "journal", I["farmfood"]),
        _p("bicycle-dongshan", "腳踏車遊冬山", "沿著冬山河自行車道，一路到梅花湖。", "禾境備有四台電動自行車...", "journal", I["bike"]),
        _p("new-year-fireworks", "跨年夜紀實", "在泳池畔倒數，看遠方煙火點亮蘭陽平原。", "每年跨年，冬山的天空都特別安靜...", "journal", I["journal3"]),
    ],
    "brand": [
        _p("hejing-story", "禾境的故事", "一個在冬山長大的女生，回鄉蓋了一棟夢想中的房子。", "小時候在冬山河邊玩水的記憶...", "brand", I["brand1"]),
        _p("hejing-design", "設計理念", "以水為核心、以山為背景的空間哲學。", "建築師說，這裡的設計只有一個主角：水...", "brand", I["brand2"]),
        _p("hejing-sustainability", "永續承諾", "太陽能、雨水回收、在地食材。", "禾境的泳池用太陽能加熱...", "brand", I["bamboo"]),
        _p("hejing-hospitality", "管家服務", "不打擾的溫暖，需要時隨時在。", "我們的管家不會一直出現...", "brand", I["brand1"]),
        _p("hejing-architecture", "建築巡禮", "清水模、落地窗、無邊際設計。", "建築師選用清水混凝土...", "brand", I["brand2"]),
        _p("hejing-local-ties", "在地連結", "與冬山農夫、漁夫、職人的合作。", "禾境的早餐來自步行可達的農場...", "brand", I["farmfood"]),
        _p("hejing-guest-reviews", "房客心聲", "來自世界各地旅人的真實評價。", "一對日本夫婦說這裡像峇里島...", "brand", I["brand1"]),
        _p("hejing-awards", "獲獎紀錄", "宜蘭好民宿金獎、國際設計雜誌推薦。", "2025 年獲宜蘭縣政府好民宿評選金獎...", "brand", I["news1"]),
        _p("hejing-future", "未來計畫", "第二棟別墅預計 2027 年開幕。", "我們正在冬山河對岸興建第二棟...", "brand", I["brand2"]),
        _p("hejing-name-meaning", "名字的由來", "「禾」是稻禾，「境」是一方自成的天地。", "禾境，是雲端的承諾...", "brand", I["brand1"]),
    ],
    "activity": [
        _p("pool-yoga", "泳池瑜伽", "清晨六點半的水上瑜伽課程。", "由宜蘭在地瑜伽老師帶領...", "activity", I["surf"]),
        _p("dongshan-river-sup", "冬山河 SUP", "立槳衝浪探索冬山河祕境。", "從禾境出發十分鐘即達 SUP 起點...", "activity", I["kayak"]),
        _p("yilan-surfing", "外澳衝浪", "頭城外澳海灘的衝浪體驗。", "車程 40 分鐘即達宜蘭最佳浪點...", "activity", I["surf"]),
        _p("rice-planting", "插秧體驗", "春天限定的稻田插秧活動。", "穿上青蛙裝踩進泥巴田...", "activity", I["farmfood"]),
        _p("lantern-making", "燈籠 DIY", "手作宜蘭傳統紙燈籠。", "在地師傅教你從竹骨開始做起...", "activity", I["pottery"]),
        _p("night-market-walk", "羅東夜市散策", "管家帶路的美食巡禮。", "管家私藏的十個攤位路線...", "activity", I["market"]),
        _p("whale-watching", "龜山島賞鯨", "四至九月限定的海上行程。", "從烏石港出發前往龜山島海域...", "activity", I["kayak"]),
        _p("scallion-farm", "三星蔥農場", "自己拔蔥、洗蔥、做蔥油餅。", "三星蔥的白色部分特別長...", "activity", I["farmfood"]),
        _p("plum-lake-cycling", "梅花湖騎行", "環湖自行車道的悠閒午後。", "全長 4 公里的平坦環湖步道...", "activity", I["bike"]),
        _p("hot-spring-jiaoxi", "礁溪溫泉半日遊", "車程 30 分鐘的溫泉小旅行。", "管家推薦三間風格不同的湯屋...", "activity", I["hotspring"]),
    ],
    "dining": [
        _p("poolside-bbq", "池畔 BBQ", "傍晚時分的池畔燒烤晚宴。", "使用在地食材的戶外燒烤體驗...", "dining", I["seafood"]),
        _p("seafood-basket", "海鮮籃", "大溪漁港直送的新鮮海產。", "每日清晨由漁夫送達...", "dining", I["fish"]),
        _p("scallion-pancake", "手作蔥油餅", "管家教你做正宗三星蔥油餅。", "從揉麵開始的療癒過程...", "dining", I["mochi"]),
        _p("breakfast-basket", "晨光早餐籃", "每日不同的在地早餐組合。", "小農鮮奶、手工麵包、季節水果...", "dining", I["farmfood"]),
        _p("afternoon-tea", "午茶時光", "宜蘭在地甜點與手沖咖啡。", "諾貝爾奶凍、花生捲冰淇淋...", "dining", I["coffee"]),
        _p("hotpot-night", "火鍋之夜", "冬季限定的在地食材火鍋。", "使用鹿野放山雞、三星蔥...", "dining", I["hotpot"]),
        _p("sake-pairing", "清酒之夜", "日本清酒搭配宜蘭海鮮。", "六款精選清酒配六道海鮮料理...", "dining", I["seafood"]),
        _p("kids-cooking", "親子廚房", "讓孩子們動手做的簡單料理。", "餃子、飯糰、水果沙拉...", "dining", I["mochi"]),
        _p("farmers-lunch", "農夫午餐", "在稻田旁享用的簡單便當。", "竹編便當盒裝著季節飯糰...", "dining", I["farmfood"]),
        _p("starlight-dinner", "星光晚餐", "夏季限定的屋頂露天晚宴。", "在三樓露台搭設長桌...", "dining", I["noodle"]),
    ],
    "service": [
        _p("butler-service", "私人管家", "入住期間全程管家服務。", "管家會在入住前致電了解需求...", "service", I["spa"]),
        _p("airport-pickup", "機場接送", "台北到宜蘭的專車服務。", "賓士 V-Class 舒適接送...", "service", I["car"]),
        _p("baby-amenities", "嬰幼兒備品", "嬰兒床、澡盆、消毒鍋免費借用。", "事先告知即備妥...", "service", I["car"]),
        _p("pool-party-setup", "泳池派對佈置", "生日或紀念日的驚喜佈置。", "氣球、鮮花、蛋糕、投影...", "service", I["spa"]),
        _p("laundry-hejing", "洗衣服務", "當日洗滌、烘乾、折疊。", "早上交付，傍晚取回...", "service", I["car"]),
        _p("pet-friendly", "寵物友善", "為毛孩準備的專屬備品。", "寵物床、碗、零食、附近散步路線...", "service", I["spa"]),
        _p("photo-session", "旅拍服務", "專業攝影師到府拍攝。", "2 小時全家福或情侶寫真...", "service", I["car"]),
        _p("grocery-prep", "食材代購", "入住前幫你備好冰箱。", "提供代購清單，我們幫你張羅...", "service", I["farmfood"]),
        _p("ebike", "電動自行車", "免費借用電動自行車。", "備有四台，含安全帽與路線圖...", "service", I["bike"]),
        _p("late-checkout", "延遲退房", "最晚可延至下午兩點。", "視當日訂房狀況，可免費延遲...", "service", I["spa"]),
    ],
    "news": [
        _p("hejing-grand-opening", "禾境正式開幕", "歷時兩年打造，禾境正式對外營運。", "2025 年 12 月 1 日開始接受預約...", "news", I["news1"]),
        _p("hejing-media-review", "媒體報導彙整", "多家旅遊媒體的實地採訪報導。", "Shopping Design、TRAVELER Luxe 聯合推薦...", "news", I["news2"]),
        _p("hejing-summer-event", "夏日池畔音樂會", "七月每週六的池畔 Live 演出。", "邀請獨立樂團在泳池畔演出...", "news", I["news1"]),
        _p("hejing-chef-residency", "駐館主廚計畫", "每月邀請不同主廚進駐。", "三月駐館主廚是台南知名甜點師...", "news", I["news2"]),
        _p("hejing-eco-award", "綠色民宿認證", "獲得宜蘭縣環保局綠色住宿認證。", "太陽能板、雨水回收系統...", "news", I["news1"]),
        _p("hejing-winter-package", "冬季暖湯方案", "含溫泉體驗的冬季住宿方案。", "入住即贈礁溪雙人湯屋券...", "news", I["news2"]),
        _p("hejing-pet-upgrade", "寵物友善升級", "新增寵物專屬草皮與清洗站。", "戶外新闢 30 坪寵物活動區...", "news", I["news1"]),
        _p("hejing-anniversary", "一週年感謝祭", "感謝首年所有房客的支持。", "一週年期間入住享九折優惠...", "news", I["news2"]),
        _p("hejing-new-room", "新房型公告", "閣樓房正式開放預約。", "由舊穀倉改建的工業風空間...", "news", I["news1"]),
        _p("hejing-spring-plan", "春季活動預告", "插秧體驗、螢火蟲季即將登場。", "四月至五月的期間限定活動...", "news", I["news2"]),
    ],
  },

  "hejing-ridge": {
    "journal": [
        _p("fog-morning", "霧中醒來", "推開窗只看見白色，然後竹林慢慢浮現。", "山嵐的早晨是慢動作的...", "journal", I["journal1"]),
        _p("fireplace-diary", "壁爐日記", "冬夜裡的火光、紅酒、與一本書。", "石屋的壁爐用的是在地相思木...", "journal", I["journal2"]),
        _p("bamboo-trail-walk", "竹林小徑散步", "一條只有住客知道的秘密步道。", "從茶寮後方的小門出去...", "journal", I["bamboo"]),
        _p("tea-farmer-visit", "拜訪茶農阿伯", "跟著種了五十年茶的老先生上山。", "凌晨五點跟著阿伯走進茶園...", "journal", I["tea"]),
        _p("night-sounds", "山裡的夜聲", "蟲鳴、溪流、偶爾的山羌叫聲。", "關掉所有燈光，山嵐的夜才真正開始...", "journal", I["star"]),
        _p("rainy-season-beauty", "梅雨季的美", "整座山在雨中變得翠綠欲滴。", "南投的梅雨季不是壞天氣...", "journal", I["waterfall"]),
        _p("seasonal-changes", "四季山嵐", "春櫻、夏螢、秋楓、冬霧。", "同一個窗景，四季截然不同...", "journal", I["journal3"]),
        _p("stone-wall-story", "石牆的故事", "每一塊石頭都是從溪邊搬來的。", "石屋的牆面花了六個月手工疊砌...", "journal", I["journal1"]),
        _p("mountain-cooking", "山裡的料理", "用山泉水煮飯、用柴火燒菜。", "山嵐的廚房有一口傳統灶...", "journal", I["farmfood"]),
        _p("leaving-the-mountain", "下山的時候", "離開山嵐回到城市的心情。", "每個離開的人都說他們會回來...", "journal", I["journal2"]),
    ],
    "brand": [
        _p("ridge-origin", "山嵐的誕生", "一個建築師在鹿谷買了一塊廢棄茶園。", "他花了五年把這塊地變成三棟建築...", "brand", I["brand1"]),
        _p("ridge-philosophy", "山嵐哲學", "少即是多，慢即是快。", "山嵐的設計原則很簡單：不做多餘的事...", "brand", I["brand2"]),
        _p("ridge-materials", "建材的故事", "在地石材、回收木料、手工燒製磚瓦。", "所有建材都來自半徑 20 公里內...", "brand", I["brand1"]),
        _p("ridge-ecology", "生態保育", "與山共生的建築理念。", "樹屋設計的第一原則：不砍樹...", "brand", I["bamboo"]),
        _p("ridge-tea-culture", "茶文化傳承", "與鹿谷茶農的深度合作。", "山嵐的每一杯茶都來自步行可達的茶園...", "brand", I["tea"]),
        _p("ridge-artisan-network", "職人網絡", "木匠、石匠、竹藝師的協作。", "山嵐的每一個細節都出自職人之手...", "brand", I["pottery"]),
        _p("ridge-guest-words", "住客的話", "來自山裡的真實聲音。", "一位作家在這裡完成了她的小說...", "brand", I["brand2"]),
        _p("ridge-seasonal-plan", "季節營運", "春夏秋冬各有不同的開放方式。", "冬季僅開放石屋，因為壁爐最暖...", "brand", I["brand1"]),
        _p("ridge-future-vision", "未來願景", "第二期計畫：溪谷冥想中心。", "預計 2028 年完工的冥想空間...", "brand", I["brand2"]),
        _p("ridge-name-meaning", "名字的含義", "Hejing 是承諾，Ridge 是山脊。", "禾境·山嵐，是山脊上的承諾...", "brand", I["brand1"]),
    ],
    "activity": [
        _p("bamboo-forest-hike", "竹林健行", "穿越千竿翠竹的兩小時步道。", "這條步道平時只有茶農在走...", "activity", I["bamboo"]),
        _p("tea-picking", "採茶體驗", "跟著茶農一起採收高山烏龍。", "戴上斗笠、背上茶簍...", "activity", I["tea"]),
        _p("firefly-watching", "螢火蟲季", "四月至五月的夜間生態導覽。", "山嵐附近有三處螢火蟲棲地...", "activity", I["firefly"]),
        _p("waterfall-trek", "瀑布探險", "前往鹿谷秘境瀑布的半日行程。", "需要溯溪涉水的野性路線...", "activity", I["waterfall"]),
        _p("charcoal-making", "炭窯體驗", "傳統相思木炭的燒製過程。", "鹿谷曾是台灣最大的木炭產地...", "activity", I["hike"]),
        _p("bird-watching", "賞鳥導覽", "跟著生態老師辨認山中鳥類。", "藍腹鷴、五色鳥、台灣藍鵲...", "activity", I["journal2"]),
        _p("meditation-session", "森林冥想", "在竹林中的引導式冥想。", "坐在竹林間的石頭上，聽風穿過竹葉...", "activity", I["bamboo"]),
        _p("pottery-ridge", "陶藝體驗", "用南投在地陶土手作茶杯。", "窯場就在山嵐步行十分鐘的地方...", "activity", I["pottery"]),
        _p("night-star-tour", "夜觀星空", "海拔 800 公尺的無光害觀星。", "配備專業天文望遠鏡...", "activity", I["star"]),
        _p("hot-spring-wild", "野溪溫泉", "前往南投秘境野溪溫泉。", "需要四輪驅動車才能到達的隱世秘湯...", "activity", I["hotspring"]),
    ],
    "dining": [
        _p("mountain-hotpot", "山中火鍋", "用山泉水熬的昆布鍋底配山產。", "冬季限定的圍爐火鍋體驗...", "dining", I["hotpot"]),
        _p("tea-cuisine", "茶料理", "用茶入菜的創意料理。", "烏龍茶燻雞、茶葉蛋、抹茶甜點...", "dining", I["tea"]),
        _p("bamboo-rice", "竹筒飯", "在竹林裡現做的傳統竹筒飯。", "用新鮮的孟宗竹裝入糯米與配料...", "dining", I["bamboo"]),
        _p("foraging-lunch", "採集午餐", "採集野菜後的現煮料理。", "跟著生態老師辨認可食植物...", "dining", I["farmfood"]),
        _p("fireside-dinner", "壁爐晚餐", "石屋壁爐旁的溫暖冬夜晚宴。", "慢燉牛肉、烤根莖蔬菜...", "dining", I["noodle"]),
        _p("tea-ceremony-meal", "茶席料理", "結合茶道的多道式料理。", "每道菜搭配一款在地茶品...", "dining", I["tea"]),
        _p("farm-breakfast", "農家早餐", "在地農夫送來的現採蔬果早餐。", "有機蛋、現烤地瓜、山苦瓜汁...", "dining", I["farmfood"]),
        _p("mochi-ridge", "搗麻糬體驗", "用木臼搗出 Q 彈客家麻糬。", "南投鹿谷的客家文化體驗...", "dining", I["mochi"]),
        _p("coffee-mountain", "山間咖啡", "海拔 600 公尺的手沖咖啡體驗。", "使用南投在地種植的阿拉比卡豆...", "dining", I["coffee"]),
        _p("wine-fireplace", "壁爐紅酒夜", "精選紅酒搭配在地起司。", "窩在壁爐前品嚐台灣與法國紅酒...", "dining", I["hotpot"]),
    ],
    "service": [
        _p("mountain-transfer", "山區接駁", "台中高鐵站到鹿谷的專車。", "四輪驅動休旅車安全上山...", "service", I["car"]),
        _p("concierge-ridge", "旅遊管家", "在地行程規劃與活動預約。", "管家熟悉鹿谷每一條步道...", "service", I["spa"]),
        _p("hot-spring-booking", "湯屋預約", "代訂南投周邊特色溫泉。", "從秘境野溪到日式湯屋...", "service", I["hotspring"]),
        _p("tea-gift-box", "茶禮盒", "客製在地茶葉伴手禮。", "與茶農合作的限量禮盒...", "service", I["tea"]),
        _p("fireplace-prep", "壁爐服務", "冬季免費提供壁爐用木柴。", "管家會在入住前備好木柴...", "service", I["car"]),
        _p("rainy-day-kit", "雨天套組", "雨鞋、雨衣、雨傘免費借用。", "南投多雨，我們備好一切...", "service", I["spa"]),
        _p("photo-mountain", "山林攝影", "專業攝影師帶你拍竹林秘境。", "在地攝影師熟知每個角度...", "service", I["car"]),
        _p("meditation-guide", "冥想引導", "預約專業冥想老師到場。", "在竹林或溪邊進行引導式靜心...", "service", I["spa"]),
        _p("hiking-gear", "登山裝備", "登山杖、頭燈、護膝免費借用。", "讓你輕裝上山...", "service", I["hike"]),
        _p("late-checkout-ridge", "延遲退房", "山裡不趕時間，最晚下午三點。", "多待幾個小時享受寧靜...", "service", I["spa"]),
    ],
    "news": [
        _p("ridge-soft-opening", "山嵐試營運公告", "2026 年三月開始接受預約。", "樹屋與茶寮率先開放...", "news", I["news1"]),
        _p("ridge-treehouse-complete", "樹屋完工", "歷時三年打造的樹冠層建築。", "建築師親手栓上最後一根螺絲...", "news", I["news2"]),
        _p("ridge-firefly-season", "螢火蟲季開跑", "四月中旬至五月底的限定體驗。", "山嵐周邊是南投最佳賞螢點...", "news", I["news1"]),
        _p("ridge-tea-collab", "茶農合作計畫", "與百年茶園簽訂獨家合作。", "住客可品嚐到市面上買不到的限量茶...", "news", I["news2"]),
        _p("ridge-eco-award", "生態建築獎", "獲得 2026 台灣永續建築獎。", "評審特別表揚了不傷害老樹的設計...", "news", I["news1"]),
        _p("ridge-autumn-special", "秋季限定方案", "含採茶體驗的兩天一夜方案。", "十月至十一月限定...", "news", I["news2"]),
        _p("ridge-stone-lodge-open", "石屋開放預約", "第三棟建築正式完工。", "冬暖夏涼的半穴居空間...", "news", I["news1"]),
        _p("ridge-winter-fireplace", "冬季壁爐套餐", "含晚餐紅酒的冬季限定方案。", "十二月至二月的專屬優惠...", "news", I["news2"]),
        _p("ridge-meditation-retreat", "冥想退修營", "三天兩夜的深度靜心體驗。", "每季舉辦一次，限額八人...", "news", I["news1"]),
        _p("ridge-spring-bloom", "春季花訊", "櫻花、杜鵑、油桐花開。", "三月至五月的山嵐花況報告...", "news", I["news2"]),
    ],
  },
}

# ═══════════════════════════════════════════════════════════════════════════
#  API CLIENT
# ═══════════════════════════════════════════════════════════════════════════

class Api:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.c = httpx.Client(timeout=30.0)
        self.token = None

    def _h(self, slug=None):
        h = {}
        if self.token: h["Authorization"] = f"Bearer {self.token}"
        if slug: h["X-Site-Slug"] = slug
        return h

    def login(self, email, pw):
        r = self.c.post(f"{self.base}/auth/login", json={"email": email, "password": pw})
        if r.status_code != 200: print(f"  Login failed: {r.status_code} {r.text}"); sys.exit(1)
        d = r.json(); self.token = d.get("access_token") or d.get("token"); print(f"  Logged in as {email}")

    def get_sites(self):
        return self.c.get(f"{self.base}/admin/sites", headers=self._h()).json()

    def create_site(self, p):
        r = self.c.post(f"{self.base}/admin/sites", json=p, headers=self._h())
        if r.status_code == 409:
            print(f"  Site '{p['slug']}' exists, finding...")
            for s in self.get_sites():
                if s["slug"] == p["slug"]: return s
            return {"id": None, "slug": p["slug"]}
        r.raise_for_status(); d = r.json(); print(f"  Created: {d.get('name')} (id={d.get('id')})"); return d

    def update_site(self, sid, p):
        r = self.c.put(f"{self.base}/admin/sites/{sid}", json=p, headers=self._h())
        if r.status_code == 200: return r.json()
        return {}

    def create_banner(self, slug, p):
        r = self.c.post(f"{self.base}/admin/cms/banners?site={slug}", json=p, headers=self._h(slug))
        r.raise_for_status(); return r.json()

    def create_stay(self, slug, p):
        r = self.c.post(f"{self.base}/admin/stays?site={slug}", json=p, headers=self._h(slug))
        if r.status_code == 409: print(f"    Stay '{p['slug']}' exists"); return {}
        r.raise_for_status(); return r.json()

    def create_page(self, slug, p):
        r = self.c.post(f"{self.base}/admin/cms/pages?site={slug}", json=p, headers=self._h(slug))
        if r.status_code == 409: print(f"    Page '{p['slug']}' exists"); return {}
        r.raise_for_status(); return r.json()

# ═══════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════

def seed(api_url, email, password, skip_parent=False):
    api = Api(api_url)
    print("\n1. Login"); api.login(email, password)

    print("\n2. Creating sites")
    parent_id = None; sites = []
    for i, sd in enumerate(SITES_DEF):
        p = {k: sd[k] for k in ("name","slug","domain","default_locale","primary_color","accent_color","contact_email","contact_line","seo_title","seo_description") if k in sd}
        p["is_template"] = sd.get("is_template", False)
        p["settings"] = sd.get("settings", {})
        if i == 0:
            if skip_parent:
                print(f"  Skipping parent '{sd['slug']}'")
                for s in api.get_sites():
                    if s["slug"] == sd["slug"]: parent_id = s["id"]; sites.append((sd["slug"], s)); break
                continue
            r = api.create_site(p); parent_id = r.get("id")
        else:
            p["parent_site_id"] = parent_id; r = api.create_site(p)
        sites.append((sd["slug"], r))
        if r.get("id") and sd.get("settings"):
            api.update_site(r["id"], {"settings": sd["settings"]})

    print(f"\n3. Seeding unique content for {len(sites)} sites")
    for slug, data in sites:
        sid = data.get("id")
        if not sid: print(f"\n  Skip {slug}"); continue
        name = data.get("name", slug)
        print(f"\n  ═══ {name} ({slug}) ═══")

        # Banners
        blist = BANNERS.get(slug, [])
        print(f"  Banners: {len(blist)}"); [api.create_banner(slug, b) for b in blist]

        # Stays
        slist = STAYS.get(slug, [])
        print(f"  Stays: {len(slist)}"); [api.create_stay(slug, s) for s in slist]

        # Pages by type
        site_pages = PAGES.get(slug, {})
        total = 0
        for ctype, plist in site_pages.items():
            ct = 0
            for pg in plist:
                pg["sort_order"] = ct; pg["tags"] = pg.get("tags", [])
                api.create_page(slug, pg); ct += 1
            print(f"  {ctype}: {ct}"); total += ct

        # Experience + Privacy
        api.create_page(slug, _p("experience", f"{name} Experience", "A slower way to stay.", "Every stay begins with a conversation.", "experience", BANNERS[slug][0]["image_url"] if BANNERS.get(slug) else I["hero_brand"]))
        api.create_page(slug, _p("privacy", "Privacy Policy", "How we handle your data.", "Your data is used solely to process stay requests.", "privacy", ""))
        total += 2
        print(f"  experience + privacy: 2")
        print(f"  Total pages: {total}")

    print("\n" + "=" * 60)
    print("SEED COMPLETE — All content unique per site")
    print("=" * 60)
    for slug, d in sites:
        sp = PAGES.get(slug, {})
        pc = sum(len(v) for v in sp.values()) + 2
        print(f"  {d.get('name',slug)}: {len(BANNERS.get(slug,[]))} banners, {len(STAYS.get(slug,[]))} stays, {pc} pages")

if __name__ == "__main__":
    pa = argparse.ArgumentParser()
    pa.add_argument("--api", required=True); pa.add_argument("--email", required=True)
    pa.add_argument("--password", required=True); pa.add_argument("--skip-parent", action="store_true")
    a = pa.parse_args(); seed(a.api, a.email, a.password, a.skip_parent)
