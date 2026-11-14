# AI 生成圖片提示詞（交給 ChatGPT）

展示網站使用的全部圖片都由 AI 生成，不使用任何真實民宿或客戶的照片。第一批 14 張（景點、服務情境、規劃中民宿）已生成並存放於 `素材/ai/`；第二批 25 張是虛構旗艦民宿「禾境」的別墅照片，見文件後半。提示詞同時作為日後重生或替換素材的規格。

## 使用方式

1. 若要重生或替換圖片，把下方「共同風格」貼給 ChatGPT，再一次貼一張圖的提示詞。
2. 圖片**照指定檔名**存到 `素材/ai/`（例如 `素材/ai/activity-dongshan-river-cycling.jpg`），存成 JPG。
3. 重新執行本機種子腳本（見 `scripts/showcase/README.md`）。圖片會自動上傳、替換暫用圖；因為缺圖而未上架的內容也會自動上架。腳本只允許本機或 staging，禁止指向正式站。

## 注意事項（請一併告訴 ChatGPT）

- **不要出現可辨識的真人臉孔**：人物只能是背影、側影或遠景，避免肖像權問題。
- **不要出現文字、招牌字樣、商標或品牌包裝**：AI 寫的中文常常是錯字，商標也有侵權風險。
- **真實地點只做「情境示意」**：梅花湖、羅東夜市、羅莊櫻花步道等是真實景點，AI 圖不會完全符合實景。網站上建議標註「情境示意」，或日後換成實拍照、有授權的圖庫照片。
- **不要做成「看起來像特定民宿的實景」**：月霧山居、礁岸之家、禾境·山嵐目前都是規劃中，沒有實體。網站文案已寫明「規劃中」，圖片也請維持概念圖的感覺，不要誤導訪客以為已經有這間房子。
- OpenAI 的使用條款目前把生成圖片的權利歸給使用者，可以商用。正式上線前，仍請確認你使用當下的條款。

## 共同風格（每次先貼這段）

```
You are creating photography for a boutique private-villa brand in Taiwan called
"Slowfield Stays". Style: natural-light editorial travel photography, calm and
airy, soft morning or late-afternoon light, true-to-life colours (no heavy
filters, no HDR look), gentle film grain, generous negative space, shot on a
35mm full-frame camera. Palette that matches the brand: warm white, rice-field
green, sky blue, light oak wood, a touch of terracotta. Absolutely no text,
signage lettering, logos or brand packaging. If people appear, show them from
behind, in silhouette or far away — no recognisable faces. Output a single
photorealistic image, landscape 3:2, at least 2048 px wide.
```

---

## 1. `activity-dongshan-river-cycling.jpg`
- **用途**：精選活動「冬山河騎單車」封面（目前暫用：稻田邊端咖啡的照片）
- **比例**：3:2

```
A quiet riverside cycling path along the Dongshan River in Yilan, Taiwan, early
morning. Flat paved bike lane beside a slow wide river, rice paddies and low
farmhouses on the far bank, mountains softly layered in haze in the distance.
Two bicycles ridden by people seen from behind, small in the frame. Dew on the
grass, pale blue sky with thin clouds.
```

## 2. `activity-meihua-lake-morning.jpg`
- **用途**：精選活動「梅花湖晨間環湖」封面（目前暫用：稻田邊散步的長輩照片）
- **比例**：3:2

```
A calm lake in Yilan, Taiwan at dawn, light mist floating on the water surface,
a slender red-and-white suspension footbridge leading to a small wooded islet,
green hills behind, still reflections. A gravel walking path along the shore in
the foreground. Peaceful, no crowds, one distant walker seen from behind.
(Illustrative scene, not an exact replica of a specific landmark.)
```

## 3. `activity-sanxing-scallion-farm.jpg`
- **用途**：精選活動「三星蔥田：拔蔥、做蔥油餅」封面（**目前未上架，等這張圖**）
- **比例**：3:2

```
A scallion farm in Sanxing, Yilan, Taiwan: neat rows of tall green spring
onions with long white stalks, wet dark soil, low mountains behind. In the
foreground a child's and an adult's hands (no faces) holding a freshly pulled
bunch of scallions with soil on the roots. Soft overcast light, rich greens.
```

## 4. `activity-luodong-night-market.jpg`
- **用途**：精選活動「羅東夜市散步地圖」封面（**目前未上架，等這張圖**）
- **比例**：3:2

