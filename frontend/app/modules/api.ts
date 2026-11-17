import { headers } from "next/headers";
import { withPublicRequestScope } from "./publicRequestScope";
import { isPubliclyVisibleVilla } from "./siteVisibility";
import { isAdminPreview } from "./adminPreview";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "./fontPresets";
import { SERVER_API_URL as API_URL } from "./apiBase";

export type Banner = {
  id: number;
  title: string;
  subtitle: string;
  image_url: string;
  cta_label: string;
  cta_href: string;
  /** Optional translated homepage controls stored in `translations`. */
  story_cta_label?: string;
  story_cta_href?: string;
  scroll_label?: string;
  sort_order: number;
  status: string;
  translations: Record<string, Record<string, string>>;
  deleted_at?: string | null;
};

export type RoomType = {
  name: string;
  description: string;
  price: number;
  capacity: number;
};

export type Stay = {
  id: number;
  slug: string;
  name: string;
  destination: string;
  region: string;
  summary: string;
  story: string;
  hero_image_url: string;
  booking_url?: string;
  base_price: number;
  max_guests: number;
  sort_order?: number;
  tags: string[];
  amenities: string[];
  /** Canonical search-filter values ticked in the admin, distinct from the
   *  free-text `amenities` copy shown on the villa page. */
  facilities?: string[];
  /** Canonical 慢域體驗 search values assigned in the stay editor. */
  experiences?: string[];
  room_types: RoomType[];
  images: { image_url: string; alt_text: string; sort_order: number }[];
  seo: Record<string, string>;
  detail_config: Record<string, unknown>;
  faq: { question?: string; answer?: string }[];
  house_rules: string[];
  location_config: Record<string, string>;
  social_links: Record<string, string>;
  related_content_ids: number[];
  translations: Record<string, Record<string, string>>;
  deleted_at?: string | null;
};

export type Page = {
  id: number;
  slug: string | null;
  title: string;
  summary: string;
  body: string;
  body_blocks?: CmsContentBlock[];
  content_type: string;
  categories?: string[];
  cover_image_url: string;
  sort_order: number;
  tags: string[];
  related_stay_ids: number[];
  status: string;
  seo: Record<string, string | null>;
  translations: Record<string, Record<string, string>>;
  deleted_at?: string | null;
  route_category?: string | null;
  public_path?: string | null;
  published_at?: string | null;
  /** Set when this entry was aggregated onto a parent site from a child villa;
   *  buildContentHref uses it to link back to the child. */
  _staySlug?: string;
};

export type CmsContentBlock =
  | { id?: string; type: "heading"; level?: "h2" | "h3"; text?: string; align?: "left" | "center" | "right" }
  | { id?: string; type: "paragraph"; text?: string; align?: "left" | "center" | "right"; fontSize?: number | "small" | "base" | "large" }
  | { id?: string; type: "image"; url?: string; alt?: string; caption?: string; size?: "full" | "wide" | "medium" | "small" }
  | { id?: string; type: "video_embed"; platform?: string; url?: string; title?: string; caption?: string; cover?: string }
  | { id?: string; type: "quote"; text?: string; source?: string }
  | { id?: string; type: "cta"; label?: string; href?: string; style?: "primary" | "outline" | "ghost" }
  | { id?: string; type: "spacer"; size?: "small" | "medium" | "large" }
  | { id?: string; type: "image_grid"; images: { url: string; alt?: string; caption?: string }[]; columns?: 2 | 3 | 4; gap?: "tight" | "normal" | "wide" }
  | { id?: string; type: "columns"; items?: { blocks: CmsContentBlock[]; flex: number }[]; left?: CmsContentBlock[]; right?: CmsContentBlock[]; ratio?: string };

export type Announcement = {
  id: number;
  title: string;
  body: string;
  image_url: string;
  cta_label: string;
  cta_href: string;
  display_mode: string;
  status: string;
  translations: Record<string, Record<string, string>>;
};

