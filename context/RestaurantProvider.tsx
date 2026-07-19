"use client";

import {
  createRestaurant,
  getStoredRestaurantId,
  listRestaurantsForUser,
  setStoredRestaurantId,
} from "@/services/restaurant.service";
import type { AppUser } from "@/types/auth";
import type { Restaurant } from "@/types/restaurant";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuthSession } from "./AuthProvider";

interface RestaurantContextValue {
  restaurants: Restaurant[];
  restaurant: Restaurant | null;
  restaurantId: string | null;
  loading: boolean;
  setRestaurantId: (id: string) => void;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  create: (name: string) => Promise<Restaurant>;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthSession();
  const uid = user?.uid ?? null;
  const idsKey = user?.restaurantIds?.join(",") ?? "";
  const userRef = useRef<AppUser | null>(user);
  userRef.current = user;

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const u = userRef.current;
      if (!u) {
        setRestaurants([]);
        setRestaurantIdState(null);
        setLoading(false);
        hasLoadedRef.current = false;
        return;
      }

      // No apagar toda la UI en refrescos (evita parpadeo en /waiter)
      const silent = opts?.silent ?? hasLoadedRef.current;
      if (!silent) setLoading(true);

      try {
        const list = await listRestaurantsForUser(u);
        setRestaurants(list);

        const stored = getStoredRestaurantId();
        const nextId =
          (stored && list.some((r) => r.id === stored) && stored) ||
          list[0]?.id ||
          null;

        setRestaurantIdState(nextId);
        if (nextId) setStoredRestaurantId(nextId);
        hasLoadedRef.current = true;
      } finally {
        setLoading(false);
      }
    },
    [uid, idsKey],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setRestaurantId = useCallback((id: string) => {
    setRestaurantIdState(id);
    setStoredRestaurantId(id);
  }, []);

  const create = useCallback(
    async (name: string) => {
      const u = userRef.current;
      if (!u) throw new Error("No autenticado");
      const created = await createRestaurant(u, name);
      await refresh({ silent: false });
      setRestaurantId(created.id);
      return created;
    },
    [refresh, setRestaurantId],
  );

  const restaurant = restaurants.find((r) => r.id === restaurantId) ?? null;

  const value = useMemo(
    () => ({
      restaurants,
      restaurant,
      restaurantId,
      loading,
      setRestaurantId,
      refresh,
      create,
    }),
    [restaurants, restaurant, restaurantId, loading, setRestaurantId, refresh, create],
  );

  return (
    <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>
  );
}

export function useRestaurant(): RestaurantContextValue {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error("useRestaurant must be used within RestaurantProvider");
  return ctx;
}
