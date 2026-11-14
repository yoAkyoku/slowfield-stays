"use client";

import { logoutAction } from "./authActions";

export default function LogoutButton({ label, className }: { label: string; className?: string }) {
  return (
    <form action={logoutAction}>
      <button className={className ?? "admin-topbar-button"} type="submit">
        {label}
      </button>
    </form>
  );
}
