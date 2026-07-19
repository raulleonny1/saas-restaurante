"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import {
  getMockDashboardMetrics,
  getMockDeltas,
  MOCK_BRANCHES,
  MOCK_RESTAURANT,
  type MockDashboardDelta,
} from "@/modules/dashboard/mock/data";
import {
  EMPTY_DASHBOARD_METRICS,
  type DashboardMetrics,
} from "@/types/dashboard";
import type { Branch } from "@/types/restaurant";
import { useEffect, useMemo, useState } from "react";

const MOCK_LOAD_MS = 280;

/**
 * Dashboard data layer — simulated metrics only.
 * Swappable later for `subscribeDashboard` without changing the view.
 */
export function useDashboard() {
  const { restaurant } = useRestaurant();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const branches: Branch[] = MOCK_BRANCHES;
  const restaurantName = restaurant?.name ?? MOCK_RESTAURANT.name;
  const currency = restaurant?.currency ?? MOCK_RESTAURANT.currency;

  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), MOCK_LOAD_MS);
    return () => window.clearTimeout(t);
  }, [branchId]);

  const metrics: DashboardMetrics = useMemo(
    () => (loading ? EMPTY_DASHBOARD_METRICS : getMockDashboardMetrics(branchId)),
    [branchId, loading],
  );

  const deltas: MockDashboardDelta = useMemo(
    () => getMockDeltas(branchId),
    [branchId],
  );

  return {
    restaurantName,
    currency,
    branches,
    branchId,
    setBranchId,
    metrics,
    deltas,
    loading,
    isSimulated: true,
  };
}
