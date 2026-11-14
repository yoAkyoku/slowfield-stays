/* Kept apart from adminApi on purpose. adminApi imports next/headers, so it is
   server-only; the error boundary that has to branch on these values is a client
   component. Sharing the strings through a module with no imports lets both
   sides agree without dragging server APIs into the client bundle. */
export const ADMIN_FORBIDDEN_DIGEST = "ADMIN_FORBIDDEN";
export const ADMIN_DATA_DIGEST = "ADMIN_DATA_ERROR";
export const ADMIN_SITE_MISSING_DIGEST = "ADMIN_SITE_MISSING";
