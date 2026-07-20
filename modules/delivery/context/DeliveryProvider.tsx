"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { useTenant } from "@/context/TenantProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  getBranchPref,
  pickAllowedBranchId,
  setBranchPref,
} from "@/lib/session-prefs";
import {
  deliveryStatusLabel,
  setDeliveryStatus,
  subscribeDeliveryOrders,
} from "@/modules/delivery/services/delivery.service";
import { subscribeBranches } from "@/modules/pos/services/branches.service";
import type { DeliveryStatus, Order } from "@/types/orders";
import type { Branch } from "@/types/restaurant";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface DeliveryContextValue {
  ready: boolean;
  error: string | null;
  branches: Branch[];
  branchId: string | null;
  setBranchId: (id: string) => void;
  orders: Order[];
  currency: string;
  assignToMe: (order: Order) => Promise<void>;
  advance: (order: Order, status: DeliveryStatus) => Promise<void>;
}

const Ctx = createContext<DeliveryContextValue | null>(null);

export function useDelivery() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDelivery requires provider");
  return ctx;
}

export function DeliveryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { restaurant, restaurantId } = useRestaurant();
  const { canAccessBranch } = useTenant();
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const currency = restaurant?.currency ?? "EUR";

  const branches = useMemo(
    () => allBranches.filter((b) => canAccessBranch(b.id)),
    [allBranches, canAccessBranch],
  );

  const setBranchId = useCallback(
    (id: string) => {
      if (!canAccessBranch(id)) return;
      setBranchIdState(id);
      setBranchPref("delivery", user?.uid, restaurantId, id);
    },
    [canAccessBranch, user?.uid, restaurantId],
  );

  useEffect(() => {
    if (!restaurantId || !isFirebaseConfigured()) {
      setReady(true);
      setError(
        !isFirebaseConfigured()
          ? "Firebase no está configurado"
          : "Selecciona un restaurante",
      );
      return;
    }
    setError(null);
    return subscribeBranches(restaurantId, (list) => {
      setAllBranches(list);
      const allowed = list.filter((b) => canAccessBranch(b.id));
      setBranchIdState((current) => {
        const stored = getBranchPref("delivery", user?.uid, restaurantId);
        return pickAllowedBranchId({
          allowedIds: allowed.map((b) => b.id),
          current,
          stored,
          defaultBranchId: restaurant?.settings.defaultBranchId,
          isDefaultId: list.find((b) => b.isDefault)?.id ?? null,
        });
      });
      setReady(true);
    }, (e) => setError(e.message));
  }, [
    restaurantId,
    restaurant?.settings.defaultBranchId,
    user?.uid,
    canAccessBranch,
  ]);

  useEffect(() => {
    if (!restaurantId || !branchId) return;
    return subscribeDeliveryOrders(
      restaurantId,
      branchId,
      setOrders,
      (e) => setError(e.message),
    );
  }, [restaurantId, branchId]);

  const assignToMe = useCallback(
    async (order: Order) => {
      if (!restaurantId || !user) throw new Error("Sin sesión");
      await setDeliveryStatus({
        restaurantId,
        orderId: order.id,
        status: "assigned",
        assignedTo: user.uid,
        assignedName: user.displayName || user.email || "Repartidor",
      });
    },
    [restaurantId, user],
  );

  const advance = useCallback(
    async (order: Order, status: DeliveryStatus) => {
      if (!restaurantId) throw new Error("Sin restaurante");
      await setDeliveryStatus({
        restaurantId,
        orderId: order.id,
        status,
        assignedTo: order.deliveryAssignedTo,
        assignedName: order.deliveryAssignedName,
      });
    },
    [restaurantId],
  );

  const value: DeliveryContextValue = {
    ready,
    error,
    branches,
    branchId,
    setBranchId,
    orders,
    currency,
    assignToMe,
    advance,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { deliveryStatusLabel };
