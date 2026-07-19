"use client";

/**
 * Background sync: paid POS orders → recipe stock deductions.
 * Mounted once in app Providers (not a separate product module).
 */

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  deductOrderFromInventory,
  subscribePaidOrdersForDeduction,
} from "@/modules/inventory/services/sale-deduction.service";
import { getDb } from "@/lib/firebase";
import type { Branch } from "@/types/restaurant";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

export function InventorySaleSync() {
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const processed = useRef(new Set<string>());

  useEffect(() => {
    if (!restaurantId || !isFirebaseConfigured()) return;
    return onSnapshot(
      collection(getDb(), "restaurants", restaurantId, "branches"),
      (snap) => {
        setBranchIds(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Branch)
            .filter((b) => !b.deletedAt)
            .map((b) => b.id),
        );
      },
    );
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !user || !isFirebaseConfigured()) return;
    const unsubs = branchIds.map((branchId) =>
      subscribePaidOrdersForDeduction(restaurantId, branchId, (order) => {
        if (processed.current.has(order.id)) return;
        processed.current.add(order.id);
        void deductOrderFromInventory({
          restaurantId,
          order,
          actorUid: user.uid,
        }).catch(() => {
          processed.current.delete(order.id);
        });
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [restaurantId, user, branchIds]);

  return null;
}
