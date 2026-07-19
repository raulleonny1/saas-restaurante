"use client";

/**
 * Local fallback when Firebase env vars are missing.
 * Architecture-only: session + users + restaurants, no domain features.
 */

import { createId } from "@/lib/id";
import {
  createMemberDocument,
  createRestaurantDocument,
  createUserDocument,
} from "@/models/schemas";
import type { AppUser } from "@/types/auth";
import type { Restaurant } from "@/types/restaurant";

const STORAGE_KEY = "smartserve_arch_v1";

interface LocalUser extends AppUser {
  password: string;
}

interface LocalState {
  users: Record<string, LocalUser>;
  restaurants: Record<string, Restaurant>;
  sessionUid: string | null;
  activeRestaurantId: string | null;
}

function empty(): LocalState {
  return {
    users: {},
    restaurants: {},
    sessionUid: null,
    activeRestaurantId: null,
  };
}

export function loadLocalState(): LocalState {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...empty(), ...(JSON.parse(raw) as LocalState) } : empty();
  } catch {
    return empty();
  }
}

export function saveLocalState(state: LocalState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("smartserve-auth-update"));
}

export function subscribeLocalAuth(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener("smartserve-auth-update", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("smartserve-auth-update", handler);
    window.removeEventListener("storage", handler);
  };
}

export function localRegister(
  email: string,
  password: string,
  displayName: string,
): AppUser {
  const state = loadLocalState();
  if (Object.values(state.users).some((u) => u.email === email)) {
    throw new Error("Ya existe una cuenta con este email.");
  }

  const uid = createId("user");
  const userDoc = createUserDocument(uid, email, displayName, "propietario");
  const restaurant = createRestaurantDocument("Mi restaurante");
  const member = createMemberDocument(restaurant.id, userDoc, []);

  const next: LocalState = {
    ...state,
    users: {
      ...state.users,
      [uid]: {
        ...userDoc,
        restaurantIds: [restaurant.id],
        password,
      },
    },
    restaurants: {
      ...state.restaurants,
      [restaurant.id]: restaurant,
    },
    sessionUid: uid,
    activeRestaurantId: restaurant.id,
  };

  // member reserved for future members collection mirror
  void member;
  saveLocalState(next);

  return {
    ...userDoc,
    restaurantIds: [restaurant.id],
  };
}

export function localLogin(email: string, password: string): AppUser {
  const state = loadLocalState();
  const found = Object.values(state.users).find((u) => u.email === email);
  if (!found || found.password !== password) {
    throw new Error("Email o contraseña incorrectos.");
  }
  saveLocalState({ ...state, sessionUid: found.uid });
  const { password: _, ...user } = found;
  return user;
}

export function localLogout(): void {
  const state = loadLocalState();
  saveLocalState({ ...state, sessionUid: null });
}

export function localCurrentUser(): AppUser | null {
  const state = loadLocalState();
  if (!state.sessionUid) return null;
  const user = state.users[state.sessionUid];
  if (!user) return null;
  const { password: _, ...safe } = user;
  return safe;
}

export function localListRestaurants(user: AppUser): Restaurant[] {
  const state = loadLocalState();
  return user.restaurantIds
    .map((id) => state.restaurants[id])
    .filter(Boolean) as Restaurant[];
}

export function localCreateRestaurant(user: AppUser, name: string): Restaurant {
  const state = loadLocalState();
  const restaurant = createRestaurantDocument(name);
  const nextUser = {
    ...state.users[user.uid],
    restaurantIds: [...(state.users[user.uid]?.restaurantIds ?? []), restaurant.id],
  };

  saveLocalState({
    ...state,
    users: { ...state.users, [user.uid]: nextUser },
    restaurants: { ...state.restaurants, [restaurant.id]: restaurant },
    activeRestaurantId: restaurant.id,
  });

  return restaurant;
}

export function getLocalActiveRestaurantId(): string | null {
  return loadLocalState().activeRestaurantId;
}

export function setLocalActiveRestaurantId(id: string | null): void {
  const state = loadLocalState();
  saveLocalState({ ...state, activeRestaurantId: id });
}