export type PublicSite = {
  id: number;
  name: string;
  slug: string;
  domain: string;
  status: string;
  default_locale: string;
  theme_config: Record<string, string>;
  contact_config: Record<string, string>;
  seo_defaults: Record<string, string>;
  settings: Record<string, unknown>;
  /** Set on a villa site; null on the group site. */
  parent_site_id?: number | null;
};

const STRICT_PUBLIC_API = process.env.NEXT_PUBLIC_APP_ENV === "production";

export class PublicApiError extends Error {
  constructor(message = "Public website data could not be loaded") {
    super(message);
    this.name = "PublicApiError";
  }
}

// Next 15 made the request APIs async. Reading them through the UnsafeUnwrapped
// escape hatch still rendered, but logged a sync-dynamic-apis error on every
// request — and Next 16 removes the hatch, so it would have become a hard
// failure on the one function every public page's data goes through.
async function publicSiteQuery() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const site = h.get("x-site-slug") ?? "";
  const params = new URLSearchParams();
  if (host) params.set("host", host);
  if (site) params.set("site", site);
  const value = params.toString();
  return value ? `?${value}` : "";
}

async function withPublicSite(path: string) {
  const siteQuery = await publicSiteQuery();
  if (!siteQuery) return path;
  return withPublicRequestScope(path, siteQuery);
}

/**
 * @param revalidate Seconds to cache the response for. Left off, the request is
 *   uncached, which is right for anything a reader is looking at: an edit in the
 *   CMS shows up on the next request. Pass it only for data incidental to the
 *   page — a count beside a sidebar link is worth neither a full uncached fetch
 *   of the site's content on every page view nor the risk of a stale article.
 */
async function apiFetch<T>(path: string, fallback: T, revalidate?: number): Promise<T> {
  try {
    const response = await fetch(
      `${API_URL}${await withPublicSite(path)}`,
      typeof revalidate === "number" ? { next: { revalidate } } : { cache: "no-store" },
    );
    if (!response.ok) {
      if (response.status >= 500 && STRICT_PUBLIC_API)
        throw new PublicApiError(`Public API request failed (${response.status})`);
      return fallback;
    }
    /* `return response.json()` — without the await — resolves AFTER the try
       block has been left, so a body that is not JSON threw straight past this
       catch and out of the Server Component: a 200 carrying a proxy error page
       took the whole route down instead of falling back. The await is what puts
       the parse inside the try.

       The shape is checked for the same reason. A 200 whose body is an object
       (`{detail: …}`) used to be handed back as if it were the expected list,
       and the caller's first `.map` threw one frame further away. */
    const data = await response.json();
    if (Array.isArray(fallback) && !Array.isArray(data)) return fallback;
    return data as T;
  } catch (err) {
    if (err instanceof PublicApiError) throw err;
    if (STRICT_PUBLIC_API) throw new PublicApiError();
    return fallback;
  }
}

export const fallbackBanners: Banner[] = [
  {
    id: 1,
    title: "Private stays with a sense of place",
    subtitle: "A curated collection of intimate villas, mountain houses, and slow coastal retreats.",
    image_url:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80",
    cta_label: "Explore stays",
    cta_href: "/stays",
    sort_order: 1,
    status: "published",
    translations: {}
  }
];

export function getBanners() {
  return apiFetch<Banner[]>("/cms/banners", fallbackBanners);
}

/** Fetch banners for an explicit site slug (used by child /property/[slug] pages
 *  where the publicSiteQuery host/header isn't enough to disambiguate). */
export function getBannersForSite(slug: string) {
  return apiFetch<Banner[]>(`/cms/banners?site=${encodeURIComponent(slug)}`, []);
}

export function getAnnouncements() {
  return apiFetch<Announcement[]>("/cms/announcements", []);
}

export function getStays(query = "") {
  return apiFetch<Stay[]>(`/stays${query}`, []);
}

export type StaySearchOption = Pick<Stay, "region" | "destination">;

export function getStaySearchOptions() {
  return apiFetch<StaySearchOption[]>("/stays/search-options", []);
}

export function getStay(slug: string) {
  return apiFetch<Stay | null>(`/stays/${slug}`, null);
}