```
A lively Taiwanese night market food street at blue hour, warm lantern and
bulb light, steam rising from food stalls, close-up of a stall counter with
fried pork strips in paper bags and bowls of herbal lamb soup, blurred crowd
in the background (no recognisable faces), shallow depth of field. No readable
signs or text anywhere.
```

## 5. `service-celebration-setup.jpg`
- **用途**：服務項目「慶生與求婚佈置」封面（目前暫用：泳池彩虹泳圈照片）
- **比例**：3:2

```
A minimalist white villa courtyard with a long blue swimming pool at dusk,
romantic celebration set-up along the pool edge: clusters of white and
champagne balloons, low candles in glass jars lining the pool, a small table
with a white cream cake and a bouquet of white flowers, string lights overhead.
Elegant and understated, no people, no text or banners.
```

## 6. `service-shuttle.jpg`
- **用途**：服務項目「車站接駁與包車」封面（**目前未上架，等這張圖**）
- **比例**：3:2

```
A clean dark-grey 9-seat van parked on a quiet country road in front of a
modern white villa, rice paddies on both sides, mountains in the distance,
morning light. A driver loading a suitcase seen from behind. No visible licence
plate, no logos or lettering on the van.
```

## 7. `journal-rainy-day-yilan.jpg`
- **用途**：旅遊專欄「宜蘭下雨天，其實很好玩」封面（目前暫用：大窗邊的客房照片）
- **比例**：3:2

```
Looking out from inside a bright minimalist white living room through a large
floor-to-ceiling window on a rainy day: raindrops on the glass, deep green rice
fields and misty mountains outside. On the windowsill a ceramic cup of tea and
an open book. Cosy, calm, soft grey daylight.
```

## 8. `journal-yilan-breakfast-map.jpg`
- **用途**：旅遊專欄「冬山・羅東早餐地圖」封面（**目前未上架，等這張圖**）
- **比例**：3:2

```
Top-down flat lay of a traditional Taiwanese breakfast on a worn wooden table:
a bowl of rice-noodle soup with fried pork, a flaky scallion pancake with egg
folded in paper, a cup of warm soy milk, a sesame flatbread, chopsticks and a
small dish of chili sauce. Morning window light, appetising and honest, no
branded packaging or text.
```

## 9. `journal-luozhuang-sakura.jpg`
- **用途**：禾境子站文章「羅莊櫻花步道」封面（**目前為草稿，等這張圖**）
- **比例**：3:2

```
A long tunnel of pink cherry blossoms arching over a narrow irrigation canal
with a footpath beside it, in a small town in Yilan, Taiwan, early spring
morning. Fallen petals on the water and path, soft pink and green palette,
one person walking away in the distance. (Illustrative scene.)
```

## 10. `news-hejing-ridge-concept.jpg`
- **用途**：慢域消息「禾境·山嵐：2027 籌備中」封面（**目前未上架，等這張圖**）
- **比例**：16:9

```
Architectural concept visualisation of a minimalist white villa set into a
forested mountainside in Yilan, Taiwan, low clouds drifting through the trees,
large glass openings, a narrow infinity pool facing the valley, early morning
mist. Clean modern architecture, rendered photorealistically but clearly a
concept image, no people, no text.
```

## 11. `stay-moon-mist-villa-hero.jpg`
- **用途**：住宿「月霧山居」主圖（**月霧山居目前未上架，需要 11、12 兩張圖**）
- **比例**：16:9

```
Concept image of a small two-room timber cabin with a dark wood exterior and a
wide covered deck, set among terraced tea plantations on a hillside in Puli,
Nantou, Taiwan, at 600 m altitude. Morning fog drifting over the tea rows, soft
diffused light, a wood-burning stove chimney with a thin wisp of smoke.
```

## 12. `stay-moon-mist-villa-room.jpg`
- **用途**：住宿「月霧山居」客房圖
- **比例**：3:2

```
Interior of a warm minimalist timber bedroom: low platform bed with off-white
linen, light oak walls, a large window framing misty tea-covered hills, a small
tea set on a wooden tray by the window, a wood-burning stove in the corner.
Quiet morning light, no people.
```

## 13. `stay-reef-house-hero.jpg`
- **用途**：住宿「礁岸之家」主圖（**礁岸之家目前未上架，需要 13、14 兩張圖**）
- **比例**：16:9

