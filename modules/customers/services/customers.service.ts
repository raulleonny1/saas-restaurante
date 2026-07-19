"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/customers/domain/ids";
import {
  computeSegments,
  computeValueScore,
  deriveTier,
} from "@/modules/customers/domain/segments";
import type {
  Customer,
  CustomerPreferences,
  CustomerTier,
} from "@/types/customers";
import {
  collection,
  doc,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";

export function subscribeCustomers(
  restaurantId: string,
  onData: (rows: Customer[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "customers"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Customer)
          .filter((c) => !c.deletedAt)
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
    },
    (err) => onError?.(err),
  );
}

export function enrichCustomer(customer: Customer): Customer {
  const valueScore = computeValueScore(customer);
  const points = customer.points ?? 0;
  const tier = deriveTier(points, valueScore);
  const segments = computeSegments({ ...customer, valueScore, tier });
  return { ...customer, valueScore, tier, segments };
}

export async function upsertCustomer(input: {
  restaurantId: string;
  customer?: Customer | null;
  name: string;
  email?: string;
  phone?: string;
  birthday?: string;
  allergies?: string[];
  preferences?: CustomerPreferences;
  favorites?: string[];
  tags?: string[];
  notes?: string;
  marketingOptIn?: boolean;
}): Promise<Customer> {
  const stamp = nowIso();
  const id = input.customer?.id ?? newId("cus");
  const base: Customer = {
    id,
    restaurantId: input.restaurantId,
    name: input.name.trim(),
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    birthday: input.birthday || undefined,
    allergies: input.allergies ?? input.customer?.allergies ?? [],
    preferences: input.preferences ?? input.customer?.preferences,
    favorites: input.favorites ?? input.customer?.favorites ?? [],
    tags: input.tags ?? input.customer?.tags ?? [],
    notes: input.notes ?? input.customer?.notes,
    marketingOptIn: input.marketingOptIn ?? input.customer?.marketingOptIn ?? true,
    points: input.customer?.points ?? 0,
    tier: input.customer?.tier ?? "standard",
    totalSpent: input.customer?.totalSpent ?? 0,
    visitCount: input.customer?.visitCount ?? 0,
    lastVisitAt: input.customer?.lastVisitAt,
    lastBranchId: input.customer?.lastBranchId,
    avgDaysBetweenVisits: input.customer?.avgDaysBetweenVisits,
    createdAt: input.customer?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };

  const enriched = enrichCustomer(base);
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "customers", id),
    enriched,
  );

  // Ensure loyalty account 1:1
  const accountRef = doc(
    getDb(),
    "restaurants",
    input.restaurantId,
    "loyaltyAccounts",
    id,
  );
  batch.set(
    accountRef,
    {
      id,
      restaurantId: input.restaurantId,
      customerId: id,
      points: enriched.points,
      tier: (enriched.tier ?? "standard") as CustomerTier,
      lifetimePoints: Math.max(enriched.points, input.customer?.points ?? 0),
      createdAt: input.customer?.createdAt ?? stamp,
      updatedAt: stamp,
    },
    { merge: true },
  );

  await batch.commit();
  return enriched;
}

export async function softDeleteCustomer(
  restaurantId: string,
  customerId: string,
): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(
    doc(getDb(), "restaurants", restaurantId, "customers", customerId),
    { deletedAt: nowIso(), updatedAt: nowIso() },
  );
  await batch.commit();
}

export async function recomputeCustomerMetrics(
  restaurantId: string,
  customer: Customer,
): Promise<Customer> {
  const enriched = enrichCustomer(customer);
  const batch = writeBatch(getDb());
  batch.update(
    doc(getDb(), "restaurants", restaurantId, "customers", customer.id),
    {
      valueScore: enriched.valueScore,
      tier: enriched.tier,
      segments: enriched.segments,
      updatedAt: nowIso(),
    },
  );
  await batch.commit();
  return enriched;
}
