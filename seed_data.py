"""
Seed 20 items for each content type: stays, brand, dining, activity, journal
Run: ADMIN_EMAIL=admin@slowfield.example ADMIN_PASSWORD=xxx python seed_data.py
"""
import os

import json
import sys
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore

API = "http://localhost:8000/api/v1"
SITE = "slowfield"

# ── Helpers ──────────────────────────────────────────────────────────────────

def api(method: str, path: str, data: dict | None = None, token: str | None = None):
    url = f"{API}{path}?site={SITE}"
    body = json.dumps(data).encode() if data else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()[:200]}")
        return None


def login() -> str:
    email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    password = os.environ.get("ADMIN_PASSWORD", "ChangeMe123!")
    result = api("POST", "/auth/login", {"email": email, "password": password})
    token = result["access_token"]
    print(f"Logged in. Token: {token[:20]}...")
    return token


def create_page(token: str, payload: dict) -> bool:
    slug = payload["slug"]
    result = api("POST", "/admin/cms/pages", payload, token)
    if result:
        # publish it
        page_id = result.get("id")
        if page_id:
            api("PATCH", f"/admin/cms/pages/{page_id}/status", {"status": "published"}, token)
        print(f"  OK {slug}")
        return True
    print(f"  SKIP {slug} (may already exist)")
    return False


def create_stay(token: str, payload: dict) -> bool:
    slug = payload["slug"]
    result = api("POST", "/admin/stays", payload, token)
    if result:
        stay_id = result.get("id")
        if stay_id:
            api("PATCH", f"/admin/stays/{stay_id}/status", {"status": "published"}, token)
        print(f"  OK {slug}")
        return True
    print(f"  SKIP {slug} (may already exist)")
    return False


# ── Unsplash helper images (public, no key needed with auto=format) ───────────
def img(photo_id: str, w: int = 800) -> str:
    return f"https://images.unsplash.com/photo-{photo_id}?auto=format&fit=crop&w={w}&q=80"


# ── DATA ─────────────────────────────────────────────────────────────────────

