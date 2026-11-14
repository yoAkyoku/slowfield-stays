"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Check, Chips, Dialog, DialogActions, Stack } from "../../ui";

type RoleOption = { name: string; label: string };

function SubmitRow({
  cancelLabel,
  confirmLabel,
  disabled,
  onCancel,
  onDone
}: {
  cancelLabel: string;
  confirmLabel: string;
  disabled: boolean;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { pending } = useFormStatus();
  const wasSubmitting = useRef(false);

  useEffect(() => {
    if (wasSubmitting.current && !pending) onDone();
    wasSubmitting.current = pending;
  }, [pending, onDone]);

  return (
    <DialogActions>
      <Button variant="ghost" onClick={onCancel} disabled={pending}>
        {cancelLabel}
      </Button>
      <Button variant="primary" type="submit" disabled={disabled || pending} icon={pending ? <span className="admin-spinner" /> : undefined}>
        {confirmLabel}
      </Button>
    </DialogActions>
  );
}

export default function UserRoleEditor({
  cancelLabel,
  confirmLabel,
  currentRole,
  currentRoleLabel,
  roles,
  title,
  updateAction,
  userId,
  userName
}: {
  cancelLabel: string;
  confirmLabel: string;
  currentRole: string;
  currentRoleLabel: string;
  roles: RoleOption[];
  title: string;
  updateAction: (id: string, formData: FormData) => Promise<void>;
  userId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentRole);

  function openDialog() {
    setSelected(currentRole);
    setOpen(true);
  }

  return (
    <>
      <Chips>
        <span>{currentRoleLabel}</span>
        <Button variant="ghost" size="sm" iconOnly icon={<Pencil />} onClick={openDialog}>
          {title}
        </Button>
      </Chips>
      <Dialog description={userName} dismissible={false} onClose={() => setOpen(false)} open={open} size="sm" title={title}>
        <form action={updateAction.bind(null, userId)}>
          <Stack>
            <Stack gap="sm">
              {roles.map((role) => (
                <Check
                  checked={selected === role.name}
                  key={role.name}
                  label={role.label}
                  name="role"
                  onChange={() => setSelected(role.name)}
                  type="radio"
                  value={role.name}
                />
              ))}
            </Stack>
            <SubmitRow
              cancelLabel={cancelLabel}
              confirmLabel={confirmLabel}
              disabled={selected === currentRole}
              onCancel={() => setOpen(false)}
              onDone={() => setOpen(false)}
            />
          </Stack>
        </form>
      </Dialog>
    </>
  );
}
