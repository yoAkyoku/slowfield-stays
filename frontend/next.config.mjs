/** @type {import('next').NextConfig} */
const localDevelopmentApiOrigins = () => {
  if (process.env.NODE_ENV === "production") return [];
  const origins = new Set();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return ["http://localhost:8000", "http://127.0.0.1:8000"];
  if (apiUrl) {
    try {
      const url = new URL(apiUrl);
      if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
        origins.add(url.origin);
      }
    } catch {
      // Ignore malformed optional dev configuration; the app retains its fallback URL.
    }
  }
  return [...origins];
};

const nextConfig = {
  output: "standalone",
  images: {
    // The standalone Next server can't reach /storage/* (served by Caddy →
    // backend), so its image optimizer 400s on every stored image
    // ("isn't a valid image"). Serve images as-is; they're already sized
    // reasonably and load fine directly. Re-enable only if the optimizer is
    // given network access to /storage.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.slowfield.example"
      },
      ...(process.env.NODE_ENV !== "production"
        ? [{ protocol: "http", hostname: "localhost" }]
        : [])
    ]
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = {
        type: "memory"
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // SAMEORIGIN (not DENY) so the admin homepage editor can preview the
          // live site in an iframe; external framing is still blocked.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Browsers ignore HSTS over http:// so it's safe to send unconditionally.
          // No `preload` until hstspreload.org submission — preload is hard to undo.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Baseline CSP. 'unsafe-inline' for script/style is required by Next.js
          // (RSC hydration + inline style props). Tighten with nonces if you ever
          // move off the default Next.js script pipeline.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https:",
              // Cloudflare auto-injects its Web Analytics beacon (beacon.min.js)
              // from static.cloudflareinsights.com; allow the script + its POST.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
              // fonts.googleapis.com hosts the LXGW WenKai TC stylesheet (kai font preset).
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Public forms call the configured API directly from the browser.
              // Keep HTTP exceptions limited to configured loopback APIs in
              // development; production continues to require HTTPS or same-origin.
              [
                "connect-src 'self' https: ws: wss:",
                ...localDevelopmentApiOrigins(),
              ].join(" "),
              // Allow trusted embeds (Google Maps in contact blocks, YouTube /
              // Instagram in social-embed blocks). Without this, frame-src
              // falls back to default-src 'self' and blocks all iframes.
              "frame-src 'self' https://www.google.com https://maps.google.com https://www.google.com/maps https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.instagram.com https://www.facebook.com",
              // 'self' so the admin preview can frame the site (same origin);
              // still blocks cross-origin framing.
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async rewrites() {
    const rewrites = [];
    const internalApiUrl = process.env.INTERNAL_API_URL;
    if (process.env.NODE_ENV !== "production" && internalApiUrl) {
      try {
        const url = new URL(internalApiUrl);
        const basePath = url.pathname.replace(/\/+$/, "");
        if (
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname) &&
          basePath.endsWith("/api/v1")
        ) {
          rewrites.push({
            source: "/api/v1/:path*",
            destination: `${url.origin}${basePath}/:path*`,
          });
        }
      } catch {
        // Ignore invalid optional API proxy configuration outside the QA launcher.
      }
    }
    // Local-only convenience: when STORAGE_PROXY_ORIGIN is set (in .env.local),
    // proxy /storage/* to a remote origin so a dev frontend pointed at the
    // production API can load its uploaded media. Inert in production (env unset).
    const storageOrigin = process.env.STORAGE_PROXY_ORIGIN;
    if (storageOrigin) {
      rewrites.push({ source: "/storage/:path*", destination: `${storageOrigin}/storage/:path*` });
    }
    return rewrites;
  },
  async redirects() {
    // Static 301 redirects for SEO — common legacy or aliased URLs
    const staticRedirects = [
      { source: "/home",       destination: "/",          permanent: true },
      { source: "/about",      destination: "/brand",     permanent: true },
      { source: "/about-us",   destination: "/brand",     permanent: true },
      { source: "/blog",       destination: "/journal",   permanent: true },
      { source: "/blog/:slug", destination: "/journal/:slug", permanent: true },
      { source: "/rooms",      destination: "/stays",     permanent: true },
      { source: "/villas",     destination: "/stays",     permanent: true },
      { source: "/media",      destination: "/media-coverage", permanent: true },
      { source: "/press",      destination: "/pr",        permanent: true },
      { source: "/jobs",       destination: "/careers",   permanent: true },
      { source: "/faq",        destination: "/contact",   permanent: true },
      { source: "/service",    destination: "/services",  permanent: true },
    ];

    // Dynamic redirects from API (when backend supports it)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
      const res = await fetch(`${apiUrl}/redirects`, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        const dynamic = (data ?? []).map((r) => ({
          source: r.source,
          destination: r.destination,
          permanent: r.permanent !== false,
        }));
        return [...staticRedirects, ...dynamic];
      }
    } catch {
      // API not available or no redirects endpoint — use static only
    }

    return staticRedirects;
  }
};

export default nextConfig;

