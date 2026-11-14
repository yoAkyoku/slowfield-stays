"use client";

import { Check, ChevronDown, Shield } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge, Button, Card } from "../../../ui";

type PermGroup = { id: string; label: string; permissions: string[] };
type RoleRef = { label: string; name: string; permissions: string[] };

export default function NewUserPermissions({
  groups,
  permissionDescriptions,
  permissionLabels,
  roles,
  title
}: {
  groups: PermGroup[];
  permissionDescriptions?: Record<string, string>;
  permissionLabels: Record<string, string>;
  roles: RoleRef[];
  title: string;
}) {
  const [selectedRole, setSelectedRole] = useState(roles[0]?.name ?? "");
  const [extraPerms, setExtraPerms] = useState<Set<string>>(new Set());
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.id))
  );

  const activeRole = roles.find((r) => r.name === selectedRole);
  const rolePerms = new Set(
    activeRole?.permissions.includes("*")
      ? groups.flatMap((g) => g.permissions)
      : activeRole?.permissions ?? []
  );

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExtra = useCallback((perm: string) => {
    setExtraPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }, []);

  const handleRoleChange = useCallback((name: string) => {
    setSelectedRole(name);
    setExtraPerms(new Set());
  }, []);

  return (
    <Card
      className="perm-checklist-panel"
      title={title}
      actions={<Badge tone="brand"><Shield size={12} /> {activeRole?.label ?? selectedRole}</Badge>}
      flush
    >

      {/* Hidden inputs for form submission */}
      {Array.from(extraPerms).map((p) => (
        <input type="hidden" name="extra_permissions" value={p} key={`extra-${p}`} />
      ))}

      {/* Role selector synced with form's role select */}
      <div className="perm-checklist-role-select">
        {roles.map((r) => (
          <Button
            key={r.name}
            size="sm"
            variant={r.name === selectedRole ? "primary" : "secondary"}
            aria-pressed={r.name === selectedRole}
            icon={r.name === selectedRole ? <Check /> : undefined}
            onClick={() => handleRoleChange(r.name)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <div className="perm-checklist-body">
        {groups.map((group) => {
          const isOpen = openSections.has(group.id);
          const groupActiveCount = group.permissions.filter(
            (p) => rolePerms.has(p) || extraPerms.has(p)
          ).length;
          return (
            <div className={`perm-check-section ${isOpen ? "perm-check-section--open" : ""}`} key={group.id}>
              <button
                className="perm-check-section-header"
                type="button"
                onClick={() => toggleSection(group.id)}
                aria-expanded={isOpen}
              >
                <span className="perm-check-section-label">{group.label}</span>
                <span className="perm-check-section-count">{groupActiveCount}/{group.permissions.length}</span>
                <ChevronDown size={14} className="perm-check-chevron" />
              </button>
              {isOpen && (
                <div className="perm-check-items">
                  {group.permissions.map((perm) => {
                    const fromRole = rolePerms.has(perm);
                    const fromExtra = extraPerms.has(perm);
                    const active = fromRole || fromExtra;
                    return (
                      <label
                        className={`perm-check-item ${active ? "perm-check-item--on" : ""} ${fromRole ? "perm-check-item--role" : ""}`}
                        key={perm}
                      >
                        <span className={`perm-check-box ${active ? "perm-check-box--on" : ""}`}>
                          {active && <Check size={11} />}
                        </span>
                        <div className="perm-check-label">
                          <strong>{permissionLabels[perm] ?? perm}</strong>
                          {permissionDescriptions?.[perm] && <span>{permissionDescriptions[perm]}</span>}
                        </div>
                        {fromRole ? (
                          <span className="perm-check-source">role</span>
                        ) : (
                          <input
                            type="checkbox"
                            className="perm-check-extra-input"
                            checked={fromExtra}
                            onChange={() => toggleExtra(perm)}
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