STAYS = [
    {
        "slug": "songlin-mountain-villa",
        "name": "松林居", "destination": "南投", "region": "central",
        "summary": "深山松林中的靜謐別院，兩間套房各有獨立露台與山景浴缸。",
        "story": "松林居藏在海拔 1,200 公尺的松樹林間，建築師以在地檜木為主材，讓室內外的氣息無縫相連。清晨雲霧漫入廊道，傍晚是一整片橘紅山巒，每一刻都值得留下。",
        "hero_image_url": img("1506905705657-08c2a30c8e9a", 1600),
        "base_price": 8800, "max_guests": 4, "status": "published",
        "amenities": ["私人溫泉", "壁爐", "山景套房", "廚房"],
        "room_types": [{"name": "山景套房", "description": "檜木浴缸、落地窗山景", "price": 8800, "capacity": 2}],
        "images": [
            {"image_url": img("1566073771259-470b1ae04f5c"), "alt_text": "松林夜景", "sort_order": 1},
            {"image_url": img("1542718610-a1031fc1c62a"), "alt_text": "室內溫泉", "sort_order": 2},
        ],
        "tags": ["mountains", "hot-spring", "forest"],
        "location_config": {"address": "南投縣仁愛鄉松林村12號", "lat": "23.87", "lng": "121.00"},
    },
    {
        "slug": "jade-valley-retreat",
        "name": "翠谷石居", "destination": "花蓮", "region": "east",
        "summary": "太魯閣步道旁的石砌民宿，峽谷景致從每扇窗倒映入室。",
        "story": "以在地花蓮石為牆面，三間客房各向一個峽谷視角開口。每晚備有新鮮峽谷泉水與主人自烤麵包，隔天清晨可徒步至隱藏瀑布。",
        "hero_image_url": img("1626436080367-7be4d2e0c5a1", 1600),
        "base_price": 7200, "max_guests": 6, "status": "published",
        "amenities": ["峽谷景觀", "自製早餐", "徒步嚮導", "天然泉水"],
        "room_types": [{"name": "峽谷景觀房", "description": "落地玻璃對向峽谷", "price": 7200, "capacity": 2}],
        "images": [
            {"image_url": img("1532622785990-d221f26c9fef"), "alt_text": "峽谷景", "sort_order": 1},
        ],
        "tags": ["gorge", "hiking", "stone"],
        "location_config": {"address": "花蓮縣秀林鄉富世村太魯閣8號"},
    },
    {
        "slug": "sea-cliff-cottage",
        "name": "海崖小築", "destination": "福隆", "region": "north",
        "summary": "臨懸崖而建的三房度假屋，窗外是北海岸稜線與太平洋晨光。",
        "story": "崖頂上的白色小屋只接待一組客人，讓整片海岸線成為私人包場。晚餐可外帶附近漁港的現捕海鮮，在露台搭配日落享用。",
        "hero_image_url": img("1507525428034-b723cf961d3e", 1600),
        "base_price": 9600, "max_guests": 6, "status": "published",
        "amenities": ["海景露台", "全屋包棟", "BBQ設備", "停車場"],
        "room_types": [{"name": "海崖三房", "description": "全屋三臥含廚房露台", "price": 9600, "capacity": 6}],
        "images": [
            {"image_url": img("1505118380757-91f5f5632de0"), "alt_text": "北海岸日出", "sort_order": 1},
        ],
        "tags": ["sea", "cliff", "private-house"],
        "location_config": {"address": "新北市貢寮區福隆里海岸路24號"},
    },
    {
        "slug": "wutong-courtyard",
        "name": "梧桐院", "destination": "台南", "region": "south",
        "summary": "百年日式街屋改造，梧桐樹蔭中的老城文人居所。",
        "story": "1920年代的老宅，經設計師以「留舊注新」為原則修復，保留原始檜木天花與花磚地板，同時導入現代衛浴與恆溫空調。位於台南老城區，步行可達多間米其林推薦食堂。",
        "hero_image_url": img("1555396273-b57e4f5a2b67", 1600),
        "base_price": 6500, "max_guests": 4, "status": "published",
        "amenities": ["老宅建築", "步行生活圈", "自行車租借", "管家服務"],
        "room_types": [{"name": "文人套房", "description": "日式格窗與花磚浴室", "price": 6500, "capacity": 2}],
        "images": [
            {"image_url": img("1519125323398-675f0ddb6308"), "alt_text": "老宅外觀", "sort_order": 1},
        ],
        "tags": ["heritage", "city", "japanese-style"],
        "location_config": {"address": "台南市中西區忠義路二段38號"},
    },
    {
        "slug": "tea-field-house",
        "name": "茶田居", "destination": "阿里山", "region": "south",
        "summary": "海拔 1,400 公尺的茶園主人住宅，雲海與茶香共存的清晨。",
        "story": "主人世代種茶，開放三間客房讓旅人體驗採茶製茶的節奏。每日清晨五點，主人備好熱茶等在露台，雲海準時從山谷湧起。",
        "hero_image_url": img("1576091160550-2173dba999ef", 1600),
        "base_price": 5800, "max_guests": 6, "status": "published",
        "amenities": ["採茶體驗", "雲海景觀", "手作茶點", "山中早餐"],
        "room_types": [{"name": "茶農套房", "description": "木地板、茶山景觀陽台", "price": 5800, "capacity": 2}],
        "images": [
            {"image_url": img("1466781662440-ab1c2cc39a8e"), "alt_text": "茶田晨景", "sort_order": 1},
        ],
        "tags": ["tea", "mountains", "farm"],
        "location_config": {"address": "嘉義縣阿里山鄉茶山村94號"},
    },
    {
        "slug": "mist-forest-cabin",
        "name": "霧林木屋", "destination": "太平山", "region": "north",
        "summary": "原始林中的獨棟木屋，雲霧時時縈繞，靜聽雨聲入眠。",
        "story": "一棟紅檜木搭建的兩層小屋，隱入太平山原始森林。無電視、無商業Wi-Fi，只有書架、壁爐與窗外數百年的古木相伴。",
        "hero_image_url": img("1448375240586-882707db888b", 1600),
        "base_price": 7800, "max_guests": 4, "status": "published",
        "amenities": ["壁爐", "古木森林", "晨間健行", "私廚服務"],
        "room_types": [{"name": "霧林套房", "description": "紅檜浴桶、森林景", "price": 7800, "capacity": 2}],
        "images": [
            {"image_url": img("1511497584788-876760111969"), "alt_text": "霧中林徑", "sort_order": 1},
        ],
        "tags": ["forest", "mist", "cabin"],
        "location_config": {"address": "宜蘭縣大同鄉太平山林道22號"},
    },
    {
        "slug": "stone-wall-penghu",
        "name": "石牆院", "destination": "澎湖", "region": "island",
        "summary": "玄武岩石牆圍起的三合院改建，海風穿堂、藍天無際。",
        "story": "百年咕咾石老厝，屋主以不動原牆為原則，在室內注入當代設計語彙。澎湖的夏日日落從中庭院落緩緩落下，晚風帶鹽味，沁入靈魂。",
        "hero_image_url": img("1489516084086-4d99f34de8c3", 1600),
        "base_price": 5600, "max_guests": 6, "status": "published",
        "amenities": ["石牆中庭", "浮潛出發點", "風箏衝浪", "島嶼自行車"],
        "room_types": [{"name": "石院套房", "description": "咕咾石牆、海景窗", "price": 5600, "capacity": 2}],
        "images": [
            {"image_url": img("1439405374710-b4f7d8e96300"), "alt_text": "澎湖石牆", "sort_order": 1},
        ],
        "tags": ["island", "sea", "heritage"],
        "location_config": {"address": "澎湖縣西嶼鄉二崁村8號"},
    },
    {
        "slug": "bamboo-grove-villa",
        "name": "竹林風雅", "destination": "美濃", "region": "south",
        "summary": "客家夥房改建的竹林民宿，蓮霧樹與竹影成為天然隔簾。",
        "story": "美濃菸業鼎盛時期的客家大院，如今成為三間客房的靜謐居所。院中保有百年龍眼樹，主人晨間備有鄰家豆腐花與客家粄條。",
        "hero_image_url": img("1553361371-9b897cd00f6c", 1600),
        "base_price": 4800, "max_guests": 6, "status": "published",
        "amenities": ["客家早餐", "竹林中庭", "造紙體驗", "農村散步"],
        "room_types": [{"name": "竹院套房", "description": "竹窗景、客家木地板", "price": 4800, "capacity": 2}],
        "images": [
            {"image_url": img("1524061581889-7c2b1d48e6f4"), "alt_text": "竹林", "sort_order": 1},
        ],
        "tags": ["hakka", "bamboo", "countryside"],
        "location_config": {"address": "高雄市美濃區中正路一段256號"},
    },
    {
        "slug": "rice-field-annexe",
        "name": "稻田別院", "destination": "宜蘭", "region": "north",
        "summary": "蘭陽平原稻田間的兩棟獨立小屋，四季各有不同田野色彩。",
        "story": "農地中央蓋起兩棟落地玻璃小屋，白天是稻田全景，夜晚銀河橫跨無光害的天空。農莊主人清晨供應現採蔬果早午餐。",
        "hero_image_url": img("1464226184884-fa280b87b3fb", 1600),
        "base_price": 6200, "max_guests": 4, "status": "published",
        "amenities": ["稻田景觀", "有機早午餐", "踩水體驗", "星空露台"],
        "room_types": [{"name": "稻田玻璃屋", "description": "全玻璃外牆、360稻田景", "price": 6200, "capacity": 2}],
        "images": [
            {"image_url": img("1500076656116-558b578dba9d"), "alt_text": "宜蘭稻田", "sort_order": 1},
        ],
        "tags": ["rice-field", "countryside", "glass-house"],
        "location_config": {"address": "宜蘭縣三星鄉大隱路50號"},
    },
    {
        "slug": "moon-lake-pavilion",
        "name": "望月閣", "destination": "日月潭", "region": "central",
        "summary": "湖面上的懸空棧道連接三間水上客房，月光在湖面靜靜搖晃。",
        "story": "設計師以「宿湖」為命題，在深水棧道上建起三間清水模客房。黃昏時分，湖面霧氣升起；深夜，月亮倒映在客房大片玻璃窗中。",
        "hero_image_url": img("1523475996614-7b0456b21910", 1600),
        "base_price": 10500, "max_guests": 2, "status": "published",
        "amenities": ["水上客房", "湖面泳池", "獨木舟", "湖鮮晚餐"],
        "room_types": [{"name": "水上月景房", "description": "懸水棧道、日月潭全景", "price": 10500, "capacity": 2}],
        "images": [
            {"image_url": img("1559827291-72416c8854c9"), "alt_text": "日月潭夜景", "sort_order": 1},
        ],
        "tags": ["lake", "water", "romantic"],
        "location_config": {"address": "南投縣魚池鄉日月潭路50號"},
    },
    {
        "slug": "coral-bay-annexe",
        "name": "珊瑚灣別院", "destination": "墾丁", "region": "south",
        "summary": "南灣私人珊瑚礁旁的四房別院，浮潛從後院下水即達礁盤。",
        "story": "從後院踏入海水，珊瑚礁就在腳下。別院僅開放一組客人包棟，備有潛水設備、戶外淋浴與燒烤台，陽台面向巴士海峽的日落。",
        "hero_image_url": img("1506905705657-08c2a30c8e9a", 1600),
        "base_price": 12000, "max_guests": 8, "status": "published",
        "amenities": ["珊瑚礁浮潛", "全棟包租", "燒烤台", "戶外淋浴"],
        "room_types": [{"name": "珊瑚灣四房", "description": "海景、全棟含廚房", "price": 12000, "capacity": 8}],
        "images": [
            {"image_url": img("1507525428034-b723cf961d3e"), "alt_text": "南灣珊瑚礁", "sort_order": 1},
        ],
        "tags": ["snorkeling", "sea", "private-house"],
        "location_config": {"address": "屏東縣恆春鎮南灣路22號"},
    },
    {
        "slug": "jiaoxi-hotspring-stay",
        "name": "礁溪溫泉宿", "destination": "宜蘭", "region": "north",
        "summary": "礁溪碳酸氫鈉溫泉引入五間客房，每房各有獨立室內池與露天浸池。",
        "story": "礁溪溫泉名聞遐邇，這棟日式旅宿將泉水導入每一間客房，碳酸泉輕輕包覆身體的疲憊。深夜起湯，竹林搖曳，是最私密的宜蘭夜晚。",
        "hero_image_url": img("1544787219-7f47ccb76574", 1600),
        "base_price": 7000, "max_guests": 2, "status": "published",
        "amenities": ["室內溫泉池", "露天湯池", "日式浴衣", "溫泉早餐"],
        "room_types": [{"name": "溫泉套房", "description": "室內池+露天池、榻榻米", "price": 7000, "capacity": 2}],
        "images": [
            {"image_url": img("1542718610-a1031fc1c62a"), "alt_text": "溫泉池", "sort_order": 1},
        ],
        "tags": ["hot-spring", "onsen", "japanese-style"],
        "location_config": {"address": "宜蘭縣礁溪鄉礁溪路五段27號"},
    },
    {
        "slug": "old-city-stay-tainan",
        "name": "老城輕旅", "destination": "台南", "region": "south",
        "summary": "台南五條港街區的清水模小旅館，六間客房各以一位老台南職人命名。",
        "story": "設計師以「重量最輕的存在感」設計這棟小旅館，清水模牆面映射老街光影，六間客房各以老台南職人命名：鐵工、竹籠師、刻印師……每一名字都是一段城市記憶。",
        "hero_image_url": img("1555396273-b57e4f5a2b67", 1600),
        "base_price": 5200, "max_guests": 2, "status": "published",
        "amenities": ["老街步行圈", "自行車出借", "職人早餐", "圖書室"],
        "room_types": [{"name": "職人套房", "description": "清水模、手工家具", "price": 5200, "capacity": 2}],
        "images": [
            {"image_url": img("1519125323398-675f0ddb6308"), "alt_text": "台南老街", "sort_order": 1},
        ],
        "tags": ["city", "heritage", "design"],
        "location_config": {"address": "台南市中西區神農街28號"},
    },
    {
        "slug": "highland-cloud-dream",
        "name": "高山雲夢", "destination": "阿里山", "region": "south",
        "summary": "1,600 公尺的阿里山林道上，雲層在腳下翻湧的夢境式住所。",
        "story": "每年十月至四月，早晨七點的雲海幾乎場場不缺席。三間客房的大窗框住整片天空，清晨起床是最好的預報，雲海會自己到來。",
        "hero_image_url": img("1576091160550-2173dba999ef", 1600),
        "base_price": 6800, "max_guests": 4, "status": "published",
        "amenities": ["雲海景觀", "森林早餐", "日出接駁", "觀星露台"],
        "room_types": [{"name": "雲海套房", "description": "大景窗、木地板", "price": 6800, "capacity": 2}],
        "images": [
            {"image_url": img("1466781662440-ab1c2cc39a8e"), "alt_text": "阿里山雲海", "sort_order": 1},
        ],
        "tags": ["mountains", "sea-of-clouds", "sunrise"],
        "location_config": {"address": "嘉義縣阿里山鄉阿里山路23號"},
    },
    {
        "slug": "taroko-valley-lodge",
        "name": "太魯閣谷宿", "destination": "花蓮", "region": "east",
        "summary": "太魯閣峽谷步道終點的小型山莊，六間客房面向絕壁大理石紋理。",
        "story": "從最後一段步道走來，峽谷靜謐無車聲。山莊保留原生植栽，客房開口面向峽谷絕壁，鋼石與清流的對話從入住的第一刻開始。",
        "hero_image_url": img("1626436080367-7be4d2e0c5a1", 1600),
        "base_price": 7500, "max_guests": 4, "status": "published",
        "amenities": ["峽谷景觀", "步道起點", "山莊餐廳", "峽谷泉水"],
        "room_types": [{"name": "峽谷岩景房", "description": "對向大理石峽谷", "price": 7500, "capacity": 2}],
        "images": [
            {"image_url": img("1532622785990-d221f26c9fef"), "alt_text": "太魯閣峽谷", "sort_order": 1},
        ],
        "tags": ["gorge", "hiking", "nature"],
        "location_config": {"address": "花蓮縣秀林鄉崇德村太魯閣62號"},
    },
    {
        "slug": "east-rift-farmhouse",
        "name": "縱谷農宅", "destination": "台東", "region": "east",
        "summary": "花東縱谷有機農場內的兩棟小屋，兩側是稻田與中央山脈稜線。",
        "story": "農場主人堅持無農藥，每季作物輪種於小屋周圍。入住可參與農事、騎鐵馬遊縱谷、在田埂上看雲層飄過中央山脈。",
        "hero_image_url": img("1464226184884-fa280b87b3fb", 1600),
        "base_price": 5500, "max_guests": 4, "status": "published",
        "amenities": ["有機農場", "鐵馬出借", "農家早餐", "觀星草坪"],
        "room_types": [{"name": "農宅套房", "description": "田園景觀、木造建築", "price": 5500, "capacity": 2}],
        "images": [
            {"image_url": img("1500076656116-558b578dba9d"), "alt_text": "花東縱谷", "sort_order": 1},
        ],
        "tags": ["farm", "east-rift-valley", "cycling"],
        "location_config": {"address": "台東縣池上鄉大坡路50號"},
    },
    {
        "slug": "kinmen-granite-house",
        "name": "金門石厝", "destination": "金門", "region": "island",
        "summary": "花崗岩砌成的閩南老厝，保留彈孔痕跡的建築記憶與清靜戰地氛圍。",
        "story": "老厝兩百年，牆上的彈孔是歷史的紋路。設計師選擇不填補、不遮蓋，讓每道裂痕都說話。庭院種了金門特有的高梁，秋天一片醺紅。",
        "hero_image_url": img("1489516084086-4d99f34de8c3", 1600),
        "base_price": 5000, "max_guests": 4, "status": "published",
        "amenities": ["閩南建築", "戰地導覽", "金門高梁體驗", "單車出借"],
        "room_types": [{"name": "閩南石室", "description": "花崗岩牆、天井景", "price": 5000, "capacity": 2}],
        "images": [
            {"image_url": img("1439405374710-b4f7d8e96300"), "alt_text": "金門老厝", "sort_order": 1},
        ],
        "tags": ["island", "heritage", "military"],
        "location_config": {"address": "金門縣金城鎮珠浦北路12號"},
    },
    {
        "slug": "lugang-merchant-house",
        "name": "鹿港商行", "destination": "鹿港", "region": "central",
        "summary": "清代商行改建的七間客棧，台灣最完整的清代街屋住宿體驗。",
        "story": "光緒年間的商行，主人選擇最低度的干預，讓七間客房保有格局原貌。舊帳房成了圖書室，穀倉是早餐室，鹿港小鎮的古韻從四面湧進。",
        "hero_image_url": img("1519125323398-675f0ddb6308", 1600),
        "base_price": 5800, "max_guests": 2, "status": "published",
        "amenities": ["清代建築", "人力車導覽", "老城餐廳群", "廟宇巡禮"],
        "room_types": [{"name": "商行老房", "description": "紅磚牆、木格窗", "price": 5800, "capacity": 2}],
        "images": [
            {"image_url": img("1555396273-b57e4f5a2b67"), "alt_text": "鹿港街景", "sort_order": 1},
        ],
        "tags": ["heritage", "city", "temple"],
        "location_config": {"address": "彰化縣鹿港鎮中山路18號"},
    },
    {
        "slug": "orchid-island-shore",
        "name": "蘭嶼海居", "destination": "蘭嶼", "region": "island",
        "summary": "達悟族部落旁的海邊三棟木屋，拼板舟晨出可與飛魚季同行。",
        "story": "每年三至六月是飛魚季，部落老人黎明出海，木屋的後院即是船塢。入住前，主人會介紹達悟文化，每晚提供現做芋頭粽與飛魚乾。",
        "hero_image_url": img("1507525428034-b723cf961d3e", 1600),
        "base_price": 6000, "max_guests": 4, "status": "published",
        "amenities": ["拼板舟體驗", "飛魚季", "達悟文化課", "海灘直達"],
        "room_types": [{"name": "海邊木屋", "description": "海景、部落風格裝飾", "price": 6000, "capacity": 2}],
        "images": [
            {"image_url": img("1489516084086-4d99f34de8c3"), "alt_text": "蘭嶼海景", "sort_order": 1},
        ],
        "tags": ["island", "indigenous", "fishing"],
        "location_config": {"address": "台東縣蘭嶼鄉椰油村20號"},
    },
    {
        "slug": "yilan-hotspring-garden",
        "name": "宜蘭湯泉苑", "destination": "宜蘭", "region": "north",
        "summary": "四棟獨立湯屋圍繞中央日式庭園，碳酸氫鈉泉在竹林靜谷中湧出。",
        "story": "每棟湯屋皆有私人庭院與露天岩池，四周竹林阻隔一切聲音。主人在庭院種植台灣香草，提供晨間草本茶與手作溫泉煮蛋早餐。",
        "hero_image_url": img("1544787219-7f47ccb76574", 1600),
        "base_price": 8200, "max_guests": 2, "status": "published",
        "amenities": ["私人湯屋", "日式庭園", "香草茶", "岩池泡湯"],
        "room_types": [{"name": "私人湯屋", "description": "獨立院落、岩石露天池", "price": 8200, "capacity": 2}],
        "images": [
            {"image_url": img("1542718610-a1031fc1c62a"), "alt_text": "溫泉庭院", "sort_order": 1},
        ],
        "tags": ["hot-spring", "japanese-style", "garden"],
        "location_config": {"address": "宜蘭縣員山鄉蓁巷路88號"},
    },
]

