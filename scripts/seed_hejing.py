"""
Populate the production 禾境 child site (id=2) on www.slowfield.example
with content modeled after the external reference https://slowfield.example.

Reads ADMIN_EMAIL and ADMIN_PASSWORD from environment, never from disk.

Flow:
  1. POST /api/v1/auth/login  ->  Bearer token
  2. GET  /api/v1/admin/sites/2  ->  preserve homepage / nav / booking / theme / contact
  3. Build settings.pages with 8 default-key entries (news, about, space, experience,
     pricing, contact, faq, articles) populated from reference content
  4. PUT  /api/v1/admin/sites/2

All names, addresses and contacts are fictional (a showcase villa for the
Slowfield Stays demo). The brand positioning ("禾 = rice, 境 = a realm of
its own") needs to stay readable, so blocks use rich_text rather than
splitting into multiple sub-blocks.
"""
import json
import os
import sys
import urllib.request
import urllib.error

BASE = "https://www.slowfield.example/api/v1"
SITE_ID = 2

ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]


def req(method, path, *, token=None, body=None, headers=None):
    h = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) seed-hejing"}
    if headers:
        h.update(headers)
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(f"{BASE}{path}", data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        return e.code, raw


def login() -> str:
    code, body = req("POST", "/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if code != 200:
        sys.exit(f"login failed [{code}]: {body}")
    return body["access_token"]


# ── Page block factories ────────────────────────────────────────────────

def rt(block_id: str, heading: dict, body: dict, eyebrow: dict | None = None, anchor: str | None = None) -> dict:
    cfg: dict = {"heading": heading, "body": body}
    if eyebrow:
        cfg["eyebrow"] = eyebrow
    if anchor:
        cfg["anchor"] = anchor
    return {"id": block_id, "type": "rich_text", "enabled": True, "config": cfg}


# Hero images — picked from /admin/media after visually sampling the library
HERO = {
    "home":       "/storage/media/f81ba9f3cef545a283c01645ca7f0467.jpg",  # pool + reader
    "about":      "/storage/media/14e5c38be51a41179f58f95f043ababe.jpg",  # brand wall quote
    "space":      "/storage/media/1e3a48a1779d402886aea3aa9eee54ab.jpg",  # luxe master + bath
    "experience": "/storage/media/b7b36db8036a4cfb97947cdb5ab43173.jpg",  # KTV / theatre living
    "pricing":    "/storage/media/009b889601f545b4a626700f6c942762.jpg",  # twin bedroom
    "contact":    "/storage/media/01c55db29f2a4189a8e77f53d9df3366.jpg",  # villa collage
    "faq":        "/storage/media/0cd50870e5ca4c3d8557dfc1dc37887b.jpg",  # open living
}


def contact_info(block_id: str, eyebrow: dict | None = None, anchor: str | None = None) -> dict:
    # BlockContactInfo supports map_embed (Google Maps iframe) + a multi-line
    # bilingual directions field — use them instead of a separate rich_text.
    map_iframe = (
        '<iframe src="https://www.google.com/maps?q='
        "%E5%AE%9C%E8%98%AD%E7%B8%A3%E5%86%AC%E5%B1%B1%E9%84%89"
        '&output=embed"></iframe>'
    )
    cfg: dict = {}
    if eyebrow:
        cfg["eyebrow"] = eyebrow
    if anchor:
        cfg["anchor"] = anchor
    return {
        "id": block_id,
        "type": "contact_info",
        "enabled": True,
        "config": {
            **cfg,
            "title": {"zh": "交通與聯繫", "en": "Contact & Directions"},
            "address": {"zh": "26950 宜蘭縣冬山鄉禾風路 1 號", "en": "No. 1, Hefeng Rd., Dongshan Township, Yilan County 26950"},
            "phone": "03-000-0000",
            "email": "hello@slowfield.example",
            "line": "@slowfield",
            "map_embed": map_iframe,
            "directions": {
                "zh": (
                    "自駕：國道五號羅東或蘇澳交流道下，約 10 分鐘抵達；館外提供 10 格免費戶外停車位。\n"
                    "火車：羅東 / 冬山 / 蘇澳新站下車，轉乘計程車約 10–15 分鐘。\n"
                    "客運：羅東後站轉計程車或於附近租車。\n"
                    "Google Maps 可搜尋「禾境」或「冬山鄉禾風路 1 號」。"
                ),
                "en": (
                    "By car: exit Freeway 5 at Luodong or Su'ao, about 10 minutes to arrival. 10 free outdoor parking bays on-site.\n"
                    "By rail: alight at Luodong, Dongshan or Su'ao-Xin, 10–15 minutes by taxi.\n"
                    "By bus: transfer from Luodong Station by taxi or local rental.\n"
                    "Google Maps: search \"禾境\" or \"No. 1, Hefeng Rd., Dongshan\"."
                ),
            },
        },
    }


def feature_badges(block_id: str) -> dict:
    items = [
        ("pool", {"zh": "14 米中庭泳池", "en": "14m courtyard pool"}),
        ("pet", {"zh": "寵物友善", "en": "Pet friendly"}),
        ("family", {"zh": "親子友善", "en": "Family friendly"}),
        ("elderly", {"zh": "長者友善", "en": "Elder friendly"}),
        ("elevator", {"zh": "電梯", "en": "Elevator"}),
        ("parking", {"zh": "免費停車 10 格", "en": "10 free parking bays"}),
        ("ktv", {"zh": "戲院級 KTV", "en": "Theatre-grade KTV"}),
        ("bbq", {"zh": "美式烤爐", "en": "BBQ grill"}),
        ("chef", {"zh": "管家私廚", "en": "Concierge dining"}),
        ("wifi", {"zh": "高速 Wi-Fi", "en": "High-speed Wi-Fi"}),
    ]
    return {
        "id": block_id,
        "type": "feature_badges",
        "enabled": True,
        "config": {
            "title": {"zh": "設施一覽", "en": "Amenities"},
            "items": [{"icon": icon, "label": label} for icon, label in items],
        },
    }


def image_gallery(block_id: str, title: dict, images: list, columns: int = 2) -> dict:
    return {
        "id": block_id,
        "type": "image_gallery",
        "enabled": True,
        "config": {"title": title, "columns": columns, "images": images},
    }


# Media reference (visually sampled from /admin/media). Reused across sections.
M = {
    "pool_reader":  "/storage/media/f81ba9f3cef545a283c01645ca7f0467.jpg",  # pool + reader / hero
    "brand_wall":   "/storage/media/14e5c38be51a41179f58f95f043ababe.jpg",  # bright brand wall
    "master_bath":  "/storage/media/1e3a48a1779d402886aea3aa9eee54ab.jpg",  # luxe master + bath
    "ktv_lounge":   "/storage/media/b7b36db8036a4cfb97947cdb5ab43173.jpg",  # KTV/theatre living
    "twin_room":    "/storage/media/009b889601f545b4a626700f6c942762.jpg",  # twin bedroom
    "villa_collage":"/storage/media/01c55db29f2a4189a8e77f53d9df3366.jpg",  # exterior collage
    "open_living":  "/storage/media/0cd50870e5ca4c3d8557dfc1dc37887b.jpg",  # white open living
    "paddy_dining": "/storage/media/67af48238a894819880b1c713efc2af1.jpg",  # paddy-view dining
}


def faq_accordion(block_id: str, anchor: str | None = None) -> dict:
    items = [
        ("入住保證金", "完成訂房後需依約定支付保證金，退房當日經管家檢查設施完好後全額退還。"),
        ("入住 / 退房時間", "入住 16:00，退房 11:00。如需早入住或晚退房請於訂房時提出，依現場可行性安排。"),
        ("房型配置", "AB 雙棟，每棟 2 間雙人房 + 2 間四人房，標準入住 12 人。"),
        ("加床說明", "單包棟與雙包棟皆可加床，每位加收 NT$1,300。"),
        ("訪客入館", "訪客需事先告知管家並登記，不得留宿。"),
        ("停車場設施", "館外免費戶外停車位 10 格，先到先停。"),
        ("館內設備", "戲院級 KTV、Netflix、電動麻將桌、三合一撞球桌、飛鏢機、多款桌遊。"),
        ("中庭泳池", "南洋風 14 米景觀泳池，恆溫設備依季節啟用，使用時段請參考現場公告。"),
        ("整潔維護", "請維持館內整潔，廚房使用後請自行收整，垃圾請分類。"),
        ("取消政策", "依官方訂房規範執行，特殊情況請洽官方 LINE。"),
        ("備品供應", "盥洗備品、毛巾、吹風機皆有提供；自選沐浴香氛位於香氛櫃自由選用。"),
        ("寵物規範", "寵物友善，每隻收特別清潔費 NT$1,000，需全程管理避免影響其他賓客。"),
        ("烤肉與外燴規範", "美式烤爐租借每次 NT$1,000（贈米其林指定海鹽一盒）；外燴與燒烤車請事先預約。"),
        ("發票", "可開立統一發票或公司報帳發票，請於訂房時告知抬頭與統編。"),
        ("禁菸", "館內全區禁菸，吸菸請至指定戶外區域。"),
        ("嬰兒與長者用品", "提供嬰兒床、餐椅與長者友善備品，請於訂房時告知需求。"),
        ("電梯使用規定", "電梯為館內共用設施，禁止兒童單獨乘坐並請依承載限制使用。"),
        ("KTV及放煙火規定", "KTV 使用時段 09:00-22:00；嚴禁於館內施放煙火與爆竹。"),
    ]
    cfg = {
        "title": {"zh": "入住須知", "en": "House Rules"},
        "items": [{"question": {"zh": q, "en": q}, "answer": {"zh": a, "en": a}} for q, a in items],
    }
    if anchor:
        cfg["anchor"] = anchor
    return {
        "id": block_id,
        "type": "faq_accordion",
        "enabled": True,
        "config": cfg,
    }


# ── Pages composition ───────────────────────────────────────────────────

PAGES = {
    "news": {
        "label": {"zh": "最新活動", "en": "News"},
        "page_type": "cms_list",
        "content_type": "news",
        "sort_order": 0,
        "visible": True,
        "blocks": [],
        "seo": {"title": {"zh": "最新活動｜禾境", "en": "News | Hejing Villa"}},
    },
    "about": {
        "label": {"zh": "關於品牌", "en": "About"},
        "page_type": "blocks",
        "sort_order": 1,
        "visible": True,
        "hero_image": HERO["about"],
        "hero_height": "large",
        "hero_title_color": "#ffffff",
        "hero_subtitle_color": "#ffffff",
        "hero_title": {"zh": "關於品牌", "en": "About"},
        "hero_subtitle": {"zh": "在稻浪之間，安靜地度假", "en": "Quiet luxury among the rice fields"},
        "blocks": [
            rt(
                "about-brand",
                heading={"zh": "關於 禾境", "en": "About Hejing Villa"},
                eyebrow={"zh": "Brand", "en": "Brand"},
                body={
                    "zh": (
                        "Hejing Villa 禾境｜宜蘭冬山泳池精品民宿，坐落於宜蘭冬山鄉靜謐田園之中，"
                        "是 Slowfield Stays 慢域旅宿集團旗下的輕奢精品民宿品牌。\n\n"
                        "「禾」是稻禾，「境」是一方自成的天地。四季從窗外看稻子由青轉金，日子也跟著稻子的節奏慢下來。\n\n"
                        "禾境是一座專屬於您的私人度假寓所，提供全客製化的管家服務，"
                        "以「在稻浪之間，安靜地度假」為品牌核心。在禾境，每一刻都只屬於你們這一群人。"
                    ),
                    "en": (
                        "Hejing Villa is a quiet-luxury pool villa tucked into the Dongshan countryside of Yilan, "
                        "part of the Slowfield Stays collection.\n\n"
                        "\"He\" is the rice plant, \"jing\" a realm of its own: a private retreat where "
                        "the days slow to the rhythm of the paddies.\n\n"
                        "Every stay is a fully managed villa take-over with a dedicated host, designed around "
                        "high-privacy, high-touch leisure."
                    ),
                },
            ),
            rt(
                "about-collection",
                heading={"zh": "關於 慢域旅宿", "en": "About Slowfield Stays"},
                eyebrow={"zh": "Collection", "en": "Collection"},
                body={
                    "zh": (
                        "慢域旅宿（Slowfield Stays）由擁有 30 年飯店管理經驗的專業團隊創立，"
                        "專注於精品民宿品牌管理與旅宿投資整合。\n\n"
                        "我們以「讓世界住進台灣在地的美好」為願景，結合飯店級服務標準、在地生活美學與精選空間設計，"
                        "打造值得收藏的度假體驗。\n\n"
                        "透過標準化營運、管家式接待與在地體驗策展，讓每一次入住，不只是住宿，而是一段會讓人想再回來的旅行記憶。"
                    ),
                    "en": (
                        "Slowfield Stays is founded by hospitality veterans with 30 years of hotel-management "
                        "experience, dedicated to curated villa brands and staycation investment.\n\n"
                        "Our vision: let the world stay inside the beauty of local Taiwan. Hotel-grade service, "
                        "vernacular design and locally programmed experiences make each stay a memory worth returning for."
                    ),
                },
            ),
            {
                "id": "about-gallery", "type": "image_gallery", "enabled": True,
                "config": {"title": {"zh":"","en":""}, "columns": 4, "images": [
                    {"url": "/storage/media/01c55db29f2a4189a8e77f53d9df3366.jpg", "caption": {"zh": "雙棟外觀", "en": "Twin-villa exterior"}},
                    {"url": "/storage/media/14e5c38be51a41179f58f95f043ababe.jpg", "caption": {"zh": "品牌入口", "en": "Brand wall"}},
                    {"url": "/storage/media/f81ba9f3cef545a283c01645ca7f0467.jpg", "caption": {"zh": "中庭泳池", "en": "Courtyard pool"}},
                    {"url": "/storage/media/67af48238a894819880b1c713efc2af1.jpg", "caption": {"zh": "田園景觀", "en": "Paddy view"}},
                ]},
            },
        ],
        "seo": {"title": {"zh": "關於品牌｜禾境", "en": "About | Hejing Villa"}},
    },
    "space": {
        "label": {"zh": "空間設計", "en": "Space"},
        "page_type": "blocks",
        "sort_order": 2,
        "visible": True,
        "hero_image": HERO["space"],
        "hero_height": "large",
        "hero_title_color": "#ffffff",
        "hero_subtitle_color": "#ffffff",
        "hero_title": {"zh": "空間設計", "en": "Space"},
        "hero_subtitle": {"zh": "宜蘭得獎設計師打造的泳池包棟民宿", "en": "An award-winning architect-designed pool villa"},
        "blocks": [
            rt(
                "space-intro",
                heading={"zh": "極簡白屋 × 中庭泳池", "en": "Minimal whites, a courtyard pool"},
                body={
                    "zh": (
                        "由宜蘭在地得獎建築師操刀，AB 雙棟極簡白色建築，結合自然採光與留白美學，"
                        "打造純淨療癒的度假場域。\n\n"
                        "雙棟之間規劃私密中庭南洋風大泳池，搭配巴里島風植栽與度假家具，"
                        "白天通透放鬆、夜晚池畔燈光滿滿度假氛圍。\n\n"
                        "是宜蘭少數同時擁有「設計感 × 泳池 × 包棟隱私」的精品民宿。"
                    ),
                    "en": (
                        "Two minimal white buildings designed by an award-winning Yilan architect, set around a "
                        "private South-East-Asian courtyard pool with tropical planting and resort furniture — "
                        "open and airy by day, pool-side glow by night.\n\n"
                        "One of the few Yilan villas where design, pool and full-villa privacy come together."
                    ),
                },
            ),
            rt(
                "space-friendly",
                heading={"zh": "寵物 × 親子 × 長者皆友善", "en": "Pet, family and elder friendly"},
                body={
                    "zh": (
                        "禾境同時兼具 寵物友善 × 親子友善 × 長者友善 設計，"
                        "提供嬰兒與長者友善備品，讓全家三代、親友與毛孩，一起安心享受有質感的宜蘭度假時光。"
                    ),
                    "en": (
                        "A space designed for three generations — pet-friendly, family-friendly and elder-friendly, "
                        "with infant and senior amenities ready on request."
                    ),
                },
            ),
            {
                "id": "space-gallery",
                "type": "image_gallery",
                "enabled": True,
                "config": {
                    "title": {"zh": "空間掠影", "en": "Spaces"},
                    "columns": 3,
                    "images": [
                        {"url": "/storage/media/01c55db29f2a4189a8e77f53d9df3366.jpg", "caption": {"zh": "極簡白屋", "en": "Minimal white facade"}},
                        {"url": "/storage/media/14e5c38be51a41179f58f95f043ababe.jpg", "caption": {"zh": "光感入口", "en": "Light-filled entry"}},
                        {"url": "/storage/media/b7b36db8036a4cfb97947cdb5ab43173.jpg", "caption": {"zh": "影音娛樂客廳", "en": "Media lounge"}},
                        {"url": "/storage/media/1e3a48a1779d402886aea3aa9eee54ab.jpg", "caption": {"zh": "景觀浴缸主臥", "en": "Master suite"}},
                        {"url": "/storage/media/009b889601f545b4a626700f6c942762.jpg", "caption": {"zh": "純白雙人房", "en": "Twin room"}},
                        {"url": "/storage/media/0cd50870e5ca4c3d8557dfc1dc37887b.jpg", "caption": {"zh": "通透公共區", "en": "Open living"}},
                        {"url": "/storage/media/67af48238a894819880b1c713efc2af1.jpg", "caption": {"zh": "田園景觀餐廳", "en": "Paddy dining"}},
                    ],
                },
            },
        ],
        "seo": {"title": {"zh": "空間設計｜禾境", "en": "Space | Hejing Villa"}},
    },
    "experience": {
        "label": {"zh": "體驗與設施", "en": "Experience"},
        "page_type": "blocks",
        "sort_order": 3,
        "visible": True,
        "hero_image": HERO["experience"],
        "hero_height": "large",
        "hero_title_color": "#ffffff",
        "hero_subtitle_color": "#ffffff",
        "hero_title": {"zh": "體驗與設施", "en": "Experience & Facilities"},
        "hero_subtitle": {"zh": "飯店級享受 × 包棟娛樂一次到位", "en": "Hotel-grade comforts, full-villa entertainment"},
        "blocks": [
            rt(
                "exp-bath",
                eyebrow={"zh": "EXPERIENCE 體驗與設施", "en": "EXPERIENCE"},
                heading={"zh": "飯店級享受 × 包棟娛樂一次到位", "en": "Hotel-grade comforts, full-villa entertainment"},
                body={
                    "zh": (
                        "禾境打造專屬的「自選沐浴香氛之旅」，入住後可至香氛櫃自由挑選多款國內外知名品牌沐浴用品。"
                        "客廳 Mini Bar 提供嚴選宜蘭在地咖啡、茶飲與零食泡麵，隨時補給度假能量。"
                    ),
                    "en": (
                        "A bespoke \"scent-bath journey\" — choose from curated international toiletries. "
                        "Mini Bar stocked with Yilan coffee, tea and snacks."
                    ),
                },
            ),
            {
                "id": "exp-bath-gallery", "type": "image_gallery", "enabled": True,
                "config": {"title": {"zh":"","en":""}, "columns": 2, "images": [
                    {"url": "/storage/media/1e3a48a1779d402886aea3aa9eee54ab.jpg", "caption": {"zh": "自選沐浴香氛", "en": "Scent-bath cabinet"}},
                    {"url": "/storage/media/009b889601f545b4a626700f6c942762.jpg", "caption": {"zh": "Mini Bar 宜蘭精選", "en": "Yilan Mini Bar"}},
                ]},
            },
            rt(
                "exp-ktv",
                heading={"zh": "公共空間 × 戲院級娛樂", "en": "Theatre-grade entertainment"},
                body={
                    "zh": (
                        "公共空間配備戲院級 KTV、Netflix、電動麻將桌、三合一撞球桌、飛鏢機與多款桌遊，"
                        "無論親友聚會、慶生派對或包棟狂歡，室內就能玩整晚。"
                    ),
                    "en": (
                        "Theatre-grade KTV, Netflix, electric mahjong, 3-in-1 pool, darts and games."
                    ),
                },
            ),
            {
                "id": "exp-ktv-gallery", "type": "image_gallery", "enabled": True,
                "config": {"title": {"zh":"","en":""}, "columns": 3, "images": [
                    {"url": "/storage/media/b7b36db8036a4cfb97947cdb5ab43173.jpg", "caption": {"zh": "戲院級客廳", "en": "Theatre living"}},
                    {"url": "/storage/media/0cd50870e5ca4c3d8557dfc1dc37887b.jpg", "caption": {"zh": "互動桌遊", "en": "Game corner"}},
                    {"url": "/storage/media/1e3a48a1779d402886aea3aa9eee54ab.jpg", "caption": {"zh": "撞球 / 麻將", "en": "Pool & mahjong"}},
                ]},
            },
            rt(
                "exp-pool",
                heading={"zh": "南洋風情 × 中庭景觀泳池", "en": "Tropical courtyard pool"},
                body={
                    "zh": (
                        "禾境中庭以南洋度假風情為靈感打造，14 米景觀大泳池橫互雙棟之間，"
                        "白日倒映藍天與椰影，夜晚點亮池畔燈光與星空氛圍。"
                        "雙包棟更可規劃池畔 BBQ 派對、星空電影院與戶外婚禮儀式。"
                    ),
                    "en": (
                        "A 14m courtyard pool spanning both buildings — sky and palms by day, "
                        "lantern glow and stars by night."
                    ),
                },
            ),
            {
                "id": "exp-pool-gallery", "type": "image_gallery", "enabled": True,
                "config": {"title": {"zh":"","en":""}, "columns": 3, "images": [
                    {"url": "/storage/media/f81ba9f3cef545a283c01645ca7f0467.jpg", "caption": {"zh": "池畔閱讀", "en": "Pool-side reading"}},
                    {"url": "/storage/media/01c55db29f2a4189a8e77f53d9df3366.jpg", "caption": {"zh": "14m 大泳池", "en": "14m pool"}},
                    {"url": "/storage/media/14e5c38be51a41179f58f95f043ababe.jpg", "caption": {"zh": "夜晚池畔燈光", "en": "Evening pool glow"}},
                ]},
            },
            rt(
                "exp-dining",
                heading={"zh": "管家私廚 × 禾境晨光", "en": "Concierge dining"},
                body={
                    "zh": (
                        "管家可協助安排 BBQ 餐車、私廚外燴或火鍋燒烤食材等代訂服務；"
                        "翌日由管家親自準備「禾境晨光」中西式早餐，選用宜蘭在地食材，為美好的一天揭開序幕。"
                    ),
                    "en": (
                        "BBQ trucks, private chefs and hot-pot kits — plus \"Hejing Sunrise\" breakfast made from Yilan produce."
                    ),
                },
            ),
            {
                "id": "exp-dining-gallery", "type": "image_gallery", "enabled": True,
                "config": {"title": {"zh":"","en":""}, "columns": 3, "images": [
                    {"url": "/storage/media/67af48238a894819880b1c713efc2af1.jpg", "caption": {"zh": "禾境晨光早餐", "en": "Hejing Sunrise"}},
                    {"url": "/storage/media/0cd50870e5ca4c3d8557dfc1dc37887b.jpg", "caption": {"zh": "私廚 / 火鍋", "en": "Private chef · hot pot"}},
                    {"url": "/storage/media/f81ba9f3cef545a283c01645ca7f0467.jpg", "caption": {"zh": "池畔 BBQ", "en": "Pool-side BBQ"}},
                ]},
            },
            feature_badges("exp-badges"),
        ],
        "seo": {"title": {"zh": "體驗與設施｜禾境", "en": "Experience | Hejing Villa"}},
    },
    "pricing": {
        "label": {"zh": "收費須知", "en": "Pricing"},
        "page_type": "blocks",
        "sort_order": 4,
        "visible": True,
        "hero_image": HERO["pricing"],
        "hero_height": "large",
        "hero_title_color": "#ffffff",
        "hero_subtitle_color": "#ffffff",
        "hero_title": {"zh": "收費須知", "en": "Pricing"},
        "hero_subtitle": {"zh": "包棟 × 加床 × 寵物 × 烤爐", "en": "Villa rates, add-ons, pets and BBQ"},
        "blocks": [
            rt(
                "price-rooms",
                heading={"zh": "房型與加床", "en": "Rooms & extra beds"},
                body={
                    "zh": (
                        "由 A、B 兩棟組成，每棟配置 2 間雙人房與 2 間四人房，標準入住 12 人。"
                        "加床服務適用於單包棟與雙包棟，每位加收 NT$1,300。"
                    ),
                    "en": (
                        "Buildings A and B, each with 2 double rooms and 2 quad rooms — standard occupancy 12 guests. "
                        "Extra bed NT$1,300 per person, available for both single- and double-villa bookings."
                    ),
                },
            ),
            rt(
                "price-brand",
                heading={"zh": "品牌服務", "en": "Included services"},
                body={
                    "zh": (
                        "包含 Mini Bar（零嘴、精品咖啡、在地茶包）、自選沐浴香氛、由管家現場料理的早餐。\n\n"
                        "不佔床來賓早餐每人收費：10 歲以下 NT$250 / 11 歲以上 NT$380。"
                    ),
                    "en": (
                        "Mini Bar (snacks, specialty coffee, local tea), scent-bath cabinet, and hosted breakfast.\n\n"
                        "Breakfast for non-bed guests: NT$250 (under 10) / NT$380 (11+)."
                    ),
                },
            ),
            rt(
                "price-extras",
                heading={"zh": "其他費用", "en": "Other fees"},
                body={
                    "zh": (
                        "寵物清潔費：寵物友善設施，每隻收特別清潔費 NT$1,000。\n\n"
                        "烤爐租借：美式烤爐每次 NT$1,000，含贈米其林餐廳指定使用海鹽一盒。"
                    ),
                    "en": (
                        "Pet cleaning fee: NT$1,000 per pet.\n\n"
                        "BBQ rental: American-style grill NT$1,000 per session, includes a Michelin-grade sea-salt gift."
                    ),
                },
            ),
            rt(
                "price-nye",
                heading={"zh": "跨年套餐", "en": "New Year's Eve package"},
                body={
                    "zh": (
                        "2026 年 12 月 31 日跨年僅接受 24 人以上 3 天 2 夜雙包棟，具體費用請洽官方 LINE。"
                    ),
                    "en": (
                        "2026 NYE: dual-villa take-over only, 24+ guests for 3 days / 2 nights. Contact the "
                        "official LINE for rates."
                    ),
                },
            ),
        ],
        "seo": {"title": {"zh": "收費須知｜禾境", "en": "Pricing | Hejing Villa"}},
    },
    "contact": {
        "label": {"zh": "交通與聯繫", "en": "Contact"},
        "page_type": "blocks",
        "sort_order": 5,
        "visible": True,
        "hero_image": HERO["contact"],
        "hero_height": "large",
        "hero_title_color": "#ffffff",
        "hero_subtitle_color": "#ffffff",
        "hero_title": {"zh": "交通與聯繫", "en": "Contact"},
        "hero_subtitle": {"zh": "宜蘭冬山禾風路 1 號", "en": "1 Hefeng Road, Dongshan, Yilan"},
        "blocks": [contact_info("contact-info", eyebrow={"zh": "CONTACT 交通與聯繫", "en": "CONTACT"})],
        "seo": {"title": {"zh": "交通與聯繫｜禾境", "en": "Contact | Hejing Villa"}},
    },
    "faq": {
        "label": {"zh": "入住須知FAQ", "en": "FAQ"},
        "page_type": "blocks",
        "sort_order": 6,
        "visible": True,
        "hero_image": HERO["faq"],
        "hero_height": "large",
        "hero_title_color": "#ffffff",
        "hero_subtitle_color": "#ffffff",
        "hero_title": {"zh": "入住須知 FAQ", "en": "FAQ"},
        "hero_subtitle": {"zh": "訂房與入住前的常見問題", "en": "Before you arrive"},
        "blocks": [faq_accordion("faq-list")],
        "seo": {"title": {"zh": "入住須知 FAQ｜禾境", "en": "FAQ | Hejing Villa"}},
    },
    "articles": {
        "label": {"zh": "慢域旅誌", "en": "Journal"},
        "page_type": "cms_list",
        "content_type": "journal",
        "sort_order": 7,
        "visible": True,
        "blocks": [],
        "seo": {"title": {"zh": "慢域旅誌｜禾境", "en": "Journal | Hejing Villa"}},
    },
}


# ── Build payload ───────────────────────────────────────────────────────

def site_payload(site: dict) -> dict:
    contact = site.get("contact_config") or {}
    seo = site.get("seo_defaults") or {}
    settings = site.get("settings") or {}
    # Inject hero on homepage too (carries through to property/[slug] root via settings.homepage.hero_image)
    # Homepage of a child site renders settings.homepage.blocks (not hero_image).
    # Push a hero_banner block first so the home page has a proper above-the-fold.
    # Common galleries reused on home + sub-pages
    about_images = [
        {"url": M["villa_collage"], "caption": {"zh": "雙棟外觀", "en": "Twin-villa exterior"}},
        {"url": M["brand_wall"],    "caption": {"zh": "品牌入口", "en": "Brand wall"}},
        {"url": M["pool_reader"],   "caption": {"zh": "中庭泳池", "en": "Courtyard pool"}},
        {"url": M["paddy_dining"],  "caption": {"zh": "田園景觀", "en": "Paddy view"}},
    ]
    space_images = [
        {"url": M["villa_collage"], "caption": {"zh": "極簡白屋", "en": "Minimal white facade"}},
        {"url": M["brand_wall"],    "caption": {"zh": "光感入口", "en": "Light-filled entry"}},
        {"url": M["ktv_lounge"],    "caption": {"zh": "影音娛樂客廳", "en": "Media lounge"}},
        {"url": M["master_bath"],   "caption": {"zh": "景觀浴缸主臥", "en": "Master suite"}},
        {"url": M["twin_room"],     "caption": {"zh": "純白雙人房", "en": "Twin room"}},
        {"url": M["open_living"],   "caption": {"zh": "通透公共區", "en": "Open living"}},
        {"url": M["paddy_dining"],  "caption": {"zh": "田園景觀餐廳", "en": "Paddy dining"}},
    ]
    exp_pool_images = [
        {"url": M["pool_reader"],   "caption": {"zh": "池畔閱讀", "en": "Pool-side reading"}},
        {"url": M["villa_collage"], "caption": {"zh": "14m 大泳池", "en": "14m pool"}},
        {"url": M["brand_wall"],    "caption": {"zh": "夜晚池畔燈光", "en": "Evening pool glow"}},
    ]
    exp_ktv_images = [
        {"url": M["ktv_lounge"],    "caption": {"zh": "戲院級客廳", "en": "Theatre living"}},
        {"url": M["open_living"],   "caption": {"zh": "互動桌遊", "en": "Game corner"}},
        {"url": M["master_bath"],   "caption": {"zh": "撞球 / 麻將", "en": "Pool & mahjong"}},
    ]
    exp_dining_images = [
        {"url": M["paddy_dining"],  "caption": {"zh": "禾境晨光早餐", "en": "Hejing Sunrise breakfast"}},
        {"url": M["open_living"],   "caption": {"zh": "私廚 / 火鍋", "en": "Private chef · hot pot"}},
        {"url": M["pool_reader"],   "caption": {"zh": "池畔 BBQ", "en": "Pool-side BBQ"}},
    ]
    exp_bath_images = [
        {"url": M["master_bath"],   "caption": {"zh": "自選沐浴香氛", "en": "Scent-bath cabinet"}},
        {"url": M["twin_room"],     "caption": {"zh": "Mini Bar 宜蘭精選", "en": "Yilan Mini Bar"}},
    ]

    home_blocks = [
        {
            "id": "home-hero",
            "type": "hero_banner",
            "enabled": True,
            "config": {
                "image": HERO["home"],
                "height": "large",
                "title": {"zh": "禾境", "en": "Hejing Villa"},
                "subtitle": {"zh": "宜蘭冬山輕奢泳池民宿", "en": "Quiet-luxury pool villa in Dongshan, Yilan"},
                "titleColor": "#ffffff",
                "subtitleColor": "#ffffff",
            },
        },
        # ── 關於 禾境 ── + 4-image gallery
        rt(
            "home-about",
            anchor="about",
            heading={"zh": "在稻浪之間，安靜地度假", "en": "Quiet luxury among the rice fields"},
            eyebrow={"zh": "ABOUT 禾境", "en": "ABOUT HEJING VILLA"},
            body={
                "zh": (
                    "Hejing Villa 禾境 — 宜蘭冬山泳池精品民宿，由 Slowfield Stays 慢域旅宿集團經營，"
                    "提供 6 至 32 人的全客製化包棟度假體驗。\n\n"
                    "「禾」是稻禾，「境」是一方自成的天地。"
                    "在這裡，日子跟著稻子的節奏慢下來。"
                ),
                "en": (
                    "A quiet-luxury pool villa hidden in Yilan's Dongshan paddy fields, operated by Slowfield Stays. "
                    "Take-overs from 6 to 32 guests, fully concierged.\n\n"
                    "\"He\" — the rice plant; \"jing\" — a realm of its own. "
                    "A private retreat that keeps the rhythm of the paddies."
                ),
            },
        ),
        image_gallery("home-about-gallery", title={"zh": "", "en": ""}, images=about_images, columns=4),
        # ── 關於 慢域旅宿 ── (text only)
        rt(
            "home-collection",
            heading={"zh": "慢域旅宿 · 讓世界住進台灣的美好", "en": "Slowfield Stays — staying inside Taiwan"},
            eyebrow={"zh": "ABOUT SLOWFIELD STAYS", "en": "COLLECTION"},
            body={
                "zh": (
                    "慢域旅宿（Slowfield Stays）由擁有 30 年飯店管理經驗的專業團隊創立，"
                    "結合飯店級服務標準、在地生活美學與精選空間設計，打造值得收藏的度假體驗。"
                ),
                "en": (
                    "Slowfield Stays is founded by hospitality veterans with 30 years of experience, "
                    "blending hotel-grade service, vernacular design and curated programming."
                ),
            },
        ),
        # ── 空間設計 ── 3-column gallery (3 rows of 3, ~7 images)
        rt(
            "home-space-intro",
            anchor="space",
            heading={"zh": "宜蘭得獎設計師打造的泳池包棟", "en": "Award-winning architect, courtyard pool"},
            eyebrow={"zh": "SPACE 空間設計", "en": "SPACE"},
            body={
                "zh": (
                    "AB 雙棟極簡白色建築，由宜蘭在地得獎建築師操刀，結合自然採光與留白美學。"
                    "雙棟之間的 14 米南洋風中庭泳池，搭配巴里島風植栽與度假家具，"
                    "白天通透放鬆、夜晚池畔燈光滿滿度假氛圍。"
                ),
                "en": (
                    "Two minimal white buildings by an award-winning Yilan architect framing a 14-metre "
                    "South-East-Asian courtyard pool — open and airy by day, pool-side glow by night."
                ),
            },
        ),
        image_gallery("home-space", title={"zh": "", "en": ""}, images=space_images, columns=3),
        feature_badges("home-space-badges"),
        # ── 體驗與設施 ── 4 sub-sections, each rich_text + gallery
        rt(
            "home-exp-bath",
            anchor="experience",
            heading={"zh": "飯店級享受 × 包棟娛樂一次到位", "en": "Hotel-grade comforts, full-villa entertainment"},
            eyebrow={"zh": "EXPERIENCE 體驗與設施", "en": "EXPERIENCE"},
            body={
                "zh": (
                    "禾境打造專屬的「自選沐浴香氛之旅」，入住後可至香氛櫃自由挑選多款國內外知名品牌沐浴用品。"
                    "客廳 Mini Bar 提供嚴選宜蘭在地咖啡、茶飲與零食泡麵，隨時補給度假能量。"
                ),
                "en": (
                    "A bespoke \"scent-bath journey\" — choose from curated international toiletries at the "
                    "fragrance cabinet. The lounge Mini Bar is stocked with Yilan coffee, tea and snacks."
                ),
            },
        ),
        image_gallery("home-exp-bath-gallery", title={"zh": "", "en": ""}, images=exp_bath_images, columns=2),
        rt(
            "home-exp-ktv",
            heading={"zh": "公共空間 × 戲院級娛樂", "en": "Theatre-grade entertainment"},
            body={
                "zh": (
                    "公共空間配備戲院級 KTV、Netflix、電動麻將桌、三合一撞球桌、飛鏢機與多款桌遊，"
                    "無論親友聚會、慶生派對或包棟狂歡，室內就能玩整晚。"
                ),
                "en": (
                    "Theatre-grade KTV, Netflix, electric mahjong, 3-in-1 pool, darts and board games — "
                    "an indoor playground for friends, birthdays, and full-villa parties."
                ),
            },
        ),
        image_gallery("home-exp-ktv-gallery", title={"zh": "", "en": ""}, images=exp_ktv_images, columns=3),
        rt(
            "home-exp-pool",
            heading={"zh": "南洋風情 × 中庭景觀泳池", "en": "Tropical courtyard pool"},
            body={
                "zh": (
                    "禾境中庭以南洋度假風情為靈感打造，14 米景觀大泳池橫互雙棟之間，"
                    "白日倒映藍天與椰影，夜晚點亮池畔燈光與星空氛圍。"
                    "雙包棟更可規劃池畔 BBQ 派對、星空電影院與戶外婚禮儀式。"
                ),
                "en": (
                    "A 14-metre courtyard pool spanning both buildings — sky and palms by day, "
                    "lantern glow and stars by night. Double-villa take-overs unlock pool BBQ, "
                    "open-air cinema and outdoor ceremonies."
                ),
            },
        ),
        image_gallery("home-exp-pool-gallery", title={"zh": "", "en": ""}, images=exp_pool_images, columns=3),
        rt(
            "home-exp-dining",
            heading={"zh": "管家私廚 × 禾境晨光", "en": "Concierge dining"},
            body={
                "zh": (
                    "管家可協助安排 BBQ 餐車、私廚外燴或火鍋燒烤食材等代訂服務；"
                    "翌日由管家親自準備「禾境晨光」中西式早餐，選用宜蘭在地食材，為美好的一天揭開序幕。"
                ),
                "en": (
                    "The concierge arranges BBQ trucks, private chefs and hot-pot kits, and serves "
                    "\"Hejing Sunrise\" — a hosted breakfast made on-site from Yilan produce."
                ),
            },
        ),
        image_gallery("home-exp-dining-gallery", title={"zh": "", "en": ""}, images=exp_dining_images, columns=3),
        # ── 收費須知 ──
        rt(
            "home-pricing",
            anchor="pricing",
            heading={"zh": "包棟 × 加床 × 寵物 × 烤爐", "en": "Villa rates, add-ons, pets and BBQ"},
            eyebrow={"zh": "PRICING 收費須知", "en": "PRICING"},
            body={
                "zh": (
                    "AB 雙棟，每棟 2 間雙人房 + 2 間四人房，標準入住 12 人；加床 NT$1,300/位。\n\n"
                    "包含 Mini Bar、自選沐浴香氛、管家現場料理早餐；不佔床早餐 10 歲以下 NT$250，11 歲以上 NT$380。\n\n"
                    "寵物清潔費 NT$1,000；烤爐租借 NT$1,000/次（含米其林指定海鹽）。"
                ),
                "en": (
                    "Buildings A & B, each with 2 doubles + 2 quads — 12 standard, extra bed NT$1,300/pp.\n\n"
                    "Includes Mini Bar, scent-bath, hosted breakfast. Non-bed breakfast NT$250 (<10) / NT$380 (11+).\n\n"
                    "Pet cleaning NT$1,000; BBQ grill NT$1,000 per session."
                ),
            },
        ),
        # ── 入住須知 FAQ ──
        faq_accordion("home-faq", anchor="faq"),
        # ── 交通與聯繫 ── (single contact_info block, anchor lives on it)
        contact_info("home-contact", eyebrow={"zh": "CONTACT 交通與聯繫", "en": "CONTACT"}, anchor="contact"),
        # ── 訂房聯絡表單 ── (delivers into hejing's inquiries inbox,
        # not the parent site, via the explicit `site` slug)
        {
            "id": "home-booking",
            "type": "contact_form",
            "enabled": True,
            "config": {
                "form_type": "booking",
                "site": "hejing",
                "title": {"zh": "立即訂房", "en": "Reserve your stay"},
                "subtitle": {
                    "zh": "開啟您的禾境時光，管家將為您安排一切。",
                    "en": "Begin your Hejing Villa stay — our concierge will arrange everything.",
                },
                "submit_label": {"zh": "送出訂房需求", "en": "Send booking request"},
            },
        },
    ]
    existing_hp = settings.get("homepage") or {}
    new_settings = {
        **settings,
        "pages": PAGES,
        "homepage": {**existing_hp, "blocks": home_blocks},
        # Bilingual legal notice rendered above the © row in PropertyFooter.
        "footer_notice": {
            "zh": "本官網相關圖文皆為盟利旅宿投資管理顧問有限公司之智慧財產，"
                  "官網資訊僅供參考，如有變更恕不另行通知，皆以最新公告為準，"
                  "請務必諮詢經營團隊。",
            "en": "All copy and imagery on this site are the intellectual property of "
                  "Meili Travel Investment Management Consulting. Information shown is "
                  "for reference only and may change without notice; please confirm "
                  "current details with the operating team before booking.",
        },
    }
    # Brand palette: previous data had primaryColor=#ffffff which made every
    # var(--forest) heading invisible on a white surface. Switch to a legible
    # deep cloud-blue derived from the logo (hejing = 禾境 / clouds);
    # leave the nav / footer / button overrides empty so the CSS falls through
    # to the primary, keeping the palette coherent.
    return {
        "name": site.get("name") or "禾境",
        "slug": site.get("slug") or "hejing",
        "domain": site.get("domain") or "",
        "status": site.get("status") or "active",
        "default_locale": site.get("default_locale") or "zh",
        "primary_color": "#2c5879",
        "accent_color": "#b78b58",
        # Theme overrides — drive the CSS vars --nav-bg / --nav-text / --footer-bg /
        # --footer-text injected by property/[slug]/layout.tsx. Editable from admin
        # site settings; values below are the cloud-and-ink palette hejing uses.
        "nav_bg": "#ffffff",
        "nav_text": "#1c1c1a",
        # Cloud-blue mid-tone sampled from the brand photo of the pool sky;
        # paired with white footer text so the band reads as ambient blue rather
        # than a pastel.
        "footer_bg": "#7aa6c1",
        "footer_text": "#ffffff",
        "button_bg": "",
        "button_text": "",
        "contact_email": contact.get("email") or "hello@slowfield.example",
        "contact_line": contact.get("line") or "@slowfield",
        "seo_title": seo.get("title") or "禾境 Hejing Villa｜宜蘭冬山泳池精品民宿",
        "seo_description": seo.get("description") or "Hejing Villa 禾境 — 宜蘭冬山輕奢泳池民宿，慢域旅宿集團旗下精品品牌。",
        # Force parent_site_id = 1 (root site_id). Frontend getPropertySite() returns null
        # for any site lacking parent_site_id, which 404s every /stays/<slug>/* route.
        "parent_site_id": site.get("parent_site_id") or 1,
        "template_site_id": site.get("template_site_id"),
        "is_template": bool(site.get("is_template")),
        "template_version": site.get("template_version") or "v1",
        "settings": new_settings,
    }


# ── CMS list seeding (news + journal) ───────────────────────────────────

CMS_ENTRIES = [
    {
        "slug": "2026-room-promo",
        "content_type": "news",
        "title": "【2026 年房價優惠】住房專案",
        "summary": "8–32 人禾境包棟假期，開幕試營運期間平假日同價；慢域會員包棟即享免費升等。",
        "cover_image_url": HERO["home"],
        "body_blocks": [
            {
                "id": "promo-body",
                "type": "rich_text",
                "enabled": True,
                "config": {
                    "heading": {"zh": "慢域會員專屬，包棟即享免費升等", "en": "Members-only villa take-over upgrade"},
                    "body": {
                        "zh": (
                            "Hejing Villa 禾境 — 6 至 32 人輕奢泳池包棟假期。\n\n"
                            "開幕試營運期間，全面平假日同價，最低每人 NT$2,026 起。\n\n"
                            "加入「慢域會員」即可享有包棟免費升等服務，詳情請洽官方 LINE @slowfield。"
                        ),
                        "en": (
                            "Hejing Villa — 6–32 guest pool villa take-overs.\n\n"
                            "Soft-launch period: flat weekday/weekend pricing, from NT$2,026 per person.\n\n"
                            "Slowfield Stays members receive a complimentary villa upgrade. Contact LINE @slowfield."
                        ),
                    },
                },
            }
        ],
    },
    {
        "slug": "luozhuang-sakura-trail",
        "content_type": "journal",
        "title": "羅莊櫻花步道：不必上山，在市區遇見最美十六份圳粉色長廊",
        "summary": "全台平地最長的櫻花隧道，位於羅東市區東南郊，每年 2–3 月化身夢幻粉色河畔步道。",
        "cover_image_url": HERO["faq"],
        "body_blocks": [
            {
                "id": "sakura-body",
                "type": "rich_text",
                "enabled": True,
                "config": {
                    "eyebrow": {"zh": "在地景點 · 2026 / 03 / 07", "en": "Local · 2026 / 03 / 07"},
                    "heading": {"zh": "十六份圳，羅東最浪漫的粉色長廊", "en": "Luozhuang Sakura Trail"},
                    "body": {
                        "zh": (
                            "羅莊櫻花步道沿十六份圳而行，是全台平地最長的櫻花隧道。\n\n"
                            "距離禾境車程僅 15 分鐘，每年 2 月至 3 月盛開期間，"
                            "粉色花瓣鋪滿水圳步道，是宜蘭最具代表性的春日散策。\n\n"
                            "建議入住期間清晨前往，避開人潮、捕捉光影最柔美的時刻。"
                        ),
                        "en": (
                            "The Luozhuang Sakura Trail runs along the Sixteen-Fen irrigation canal — Taiwan's "
                            "longest plains-level cherry tunnel, just 15 minutes from Hejing Villa.\n\n"
                            "From February to March, pink petals carpet the canal walk. Visit at dawn for the "
                            "softest light and emptiest paths."
                        ),
                    },
                },
            }
        ],
    },
]


def seed_cms(token: str):
    code, existing = req("GET", f"/admin/cms/pages?site=hejing&site_id={SITE_ID}", token=token)
    have = {}
    if code == 200 and isinstance(existing, list):
        have = {p.get("slug"): p for p in existing if isinstance(p, dict)}
    elif code == 200 and isinstance(existing, dict) and isinstance(existing.get("items"), list):
        have = {p.get("slug"): p for p in existing["items"] if isinstance(p, dict)}
    for entry in CMS_ENTRIES:
        payload = {
            "slug": entry["slug"],
            "title": entry["title"],
            "summary": entry["summary"],
            "body": "",
            "body_blocks": entry["body_blocks"],
            "content_type": entry["content_type"],
            "layout": "page",
            "cover_image_url": entry["cover_image_url"],
            "sort_order": 0,
            "tags": [],
            "related_stay_ids": [],
            "status": "published",
            "seo": {},
            "translations": {},
        }
        if entry["slug"] in have:
            page_id = have[entry["slug"]].get("id")
            code, body = req("PUT", f"/admin/cms/pages/{page_id}?site=hejing&site_id={SITE_ID}", token=token, body=payload)
            print(f"  ~ updated {entry['content_type']}/{entry['slug']} [{code}]")
        else:
            code, body = req("POST", f"/admin/cms/pages?site=hejing&site_id={SITE_ID}", token=token, body=payload)
            print(f"  + created {entry['content_type']}/{entry['slug']} [{code}] {str(body)[:120]}")


def main():
    print("→ login")
    token = login()
    print(f"  token ok")

    print("→ fetch current site 2")
    code, site = req("GET", f"/admin/sites/{SITE_ID}?site=hejing", token=token)
    if code != 200:
        sys.exit(f"GET failed [{code}]: {site}")
    print(f"  name={site.get('name')!r} slug={site.get('slug')!r} keys={list((site.get('settings') or {}).keys())}")

    payload = site_payload(site)
    print(f"→ PUT site 2 with {len(PAGES)} pages")
    code, result = req("PUT", f"/admin/sites/{SITE_ID}?site=hejing", token=token, body=payload)
    if code != 200:
        sys.exit(f"PUT failed [{code}]: {result}")
    new_pages = list(((result.get("settings") or {}).get("pages") or {}).keys())
    print(f"  ok — settings.pages now: {new_pages}")

    print("→ seed CMS pages (news + journal)")
    seed_cms(token)


if __name__ == "__main__":
    main()
