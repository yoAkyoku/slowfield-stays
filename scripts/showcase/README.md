# 展示網站內容（showcase seed）

把本機或測試環境的資料庫，換成有真實質感的民宿內容，包括：

- 母站「慢域旅宿」：品牌、住宿、活動、餐飲、服務、專欄、消息
- 禾境子站：首頁、關於、空間、體驗、房價、交通、FAQ、文章

**不可用於正式站**：腳本會刪除它所取代的示範資料；指向 slowfield.example 時會直接拒絕執行。

## 檔案

| 檔案 | 內容 |
|---|---|
| `photos.mjs` | 實拍照與 AI 圖的對照表（檔名、替代文字、缺圖時的暫用圖） |
| `content.mjs` | 母站所有文案（繁中為主，附英文翻譯） |
| `seed.mjs` | 上傳照片、寫入母站內容、整理子站示範資料 |
| `run-child-seed.py` | 用本機照片執行既有的 `scripts/seed_hejing.py`（子站內容） |

## 執行（本機 QA 環境）

```bash
# 1) 母站內容 + 照片上傳（Node 22+）
SHOWCASE_API=http://localhost:8012/api/v1 SHOWCASE_EMAIL=<admin> SHOWCASE_PASSWORD=<password> \
  node scripts/showcase/seed.mjs

# 2) 禾境子站內容（在 API 容器裡跑 Python）
export MSYS_NO_PATHCONV=1   # Git Bash on Windows
API=<backend-container>     # 例如 docker compose 的 backend 容器名稱
docker exec $API mkdir -p /tmp/showcase
docker cp scripts/seed_hejing.py $API:/tmp/showcase/
docker cp scripts/showcase/run-child-seed.py $API:/tmp/showcase/
docker cp scripts/showcase/.child-media.json $API:/tmp/showcase/child-media.json
docker exec -e SHOWCASE_EMAIL=<admin> -e SHOWCASE_PASSWORD=<password> $API \
  python /tmp/showcase/run-child-seed.py /tmp/showcase/seed_hejing.py /tmp/showcase/child-media.json
```

兩支腳本都可以重複執行：照片依檔名只上傳一次，住宿與文章依 slug 更新。

## 補上 AI 圖片

1. 依照 `docs/showcase/AI_IMAGE_PROMPTS.md` 生成圖片，**按指定檔名**存到 `素材/ai/`。
2. 重新執行上面兩個步驟。
   - 暫用的實拍照會被換掉。
   - 因缺圖而未上架的內容會自動上架，例如月霧山居、礁岸之家、羅東夜市。

圖片來源與授權說明見 `docs/showcase/IMAGE_CREDITS.md`。