# ── BRAND PAGES (20) ──────────────────────────────────────────────────────────
BRAND_PAGES = [
    {"slug": "brand-design-philosophy", "title": "設計哲學：空間即主人", "summary": "探索我們如何以「空間本身即服務」為選品核心。", "cover_image_url": img("1520608760-4ffe3a7f0b62"), "tags": ["design", "philosophy"]},
    {"slug": "brand-material-palette", "title": "選材：檜木、花崗岩、竹與光", "summary": "在地建材如何定義台灣私宿的觸感語言。", "cover_image_url": img("1524758631624-e2822b8b6b4e"), "tags": ["materials", "design"]},
    {"slug": "brand-curation-criteria", "title": "私宿選品標準", "summary": "每間入選的私宿須通過哪些面向的親身評核。", "cover_image_url": img("1566073771259-470b1ae04f5c"), "tags": ["curation", "process"]},
    {"slug": "brand-founder-story", "title": "品牌緣起：一次意外的過夜", "summary": "創辦人因緣際會住入南投農宅，從此改變了對旅行的定義。", "cover_image_url": img("1512917774080-9991f1c4c750"), "tags": ["story", "founder"]},
    {"slug": "brand-what-private-means", "title": "什麼是「真正的私密」", "summary": "在全包棟、隱密地址、最少外人打擾的三個層次解讀私宿意義。", "cover_image_url": img("1571003123894-1f0594d2b5d9"), "tags": ["private", "concept"]},
    {"slug": "brand-service-vs-hospitality", "title": "服務與款待之別", "summary": "我們偏好款待而非制式服務，差異在哪裡？", "cover_image_url": img("1551524164-687a55dd1126"), "tags": ["hospitality", "service"]},
    {"slug": "brand-architecture-review", "title": "建築讀本：鋼構、木構與土磚", "summary": "三種結構系統如何與台灣地理氣候對話。", "cover_image_url": img("1487958449943-2429e8be8625"), "tags": ["architecture", "review"]},
    {"slug": "brand-partner-honestbee", "title": "合作夥伴：在地食材供應鏈", "summary": "與宜蘭小農合作的背後，是一條看不見的食材路徑。", "cover_image_url": img("1464226184884-fa280b87b3fb"), "tags": ["partner", "food"]},
    {"slug": "brand-quiet-luxury-manifesto", "title": "安靜奢華宣言", "summary": "不以奢華為目的，而以安靜為前提——Slowfield Stays 的品牌立場。", "cover_image_url": img("1560185893-a55c60b6b1bb"), "tags": ["manifesto", "luxury"]},
    {"slug": "brand-seasonal-selection", "title": "四季選品：時令帶動推薦", "summary": "春梅、夏海、秋楓、冬湯——季節如何影響我們的策展。", "cover_image_url": img("1466781662440-ab1c2cc39a8e"), "tags": ["seasonal", "selection"]},
    {"slug": "brand-photography-guide", "title": "影像指南：如何拍出宿空間的靈魂", "summary": "不做廣告修圖，只做真實光線——私宿影像的美學原則。", "cover_image_url": img("1506905705657-08c2a30c8e9a", 1600), "tags": ["photography", "guide"]},
    {"slug": "brand-inquiry-experience", "title": "詢價是體驗的開始", "summary": "為什麼我們不做即時訂房？一封手寫回信是如何形成的。", "cover_image_url": img("1562516710-e6d7bd48e8d5"), "tags": ["inquiry", "experience"]},
    {"slug": "brand-sourcing-east-coast", "title": "東海岸之旅：選品田調紀錄", "summary": "一週五個縣市的實地踏查，花東這片海岸給了我們什麼啟示。", "cover_image_url": img("1532622785990-d221f26c9fef"), "tags": ["sourcing", "east-coast"]},
    {"slug": "brand-local-crafts", "title": "在地工藝：從竹編到陶器", "summary": "我們如何為每間宿舍選入一件在地工藝品，讓空間有記憶點。", "cover_image_url": img("1553361371-9b897cd00f6c"), "tags": ["crafts", "local"]},
    {"slug": "brand-slow-travel-ethic", "title": "慢旅行倫理：少而精的選擇哲學", "summary": "在過度旅遊的時代，我們為什麼主張少一點、深一點。", "cover_image_url": img("1500076656116-558b578dba9d"), "tags": ["slow-travel", "ethics"]},
    {"slug": "brand-lighting-design", "title": "光源設計：夜晚的空間語言", "summary": "我們入選的宿舍如何用燈光定義氣氛而非照明。", "cover_image_url": img("1524758631624-e2822b8b6b4e"), "tags": ["lighting", "design"]},
    {"slug": "brand-host-profile-alice", "title": "主人側寫：Alice 與她的太魯閣石居", "summary": "一位前建築師如何用退休後的熱忱蓋起一棟住宿哲學館。", "cover_image_url": img("1626436080367-7be4d2e0c5a1"), "tags": ["host", "profile"]},
    {"slug": "brand-amenity-philosophy", "title": "配備哲學：有與沒有之間的選擇", "summary": "我們為什麼不提供電視，而是提供一整排書？", "cover_image_url": img("1448375240586-882707db888b"), "tags": ["amenity", "philosophy"]},
    {"slug": "brand-environmental-commitment", "title": "環境承諾：在旅行中減少足跡", "summary": "從日常備品到廢水處理，我們對合作宿舍的環境要求。", "cover_image_url": img("1576091160550-2173dba999ef"), "tags": ["environment", "sustainability"]},
    {"slug": "brand-year-in-review-2025", "title": "2025 年度回顧", "summary": "56 間宿舍、1,200 筆詢價、18 個縣市——一年的台灣私宿地圖。", "cover_image_url": img("1523475996614-7b0456b21910"), "tags": ["review", "annual"]},
]

