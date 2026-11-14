export function sidebarHrefIsActive(href: string, pathname: string, query: string): boolean {
  const [target, raw] = href.split("?");
  const params = new URLSearchParams(query);
  if (raw) return (target === "/admin/cms" && raw === "tab=banners" && pathname.startsWith("/admin/cms/banners/")) || (pathname === target && Array.from(new URLSearchParams(raw)).every(([key,value]) => params.get(key) === value));
  if (target === "/admin/cms" && (pathname.startsWith("/admin/cms/categories") || pathname.startsWith("/admin/cms/tags") || pathname.startsWith("/admin/cms/banners") || (params.get("tab") === "banners" && pathname === target))) return false;
  return pathname === target || (target !== "/admin" && pathname.startsWith(`${target}/`));
}
