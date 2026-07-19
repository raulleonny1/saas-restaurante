"use client";

/**
 * Syncs pesados solo en backoffice (dueño/gerente…).
 * Mesero/caja/cocina/barra no los montan: el cobro ya dispara inventario/CRM
 * en PosProvider.pay (idempotente).
 */

import { useAuth } from "@/context/AuthProvider";
import {
  canManageRestaurant,
  isFloorAppRole,
  isKitchenStaffRole,
} from "@/lib/roles";
import { CrmOrderSync } from "@/modules/customers";
import { InventorySaleSync } from "@/modules/inventory";
import { MarketingSchedulerSync } from "@/modules/marketing";

export function BackofficeSyncs() {
  const { role, can, user } = useAuth();

  if (!user || !role) return null;

  if (isFloorAppRole(role) || isKitchenStaffRole(role)) {
    return null;
  }

  const runCatchUp =
    canManageRestaurant(role) ||
    can("inventory.adjust") ||
    can("customers.manage");

  return (
    <>
      {runCatchUp ? <InventorySaleSync /> : null}
      {runCatchUp ? <CrmOrderSync /> : null}
      <MarketingSchedulerSync />
    </>
  );
}
