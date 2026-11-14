"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Dialog } from "../../ui";
import PermissionGroups, { type PermGroup } from "../users/PermissionGroups";

export default function AccountPermissionModal({
  groups,
  labels,
  roleLabel
}: {
  groups: PermGroup[];
  labels: { close: string; title: string; trigger: string };
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" icon={<Eye size={14} />} onClick={() => setOpen(true)}>
        {labels.trigger}
      </Button>
      <Dialog closeLabel={labels.close} description={<Badge tone="brand">{roleLabel}</Badge>} onClose={() => setOpen(false)} open={open} size="lg" title={labels.title}>
        <PermissionGroups groups={groups} />
      </Dialog>
    </>
  );
}