/**
 * @param site Villa (child) site slug. The parent and every villa share one
 *   domain, so the backend resolves the owning site from the Host header and
 *   without this it always looked in the parent — every villa's own news and
 *   media entries 404'd from their own pages.
 */
export function resolvePage(category: string, identifier: string, site?: string) {
  // Send the raw URL category — the backend maps it to content_type via CONTENT_CATEGORY_ALIASES
  const query = site ? `?site=${encodeURIComponent(site)}` : "";
  return apiFetch<Page | null>(
    `/cms/pages/resolve/${encodeURIComponent(category)}/${encodeURIComponent(identifier)}${query}`, null
  );
}

/**
 * @param staySlug On a villa site, pulls in the parent's brand-wide posts that
 *   name this villa in related_stay_ids — so one 品牌活動 published once can
 *   appear on the villas it was ticked for, instead of being re-posted on each.
 */
export function getPages(contentType?: string, staySlug?: string, revalidate?: number, siteSlug?: string) {
  const params = new URLSearchParams();
  if (contentType) params.set("content_type", contentType);
  if (staySlug) params.set("stay", staySlug);
  // Target a specific site (e.g. a child villa) so the parent can pull a child's
  // entries; without it the request resolves to the current host's site.
  if (siteSlug) params.set("site", siteSlug);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<Page[]>(`/cms/pages${query}`, [], revalidate);
}

/**
 * A parent-site category's entries, plus the same category pulled from every
 * live child villa — each tagged with the child's slug so its card links back to
 * the child site. Used where a group-wide index (媒體報導) should surface the
 * coverage that actually lives on the individual villas.
 */
export async function getAggregatedPages(contentType: string, revalidate?: number): Promise<Page[]> {
  const [own, children] = await Promise.all([
    getPages(contentType, undefined, revalidate),
    getPropertySites(),
  ]);
  const childLists = await Promise.all(
    children.map((child) =>
      getPages(contentType, undefined, revalidate, child.slug)
        .then((pages) => pages.map((p) => ({ ...p, _staySlug: child.slug })))
        .catch(() => [] as Page[]),
    ),
  );
  return [...own, ...childLists.flat()];
}

export async function getPagesByIds(ids: number[]): Promise<Page[]> {
  if (ids.length === 0) return [];
  const wanted = new Set(ids);
  const batch = await apiFetch<Page[]>(`/cms/pages?ids=${ids.join(",")}`, []);
  // Filter regardless of what came back. The endpoint used to ignore `ids` and
  // return the whole list, and the old guard here — "did we get anything?" —
  // could not tell that apart from a real answer, so a stay showed every
  // article as related content.
  return batch.filter((page) => wanted.has(page.id));
}

export function getCurrentSite() {
  return apiFetch<PublicSite>("/site/resolve", {
    id: 1,
    name: "Slowfield Stays",
    slug: "slowfield",
    domain: "localhost",
    status: "active",
    default_locale: "zh",
    theme_config: { primaryColor: DEFAULT_PRIMARY_COLOR, accentColor: DEFAULT_ACCENT_COLOR },
    contact_config: { email: "hello@example.com", line: "@slowfield" },
    seo_defaults: {
      title: "Slowfield Stays",
      description: "Curated boutique villas and private stays."
    },
    settings: {}
  });
}

