"use client";

import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import {
  getLocalActiveRestaurantId,
  localCreateRestaurant,
  localListRestaurants,
  setLocalActiveRestaurantId,
} from "@/lib/local-auth";
import {
  createBranchDocument,
  createMemberDocument,
  createRestaurantDocument,
  createTenantBillingDocument,
} from "@/models/schemas";
import { defaultWebsiteSettings } from "@/modules/website/domain/defaults";
import type { AppUser } from "@/types/auth";
import type { Member, Restaurant } from "@/types/restaurant";
import type { RestaurantSlugIndex } from "@/types/website";
import { stripUndefined } from "@/lib/firestore-safe";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  getRestaurantPref,
  setRestaurantPref,
} from "@/lib/session-prefs";

export function getStoredRestaurantId(uid?: string | null): string | null {
  if (typeof window === "undefined") return null;
  if (!isFirebaseConfigured()) return getLocalActiveRestaurantId();
  return getRestaurantPref(uid);
}

export function setStoredRestaurantId(
  id: string | null,
  uid?: string | null,
): void {
  if (typeof window === "undefined") return;
  if (!isFirebaseConfigured()) {
    setLocalActiveRestaurantId(id);
    return;
  }
  setRestaurantPref(uid, id);
}

export async function listRestaurantsForUser(user: AppUser): Promise<Restaurant[]> {
  if (!isFirebaseConfigured()) {
    return localListRestaurants(user);
  }

  const snaps = await Promise.all(
    user.restaurantIds.map((id) => getDoc(doc(getDb(), "restaurants", id))),
  );
  return snaps
    .filter((snap) => snap.exists())
    .map((snap) => ({ id: snap.id, ...snap.data() }) as Restaurant);
}

export async function createRestaurant(
  user: AppUser,
  name: string,
): Promise<Restaurant> {
  if (!isFirebaseConfigured()) {
    const restaurant = localCreateRestaurant(user, name);
    setStoredRestaurantId(restaurant.id);
    return restaurant;
  }

  const restaurant = createRestaurantDocument(name);
  const branch = createBranchDocument(restaurant.id, "Principal", {
    code: "MAIN",
    isDefault: true,
  });
  restaurant.settings.defaultBranchId = branch.id;
  // Owner membership — required for canManage (website/slug/billing rules)
  const member = createMemberDocument(
    restaurant.id,
    { ...user, role: "propietario" },
    [],
  );
  const website = defaultWebsiteSettings(restaurant.id, restaurant.name);
  const slugIndex: RestaurantSlugIndex = {
    slug: restaurant.slug!,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    published: true,
    updatedAt: restaurant.createdAt,
  };

  // Member before branch — rules require membership for canManage
  await setDoc(
    doc(getDb(), "restaurants", restaurant.id),
    stripUndefined({ ...restaurant, deletedAt: null }),
  );
  await setDoc(
    doc(getDb(), "restaurants", restaurant.id, "members", user.uid),
    stripUndefined({ ...member }),
  );
  await setDoc(
    doc(getDb(), "restaurants", restaurant.id, "branches", branch.id),
    stripUndefined({ ...branch, deletedAt: null }),
  );
  try {
    const billing = createTenantBillingDocument(restaurant.id, user.email);
    await setDoc(
      doc(getDb(), "restaurants", restaurant.id, "billing", "current"),
      stripUndefined({ ...billing }),
    );
  } catch (e) {
    console.warn("[createRestaurant] billing skipped", e);
  }
  try {
    const { customDomain: _c, ...websiteSafe } = website;
    await setDoc(
      doc(getDb(), "restaurants", restaurant.id, "websiteSettings", "default"),
      stripUndefined({ ...websiteSafe }),
    );
  } catch (e) {
    console.warn("[createRestaurant] website skipped", e);
  }
  try {
    if (restaurant.slug) {
      await setDoc(
        doc(getDb(), "restaurantSlugs", restaurant.slug),
        stripUndefined({ ...slugIndex }),
      );
    }
  } catch (e) {
    console.warn("[createRestaurant] slug skipped", e);
  }
  await updateDoc(doc(getDb(), "users", user.uid), {
    restaurantIds: [...user.restaurantIds, restaurant.id],
  });

  setStoredRestaurantId(restaurant.id);
  return restaurant;
}

export async function updateRestaurant(
  restaurantId: string,
  patch: Partial<Restaurant>,
): Promise<void> {
  if (!isFirebaseConfigured()) {
    // Local mirror can be extended when settings UI is built.
    void restaurantId;
    void patch;
    return;
  }
  await updateDoc(doc(getDb(), "restaurants", restaurantId), {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export async function listMembers(restaurantId: string): Promise<Member[]> {
  if (!isFirebaseConfigured()) return [];

  const snap = await getDocs(
    collection(getDb(), "restaurants", restaurantId, "members"),
  );
  return snap.docs.map((d) => d.data() as Member);
}
