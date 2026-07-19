"use client";

import { getDb } from "@/lib/firebase";
import { newId, nowIso } from "@/modules/inventory/domain/ids";
import type { Supplier } from "@/types/inventory";
import {
  collection,
  doc,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";

export function subscribeSuppliers(
  restaurantId: string,
  onData: (rows: Supplier[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "suppliers"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Supplier)
          .filter((s) => !s.deletedAt)
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
    },
    (err) => onError?.(err),
  );
}

export async function upsertSupplier(input: {
  restaurantId: string;
  supplier?: Supplier | null;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}): Promise<Supplier> {
  const stamp = nowIso();
  const id = input.supplier?.id ?? newId("sup");
  const row: Supplier = {
    id,
    restaurantId: input.restaurantId,
    name: input.name.trim(),
    email: input.email,
    phone: input.phone,
    notes: input.notes,
    createdAt: input.supplier?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "suppliers", id),
    row,
  );
  await batch.commit();
  return row;
}