# ── DINING PAGES (20) ─────────────────────────────────────────────────────────
DINING_PAGES = [
    {"slug": "dining-alishan-wild-tea", "title": "阿里山野放茶：葉片裡的海拔滋味", "summary": "1,400 公尺的手採輕發酵茶，在木桌上用蓋碗慢慢泡開一個早晨。", "cover_image_url": img("1576091160550-2173dba999ef"), "tags": ["tea", "alishan"]},
    {"slug": "dining-tainan-beef-soup", "title": "台南牛肉湯：凌晨四點的儀式", "summary": "屠宰場直送的溫體牛，在日出前的小巷裡燙出一碗清澈的台南早晨。", "cover_image_url": img("1555396273-b57e4f5a2b67"), "tags": ["tainan", "breakfast"]},
    {"slug": "dining-yilan-clam-rice", "title": "宜蘭蛤蜊飯：河口的味道記憶", "summary": "宜蘭蘭陽溪出海口的文蛤，清炊後鋪在三星米飯上，鹹鮮相遇的純粹。", "cover_image_url": img("1464226184884-fa280b87b3fb"), "tags": ["yilan", "seafood"]},
    {"slug": "dining-hakka-mochi", "title": "客家麻糬：美濃的慢食節奏", "summary": "用柴火糯米蒸熟、手工搗製的傳統客家麻糬，沾花生糖粉入口即化。", "cover_image_url": img("1553361371-9b897cd00f6c"), "tags": ["hakka", "mochi"]},
    {"slug": "dining-penghu-squid", "title": "澎湖炙燒花枝：島嶼午後的炭火", "summary": "現撈花枝在漁港邊直火燒烤，佐以澎湖九層塔醬，是整個夏天的滋味。", "cover_image_url": img("1489516084086-4d99f34de8c3"), "tags": ["penghu", "seafood"]},
    {"slug": "dining-aboriginal-millet-wine", "title": "原住民小米酒：部落共食的開場白", "summary": "達悟族傳統釀製的小米酒，在蘭嶼海邊的部落餐桌上，先乾為敬。", "cover_image_url": img("1507525428034-b723cf961d3e"), "tags": ["aboriginal", "wine"]},
    {"slug": "dining-lukang-oyster-omelette", "title": "鹿港蚵仔煎：百年老灶的鍋氣", "summary": "彰化近海肥美蚵仔，混入番薯粉與雞蛋，在百年柴灶鐵鍋裡煎出的是老城的溫度。", "cover_image_url": img("1519125323398-675f0ddb6308"), "tags": ["lukang", "street-food"]},
    {"slug": "dining-hualien-wild-boar", "title": "花蓮山豬肉：山林裡的蛋白質", "summary": "阿美族獵人上山所獲的山豬，以月桃葉包裹蒸煮，野性而清甜。", "cover_image_url": img("1626436080367-7be4d2e0c5a1"), "tags": ["hualien", "aboriginal"]},
    {"slug": "dining-nantou-mushroom-feast", "title": "南投菇宴：森林底下的鮮味", "summary": "埔里無數菇農中精選一家，從菌棒採收到上桌，一頓只用菇的完整晚餐。", "cover_image_url": img("1506905705657-08c2a30c8e9a"), "tags": ["nantou", "vegetarian"]},
    {"slug": "dining-kinmen-braised-pork", "title": "金門紅糟肉：酒鄉裡的慢火滷味", "summary": "以金門高梁酒糟醃漬三天，炸至金黃的金門特色古早味豬肉，沾老醋入口。", "cover_image_url": img("1439405374710-b4f7d8e96300"), "tags": ["kinmen", "pork"]},
    {"slug": "dining-taroko-river-shrimp", "title": "太魯閣溪蝦：清流中的山珍", "summary": "太魯閣清澈溪水中以竹籠捕獲的溪蝦，水煮後蘸薑絲米酒，鮮甜透骨。", "cover_image_url": img("1532622785990-d221f26c9fef"), "tags": ["taroko", "river"]},
    {"slug": "dining-sun-moon-lake-fish", "title": "日月潭水社柳魚：湖心的一道鱗光", "summary": "日月潭特有的水社柳魚，清蒸後以香菜與薑片簡單調味，湖水的清冽藏在肉裡。", "cover_image_url": img("1523475996614-7b0456b21910"), "tags": ["sun-moon-lake", "fish"]},
    {"slug": "dining-kenting-fruit-plate", "title": "墾丁熱帶水果盤：南國的甜意", "summary": "愛文芒果、蓮霧、龍眼、百香果——恆春半島午後水果攤的每一顆都像在說謝謝。", "cover_image_url": img("1505118380757-91f5f5632de0"), "tags": ["kenting", "fruit"]},
    {"slug": "dining-taipei-fine-dim-sum", "title": "台北精緻港點：都市裡的南方早茶", "summary": "幾位香港師傅在大安區開的低調點心舖，蝦餃皮薄到透光，一顆就是一個時辰的工。", "cover_image_url": img("1562516710-e6d7bd48e8d5"), "tags": ["taipei", "dim-sum"]},
    {"slug": "dining-orchid-island-flying-fish", "title": "蘭嶼飛魚：跨越海峽的季節使者", "summary": "每年春天，達悟族人以古法迎接飛魚到來，用火烤與曬乾保留整個季節的鮮味。", "cover_image_url": img("1507525428034-b723cf961d3e"), "tags": ["orchid-island", "flying-fish"]},
    {"slug": "dining-puli-arrowroot-noodle", "title": "埔里粉葛麵：山城的白色細麵", "summary": "以埔里特產葛根製作的白色細麵，清淡透明的湯底，搭配香椿嫩芽，是一碗能讓人安靜下來的早餐。", "cover_image_url": img("1524758631624-e2822b8b6b4e"), "tags": ["puli", "noodle"]},
    {"slug": "dining-east-coast-sunset-bbq", "title": "東海岸夕燒烤：海風下的炭火料理", "summary": "台11線旁的無名烤攤，夕陽剛沉入海面，爐上的旗魚片已經飄起白煙。", "cover_image_url": img("1500076656116-558b578dba9d"), "tags": ["east-coast", "bbq"]},
    {"slug": "dining-rice-field-bento", "title": "池上便當：一塊田的能量", "summary": "池上米在池上烹調，配上魯肉與炒時蔬，木盒打開的那刻是台東最誠實的滋味。", "cover_image_url": img("1464226184884-fa280b87b3fb"), "tags": ["taitung", "bento"]},
    {"slug": "dining-green-island-sashimi", "title": "綠島生魚片：黑潮海流的恩賜", "summary": "黑潮從菲律賓帶來的鬼頭刀、旗魚與鯖魚，漁夫在碼頭現殺片成薄片，只加一點山葵。", "cover_image_url": img("1489516084086-4d99f34de8c3"), "tags": ["green-island", "sashimi"]},
    {"slug": "dining-wuling-highland-vegetable", "title": "武陵高山蔬菜：霧中菜園的滋味", "summary": "武陵農場海拔 2,000 公尺的小白菜與高麗菜，在霜後採收，甜度是平地的三倍。", "cover_image_url": img("1576091160550-2173dba999ef"), "tags": ["highland", "vegetables"]},
]

