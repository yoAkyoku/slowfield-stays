import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("media library loads video metadata and permits inline playback", () => {
  const source = fs.readFileSync(
    path.join(root, "app/admin/(dashboard)/media/MediaLibraryView.tsx"),
    "utf8",
  );
  const thumbnail = fs.readFileSync(
    path.join(root, "app/admin/modules/VideoThumbnail.tsx"),
    "utf8",
  );

  assert.match(source, /<VideoThumbnail[\s\S]*?controls/);
  assert.match(thumbnail, /playsInline[\s\S]*?preload="metadata"/);
  assert.doesNotMatch(thumbnail, /preload="none"/);
});

test("the storage sandbox remains scoped to SVG documents", () => {
  const source = fs.readFileSync(path.resolve(root, "../backend/app/main.py"), "utf8");

  assert.match(source, /if Path\(path\)\.suffix\.lower\(\) == "\.svg":/);
  assert.match(source, /response\.headers\["Content-Security-Policy"\]/);
});
