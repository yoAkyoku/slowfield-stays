"use client";

import { Pencil } from "lucide-react";
import { Button, Dialog, DialogActions, Input } from "../../ui";
import { useState } from "react";
import { useAdminSiteSlug } from "../../modules/AdminSiteContext";

function proxyUrl(id: number, site: string) {
  return `/admin/api/proxy?path=${encodeURIComponent(`/admin/media/${id}`)}&site=${encodeURIComponent(site)}`;
}

type Labels = {
  rename: string;
  save: string;
  cancel: string;
  placeholder: string;
  error: string;
};

export default function RenameMediaButton({
  id,
  name,
  labels,
  onRenamed,
}: {
  id: number;
  name: string;
  labels: Labels;
  onRenamed: (name: string) => void;
}) {
  const site = useAdminSiteSlug();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const displayName = value.trim();
    if (!displayName || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(proxyUrl(id, site), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!response.ok) {
        setError(labels.error);
        return;
      }
      onRenamed(displayName);
      setOpen(false);
    } catch {
      setError(labels.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        icon={<Pencil />}
        iconOnly
        onClick={() => { setValue(name); setError(""); setOpen(true); }}
        size="sm"
        variant="ghost"
      >
        {labels.rename}
      </Button>
      <Dialog
        dismissible={false}
        footer={
          <DialogActions>
            <Button onClick={() => setOpen(false)}>{labels.cancel}</Button>
            <Button disabled={saving || !value.trim()} onClick={() => void save()} variant="primary">{labels.save}</Button>
          </DialogActions>
        }
        onClose={() => setOpen(false)}
        open={open}
        size="sm"
        title={labels.rename}
      >
        <Input
          value={value}
          maxLength={260}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void save(); }}
        />
        {error ? <p className="admin-form-error" role="alert">{error}</p> : null}
      </Dialog>
    </>
  );
}
