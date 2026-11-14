// usage: node shoot.mjs <list.txt> <outdir> [storageState]
// list lines: "/path | label"   (lines starting with # are skipped)
// Produces full-page JPEGs + a "scrolled" viewport JPEG per page, and a manifest
// with the rects of fixed/sticky chrome so build-video.mjs can pin them on screen.
import { chromium } from 'playwright'; import fs from 'fs';
const [list, outdir, state] = process.argv.slice(2);
const base = process.env.BASE || 'http://localhost:3012';
const W = 1920, H = 1080;
fs.mkdirSync(outdir, { recursive: true });
const items = fs.readFileSync(list, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  .map(l => { const [u, label] = l.split('|').map(s => s.trim()); return { u, label: label || u }; });
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(Number)) : null;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, locale: 'zh-TW', storageState: state || undefined });
await ctx.addInitScript(() => { try { localStorage.setItem('cookie-consent-accepted', '0'); } catch {} });
await ctx.addCookies([{ name: 'site-locale', value: process.env.LOCALE || 'zh', url: base }]);
const css = `nextjs-portal,[data-nextjs-toast],#__next-build-watcher,.cookie-consent-banner{display:none!important}
::-webkit-scrollbar{display:none} html{scrollbar-width:none} *{caret-color:transparent!important}
/* stills, not a live recording: entrance animations must already be finished */
.hero-content>*,.hero-scroll,.home-stays-search-wrap,.content-index-hero :is(h1,p),.contact-hero :is(h1,p),.stays-index-hero :is(h1,p){animation:none!important}
.home-reveal{opacity:1!important;transform:none!important}`;
const p = await ctx.newPage();
const manifestPath = `${outdir}/manifest.json`;
const manifest = fs.existsSync(manifestPath) && only ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
let i = 0;
for (const it of items) {
  i++;
  if (only && !only.has(i)) continue;
  const stem = `${outdir}/${String(i).padStart(3, '0')}`;
  for (let attempt = 1; attempt <= 3; attempt++) { try { await shootOne(it, i, stem); break; } catch (e) { console.log('retry', i, it.u, String(e.message).slice(0, 80)); await p.waitForTimeout(3000); } }
  fs.writeFileSync(manifestPath, JSON.stringify([...manifest].sort((a, b) => a.index - b.index), null, 1));
}
async function shootOne(it, i, stem) {
  // pin the admin "current site": visiting a child site page switches it
  if (state) await ctx.addCookies([{ name: 'admin-site', value: process.env.ADMIN_SITE || 'slowfield', url: base }]);
  try { await p.goto(base + it.u, { waitUntil: 'networkidle', timeout: 180000 }); } catch (e) { console.log('slow', it.u); }
  await p.addStyleTag({ content: css }).catch(() => {});
  // hold the hero carousel on its first slide, or the still can land mid-crossfade
  await p.evaluate(() => document.querySelector(".hero-pause")?.click()).catch(() => {});
  // walk the page so lazy images load and scroll-reveal animations fire
  const total = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 450) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(110); }
  await p.waitForTimeout(500);
  await p.evaluate(async () => { await Promise.all([...document.images].map(img => img.complete ? 0 : new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 8000); }))); });
  // embedded previews (admin block editors): let them load, hide the dev badge inside them too
  for (const f of p.frames()) { if (f === p.mainFrame()) continue; await f.waitForLoadState('load', { timeout: 20000 }).catch(() => {}); await f.addStyleTag({ content: css }).catch(() => {}); }
  if (p.frames().length > 1) await p.waitForTimeout(1200);
  // scrolled-state chrome (sticky header in its solid state, sidebar, FAB)
  const docH = await p.evaluate(() => document.documentElement.scrollHeight);
  let overlays = [];
  if (docH > H + 40) {
    await p.evaluate(y => window.scrollTo(0, y), Math.min(900, docH - H)); await p.waitForTimeout(900);
    overlays = await p.evaluate(({ W, H }) => {
      const els = [...document.querySelectorAll('body *')].filter(e => {
        const s = getComputedStyle(e);
        if (!(s.position === 'fixed' || s.position === 'sticky')) return false;
        if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false;
        const r = e.getBoundingClientRect();
        if (r.width < 24 || r.height < 24 || r.right <= 0 || r.bottom <= 0 || r.left >= W || r.top >= H) return false;
        if (s.position === 'sticky' && r.top > 2 && r.left > 2) return false;          // only chrome stuck to an edge
        if (r.width >= W - 2 && r.height >= H - 2) return false;                        // full-screen overlays
        return true;
      });
      const top = els.filter(e => !els.some(o => o !== e && o.contains(e)));
      return top.map(e => { const r = e.getBoundingClientRect(); const x = Math.max(0, Math.floor(r.left)), y = Math.max(0, Math.floor(r.top));
        return { x, y, w: Math.min(W, Math.ceil(r.right)) - x, h: Math.min(H, Math.ceil(r.bottom)) - y, tag: e.tagName + '.' + String(e.className).slice(0, 40) }; });
    }, { W, H });
    if (overlays.length) await p.screenshot({ path: `${stem}-scrolled.jpg`, type: 'jpeg', quality: 92 });
  }
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(900);
  await p.screenshot({ path: `${stem}.jpg`, fullPage: true, type: 'jpeg', quality: 90 });
  const entry = { index: i, file: `${stem}.jpg`, scrolled: overlays.length ? `${stem}-scrolled.jpg` : null, overlays, url: it.u, label: it.label, height: docH };
  const at = manifest.findIndex(m => m.index === i); if (at >= 0) manifest[at] = entry; else manifest.push(entry);
  console.log(i, it.u, docH, overlays.map(o => o.tag).join(' | '));
}
manifest.sort((a, b) => a.index - b.index);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
await b.close();
