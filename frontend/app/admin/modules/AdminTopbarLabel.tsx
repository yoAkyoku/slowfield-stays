"use client";

import { usePathname, useSearchParams } from "next/navigation";

type GroupDef = { label: string; hrefs: string[] };

export default function AdminTopbarLabel({ groups }: { groups: GroupDef[] }) {
  const pathname = usePathname();
  const search = useSearchParams();
  if ((pathname === "/admin/cms" && search.get("tab") === "banners") || pathname.startsWith("/admin/cms/banners/")) return <strong>{groups.find(group => group.hrefs.includes("/admin/media"))?.label ?? ""}</strong>;
  // `/admin` is the root of every dashboard route, so a first-match lookup
  // always labels nested screens as Overview. Prefer the longest matching
  // href so `/admin/cms/tags` resolves to Content and `/admin/sites/1` to
  // Site Management while the root still resolves to Overview.
  const active = groups
    .filter((group) => group.hrefs.some((href) => pathname === href || pathname.startsWith(href + "/")))
    .sort((a, b) => {
      const longestHref = (group: GroupDef) =>
        Math.max(0, ...group.hrefs.filter((href) => pathname === href || pathname.startsWith(href + "/")).map((href) => href.length));
      return longestHref(b) - longestHref(a);
    })[0];
  return <strong>{active?.label ?? ""}</strong>;
}
