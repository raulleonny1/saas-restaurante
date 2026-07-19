"use client";

import type { TenantBilling, TenantInvoice } from "@/types/billing";
import type { PermissionId, RoleId } from "@/types/rbac";
import type { Branch, Member } from "@/types/restaurant";
import { createContext } from "react";

export interface TenantContextValue {
  ready: boolean;
  member: Member | null;
  members: Member[];
  branches: Branch[];
  billing: TenantBilling | null;
  invoices: TenantInvoice[];
  role: RoleId | null;
  permissions: PermissionId[];
  branchIds: string[];
  can: (permission: PermissionId) => boolean;
  hasRole: (allowed: RoleId | RoleId[]) => boolean;
  hasAnyRole: (allowed: RoleId[]) => boolean;
  isStaff: boolean;
  canManage: boolean;
  canAccessBranch: (branchId: string) => boolean;
  refreshInvites: () => Promise<number>;
}

export const TenantContext = createContext<TenantContextValue | null>(null);
