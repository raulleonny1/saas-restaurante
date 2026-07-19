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

function readyItemKeys(orders: Order[], tableIds: string[]) {
  const allowed = new Set(tableIds);
  const keys = new Set<string>();
  for (const o of orders) {
    if (o.status === "paid" || o.status === "cancelled") continue;
    if (!o.tableId || !allowed.has(o.tableId)) continue;
    for (const i of o.items) {
      if (i.status === "ready") {
        keys.add(`${o.id}:${i.id}:${o.waiterAlertAt ?? "ready"}`);
      }
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
  const { openOrders, tables } = usePos();
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

  /** Solo mesas con pedido activo en el plano (evita avisos fantasma). */
  const activeTableIds = useMemo(
    () =>
      tables
        .filter((t) => t.currentOrderId || t.status === "occupied")
        .map((t) => t.id),
    [tables],
  );

  const kitchen = useMemo(
    () =>
      kitchenReadyAlerts(openOrders, activeTableIds).filter(
        (n) => !dismissed.has(n.id),
      ),
    [openOrders, activeTableIds, dismissed],
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

  // Sonido solo ante avisos nuevos (no si no hay mesas activas)
  useEffect(() => {
    const keys = readyItemKeys(openOrders, activeTableIds);

    if (!primedRef.current) {
      seenReadyRef.current = keys;
      primedRef.current = true;
      return;
    }

    let hasNew = false;
    for (const key of keys) {
      if (!seenReadyRef.current.has(key)) {
        hasNew = true;
        break;
      }
    }

    if (hasNew && kitchen.length > 0) {
      void playWaiterPickupAlarm();
      vibratePickup();
    }

    seenReadyRef.current = keys;
  }, [openOrders, activeTableIds, kitchen.length]);

  // Recordatorio solo mientras queden avisos no cerrados
  useEffect(() => {
    if (!kitchen.length) return;
    const id = window.setInterval(() => {
      void playWaiterPickupAlarm();
      vibratePickup();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [kitchen.length]);

  const value: WaiterNotificationsValue = {
    notifications,
    unread,
    unlockAudio,
    markRead: async (id) => {
      if (id.startsWith("ready_")) {
        const related = notifications.find((n) => n.id === id);
        setDismissed((prev) => {
          const next = new Set(prev).add(id);
          if (related?.referenceId) {
            for (const n of notifications) {
              if (
                n.id.startsWith("ready_") &&
                n.referenceId === related.referenceId
              ) {
                next.add(n.id);
              }
            }
          }
          return next;
        });
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
