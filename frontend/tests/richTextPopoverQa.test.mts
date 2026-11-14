import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode.mts";

test("editor URL panels preserve invalid input and provide named cancel actions", () => {
  const code = readCode("app/admin/modules/RichTextEditor.tsx");
  assert.match(code, /if \(!isSafeUrl\(url\)\) \{\s*setLinkError/);
  for (const name of ["連結網址 Link URL", "影片網址 Video URL", "套用連結 Apply link", "取消連結 Cancel link", "插入影片 Insert video", "取消插入影片 Cancel video insertion"]) assert.ok(code.includes(name), name);
  assert.match(code, /event.key !== "Escape"/);
  assert.match(code, /event.currentTarget.contains\(nestedDialog\)/);
  assert.match(code, /requestAnimationFrame\(\(\) => trigger.current\?\.focus\(\)\)/);
});
