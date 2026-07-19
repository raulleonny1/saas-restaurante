"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  playNewTicketSound,
  playReadySound,
  playUrgentSound,
  unlockKitchenAudio,
} from "@/modules/kitchen/domain/sound";
import {
  advanceKitchenItem,
  advanceTicketColumn,
  buildKitchenTickets,
  subscribeKitchenBranches,
  subscribeKitchenCatalog,
  subscribeKitchenOrders,
} from "@/modules/kitchen/services/kitchen.service";
import type { Product, ProductCategory } from "@/types/catalog";
import type {
  KitchenColumnId,
  KitchenStationId,
  KitchenTicket,
} from "@/types/kitchen";
import { KITCHEN_STATIONS } from "@/types/kitchen";
import type { Order } from "@/types/orders";
import type { Branch } from "@/types/restaurant";
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

const BRANCH_KEY = "smartserve_kitchen_branch";
const STATION_KEY = "smartserve_kitchen_station";
const SOUND_KEY = "smartserve_kitchen_sound";

interface KitchenFilters {
  query: string;
  channel: "all" | Order["channel"];
  includeDelivered: boolean;
}

interface KitchenContextValue {
  ready: boolean;
  error: string | null;
  branches: Branch[];
  branchId: string | null;
  setBranchId: (id: string) => void;
  station: KitchenStationId;
  setStation: (id: KitchenStationId) => void;
  stations: typeof KITCHEN_STATIONS;
  filters: KitchenFilters;
  setFilters: (patch: Partial<KitchenFilters>) => void;
  soundEnabled: boolean;
  setSoundEnabled: (on: boolean) => void;
  unlockAudio: () => Promise<void>;
  tickets: KitchenTicket[];
  ticketsByColumn: Record<KitchenColumnId, KitchenTicket[]>;
  now: number;
  moveItem: (orderId: string, itemId: string, to: KitchenColumnId) => Promise<void>;
  moveTicketItems: (
    orderId: string,
    itemIds: string[],
    to: KitchenColumnId,
  ) => Promise<void>;
}

const KitchenContext = createContext<KitchenContextValue | null>(null);

export function useKitchen() {
  const ctx = useContext(KitchenContext);
  if (!ctx) throw new Error("useKitchen requires KitchenProvider");
  return ctx;
}

