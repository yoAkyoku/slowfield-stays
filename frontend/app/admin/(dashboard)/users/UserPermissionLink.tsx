"use client";

import { useState } from "react";
import { Badge, Button, Dialog } from "../../ui";
import PermissionGroups, { type PermGroup } from "./PermissionGroups";

export default function UserPermissionLink({
  closeLabel,
  groups,
  roleLabel,
  title,
  triggerLabel,
  userName
}: {
  closeLabel: string;
  groups: PermGroup[];
  roleLabel: string;
  title: string;
  triggerLabel: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog
        closeLabel={closeLabel}
        description={<><strong>{userName}</strong> <Badge tone="brand">{roleLabel}</Badge></>}
        onClose={() => setOpen(false)}
        open={open}
        size="lg"
        title={title}
      >
        <PermissionGroups groups={groups} />
      </Dialog>
    </>
  );
}
