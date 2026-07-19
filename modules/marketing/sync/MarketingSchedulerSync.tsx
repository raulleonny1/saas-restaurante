"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import { processMarketingSchedule } from "@/modules/marketing/services/scheduler.service";
import { useEffect, useRef } from "react";

const INTERVAL_MS = 60_000;

/**
 * Background tick for scheduled campaigns + automations while the app is open.
 */
export function MarketingSchedulerSync() {
  const { user, can } = useAuth();
  const { restaurantId } = useRestaurant();
  const running = useRef(false);

  const allowed =
    can("marketing.campaigns.manage") || can("marketing.read");

  useEffect(() => {
    if (!restaurantId || !user?.uid || !isFirebaseConfigured() || !allowed) {
      return;
    }

    const tick = () => {
      if (running.current) return;
      running.current = true;
      void processMarketingSchedule({
        restaurantId,
        actorUid: user.uid,
      })
        .catch(() => {
          /* silent — avoid toast spam in background */
        })
        .finally(() => {
          running.current = false;
        });
    };

    tick();
    const id = window.setInterval(tick, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [restaurantId, user?.uid, allowed]);

  return null;
}
