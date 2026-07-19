"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/customers/domain/ids";
import { enrichCustomer } from "@/modules/customers/services/customers.service";
import type { Customer } from "@/types/customers";
import { collection, doc, getDocs, writeBatch } from "firebase/firestore";

export async function ensureCrmBootstrap(
  restaurantId: string,
): Promise<{ created: number }> {
  const existing = await getDocs(
    collection(getDb(), "restaurants", restaurantId, "customers"),
  );
  if (existing.docs.some((d) => !d.data().deletedAt)) {
    return { created: 0 };
  }

  const stamp = nowIso();
  const batch = writeBatch(getDb());
  const seeds: Array<Partial<Customer> & { name: string }> = [
    {
      name: "María López",
      email: "maria@example.com",
      phone: "+34600111222",
      birthday: "1990-07-22",
      allergies: ["gluten"],
      preferences: {
        favorites: ["Cappuccino"],
        dietary: ["sin gluten"],
        preferredChannel: "whatsapp",
        notes: ["Terraza si hace buen tiempo"],
      },
      points: 420,
      totalSpent: 286,
      visitCount: 14,
      lastVisitAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      marketingOptIn: true,
      tags: ["brunch"],
    },
    {
      name: "Carlos Ruiz",
      email: "carlos@example.com",
      phone: "+34600333444",
      birthday: "1985-03-10",
      allergies: [],
      preferences: { favorites: ["Burger casa"], preferredChannel: "email" },
      points: 90,
      totalSpent: 64,
      visitCount: 2,
      lastVisitAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      marketingOptIn: true,
      tags: ["nuevo"],
    },
    {
      name: "Ana Pérez",
      phone: "+34600555666",
      birthday: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
      allergies: ["lactosa"],
      preferences: {
        dietary: ["lactosa"],
        notes: ["Leche avena siempre"],
      },
      points: 1100,
      totalSpent: 540,
      visitCount: 28,
      lastVisitAt: new Date(Date.now() - 40 * 86400000).toISOString(),
      marketingOptIn: true,
      tags: ["vip"],
    },
  ];

  let created = 0;
  for (const s of seeds) {
    const id = newId("cus");
    const base: Customer = {
      id,
      restaurantId,
      name: s.name,
      email: s.email,
      phone: s.phone,
      birthday: s.birthday,
      allergies: s.allergies ?? [],
      preferences: s.preferences,
      favorites: s.preferences?.favorites ?? [],
      tags: s.tags ?? [],
      notes: s.notes,
      marketingOptIn: s.marketingOptIn ?? true,
      points: s.points ?? 0,
      totalSpent: s.totalSpent ?? 0,
      visitCount: s.visitCount ?? 0,
      lastVisitAt: s.lastVisitAt,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
    const enriched = enrichCustomer(base);
    batch.set(
      doc(getDb(), "restaurants", restaurantId, "customers", id),
      enriched,
    );
    batch.set(
      doc(getDb(), "restaurants", restaurantId, "loyaltyAccounts", id),
      {
        id,
        restaurantId,
        customerId: id,
        points: enriched.points,
        tier: enriched.tier ?? "standard",
        lifetimePoints: enriched.points,
        createdAt: stamp,
        updatedAt: stamp,
      },
    );
    created += 1;
  }

  await batch.commit();
  return { created };
}