```
Concept image of a low, white, modern single-storey villa on the rugged
Pacific coast of Fengbin, Hualien, Taiwan: dark volcanic reef rocks and tide
pools in front, deep blue ocean, green coastal mountains behind, early sunrise
light. Floor-to-ceiling windows facing the sea, two sea kayaks resting on the
grass.
```

## 14. `stay-reef-house-room.jpg`
- **用途**：住宿「礁岸之家」客房圖
- **比例**：3:2

```
Interior of a bright coastal bedroom with white walls and a pale wood floor, a
king bed with crisp white linen facing a full-width window with an
uninterrupted view of the Pacific Ocean at sunrise, a linen armchair and a
small side table, sheer curtains moving slightly. No people.
```

---

# 第二批：禾境別墅 25 張（取代前客戶實拍照）

展示網站的旗艦民宿「禾境 Hejing Villa」是虛構的。原本使用的是前客戶別墅的實拍照，現在全部改用 AI 圖，因此需要這 25 張。**生成前，網站上禾境的頁面、房型、輪播與相關文章都不會上架。**

## 一定要做到：25 張是同一棟房子

請在**同一個 ChatGPT 對話**裡依序生成，並在第一張之前，先貼上「共同風格」與下面這段「別墅設定」，告訴它：「之後每一張都是這棟別墅，外觀、材質、配色要一致。」

```
THE VILLA (keep identical in every image): "Hejing", a private pool villa in
Dongshan, Yilan, Taiwan. Two minimalist two-storey white buildings with flat
roofs face each other across a 14-metre rectangular courtyard pool lined with
pale blue-grey tiles. Facades: smooth white render, large floor-to-ceiling
glass, slim black window frames, light oak timber screens. Tropical planting
(bird-of-paradise, banana leaves) in white planters along the pool deck, white
sun loungers. The villa sits alone among flat green rice paddies, with low
layered mountains in the distance. Interiors: white walls, light oak floors,
off-white linen, rattan and light-wood furniture, warm terracotta accents,
very uncluttered.
```

存檔位置與方式同上：`素材/ai/<檔名>`，JPG。

### 外觀與泳池

**1. `villa-exterior-field.jpg`**（16:9，首頁與住宿主圖）
```
Wide establishing shot of the villa from across the rice paddies on a clear
morning: the two white buildings low on the horizon, green paddies in the
foreground with a narrow farm path leading toward them, mountains behind,
blue sky with a few clouds.
```

**2. `villa-exterior-dusk.jpg`**（3:2）
```
The villa at blue hour seen from the edge of the paddies: warm interior lights
glowing through the large windows, the courtyard pool glowing aqua between the
buildings, last pink light on the mountains, paddies reflecting the sky.
```

**3. `villa-courtyard-pool.jpg`**（16:9，輪播主圖）
```
Standing at one end of the 14-metre courtyard pool looking down its length:
white buildings on both sides, sun loungers and tropical plants along the deck,
bright midday sun, crisp shadows, calm turquoise water, blue sky above.
```

**4. `villa-pool-night.jpg`**（3:2）
```
The courtyard pool at night with underwater lights on, water glowing soft blue,
warm light from the windows of both buildings, a few stars over the dark
mountains, loungers in silhouette. Calm and quiet, no people.
```

**5. `villa-pool-floats.jpg`**（3:2）
```
Afternoon in the courtyard pool: a rainbow-striped inflatable ring and a
white swan float drifting on the water, a woman in a wide straw hat seen from
behind resting her arms on the pool edge, loungers and plants beyond.
```

### 室內

**6. `villa-living-room.jpg`**（3:2）
```
The double-height white living room: a long off-white sofa, low oak coffee
table, a large wall-mounted screen with a home-theatre sound bar, floor-to-
ceiling glass looking onto the courtyard pool. Bright, airy, uncluttered.
```

**7. `villa-dining-field-view.jpg`**（16:9）
```
The dining area: a long light-oak table with six white chairs in front of a
full-width window that frames nothing but green rice paddies and mountains,
a retro cream fridge and a few plants to the side, soft morning light.
```

**8. `villa-kitchen.jpg`**（3:2）
```
Open-plan kitchen with white cabinetry, light-oak open shelving, a large round
white dining table for ten, pendant lights, a window onto the paddies. Neat,
with a bowl of fruit and a few ceramic dishes as the only props.
```

