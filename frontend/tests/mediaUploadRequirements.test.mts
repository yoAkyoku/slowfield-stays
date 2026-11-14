import assert from "node:assert/strict";
import test from "node:test";
import { readCode } from "./readCode";

test("every file uploader shows the shared image and video requirements", () => {
  const requirement = readCode("app/admin/modules/MediaUploadRequirements.tsx");
  assert.match(requirement, /1920.*1080/s);
  assert.match(requirement, /JPG.*PNG.*WebP.*AVIF/s);
  assert.match(requirement, /MP4.*WebM/s);
  assert.match(requirement, /100\s*MB/);
  assert.match(requirement, /Logo.*1200.*320/s);
  assert.match(requirement, /PNG.*SVG/s);
  assert.doesNotMatch(requirement, /<br\s*\/>/);

  const styles = readCode("app/globals.css");
  assert.match(styles, /\.hero-image-field\s*>\s*\.media-upload-requirements\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);

  for (const path of [
    "app/admin/(dashboard)/homepage/ImageUploadInput.tsx",
    "app/admin/(dashboard)/media/MediaUploadModal.tsx",
    "app/admin/(dashboard)/stays/HeroImageField.tsx",
  ]) {
    const source = readCode(path);
    assert.match(source, /MediaUploadRequirements/, `${path} has no upload guidance`);
  }
});

test("the site logo uploader shows logo-specific guidance and accepts images only", () => {
  const siteEditor = readCode("app/admin/(dashboard)/sites/[id]/SitePageEditor.tsx");
  assert.match(siteEditor, /fieldName="logo_url"[\s\S]*?mediaKind="logo"/);
  const uploader = readCode("app/admin/(dashboard)/stays/HeroImageField.tsx");
  assert.match(uploader, /mediaKind === "logo"[^\n]*\.png,\.svg/);
});

test("the media library limits initial DOM and network work", () => {
  const source = readCode("app/admin/(dashboard)/media/MediaLibraryView.tsx");
  const page = readCode("app/admin/(dashboard)/media/page.tsx");
  assert.match(source, /MEDIA_PAGE_SIZE\s*=\s*48/);
  assert.match(source, /filteredMedia\.slice\(0,\s*visibleCount\)/);
  assert.match(source, /fetchMore/);
  assert.match(page, /getAdminMediaOverview\(48\)/);
  assert.match(source, /loading="lazy"/);
  assert.match(source, /VideoThumbnail/);
  const thumbnail = readCode("app/admin/modules/VideoThumbnail.tsx");
  assert.match(thumbnail, /preload="metadata"/);
});

test("multipart uploads are rebuilt by the Next proxy so the file field survives", () => {
  const proxy = readCode("app/admin/api/proxy/route.ts");
  assert.match(proxy, /body = await request\.formData\(\)/);
  assert.doesNotMatch(
    proxy,
    /body = await request\.formData\(\);\s*forwardHeaders\["Content-Type"\] = contentType/,
  );
  assert.match(proxy, /MAX_MULTIPART_REQUEST_BYTES/);
  assert.match(proxy, /101\s*\*\s*1024\s*\*\s*1024/);
  assert.match(proxy, /100 MB limit/);
});

test("the media dialog rejects oversized files without sending or crashing", () => {
  const modal = readCode("app/admin/(dashboard)/media/MediaUploadModal.tsx");
  assert.match(modal, /MAX_UPLOAD_BYTES\s*=\s*100\s*\*\s*1024\s*\*\s*1024/);
  assert.match(modal, /file\.size\s*>\s*MAX_UPLOAD_BYTES/);
  assert.match(modal, /status:\s*oversized\s*\?\s*"error"\s*:\s*"pending"/);
  assert.match(modal, /typeof detail === "string"/);
  assert.match(modal, /\/api\/v1\/admin\/media/);
  assert.match(modal, /credentials:\s*"same-origin"/);
  assert.match(modal, /"X-Site-Slug":\s*site/);
});

test("admin layout starts independent requests together and profile is request-cached", () => {
  const layout = readCode("app/admin/(dashboard)/layout.tsx");
  assert.match(layout, /Promise\.all\(\[getAdminProfile\(\),\s*getAdminSites\(\)\]\)/);
  const api = readCode("app/admin/modules/adminApi.ts");
  assert.match(api, /getAdminProfile\s*=\s*cache\(/);
});
