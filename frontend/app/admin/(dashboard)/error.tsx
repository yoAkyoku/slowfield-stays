"use client";

import AdminErrorScreen from "../modules/AdminErrorScreen";

/* Catches errors thrown by pages inside the dashboard. Throws from the layout
   itself go one level up, to admin/error.tsx; both render the same screen. */
export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminErrorScreen {...props} />;
}
