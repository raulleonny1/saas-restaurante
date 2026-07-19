"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  applyPaidOrderToCrm,
  subscribePaidOrdersWithCustomer,
} from "@/modules/customers/services/orders-crm.service";
import { useEffect, useRef } from "react";

/** Background: paid orders with customerId → points, LTV, history. */
export function CrmOrderSync() {
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!restaurantId || !user || !isFirebaseConfigured()) return;
    return subscribePaidOrdersWithCustomer(restaurantId, (order) => {
      if (seen.current.has(order.id)) return;
      seen.current.add(order.id);
      void applyPaidOrderToCrm({
        restaurantId,
        order,
        actorUid: user.uid,
      }).catch(() => {
        seen.current.delete(order.id);
      });
    });
  }, [restaurantId, user]);

  return null;
}
