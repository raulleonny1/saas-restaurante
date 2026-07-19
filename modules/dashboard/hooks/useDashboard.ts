"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import { useTenant } from "@/context/TenantProvider";
import {
  listBranches,
  subscribeDashboard,
} from "@/services/dashboard.service";
import {
  EMPTY_DASHBOARD_METRICS,
  type DashboardMetrics,
} from "@/types/dashboard";
import type { Branch } from "@/types/restaurant";
import { useEffect, useState } from "react";

export type DashboardDelta = {
  revenuePct: number | null;
  ordersPct: number | null;
};

/**
 * Dashboard en tiempo real desde Firestore (pedidos, mesas, stock, reservas).
 */
export function useDashboard() {
  const { restaurant, restaurantId } = useRestaurant();
  const { branches: tenantBranches } = useTenant();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_DASHBOARD_METRICS);
  const [deltas, setDeltas] = useState<DashboardDelta>({
    revenuePct: null,
    ordersPct: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantBranches.length) {
      setBranches(tenantBranches.filter((b) => b.status !== "archived"));
      return;
    }
    if (!restaurantId) {
      setBranches([]);
      return;
    }
    return listBranches(restaurantId, setBranches);
  }, [restaurantId, tenantBranches]);

  useEffect(() => {
    if (!restaurantId) {
      setMetrics(EMPTY_DASHBOARD_METRICS);
      setDeltas({ revenuePct: null, ordersPct: null });
      setLoading(false);
      return;
    }

    setLoading(true);
    let first = true;
    const stop = subscribeDashboard(restaurantId, branchId, (next, nextDeltas) => {
      setMetrics(next);
      if (nextDeltas) setDeltas(nextDeltas);
      if (first) {
        first = false;
        setLoading(false);
      }
    });

    return () => {
      stop();
    };
  }, [restaurantId, branchId]);

  return {
    restaurantName: restaurant?.name ?? "Restaurante",
    currency: restaurant?.currency ?? "EUR",
    branches,
    branchId,
    setBranchId,
    metrics,
    deltas,
    loading: loading || !restaurantId,
    isSimulated: false,
  };
}
