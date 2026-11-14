#!/usr/bin/env node
/**
 * Turn a local / staging database into a realistic boutique-stay showcase.
 *
 *   SHOWCASE_API=http://localhost:8012/api/v1 \
 *   SHOWCASE_EMAIL=… SHOWCASE_PASSWORD=… node scripts/showcase/seed.mjs
 *
 * Refuses to run against slowfield.example: it deletes the demo rows it
 * replaces. Re-runnable — media are uploaded once (matched by file name), stays
 * and pages are upserted by slug. Generated images dropped into 素材/ai/ are
 * picked up on the next run.
 *
 * The Hejing Villa child site's own pages come from scripts/seed_hejing.py;
 * this script writes the media map that run-child-seed.py feeds it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AI, AI_DIR, ALIAS, VILLA } from "./photos.mjs";
import { BANNERS, CHILD_BANNERS, CHILD_ROOMS, CONTACT, CONTACT_PAGE, EXPERIENCE, HOME_BLOCKS, PAGES, SECTION_HEROES, STAYS } from "./content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const API = process.env.SHOWCASE_API || "http://localhost:8012/api/v1";
const EMAIL = process.env.SHOWCASE_EMAIL;
const PASSWORD = process.env.SHOWCASE_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error("Set SHOWCASE_EMAIL and SHOWCASE_PASSWORD");
if (/slowfieldstays\.com/i.test(API)) throw new Error("Refusing to seed production: this script deletes demo content");

const PARENT = "slowfield";
const CHILD = "hejing";
const RIDGE = "hejing-ridge";
const MANAGED_TYPES = ["activity", "dining", "service", "journal", "news", "brand"];

let token = "";
async function call(method, p, { body, site, form } = {}) {
  const url = `${API}${p}${p.includes("?") ? "&" : "?"}site=${site || PARENT}`;
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${String(text).slice(0, 300)}`);
  return data;
}
const list = (d) => (Array.isArray(d) ? d : d?.items ?? []);

/* ── media ─────────────────────────────────────────────────────────────── */
const media = new Map(); // display name → url
async function loadMedia() {
  for (let skip = 0; ; skip += 200) {
    const page = list(await call("GET", `/admin/media?skip=${skip}&limit=200`));
    for (const m of page) media.set(m.display_name, m.url);
    if (page.length < 200) break;
  }
}
async function upload(file, name, alt) {
  if (media.has(name)) return media.get(name);
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(file)], { type: "image/jpeg" }), name);
  form.append("alt_text", alt);
  const res = await fetch(`${API}/admin/media?site=${PARENT}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!res.ok) throw new Error(`upload ${name} → ${res.status} ${await res.text()}`);
  const m = await res.json();
  media.set(name, m.url);
  console.log(`  ↑ ${name}`);
  return m.url;
}
const used = { real: new Set(), aiMissing: new Set() };
/** "real:key" / "ai:key" → served URL, or null (AI image not generated yet, no fallback). */
async function src(ref) {
  if (!ref) return null;
  const [kind, key] = ref.split(":");
  if (kind === "real") {
    // a role in the fictional villa (all AI-generated; see photos.mjs)
    const role = VILLA[key] ? key : ALIAS[key];
    const v = VILLA[role];
    if (!v) throw new Error(`unknown villa image ${key}`);
    const file = path.join(ROOT, AI_DIR, v.file);
    if (!fs.existsSync(file)) { used.aiMissing.add(v.file); return null; }
    used.real.add(role);
    return upload(file, `showcase-ai-${v.file}`, v.alt);
  }
  const ai = AI[key];
  if (!ai) throw new Error(`unknown AI image ${key}`);
  const file = path.join(ROOT, AI_DIR, ai.file);
  if (fs.existsSync(file)) return upload(file, `showcase-ai-${ai.file}`, ai.alt);
  used.aiMissing.add(ai.file);
  return ai.fallback ? src(`real:${ai.fallback}`) : null;
}
/** Resolve image refs anywhere inside a block tree. */
async function resolveBlocks(blocks) {
  const walk = async (v) => {
    if (typeof v === "string" && /^(real|ai):/.test(v)) return (await src(v)) ?? "";
    if (Array.isArray(v)) return Promise.all(v.map(walk));
    if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = await walk(x); return o; }
    return v;
  };
  const out = await walk(blocks);
  // drop gallery images whose AI file does not exist yet
  // drop images not generated yet, and the same picture twice (aliases share a role)
  for (const b of out) if (b.type === "image_gallery") {
    const seen = new Set();
    b.config.images = b.config.images.filter((i) => i.url && !seen.has(i.url) && seen.add(i.url));
  }
  return out.filter((b) => b.type !== "image_gallery" || b.config.images.length > 0);
}

/* ── helpers to remove demo rows ────────────────────────────────────────── */
async function removePage(id, site) {
  await call("POST", `/admin/cms/pages/${id}/delete`, { site }).catch(() => {});
  await call("POST", `/admin/cms/pages/${id}/purge`, { site });
}
async function removeStay(id, site) {
  await call("POST", `/admin/stays/${id}/delete`, { site }).catch(() => {});
  // A stay that booking requests point at cannot be purged (FK); leaving it in
  // the bin keeps it off the site and keeps the guest's request intact.
  await call("POST", `/admin/stays/${id}/purge`, { site }).catch((e) => console.log(`  (stay ${id} kept in bin: ${e.message.slice(0, 60)})`));
}
async function removeBanner(id, site) {
  await call("POST", `/admin/cms/banners/${id}/delete`, { site }).catch(() => {});
  await call("POST", `/admin/cms/banners/${id}/purge`, { site });
}

/* ── seeders ────────────────────────────────────────────────────────────── */
async function seedBanners(site = PARENT, banners = BANNERS) {
  const existing = list(await call("GET", "/admin/cms/banners?visibility=all", { site }));
  const keep = new Set(banners.map((b) => b.title));
  for (const b of existing) if (!keep.has(b.title)) await removeBanner(b.id, site);
  const byTitle = new Map(existing.filter((b) => keep.has(b.title)).map((b) => [b.title, b]));
  let n = 0;
  for (const [i, b] of banners.entries()) {
    const image = (await src(b.image)) ?? (b.fallback ? await src(b.fallback) : null);
    const hit = byTitle.get(b.title);
    if (!image) { if (hit) await removeBanner(hit.id, site); continue; } // waits for its image
    const payload = {
      title: b.title, subtitle: b.subtitle, image_url: image, cta_label: b.cta_label, cta_href: b.cta_href,
      sort_order: i, status: "published", translations: { en: b.en },
    };
    if (hit) await call("PUT", `/admin/cms/banners/${hit.id}`, { body: payload, site });
    else await call("POST", "/admin/cms/banners", { body: payload, site });
    n++;
  }
  console.log(`✓ ${site} banners: ${n}/${banners.length}`);
}

function stayPayload(s, hero, images, extra = {}) {
  return {
    slug: s.slug, name: s.name, destination: s.destination, region: s.region, summary: s.summary, story: s.story ?? "",
    hero_image_url: hero, booking_url: "", base_price: s.base_price, max_guests: s.max_guests, sort_order: s.sort ?? 0,
    status: extra.status ?? "published", seo: { title: `${s.name}｜慢域旅宿`, description: s.summary },
    detail_config: {}, faq: s.faq ?? [], house_rules: s.house_rules ?? [], location_config: s.location ?? {},
    social_links: { line: CONTACT.line }, tags: s.tags ?? [], facilities: s.facilities ?? [], experiences: [],
    related_content_ids: [], amenities: s.amenities ?? [], room_types: s.room_types ?? [],
    images: images.map((u, i) => ({ image_url: u, alt_text: s.name, sort_order: i })),
    translations: s.en ? { en: s.en } : {},
  };
}

async function seedParentStays() {
  const existing = list(await call("GET", "/admin/stays?visibility=all&limit=200"));
  const want = new Set(STAYS.map((s) => s.slug));
  for (const s of existing) if (!want.has(s.slug)) await removeStay(s.id, PARENT);
  const bySlug = new Map(existing.map((s) => [s.slug, s]));
  for (const [i, s] of STAYS.entries()) {
    const hero = await src(s.hero);
    const images = [...new Set((await Promise.all(s.images.map(src))).filter(Boolean))];
    const status = hero ? "published" : "draft"; // nothing goes live without its photo
    const payload = stayPayload({ ...s, sort: i }, hero ?? "", images, { status });
    const hit = bySlug.get(s.slug);
    if (hit) await call("PUT", `/admin/stays/${hit.id}`, { body: payload });
    else await call("POST", "/admin/stays", { body: payload });
    console.log(`✓ stay ${s.slug} (${status})`);
  }
}

async function seedChildRooms() {
  const existing = list(await call("GET", "/admin/stays?visibility=all&limit=200", { site: CHILD }));
  const villa = STAYS[0];
  for (const room of CHILD_ROOMS) {
    const hit = existing.find((s) => s.slug === room.slug);
    if (!hit) continue;
    const hero = await src(room.hero);
    const images = [...new Set((await Promise.all(room.images.map(src))).filter(Boolean))];
    const payload = stayPayload({ ...villa, ...room, story: villa.story, room_types: villa.room_types.filter((r) => r.name === room.name), en: undefined }, hero ?? "", images, { status: hero ? "published" : "draft" });
    payload.translations = {};
    await call("PUT", `/admin/stays/${hit.id}`, { body: payload, site: CHILD });
  }
  console.log(`✓ Hejing Villa rooms: ${CHILD_ROOMS.length}`);
  // Ridge is still being planned: its demo rooms come off the public site.
  for (const s of list(await call("GET", "/admin/stays?visibility=all&limit=200", { site: RIDGE }))) {
    if (s.status !== "draft") await call("PATCH", `/admin/stays/${s.id}/status`, { body: { status: "draft" }, site: RIDGE });
  }
  console.log("✓ Hejing Ridge demo rooms set to draft");
}

async function seedPages() {
  const existing = list(await call("GET", "/admin/cms/pages?visibility=all&limit=500"));
  const want = new Set(PAGES.map((p) => `${p.content_type}/${p.slug}`));
  for (const p of existing) {
    const junk = p.content_type === "page" && !p.slug; // a QA leftover with no address
    if (junk || (MANAGED_TYPES.includes(p.content_type) && !want.has(`${p.content_type}/${p.slug}`))) await removePage(p.id, PARENT);
  }
  const bySlug = new Map(existing.map((p) => [`${p.content_type}/${p.slug}`, p]));
  let published = 0;
  for (const [i, p] of PAGES.entries()) {
    const cover = await src(p.cover);
    const blocks = await resolveBlocks(p.blocks);
    const body = blocks.filter((b) => b.type === "rich_text").map((b) => b.config.body.zh).join("\n\n");
    const payload = {
      slug: p.slug, title: p.title, summary: p.summary, body, body_blocks: blocks, content_type: p.content_type,
      categories: [p.content_type], layout: "page", cover_image_url: cover ?? "", sort_order: i, tags: [], related_stay_ids: [],
      status: cover ? "published" : "draft", seo: { title: p.title, description: p.summary }, translations: { en: p.en },
    };
    const hit = bySlug.get(`${p.content_type}/${p.slug}`);
    if (hit) await call("PUT", `/admin/cms/pages/${hit.id}`, { body: payload });
    else await call("POST", "/admin/cms/pages", { body: payload });
    if (cover) published++;
  }
  console.log(`✓ pages: ${published} published, ${PAGES.length - published} waiting for AI images`);

  const exp = existing.find((p) => p.content_type === "experience");
  if (exp) {
    const expCover = await src(EXPERIENCE.cover);
    await call("PUT", `/admin/cms/pages/${exp.id}`, {
      body: { ...exp, title: "慢域體驗", translations: { ...(exp.translations ?? {}), en: { title: "The Slowfield experience", summary: "Swim, ride, eat, sing — slowing down together." } }, summary: EXPERIENCE.summary, cover_image_url: expCover ?? "", body_blocks: await resolveBlocks(EXPERIENCE.blocks), status: expCover ? "published" : "draft" },
    });
    console.log("✓ experience page");
  }
}

async function cleanChildDemoPages() {
  for (const site of [CHILD, RIDGE]) {
    const rows = list(await call("GET", "/admin/cms/pages?visibility=all&limit=500", { site }));
    let n = 0;
    for (const p of rows) {
      // Demo rows from the multisite seed carry stock (Unsplash) covers. They are
      // unpublished, not deleted, so nothing is lost; the real Hejing Villa news
      // and journal entries come from seed_hejing.py afterwards.
      if (MANAGED_TYPES.includes(p.content_type) && /unsplash\.com/.test(p.cover_image_url ?? "") && p.status !== "draft") {
        await call("PATCH", `/admin/cms/pages/${p.id}/status`, { body: { status: "draft" }, site });
        n++;
      }
    }
    for (const b of list(await call("GET", "/admin/cms/banners?visibility=all", { site }))) await removeBanner(b.id, site);
    console.log(`✓ ${site}: ${n} stock-photo demo pages set to draft; demo banners removed`);
  }
}

/** A small B&B brand has no press room, careers page or franchise programme.
 *  Tombstone them (as 頁面管理 does on delete) so the bundled defaults stay
 *  out of the nav, footer and sitemap, and their URLs 404. */
const REMOVED_PAGES = ["media", "pr", "career", "franchise"];
function removedPages(pages = {}) {
  const next = { ...pages };
  for (const key of REMOVED_PAGES) next[key] = { ...(next[key] ?? {}), deleted: true };
  return next;
}

async function seedSiteContact() {
  const s = await call("GET", "/admin/sites/1");
  // Homepage blocks and section hero photos; anything whose image is missing is left out.
  const blocks = (await resolveBlocks(HOME_BLOCKS)).map((b) => {
    if (b.type === "about" || b.type === "gallery") b.config.images = b.config.images.filter(Boolean);
    return b;
  }).filter((b) => b.type !== "gallery" || b.config.images.length >= 3);
  const [contactPage] = await resolveBlocks([{ type: "page", ...CONTACT_PAGE }]);
  delete contactPage.type;
  const heroes = {};
  for (const [type, ref] of Object.entries(SECTION_HEROES)) { const url = await src(ref); if (url) heroes[`hero_${type}`] = url; }
  await call("PUT", "/admin/sites/1", {
    body: {
      name: "慢域旅宿 Slowfield Stays", slug: s.slug, domain: s.domain, status: s.status, default_locale: s.default_locale,
      primary_color: s.theme_config?.primaryColor ?? "#2f4638", accent_color: s.theme_config?.accentColor ?? "#b78b58",
      contact_email: CONTACT.email, contact_line: CONTACT.line,
      seo_title: "慢域旅宿 Slowfield Stays｜精選台灣包棟與設計民宿",
      seo_description: "由 30 年飯店團隊經營的精品民宿品牌。宜蘭冬山禾境泳池包棟、田野早餐、管家式接待。",
      parent_site_id: null, template_site_id: s.template_site_id, is_template: s.is_template, template_version: s.template_version,
      settings: { ...(s.settings ?? {}), ...heroes, homepage: { ...(s.settings?.homepage ?? {}), blocks }, contact_phone: CONTACT.phone, contact_address: CONTACT.address.zh, pages: { ...removedPages(s.settings?.pages), contact: { ...(s.settings?.pages?.contact ?? {}), ...contactPage } } },
    },
  });
  console.log("✓ brand site name, SEO and contact; removed " + REMOVED_PAGES.join(", "));
}

/** Hejing Ridge is still being planned and has no photography: keep the site
 *  off the public web until it does (a non-active child site 404s). */
async function hideRidge() {
  const s = await call("GET", "/admin/sites/3", { site: RIDGE });
  if (s.status === "draft") return;
  await call("PUT", "/admin/sites/3", { site: RIDGE, body: {
    name: s.name, slug: s.slug, domain: s.domain, status: "draft", default_locale: s.default_locale,
    primary_color: s.theme_config?.primaryColor, accent_color: s.theme_config?.accentColor,
    contact_email: s.contact_config?.email, contact_line: s.contact_config?.line,
    seo_title: s.seo_defaults?.title, seo_description: s.seo_defaults?.description,
    parent_site_id: s.parent_site_id, template_site_id: s.template_site_id, is_template: s.is_template,
    template_version: s.template_version, settings: s.settings ?? {},
  } });
  console.log("✓ hejing-ridge set to draft (not public until it has photos)");
}

/** The villa site goes public only once every villa role has its image. */
async function setChildVisibility() {
  const ready = Object.values(VILLA).every((v) => fs.existsSync(path.join(ROOT, AI_DIR, v.file)));
  const s = await call("GET", "/admin/sites/2", { site: CHILD });
  const status = ready ? "active" : "draft";
  if (s.status !== status) await call("PUT", "/admin/sites/2", { site: CHILD, body: {
    name: s.name, slug: s.slug, domain: s.domain, status, default_locale: s.default_locale,
    primary_color: s.theme_config?.primaryColor, accent_color: s.theme_config?.accentColor,
    contact_email: s.contact_config?.email, contact_line: s.contact_config?.line,
    seo_title: s.seo_defaults?.title, seo_description: s.seo_defaults?.description,
    parent_site_id: s.parent_site_id, template_site_id: s.template_site_id, is_template: s.is_template,
    template_version: s.template_version, settings: s.settings ?? {},
  } });
  console.log(`✓ hejing site ${status}${ready ? "" : " (villa images not generated yet)"}`);
}

/* ── main ───────────────────────────────────────────────────────────────── */
const login = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
if (!login.ok) throw new Error(`login failed: ${login.status}`);
token = (await login.json()).access_token;
console.log(`API ${API}`);

await loadMedia();
await seedSiteContact();
await seedBanners();
await seedParentStays();
await seedChildRooms();
await cleanChildDemoPages();
await seedBanners(CHILD, CHILD_BANNERS);
await hideRidge();
await setChildVisibility();
await seedPages();

// media map for the child-site Python seed (production paths → local uploads)
const childMap = {};
for (const key of ["pool_reader", "brand_wall", "room_king", "living_white", "room_twin", "exterior_field", "living_open", "dining_field", "pool_wide", "pool_night", "breakfast_spread", "corridor"]) childMap[key] = await src(`real:${key}`);
childMap.sakura = await src("ai:luozhuang_sakura"); // null until generated
fs.writeFileSync(path.join(ROOT, "scripts/showcase/.child-media.json"), JSON.stringify(childMap, null, 2));

console.log(`\nreal photos used: ${used.real.size}`);
if (used.aiMissing.size) console.log(`AI images still to generate (${used.aiMissing.size}): ${[...used.aiMissing].join(", ")}`);
