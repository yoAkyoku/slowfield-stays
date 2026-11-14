"use client";

import { Check, Grid3X3, Lock, Search, Tag } from "lucide-react";
import { roleLabel } from "../../../modules/roleLabel";
import { useCallback, useMemo, useState } from "react";
import SubmitButton from "../../modules/SubmitButton";
import { updateRolePermissionsAction } from "../../modules/userActions";
import { Badge, Callout, Card, FormActions, SearchInput, Segmented, Stack, Toolbar, buttonClass } from "../../ui";
import "./roles.css";

type RoleData = {
  id: number;
  name: string;
  permissions: string[];
};

type PermGroup = {
  id: string;
  label: string;
  labelEn: string;
  permissions: string[];
};

type ViewMode = "grid" | "cloud";

/**
 * The role that holds everything, by what it grants rather than by what it is
 * called.
 *
 * This screen locked its grid on `name === "super_admin"`. That name is not the
 * only one: `roleLabels` calls BOTH "super_admin" and "owner" 超級管理者, and the
 * screen itself can put `*` on a role called anything at all. So an `owner` — or
 * any bespoke role granted the wildcard — arrived here fully editable, and the
 * one change nobody left could undo was the one the lock existed to prevent.
 *
 * The backend counts the same way (_super_admin_role_ids, and the docstring on
 * _is_last_super_admin says why), so the two now agree about which role is
 * untouchable instead of agreeing only for the role that happens to be named.
 */
function grantsEverything(role: { permissions?: string[] } | undefined): boolean {
  return (role?.permissions ?? []).includes("*");
}

