"use client";

import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";
import { SIGNUP_ROLES, type RoleId } from "@/types/auth";
import { Select } from "@/ui";

interface RoleSelectProps {
  value: RoleId;
  onChange: (role: RoleId) => void;
  id?: string;
  disabled?: boolean;
  /** Defaults to public signup roles only. */
  roles?: RoleId[];
}

export function RoleSelect({
  value,
  onChange,
  id = "role",
  disabled,
  roles = SIGNUP_ROLES,
}: RoleSelectProps) {
  return (
    <div className="space-y-1.5">
      <Select
        id={id}
        label="Rol"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as RoleId)}
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </Select>
      <p className="text-xs text-fg-muted">{ROLE_DESCRIPTIONS[value]}</p>
    </div>
  );
}