# ── ACTIVITY PAGES (20) ───────────────────────────────────────────────────────
ACTIVITY_PAGES = [
    {"slug": "activity-tea-picking-alishan", "title": "採茶半日遊：阿里山茶農帶路", "summary": "跟著茶農清晨採摘，手炒體驗第一泡輕發酵茶的誕生。", "cover_image_url": img("1576091160550-2173dba999ef"), "tags": ["tea", "workshop"]},
    {"slug": "activity-taroko-hidden-trail", "title": "太魯閣隱藏步道：峽谷深處的靜行", "summary": "繞過觀光人潮的私房步道，峽谷石壁就在肩膀一側。", "cover_image_url": img("1532622785990-d221f26c9fef"), "tags": ["hiking", "taroko"]},
    {"slug": "activity-kayak-yilan-river", "title": "宜蘭河口獨木舟：紅樹林晨划", "summary": "日出時分入水，槳聲劃過紅樹林與白鷺鷥的覓食場域。", "cover_image_url": img("1464226184884-fa280b87b3fb"), "tags": ["kayak", "yilan"]},
    {"slug": "activity-penghu-kite-surf", "title": "澎湖風箏衝浪：季風的速度", "summary": "澎湖東北季風全球知名，三小時的基礎課程，讓風把你帶離岸邊。", "cover_image_url": img("1489516084086-4d99f34de8c3"), "tags": ["kite-surf", "penghu"]},
    {"slug": "activity-meinong-paper-making", "title": "美濃造紙工坊：客家手工紙的誕生", "summary": "竹漿在紙簾上緩緩凝固，一張紙是一個下午的等待與讚嘆。", "cover_image_url": img("1553361371-9b897cd00f6c"), "tags": ["craft", "hakka"]},
    {"slug": "activity-lugang-temple-tour", "title": "鹿港廟宇巡禮：神明的住所設計學", "summary": "以建築視角走訪鹿港七廟，燕尾脊、八卦藻井與剪黏工藝的解讀之旅。", "cover_image_url": img("1519125323398-675f0ddb6308"), "tags": ["heritage", "temple"]},
    {"slug": "activity-east-coast-cycling", "title": "台11線單車：海岸線上的節奏感", "summary": "從靜浦到長濱的 90 公里海岸，海風、礁石與望海的農路。", "cover_image_url": img("1500076656116-558b578dba9d"), "tags": ["cycling", "east-coast"]},
    {"slug": "activity-orchid-island-culture", "title": "蘭嶼達悟文化沉浸：拼板舟與海洋觀", "summary": "部落長老親授拼板舟的象徵意義，並帶領夜間海龜守護巡視。", "cover_image_url": img("1507525428034-b723cf961d3e"), "tags": ["indigenous", "culture"]},
    {"slug": "activity-nantou-hot-air-balloon", "title": "南投熱氣球：清晨山谷的鳥瞰視角", "summary": "霧散之前升空，俯瞰日月潭與濁水溪的曲折輪廓。", "cover_image_url": img("1523475996614-7b0456b21910"), "tags": ["balloon", "aerial"]},
    {"slug": "activity-forest-yoga-taipingshan", "title": "太平山森林瑜珈：古木之間的靜息", "summary": "千年紅檜環繞的場地，由資深老師帶領兩小時的靜心呼吸練習。", "cover_image_url": img("1448375240586-882707db888b"), "tags": ["yoga", "forest"]},
    {"slug": "activity-taroko-geology-walk", "title": "太魯閣地質解讀：大理石的時間刻度", "summary": "地質師帶路，讀懂每一道斷層、每一處滲水與峽谷形成的億年歷程。", "cover_image_url": img("1626436080367-7be4d2e0c5a1"), "tags": ["geology", "education"]},
    {"slug": "activity-alishan-sunrise-watch", "title": "阿里山日出：日月切換的儀式", "summary": "凌晨三點出發，祝山觀日台靜靜等候那道橘紅從玉山山脈緩緩升起。", "cover_image_url": img("1466781662440-ab1c2cc39a8e"), "tags": ["sunrise", "alishan"]},
    {"slug": "activity-kinmen-battlefield", "title": "金門古戰場徒步：冷戰地景的另一種旅行", "summary": "隨退伍老兵穿越坑道與碉堡，在蓬萊溪旁聽一段 823 砲戰的親歷記述。", "cover_image_url": img("1439405374710-b4f7d8e96300"), "tags": ["history", "kinmen"]},
    {"slug": "activity-taitung-star-gazing", "title": "台東暗空觀星：銀河的完整版", "summary": "台東縱谷的無光害區，星空攝影師帶您尋找適合拍下銀河的最佳角度。", "cover_image_url": img("1464226184884-fa280b87b3fb"), "tags": ["stargazing", "night"]},
    {"slug": "activity-surfing-jinzun", "title": "金樽衝浪：東海岸最入門的浪點", "summary": "台東金樽漁港旁的初學者沙灘，全年適合衝浪，教練提供全中文基礎教學。", "cover_image_url": img("1505118380757-91f5f5632de0"), "tags": ["surfing", "taitung"]},
    {"slug": "activity-winery-tour-puli", "title": "埔里酒廠巡禮：紹興酒的誕生現場", "summary": "跟隨釀酒師穿越酒窖，試飲不同年份的埔里紹興，了解糯米轉化的化學詩意。", "cover_image_url": img("1524758631624-e2822b8b6b4e"), "tags": ["wine", "tour"]},
    {"slug": "activity-bamboo-workshop", "title": "竹編工坊：一條竹片的柔韌哲學", "summary": "傳統竹藝師教授竹編基礎，從破竹、磨邊到編出一只小竹籃，手中生出一份安靜。", "cover_image_url": img("1553361371-9b897cd00f6c"), "tags": ["bamboo", "craft"]},
    {"slug": "activity-organic-farm-half-day", "title": "有機農場半日體驗：從土壤到餐桌", "summary": "宜蘭有機農場採摘、烹調到共食，一個上午完整走過一頓飯的旅程。", "cover_image_url": img("1500076656116-558b578dba9d"), "tags": ["farm", "organic"]},
    {"slug": "activity-whale-watching-hualien", "title": "花蓮賞鯨：黑潮上的巨大靜默", "summary": "每年四月至十月，搭船出港兩小時，在太平洋寬廣海面等待抹香鯨的呼吸孔。", "cover_image_url": img("1532622785990-d221f26c9fef"), "tags": ["whale", "marine"]},
    {"slug": "activity-jiufen-lantern-night", "title": "九份夜雨提燈行：金礦鎮的霧中步行", "summary": "細雨夜晚的九份比白天更接近它原本的樣子，燈籠的橘紅在濕石板上暈染。", "cover_image_url": img("1551524164-687a55dd1126"), "tags": ["jiufen", "night"]},
]