**9. `villa-master-suite.jpg`**（3:2）
```
The master suite: king bed with white linen and a terracotta throw, light oak
floor, a freestanding white bathtub near a tall window looking out to the rice
fields, sheer curtains, morning light.
```

**10. `villa-twin-room.jpg`**（3:2）
```
A calm twin bedroom: two single beds with crisp white linen, a slim oak
bedside table between them, a large window with the paddies outside, a
wall-mounted TV, minimal decor.
```

**11. `villa-bathtub.jpg`**（3:2）
```
Close view of a freestanding white bathtub beside a floor-to-ceiling window,
green paddies outside, a rolled white towel and a small vase of wildflowers on
an oak stool, soft daylight.
```

**12. `villa-entrance-hall.jpg`**（3:2）
```
The villa's entrance hall: clean white walls, a light oak bench, a tall potted
plant, a white staircase with a slim black handrail, natural light falling
from a high window.
```

**13. `villa-reception-lounge.jpg`**（3:2）
```
A welcoming lounge corner: rattan armchairs, a low table set with a teapot and
two cups, a vase of fresh flowers, a host's hands (no face) pouring tea, the
pool visible through the glass behind.
```

### 餐飲與娛樂

**14. `villa-breakfast.jpg`**（3:2）
```
Breakfast laid on the dining table facing the paddies: seasonal fruit
(wax apples, guava, pineapple), croissants and toast, sausages and greens,
glass jugs of orange juice, a pot of coffee. Bright morning light.
```

**15. `villa-poolside-bbq.jpg`**（3:2）
```
A black gas barbecue grill on the pool deck with steaks, pork belly, prawns,
corn and vegetables sizzling, a side table with plates and tongs, the
turquoise pool beside it, late-afternoon light.
```

**16. `villa-hotpot-dinner.jpg`**（3:2）
```
Evening hot pot on the large round table: two simmering pots, plates of sliced
meat, seafood, mushrooms and greens, many hands with chopsticks reaching in
(no faces), warm pendant light, cosy and lively.
```

**17. `villa-evening-drink.jpg`**（3:2）
```
Close-up of a hand pouring whisky over a large ice cube in a crystal glass on
the poolside table at night, the softly lit pool blurred behind.
```

**18. `villa-coffee-corner.jpg`**（3:2）
```
A coffee corner on an oak counter: a drip coffee machine, ceramic cups, a jar
of tea bags and a small basket of local snacks without packaging labels,
morning sun across the counter.
```

**19. `villa-billiards.jpg`**（3:2）
```
A full-size billiards table with blue cloth in a bright white games room,
balls racked, cues on a wall rack, a window onto the courtyard pool.
```

**20. `villa-mahjong.jpg`**（3:2）
```
An automatic mahjong table with green felt and tiles laid out, four grey
upholstered chairs around it, in a corner of the white living room.
```

### 家庭、毛孩與田野

**21. `villa-kids-play-area.jpg`**（3:2）
```
A children's play corner beside the glass wall onto the pool: a small striped
play tent, a round rug, a wooden play kitchen and toys neatly arranged, bright
and safe-looking, no children shown.
```

**22. `villa-pet-friendly.jpg`**（3:2）
```
A bright guest room prepared for a dog: a round dog bed, two ceramic bowls and
a folded towel on the oak floor, a small dog (any breed) seen from behind
looking out of the window at the paddies.
```

**23. `villa-bath-amenities.jpg`**（3:2）
```
A light-oak wall shelf in the bathroom holding unlabelled amber glass pump
bottles of shampoo, conditioner and body wash, rolled towels and a small plant.
No brand names or labels.
```

**24. `villa-morning-coffee-paddies.jpg`**（3:2）
```
A man seen from behind standing at the edge of the rice paddies at sunrise,
holding a mug of coffee, the white villa small in the background, mist over
the fields.
```

**25. `villa-elders-paddy-walk.jpg`**（3:2）
```
An elderly couple seen from behind walking hand in hand along a narrow path
between green rice paddies in soft morning light, the white villa and
mountains in the distance.
```

## 生成後

1. 確認 25 個檔名都正確放在 `素材/ai/`。
2. 重跑 `scripts/showcase/README.md` 的兩個步驟。禾境的頁面、房型、輪播與文章會自動上架，子站內容也會一併建立。