/** List all property (child) sites. Returns empty array on error. */
export async function getPropertySites(): Promise<(PublicSite & { parent_site_id: number })[]> {
  /* API_URL, not a second copy that reads only the public variable. These two
     run on the server, where INTERNAL_API_URL is the reachable address; behind
     a container network the public one is not, and both callers swallow the
     failure — the homepage's villa row and the aggregated child articles simply
     came back empty, with nothing logged. */
  const API = API_URL;
  try {
    const res = await fetch(`${API}/site/children`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Resolve a property (child) site by its slug. Returns null if not found or not a child site. */
export async function getPropertySite(slug: string): Promise<PublicSite | null> {
  const API = API_URL;
  try {
    const res = await fetch(`${API}/site/resolve?site=${encodeURIComponent(slug)}`, { cache: "no-store" });
    // See the same guard in middleware.ts: a 404 is the backend telling us this
    // slug is not a site. Falling back to the mock there invented a villa for
    // it, which is worse than the 404 it replaced.
    if (res.status === 404) return null;
    if (!res.ok) return devMockPropertySite(slug);
    const site = (await res.json()) as PublicSite & { parent_site_id?: number | null };
    if (isPubliclyVisibleVilla(site)) return site;
    // A draft villa stays invisible to the public, but has to be reviewable by
    // the people building it — otherwise publishing is the only way to see it.
    return (await isAdminPreview()) ? site : null;
  } catch {
    return devMockPropertySite(slug);
  }
}

/** DEV-ONLY: Mock property site data for frontend testing without backend */
function devMockPropertySite(slug: string): PublicSite | null {
  if (process.env.NODE_ENV !== "development") return null;
  return {
    id: 99,
    name: slug === "shamanya" ? "禾境" : slug,
    slug,
    domain: "",
    status: "active",
    default_locale: "zh",
    theme_config: { primaryColor: DEFAULT_PRIMARY_COLOR, accentColor: DEFAULT_ACCENT_COLOR },
    contact_config: { email: "hello@shamanya.tw", line: "@shamanya" },
    seo_defaults: { title: "禾境｜宜蘭冬山輕奢泳池民宿", description: "隱身宜蘭冬山的輕奢泳池民宿" },
    settings: {
      name_translations: { zh: "禾境", en: "Hejing Villa" },
      logo_url: "",
      nav: [
        { key: "news", label: { en: "News", zh: "最新活動" }, enabled: true },
        { key: "about", label: { en: "About", zh: "關於品牌" }, enabled: true },
        { key: "space", label: { en: "Space", zh: "空間設計" }, enabled: true },
        { key: "experience", label: { en: "Experience", zh: "體驗設施" }, enabled: true },
        { key: "pricing", label: { en: "Pricing", zh: "收費須知" }, enabled: true },
        { key: "contact", label: { en: "Contact", zh: "交通聯繫" }, enabled: true },
        { key: "faq", label: { en: "FAQ", zh: "入住須知" }, enabled: true },
        { key: "articles", label: { en: "Articles", zh: "旅遊專欄" }, enabled: true },
      ],
      booking: { phone: "0912-345-678", line: "@shamanya", cta_label: { en: "Book Now", zh: "立即訂房" } },
      homepage: {
        blocks: [
          { type: "hero_banner", enabled: true, config: { image: "https://images.unsplash.com/photo-1582610116397-edb318620f90?w=1600", title: { zh: "禾境", en: "Hejing Villa" }, subtitle: { zh: "隱身宜蘭冬山的輕奢泳池民宿", en: "A luxury pool villa hidden in Yilan" } } },
          { type: "rich_text", enabled: true, config: { heading: { zh: "歡迎來到禾境", en: "Welcome to Hejing" }, body: { zh: "在這裡，每一刻都是與自然共舞的詩意時光。", en: "Every moment here is a poetic dance with nature." } } },
        ],
      },
      pages: {
        about: {
          label: { zh: "關於品牌", en: "About" }, page_type: "blocks", sort_order: 1,
          blocks: [
            { type: "hero_banner", enabled: true, config: { image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1600", title: { zh: "關於品牌", en: "About Us" }, subtitle: { zh: "我們的故事", en: "Our Story" } } },
            { type: "rich_text", enabled: true, config: { heading: { zh: "品牌理念", en: "Brand Philosophy" }, body: { zh: "禾境誕生於對自然與美學的追求，結合東方禪意與現代設計，打造沉浸式的度假體驗。", en: "Hejing Villa was born from a pursuit of nature and aesthetics, combining Eastern zen with modern design to create an immersive vacation experience." } } },
            { type: "feature_badges", enabled: true, config: { items: [{ icon: "pool", label: { zh: "無邊際泳池", en: "Infinity Pool" } }, { icon: "spa", label: { zh: "SPA 空間", en: "SPA Space" } }, { icon: "garden", label: { zh: "日式庭園", en: "Japanese Garden" } }, { icon: "bbq", label: { zh: "BBQ 區", en: "BBQ Area" } }] } },
          ],
          seo: { title: "關於品牌 | 禾境", description: "了解禾境的品牌故事" },
        },
        space: {
          label: { zh: "空間設計", en: "Space" }, page_type: "blocks", sort_order: 2,
          blocks: [
            { type: "hero_banner", enabled: true, config: { image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1600", title: { zh: "空間設計", en: "Space Design" }, subtitle: { zh: "每一處角落都是風景", en: "Every corner is a view" } } },
            { type: "image_gallery", enabled: true, config: { images: [{ url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800", caption: { zh: "主臥套房", en: "Master Suite" } }, { url: "https://images.unsplash.com/photo-1582610116397-edb318620f90?w=800", caption: { zh: "泳池區", en: "Pool Area" } }, { url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800", caption: { zh: "庭園景觀", en: "Garden View" } }], columns: 3 } },
          ],
        },
        experience: {
          label: { zh: "體驗設施", en: "Experience" }, page_type: "blocks", sort_order: 3,
          blocks: [
            { type: "hero_banner", enabled: true, config: { image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6c?w=1600", title: { zh: "體驗設施", en: "Experience" }, subtitle: { zh: "沉浸式的休閒時光", en: "Immersive leisure time" } } },
            { type: "rich_text", enabled: true, config: { heading: { zh: "設施介紹", en: "Facilities" }, body: { zh: "無邊際恆溫泳池、獨立 SPA 空間、日式枯山水庭園、星空觀景台，讓每位旅人都能找到屬於自己的放鬆方式。", en: "Infinity heated pool, private SPA, Japanese zen garden, stargazing deck — every guest finds their own way to unwind." } } },
          ],
        },
        pricing: {
          label: { zh: "收費須知", en: "Pricing" }, page_type: "blocks", sort_order: 4,
          blocks: [
            { type: "table", enabled: true, config: { title: { zh: "收費須知", en: "Pricing" }, columns: [{ label: { zh: "房型", en: "Room" } }, { label: { zh: "價格", en: "Price" } }, { label: { zh: "容量", en: "Capacity" } }, { label: { zh: "說明", en: "Details" } }], rows: [["禾境雙人房", "NT$6,800", "2", "含早餐、泳池、SPA"], ["星空四人房", "NT$9,200", "4", "含早餐、BBQ、泳池"]] } },
          ],
        },
        contact: {
          label: { zh: "交通聯繫", en: "Contact" }, page_type: "blocks", sort_order: 5,
          blocks: [
            { type: "contact_info", enabled: true, config: { address: { zh: "宜蘭縣冬山鄉梅花路 123 號", en: "No.123, Meihua Rd., Dongshan, Yilan" }, phone: "0912-345-678", email: "hello@shamanya.tw", line: "@shamanya" } },
          ],
        },
        faq: {
          label: { zh: "入住須知", en: "FAQ" }, page_type: "blocks", sort_order: 6,
          blocks: [
            { type: "faq_accordion", enabled: true, config: { items: [{ question: { zh: "入住/退房時間？", en: "Check-in/Check-out time?" }, answer: { zh: "入住 15:00，退房 11:00", en: "Check-in 3:00 PM, Check-out 11:00 AM" } }, { question: { zh: "是否提供停車場？", en: "Is parking available?" }, answer: { zh: "是，提供免費停車", en: "Yes, free parking is available." } }, { question: { zh: "可以攜帶寵物嗎？", en: "Are pets allowed?" }, answer: { zh: "抱歉，為維護環境品質，目前不開放寵物入住。", en: "Sorry, pets are not currently allowed to maintain environment quality." } }] } },
          ],
        },
        news: {
          label: { zh: "最新活動", en: "News" }, page_type: "cms_list", content_type: "news", sort_order: 0,
        },
        articles: {
          label: { zh: "旅遊專欄", en: "Articles" }, page_type: "cms_list", content_type: "journal", sort_order: 7,
        },
      },
      instagram: "https://instagram.com/shamanya_villa",
      facebook: "https://facebook.com/shamanyavilla",
      line: "https://line.me/ti/p/@shamanya",
    },
  };
}
