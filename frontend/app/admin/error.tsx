"use client";

import AdminErrorScreen from "./modules/AdminErrorScreen";

/* Two boundaries, one screen. Next routes an error to the boundary of the
   *parent* segment, so this one — and not (dashboard)/error.tsx — is what
   catches a throw from the dashboard layout itself, which is where the sidebar
   loads the profile and the site list. Without it a stale admin-site cookie
   escaped every boundary and landed on Next's bare built-in error page. */
export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminErrorScreen {...props} />;
}
