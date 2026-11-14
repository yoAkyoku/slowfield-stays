import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("property article category rows explain both editable fields", () => {
  const source = readCode("app/admin/(dashboard)/sites/[id]/pages/[pageKey]/PropertyBlockEditor.tsx");
  assert.match(source, /篩選顯示名稱/);
  assert.match(source, /對應文章標籤/);
  assert.match(source, /選擇文章已有的主題標籤/);
  assert.match(source, /前台主題篩選/);
  assert.match(source, /className="hpb-subtab-field"/);
});
