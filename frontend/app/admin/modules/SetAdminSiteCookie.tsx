"use client";

import { useEffect } from "react";
import { setAdminSiteCookie } from "./adminSiteCookie";

export function SetAdminSiteCookie({
  slug,
  parentSiteId,
}: {
  slug: string;
  parentSiteId: number | null | undefined;
}) {
  useEffect(() => {
    setAdminSiteCookie(slug);
  }, [slug, parentSiteId]);
  return null;
}
