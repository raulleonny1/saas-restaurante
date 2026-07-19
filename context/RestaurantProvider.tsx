"use client";

import {
  createRestaurant,
  getStoredRestaurantId,
  listRestaurantsForUser,
  setStoredRestaurantId,
} from "@/services/restaurant.service";
import type { Restaurant } from "@/types/restaurant";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuthSession } from "./AuthProvider";

interface RestaurantContextValue {
  restaurants: Restaurant[];
  restaurant: Restaurant | null;
  restaurantId: string | null;
  loading: boolean;
  setRestaurantId: (id: string) => void;
  refresh: () => Promise<void>;
  create: (name: string) => Promise<Restaurant>;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthSession();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRestaurants([]);
      setRestaurantIdState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const list = await listRestaurantsForUser(user);
    setRestaurants(list);

    const stored = getStoredRestaurantId();
    const nextId =
      (stored && list.some((r) => r.id === stored) && stored) || list[0]?.id || null;

    setRestaurantIdState(nextId);
    if (nextId) setStoredRestaurantId(nextId);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setRestaurantId = useCallback((id: string) => {
    setRestaurantIdState(id);
    setStoredRestaurantId(id);
  }, []);

  const create = useCallback(
    async (name: string) => {
      if (!user) throw new Error("No autenticado");
      const created = await createRestaurant(user, name);
      await refresh();
      setRestaurantId(created.id);
      return created;
    },
    [user, refresh, setRestaurantId],
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
