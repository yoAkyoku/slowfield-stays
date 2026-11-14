"use client";

import { createContext, useContext } from "react";

const AdminSiteSlugContext = createContext<string>("slowfield");
const AdminPermissionsContext = createContext<string[]>(["*"]);

export function AdminSiteProvider({ slug, permissions = ["*"], children }: { slug: string; permissions?: string[]; children: React.ReactNode }) {
  return <AdminSiteSlugContext.Provider value={slug}><AdminPermissionsContext.Provider value={permissions}>{children}</AdminPermissionsContext.Provider></AdminSiteSlugContext.Provider>;
}

export function useAdminPermission(permission: string) {
  const permissions = useContext(AdminPermissionsContext);
  return permissions.includes("*") || permissions.includes(permission);
}

export function useAdminSiteSlug() {
  return useContext(AdminSiteSlugContext);
}
