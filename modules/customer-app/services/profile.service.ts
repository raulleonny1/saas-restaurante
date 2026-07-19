"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { newId, nowIso } from "@/modules/customer-app/domain/ids";
import type { AppUser } from "@/types/auth";
import type { Customer } from "@/types/customers";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

/** Find or create CRM customer linked to auth uid for this restaurant. */
export async function ensureCustomerProfile(input: {
  restaurantId: string;
  user: AppUser;
}): Promise<Customer> {
  const q = query(
    collection(getDb(), "restaurants", input.restaurantId, "customers"),
    where("uid", "==", input.user.uid),
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as Customer;
  }

  const stamp = nowIso();
  const id = newId("cus");
  const row: Customer = {
    id,
    restaurantId: input.restaurantId,
    uid: input.user.uid,
    name: input.user.displayName || input.user.email.split("@")[0] || "Cliente",
    email: input.user.email,
    points: 0,
    favorites: [],
    tags: [],
    allergies: [],
    marketingOptIn: true,
    totalSpent: 0,
    visitCount: 0,
    tier: "standard",
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };

  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "customers", id),
    stripUndefined({ ...row }),
  );

  // Loyalty account 1:1
  await setDoc(
    doc(getDb(), "restaurants", input.restaurantId, "loyaltyAccounts", id),
    stripUndefined({
      id,
      restaurantId: input.restaurantId,
      customerId: id,
      points: 0,
      tier: "standard",
      lifetimePoints: 0,
      createdAt: stamp,
      updatedAt: stamp,
    }),
  );

  return row;
}

export async function updateCustomerFavorites(input: {
  restaurantId: string;
  customerId: string;
  favorites: string[];
}): Promise<void> {
  await updateDoc(
    doc(getDb(), "restaurants", input.restaurantId, "customers", input.customerId),
    { favorites: input.favorites, updatedAt: nowIso() },
  );
}
