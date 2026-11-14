/**
 * Image library for the fictional showcase site (Slowfield Stays / 禾境).
 *
 * Every image is AI-generated from docs/showcase/AI_IMAGE_PROMPTS.md and lives
 * in 素材/ai/<file>. No photography of any real property or client is used.
 *
 * Content refers to images as:
 *   "real:<key>"  a role in the fictional villa 禾境 (VILLA below, or an ALIAS
 *                 that reuses one of those roles)
 *   "ai:<key>"    a scene outside the villa (AI below)
 * An image that has not been generated yet resolves to its fallback, or to
 * nothing — in which case the item it illustrates stays unpublished.
 */

export const AI_DIR = "素材/ai";

/** The 禾境 villa: one generated image per role. */
export const VILLA = {
  exterior_field: { file: "villa-exterior-field.jpg", alt: "冬山稻田間的禾境白色雙棟建築" },
  exterior_dusk: { file: "villa-exterior-dusk.jpg", alt: "傍晚亮燈的禾境與前方稻田" },
  pool_wide: { file: "villa-courtyard-pool.jpg", alt: "兩棟白色建築之間的中庭泳池" },
  pool_night: { file: "villa-pool-night.jpg", alt: "夜晚點燈的中庭泳池" },
  pool_floats: { file: "villa-pool-floats.jpg", alt: "漂著泳圈的午後泳池" },
  living_white: { file: "villa-living-room.jpg", alt: "純白挑高客廳與家庭劇院" },
  dining_field: { file: "villa-dining-field-view.jpg", alt: "落地窗外是整片稻田的用餐區" },
  kitchen_round: { file: "villa-kitchen.jpg", alt: "開放式廚房與大圓桌" },
  room_king: { file: "villa-master-suite.jpg", alt: "主臥套房與獨立浴缸" },
  room_twin: { file: "villa-twin-room.jpg", alt: "純白雙床房" },
  bath_tub: { file: "villa-bathtub.jpg", alt: "窗邊的獨立浴缸" },
  breakfast_spread: { file: "villa-breakfast.jpg", alt: "面向稻田的早餐桌" },
  bbq: { file: "villa-poolside-bbq.jpg", alt: "池畔烤爐上的肉品與時蔬" },
  billiards: { file: "villa-billiards.jpg", alt: "撞球桌" },
  mahjong: { file: "villa-mahjong.jpg", alt: "電動麻將桌" },
  kids_room: { file: "villa-kids-play-area.jpg", alt: "面向泳池的兒童遊戲區" },
  pet_room: { file: "villa-pet-friendly.jpg", alt: "準備好睡墊與餐碗的毛孩友善客房" },
  corridor: { file: "villa-entrance-hall.jpg", alt: "純白玄關與植栽" },
  brand_wall: { file: "villa-reception-lounge.jpg", alt: "迎賓起居區" },
  whisky: { file: "villa-evening-drink.jpg", alt: "夜晚池畔的一杯威士忌" },
  rice_field_walk: { file: "villa-morning-coffee-paddies.jpg", alt: "稻田邊端著咖啡的早晨" },
  couple_field: { file: "villa-elders-paddy-walk.jpg", alt: "稻田小徑上散步的長輩" },
  hotpot: { file: "villa-hotpot-dinner.jpg", alt: "大圓桌上的火鍋晚餐" },
  coffee: { file: "villa-coffee-corner.jpg", alt: "早晨現煮咖啡" },
  amenity_shelf: { file: "villa-bath-amenities.jpg", alt: "木架上的沐浴備品" },
};

/** Older content keys that reuse a villa role (keeps content.mjs readable). */
export const ALIAS = {
  exterior_sign: "exterior_field", exterior_sign2: "exterior_field", facade_green: "exterior_dusk",
  pool_side: "pool_wide", pool_side2: "pool_wide", pool_reader: "pool_wide",
  pool_hat: "pool_floats", pool_hat2: "pool_floats", pool_family: "pool_floats",
  living_tv: "living_white", living_open: "living_white", living_lounge: "living_white", ktv_night: "living_white",
  dining_field2: "dining_field", kitchen_round2: "kitchen_round", kitchen: "kitchen_round",
  bath_tub2: "bath_tub", room_window: "room_twin", room_tv: "room_twin", room_soft: "room_king", room_soft2: "room_twin",
  breakfast_spread2: "breakfast_spread", breakfast_plate: "breakfast_spread", billiards2: "billiards",
  kids_room2: "kids_room", tea_jars: "coffee", snack_shelf: "coffee", dog_bath: "pet_room", chef_prep: "hotpot",
};

/** Scenes outside the villa. `fallback` is a villa role used until the file exists. */
export const AI = {
  dongshan_river_cycling: { file: "activity-dongshan-river-cycling.jpg", fallback: "rice_field_walk", alt: "冬山河畔的自行車道" },
  meihua_lake_morning: { file: "activity-meihua-lake-morning.jpg", fallback: "couple_field", alt: "清晨的梅花湖" },
  sanxing_scallion: { file: "activity-sanxing-scallion-farm.jpg", fallback: null, alt: "三星蔥田體驗" },
  luodong_night_market: { file: "activity-luodong-night-market.jpg", fallback: null, alt: "羅東夜市" },
  celebration_setup: { file: "service-celebration-setup.jpg", fallback: "pool_floats", alt: "池畔慶生佈置" },
  shuttle_service: { file: "service-shuttle.jpg", fallback: null, alt: "接駁車停在民宿門口" },
  rainy_day_yilan: { file: "journal-rainy-day-yilan.jpg", fallback: "room_twin", alt: "雨天窗邊" },
  yilan_breakfast_map: { file: "journal-yilan-breakfast-map.jpg", fallback: null, alt: "宜蘭在地早餐" },
  luozhuang_sakura: { file: "journal-luozhuang-sakura.jpg", fallback: null, alt: "羅莊櫻花步道" },
  ridge_concept: { file: "news-hejing-ridge-concept.jpg", fallback: null, alt: "禾境·山嵐 建築概念" },
  moon_mist_hero: { file: "stay-moon-mist-villa-hero.jpg", fallback: null, alt: "埔里茶園間的月霧山居" },
  moon_mist_room: { file: "stay-moon-mist-villa-room.jpg", fallback: null, alt: "月霧山居木造客房" },
  reef_house_hero: { file: "stay-reef-house-hero.jpg", fallback: null, alt: "花蓮豐濱海岸的礁岸之家" },
  reef_house_room: { file: "stay-reef-house-room.jpg", fallback: null, alt: "礁岸之家海景客房" },
};
