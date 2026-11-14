# Walkthrough videos

Records the public site and the back office as two scrolling 1080p videos.
Each page is captured as a full-page screenshot (so the footer is always in
frame), then panned top → bottom with easing; fixed chrome (site header,
admin sidebar / topbar, back-to-top button) is captured in its scrolled state
and pinned on screen, so it reads like a real scroll.

```bash
cd scripts/walkthrough-video
npm install
npx playwright install chromium

# BASE defaults to http://localhost:3012 (point it at staging/production to record that)
node shoot.mjs front-pages.txt shots-front
node build-video.mjs shots-front ../../recordings/front.mp4 "Slowfield Stays｜前台網站導覽"

# admin: needs a logged-in Playwright storage state (log in once, save with context.storageState)
node shoot.mjs admin-pages.txt shots-admin admin-state.json
node build-video.mjs shots-admin ../../recordings/admin.mp4 "Slowfield Stays｜後台管理系統導覽"
```

- `ONLY=3,7 node shoot.mjs …` re-shoots just those list entries.
- `SPEED=650` (px/s) sets the scroll speed; `LOCALE=en` records the English UI.
- `compare.mjs <before> <after>` SSIM-diffs two shot folders (visual regression check).
- On Git Bash for Windows prefix commands with `MSYS_NO_PATHCONV=1`, or `/admin`
  paths in the lists get rewritten into Windows paths.