export function KitchenProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { restaurant, restaurantId } = useRestaurant();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [station, setStationState] = useState<KitchenStationId>("cocina");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [filters, setFiltersState] = useState<KitchenFilters>({
    query: "",
    channel: "all",
    includeDelivered: false,
  });

  const seenKeysRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  const setBranchId = useCallback((id: string) => {
    setBranchIdState(id);
    localStorage.setItem(BRANCH_KEY, id);
  }, []);

  const setStation = useCallback((id: KitchenStationId) => {
    setStationState(id);
    localStorage.setItem(STATION_KEY, id);
    primedRef.current = false;
    seenKeysRef.current = new Set();
  }, []);

  const setSoundEnabled = useCallback((on: boolean) => {
    setSoundEnabledState(on);
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  }, []);

  const setFilters = useCallback((patch: Partial<KitchenFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    const storedStation = localStorage.getItem(STATION_KEY) as KitchenStationId | null;
    if (storedStation && KITCHEN_STATIONS.some((s) => s.id === storedStation)) {
      setStationState(storedStation);
    }
    setSoundEnabledState(localStorage.getItem(SOUND_KEY) !== "0");
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

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
    return subscribeKitchenBranches(
      restaurantId,
      (list) => {
        setBranches(list);
        setBranchIdState((current) => {
          if (current && list.some((b) => b.id === current)) return current;
          const stored = localStorage.getItem(BRANCH_KEY);
          if (stored && list.some((b) => b.id === stored)) return stored;
          return (
            restaurant?.settings.defaultBranchId &&
            list.some((b) => b.id === restaurant.settings.defaultBranchId)
              ? restaurant.settings.defaultBranchId
              : list.find((b) => b.isDefault)?.id ?? list[0]?.id ?? null
          );
        });
        setReady(true);
      },
      (err) => setError(err.message),
    );
  }, [restaurantId, restaurant?.settings.defaultBranchId]);

  useEffect(() => {
    if (!restaurantId) return;
    return subscribeKitchenCatalog(
      restaurantId,
      (p, c) => {
        setProducts(p);
        setCategories(c);
      },
      (err) => setError(err.message),
    );
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !branchId) return;
    primedRef.current = false;
    seenKeysRef.current = new Set();
    return subscribeKitchenOrders(
      restaurantId,
      branchId,
      setOrders,
      (err) => setError(err.message),
    );
  }, [restaurantId, branchId]);

  const tickets = useMemo(() => {
    let list = buildKitchenTickets({
      orders,
      products,
      categories,
      station,
      includeDelivered: filters.includeDelivered,
      now,
    });
    if (filters.channel !== "all") {
      list = list.filter((t) => t.order.channel === filters.channel);
    }
    if (filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.order.tableName?.toLowerCase().includes(q) ||
          t.order.id.toLowerCase().includes(q) ||
          t.items.some((i) => i.item.name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [orders, products, categories, station, filters, now]);

  const ticketsByColumn = useMemo(() => {
    const empty: Record<KitchenColumnId, KitchenTicket[]> = {
      queued: [],
      preparing: [],
      ready: [],
      delivered: [],
    };
    for (const ticket of tickets) {
      const cols = new Set(ticket.items.map((i) => i.column));
      for (const col of cols) {
        const subsetItems = ticket.items.filter((i) => i.column === col);
        if (!subsetItems.length) continue;
        empty[col].push({
          ...ticket,
          items: subsetItems,
          priority: subsetItems.reduce(
            (acc, i) =>
              acc === "critical" || i.priority === "critical"
                ? "critical"
                : acc === "urgent" || i.priority === "urgent"
                  ? "urgent"
                  : acc === "warning" || i.priority === "warning"
                    ? "warning"
                    : "normal",
            "normal" as KitchenTicket["priority"],
          ),
          elapsedMs: Math.max(...subsetItems.map((i) => i.elapsedMs)),
        });
      }
    }
    return empty;
  }, [tickets]);

  // Sounds: new tickets + urgent
  useEffect(() => {
    if (!soundEnabled) return;
    const keys = new Set<string>();
    for (const t of tickets) {
      for (const i of t.items) {
        if (i.column === "delivered") continue;
        keys.add(`${t.order.id}:${i.item.id}:${i.column}`);
      }
    }

    if (!primedRef.current) {
      seenKeysRef.current = keys;
      primedRef.current = true;
      return;
    }

    let hasNewQueued = false;
    let hasNewReady = false;
    let hasUrgent = false;
    for (const key of keys) {
      if (!seenKeysRef.current.has(key)) {
        if (key.endsWith(":queued")) hasNewQueued = true;
        if (key.endsWith(":ready")) hasNewReady = true;
      }
    }
    for (const t of tickets) {
      if (t.priority === "urgent" || t.priority === "critical") hasUrgent = true;
    }

    if (hasNewQueued) playNewTicketSound();
    else if (hasNewReady) playReadySound();
    else if (hasUrgent && Math.floor(now / 15000) !== Math.floor((now - 1000) / 15000)) {
      playUrgentSound();
    }

    seenKeysRef.current = keys;
  }, [tickets, soundEnabled, now]);

  const findOrder = useCallback(
    (orderId: string) => orders.find((o) => o.id === orderId),
    [orders],
  );

  const moveItem = useCallback(
    async (orderId: string, itemId: string, to: KitchenColumnId) => {
      if (!restaurantId || !user) throw new Error("Sin sesión");
      const order = findOrder(orderId);
      if (!order) throw new Error("Pedido no encontrado");
      await advanceKitchenItem({
        restaurantId,
        order,
        itemId,
        toColumn: to,
        actorUid: user.uid,
      });
    },
    [restaurantId, user, findOrder],
  );

  const moveTicketItems = useCallback(
    async (orderId: string, itemIds: string[], to: KitchenColumnId) => {
      if (!restaurantId || !user) throw new Error("Sin sesión");
      const order = findOrder(orderId);
      if (!order) throw new Error("Pedido no encontrado");
      await advanceTicketColumn({
        restaurantId,
        order,
        itemIds,
        toColumn: to,
        actorUid: user.uid,
      });
    },
    [restaurantId, user, findOrder],
  );

  const value: KitchenContextValue = {
    ready,
    error,
    branches,
    branchId,
    setBranchId,
    station,
    setStation,
    stations: KITCHEN_STATIONS,
    filters,
    setFilters,
    soundEnabled,
    setSoundEnabled,
    unlockAudio: unlockKitchenAudio,
    tickets,
    ticketsByColumn,
    now,
    moveItem,
    moveTicketItems,
  };

  return (
    <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>
  );
}