/** Ignore permission groups whose permissions are not available to this installation. */
function hasVisiblePermissionResults(groups: PermGroup[], allPermissions: string[]): boolean {
  return groups.some((group) => group.permissions.some((permission) => allPermissions.includes(permission)));
}
export default function RolesTabView({
  allPermissions,
  canWrite,
  groups,
  initialRole,
  lockedLabel,
  permissionDescriptions,
  noResultsLabel,
  permissionLabels,
  roleLabels,
  roles,
  saveLabel,
  searchPlaceholder,
  unsavedLabel = "",
  viewingLabel
}: {
  allPermissions: string[];
  canWrite: boolean;
  initialRole: string;
  groups: PermGroup[];
  lockedLabel: string;
  permissionDescriptions: Record<string, string>;
  noResultsLabel: string;
  permissionLabels: Record<string, string>;
  roleLabels: Record<string, string>;
  roles: RoleData[];
  saveLabel: string;
  searchPlaceholder: string;
  unsavedLabel?: string;
  viewingLabel: string;
}) {
  /* Seeded from the URL so it survives the redirect the save action performs;
     falls back to the first role for a plain visit. */
  const [activeTab, setActiveTab] = useState(
    roles.some((r) => r.name === initialRole) ? initialRole : (roles[0]?.name ?? "")
  );
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const activeRole = roles.find((r) => r.name === activeTab);

  /* ── Track toggled permissions for immediate visual feedback ── */
  const initialPerms = useMemo(() => new Set(activeRole?.permissions ?? []), [activeRole]);
  const [toggledPerms, setToggledPerms] = useState<Set<string>>(initialPerms);
  const [dirty, setDirty] = useState(false);

  /* Reset when switching tabs */
  const switchTab = useCallback((name: string) => {
    setActiveTab(name);
    const role = roles.find((r) => r.name === name);
    setToggledPerms(new Set(role?.permissions ?? []));
    setDirty(false);
  }, [roles]);

  const togglePerm = useCallback((perm: string) => {
    setToggledPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
    setDirty(true);
  }, []);

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        permissions: g.permissions.filter((p) => {
          const label = (permissionLabels[p] ?? p).toLowerCase();
          const desc = (permissionDescriptions[p] ?? "").toLowerCase();
          return label.includes(q) || desc.includes(q) || p.toLowerCase().includes(q);
        })
      }))
      .filter((g) => g.permissions.length > 0);
  }, [groups, query, permissionLabels, permissionDescriptions]);
  const hasVisiblePermissions = hasVisiblePermissionResults(filteredGroups, allPermissions);

  const isChecked = (perm: string) => {
    const hasAll = toggledPerms.has("*");
    return hasAll || toggledPerms.has(perm);
  };

  return (
    <Stack className="roles-tabs-view">
      {/* Header bar: tabs + search + view toggle */}
      <Toolbar
        end={
          <>
            <SearchInput
              icon={<Search />}
              type="text"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Segmented<ViewMode>
              ariaLabel="View"
              onChange={setViewMode}
              options={[
                { value: "grid", label: null, icon: <Grid3X3 aria-label="Grid" />, title: "Grid" },
                { value: "cloud", label: null, icon: <Tag aria-label="Tags" />, title: "Tags" }
              ]}
              value={viewMode}
            />
          </>
        }
      >
        <span className="a-field__label">{viewingLabel}</span>
        <Segmented
          ariaLabel={viewingLabel}
          onChange={switchTab}
          options={roles.map((role) => ({ value: role.name, label: roleLabel(roleLabels, role.name) }))}
          value={activeTab}
        />
      </Toolbar>

      {/* Content */}
      {activeRole && (
        <Card flush className="roles-permissions-card">
        {grantsEverything(activeRole) ? (
          <div className="roles-locked-note">
            <Callout tone="info" icon={<Lock />}>{lockedLabel}</Callout>
          </div>
        ) : null}
        <form
          className={`roles-tab-content ${grantsEverything(activeRole) ? "roles-tab-content--locked" : ""}`}
          action={updateRolePermissionsAction.bind(null, String(activeRole.id))}
          key={activeRole.id}
        >
          {/* Tells the action which tab to come back to; see
              updateRolePermissionsAction. */}
          <input type="hidden" name="role_name" value={activeRole.name} />
          {grantsEverything(activeRole) && (
            <input type="hidden" name="permissions" value="*" />
          )}
          {/* Hidden inputs for checked permissions (form submission) */}
          {Array.from(toggledPerms).filter((p) => p !== "*").map((perm) => (
            <input type="hidden" name="permissions" value={perm} key={`h-${perm}`} />
          ))}

          {!hasVisiblePermissions ? (
            <p className="roles-search-empty" role="status">{noResultsLabel}</p>
          ) : viewMode === "grid" ? (
            /* ── Grid View ── */
            <div className="roles-grid-view">
              {filteredGroups.map((group) => (
                <div className="rpg-section" key={group.id}>
                  <div className="rpg-section-header">
                    <span className="rpg-dot" />
                    <span className="rpg-section-title">
                      {group.label}
                      {group.labelEn && <span className="rpg-section-en"> ({group.labelEn})</span>}
                    </span>
                  </div>
                  <div className="rpg-card-grid">
                    {group.permissions
                      .filter((p) => allPermissions.includes(p))
                      .map((perm) => {
                        const checked = isChecked(perm);
                        const disabled = grantsEverything(activeRole) || !canWrite;
                        const isRead = perm.endsWith(":read");
                        return (
                          <button
                            type="button"
                            className={`rpg-card ${checked ? "rpg-card--on" : "rpg-card--off"} ${disabled ? "rpg-card--disabled" : ""}`}
                            key={perm}
                            onClick={() => !disabled && togglePerm(perm)}
                            aria-pressed={checked}
                          >
                            <span className={`rpg-badge ${isRead ? "rpg-badge--read" : "rpg-badge--write"}`}>
                              {isRead ? "R" : "W"}
                            </span>
                            <div className="rpg-card-text">
                              <strong>{permissionLabels[perm] ?? perm}</strong>
                              {permissionDescriptions[perm] && <span>{permissionDescriptions[perm]}</span>}
                            </div>
                            <span className={`rpg-indicator ${checked ? "rpg-indicator--on" : ""}`}>
                              {checked && <Check size={12} />}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Cloud / Tag View ── */
            <div className="roles-cloud-view">
              {filteredGroups.map((group) => (
                <div className="rpc-section" key={group.id}>
                  <span className="rpc-section-label">{group.label}</span>
                  <div className="rpc-tags">
                    {group.permissions
                      .filter((p) => allPermissions.includes(p))
                      .map((perm) => {
                        const checked = isChecked(perm);
                        const disabled = grantsEverything(activeRole) || !canWrite;
                        return (
                          <button
                            type="button"
                            className={`rpc-tag ${checked ? "rpc-tag--on" : "rpc-tag--off"} ${disabled ? "rpc-tag--disabled" : ""}`}
                            key={perm}
                            onClick={() => !disabled && togglePerm(perm)}
                            aria-pressed={checked}
                          >
                            {checked && <Check size={11} className="rpc-tag-check" />}
                            <span>{permissionLabels[perm] ?? perm}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canWrite && !grantsEverything(activeRole) && dirty && (
            <FormActions sticky className="roles-save-bar">
              {dirty && <Badge tone="warning" dot>{unsavedLabel}</Badge>}
              <SubmitButton className={buttonClass({ variant: "primary" })}>
                {saveLabel}
              </SubmitButton>
            </FormActions>
          )}
        </form>
        </Card>
      )}
    </Stack>
  );
}