# ── JOURNAL PAGES (20) ────────────────────────────────────────────────────────
JOURNAL_PAGES = [
    {"slug": "journal-first-time-private-stay", "title": "第一次住私宿：需要知道的七件事", "summary": "從訂房流程到與主人溝通的心理準備，給私宿新手的完整指引。", "cover_image_url": img("1512917774080-9991f1c4c750"), "tags": ["guide", "first-time"]},
    {"slug": "journal-slow-hualien-3days", "title": "花蓮慢三日：什麼都不趕的旅行節奏", "summary": "不排景點、不訂行程，只帶著一本書和一個背包，讓花蓮帶路。", "cover_image_url": img("1626436080367-7be4d2e0c5a1"), "tags": ["hualien", "slow-travel"]},
    {"slug": "journal-single-travel-guide", "title": "一個人的台灣私宿攻略", "summary": "哪些私宿適合獨遊？獨行者如何在陌生空間裡找到安全感？", "cover_image_url": img("1448375240586-882707db888b"), "tags": ["solo", "guide"]},
    {"slug": "journal-mountain-vs-sea", "title": "山還是海？台灣兩種截然不同的安靜", "summary": "同樣是靜謐，阿里山的沉澱與墾丁的張揚之間，你更需要哪一種？", "cover_image_url": img("1506905705657-08c2a30c8e9a"), "tags": ["nature", "comparison"]},
    {"slug": "journal-taiwan-autumn-travel", "title": "台灣秋旅：最好的季節，最少人知道", "summary": "十月到十一月，楓紅、菊花茶與秋芒的台灣，為什麼是最被低估的旅遊時節。", "cover_image_url": img("1466781662440-ab1c2cc39a8e"), "tags": ["autumn", "seasonal"]},
    {"slug": "journal-two-nights-sun-moon", "title": "日月潭兩夜：等一場完整的清晨霧氣", "summary": "第一夜適應，第二夜才真的看見日月潭的靜。帶走一段你在湖邊的記憶。", "cover_image_url": img("1523475996614-7b0456b21910"), "tags": ["sun-moon-lake", "itinerary"]},
    {"slug": "journal-packing-light", "title": "輕量打包術：私宿旅行只需要這些", "summary": "三天兩夜的私宿行，一個 20 升背包裡可以裝進什麼？整理清單與心法。", "cover_image_url": img("1560185893-a55c60b6b1bb"), "tags": ["packing", "tips"]},
    {"slug": "journal-host-conversation", "title": "與主人的對話是旅行的一部分", "summary": "如何開口問、如何聆聽，讓主人的故事成為旅行最珍貴的收穫。", "cover_image_url": img("1551524164-687a55dd1126"), "tags": ["host", "conversation"]},
    {"slug": "journal-east-coast-road-trip", "title": "台11線公路旅行：海岸是一條閱讀路線", "summary": "從花蓮南下台東，海岸公路上的十個停靠點，都是台灣最誠實的地理切面。", "cover_image_url": img("1500076656116-558b578dba9d"), "tags": ["road-trip", "east-coast"]},
    {"slug": "journal-two-person-retreat", "title": "兩人的私宿退休計畫", "summary": "什麼都不安排的四天三夜，在阿里山山腰，兩個人如何重新找到對話的頻率。", "cover_image_url": img("1576091160550-2173dba999ef"), "tags": ["couple", "retreat"]},
    {"slug": "journal-photography-in-taiwan", "title": "台灣攝影旅行：光線的十種台灣特有面貌", "summary": "從霧山清晨到漁港夕照，哪些時段、哪些縣市，對攝影人最慷慨。", "cover_image_url": img("1532622785990-d221f26c9fef"), "tags": ["photography", "guide"]},
    {"slug": "journal-rainy-stay-guide", "title": "下雨天，反而是住進去的理由", "summary": "哪些私宿在雨天更好？雨聲、霧景與壁爐邊的時光，如何讓壞天氣成為資產。", "cover_image_url": img("1448375240586-882707db888b"), "tags": ["rainy", "indoor"]},
    {"slug": "journal-taiwan-indigenous-travel", "title": "原住民文化旅行入門指南", "summary": "如何以尊重的方式進入部落、參與文化活動，並讓你的消費留在社區。", "cover_image_url": img("1507525428034-b723cf961d3e"), "tags": ["indigenous", "responsible"]},
    {"slug": "journal-kinmen-off-season", "title": "淡季的金門：還給它本來的樣子", "summary": "十二月的金門沒有遊客，只有老人、菊花、高梁香與無盡的灰藍天光。", "cover_image_url": img("1439405374710-b4f7d8e96300"), "tags": ["kinmen", "off-season"]},
    {"slug": "journal-weekend-taipei-escape", "title": "週末從台北出走：兩小時以內的私宿選擇", "summary": "福隆、礁溪、三峽——不用長假，週五晚間出發，週日下午回來，剛好。", "cover_image_url": img("1505118380757-91f5f5632de0"), "tags": ["taipei", "weekend"]},
    {"slug": "journal-family-with-kids", "title": "帶孩子住私宿：讓旅行教會他們看的能力", "summary": "親子私宿的選擇標準、入住準備，以及如何讓孩子在安靜中找到自己的好奇心。", "cover_image_url": img("1464226184884-fa280b87b3fb"), "tags": ["family", "kids"]},
    {"slug": "journal-hot-spring-guide", "title": "台灣溫泉指南：泉質、地點與私湯禮儀", "summary": "碳酸泉、硫黃泉、食鹽泉——地理決定泉質，我們幫你選對泡法與時間。", "cover_image_url": img("1544787219-7f47ccb76574"), "tags": ["hot-spring", "guide"]},
    {"slug": "journal-year-end-retreat", "title": "歲末的退隱計畫：給自己一個沒有手機的四天", "summary": "十二月的私宿旅行，不做年終回顧，只是停下來，讓身體告訴你什麼是夠了。", "cover_image_url": img("1542718610-a1031fc1c62a"), "tags": ["retreat", "digital-detox"]},
    {"slug": "journal-architecture-stays", "title": "住進建築之中：十間以設計著稱的台灣私宿", "summary": "清水模、咕咾石、紅檜、竹構——十種台灣在地建築語言的住宿代表作。", "cover_image_url": img("1487958449943-2429e8be8625"), "tags": ["architecture", "design"]},
    {"slug": "journal-travel-with-book", "title": "帶一本書出發：旅行書單的台灣選擇", "summary": "六本讀完後會想訂票前往台灣某個角落的書，我們的書架常備款。", "cover_image_url": img("1512917774080-9991f1c4c750"), "tags": ["books", "inspiration"]},
]


# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    token = login()

    # Stays
    print("\n=== Creating 20 Stays ===")
    for s in STAYS:
        create_stay(token, {**s, "status": "draft"})

    # Brand pages
    print("\n=== Creating 20 Brand Pages ===")
    for p in BRAND_PAGES:
        create_page(token, {**p, "content_type": "brand", "status": "draft",
                            "body": p["summary"] + "\n\n" + p["summary"]})

    # Dining pages
    print("\n=== Creating 20 Dining Pages ===")
    for p in DINING_PAGES:
        create_page(token, {**p, "content_type": "dining", "status": "draft",
                            "body": p["summary"] + "\n\n" + p["summary"]})

    # Activity pages
    print("\n=== Creating 20 Activity Pages ===")
    for p in ACTIVITY_PAGES:
        create_page(token, {**p, "content_type": "activity", "status": "draft",
                            "body": p["summary"] + "\n\n" + p["summary"]})

    # Journal pages
    print("\n=== Creating 20 Journal Pages ===")
    for p in JOURNAL_PAGES:
        create_page(token, {**p, "content_type": "journal", "status": "draft",
                            "body": p["summary"] + "\n\n" + p["summary"]})

    print("\nDone. Check the admin panel to review and publish.")


if __name__ == "__main__":
    main()
