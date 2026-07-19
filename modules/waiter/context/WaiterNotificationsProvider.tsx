"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { usePos } from "@/modules/pos/context/PosProvider";
import {
  kitchenReadyAlerts,
  markStaffNotificationRead,
  subscribeStaffNotifications,
} from "@/modules/waiter/services/notifications.service";
import type { AppNotification } from "@/types/notifications";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface WaiterNotificationsValue {
  notifications: AppNotification[];
  unread: number;
  markRead: (id: string) => Promise<void>;
  dismissLocal: (id: string) => void;
}

const Ctx = createContext<WaiterNotificationsValue | null>(null);

export function useWaiterNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWaiterNotifications requires provider");
  return ctx;
}

export function WaiterNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();
  const { openOrders } = usePos();
  const [remote, setRemote] = useState<AppNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !restaurantId) {
      setRemote([]);
      return;
    }
    return subscribeStaffNotifications(restaurantId, user.uid, setRemote);
  }, [user, restaurantId]);

  const kitchen = useMemo(
    () =>
      kitchenReadyAlerts(openOrders).filter((n) => !dismissed.has(n.id)),
    [openOrders, dismissed],
  );

  const notifications = useMemo(() => {
    return [...kitchen, ...remote].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }, [kitchen, remote]);

  const unread = notifications.filter((n) => !n.read).length;

  const value: WaiterNotificationsValue = {
    notifications,
    unread,
    markRead: async (id) => {
      if (id.startsWith("ready_")) {
        setDismissed((prev) => new Set(prev).add(id));
        return;
      }
      if (!restaurantId) return;
      await markStaffNotificationRead({
        restaurantId,
        notificationId: id,
      });
    },
    dismissLocal: (id) => {
      setDismissed((prev) => new Set(prev).add(id));
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
