"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { usePos } from "@/modules/pos/context/PosProvider";
import {
  playWaiterPickupAlarm,
  unlockWaiterAudio,
  vibratePickup,
} from "@/modules/waiter/domain/alertSound";
import {
  kitchenReadyAlerts,
  markStaffNotificationRead,
  subscribeStaffNotifications,
} from "@/modules/waiter/services/notifications.service";
import type { AppNotification } from "@/types/notifications";
import type { Order } from "@/types/orders";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface WaiterNotificationsValue {
  notifications: AppNotification[];
  unread: number;
  markRead: (id: string) => Promise<void>;
  dismissLocal: (id: string) => void;
  unlockAudio: () => Promise<void>;
}

const Ctx = createContext<WaiterNotificationsValue | null>(null);

export function useWaiterNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWaiterNotifications requires provider");
  return ctx;
}

function readyItemKeys(orders: Order[]) {
  const keys = new Set<string>();
  for (const o of orders) {
    for (const i of o.items) {
      if (i.status === "ready") keys.add(`${o.id}:${i.id}`);
    }
  }
  return keys;
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
  const seenReadyRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

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

  const unlockAudio = useCallback(async () => {
    await unlockWaiterAudio();
  }, []);

  // Sonido + vibración cuando cocina marca listo
  useEffect(() => {
    const keys = readyItemKeys(openOrders);

    if (!primedRef.current) {
      seenReadyRef.current = keys;
      primedRef.current = true;
      // Si ya hay listos al abrir la app, avisa igual (banner + intento de sonido)
      if (keys.size > 0) {
        void playWaiterPickupAlarm();
        vibratePickup();
      }
      return;
    }

    let hasNew = false;
    for (const key of keys) {
      if (!seenReadyRef.current.has(key)) {
        hasNew = true;
        break;
      }
    }

    if (hasNew) {
      void playWaiterPickupAlarm();
      vibratePickup();
    }

    seenReadyRef.current = keys;
  }, [openOrders]);

  // Recordatorio sonoro mientras haya avisos
  useEffect(() => {
    if (!kitchen.length) return;
    const id = window.setInterval(() => {
      void playWaiterPickupAlarm();
      vibratePickup();
    }, 12_000);
    return () => window.clearInterval(id);
  }, [kitchen.length]);

  const value: WaiterNotificationsValue = {
    notifications,
    unread,
    unlockAudio,
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
