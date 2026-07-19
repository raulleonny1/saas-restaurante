"use client";

import { getDb } from "@/lib/firebase";
import type { Product, ProductCategory } from "@/types/catalog";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  where,
} from "firebase/firestore";

export function subscribeCategories(
  restaurantId: string,
  onData: (categories: ProductCategory[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "categories"),
    orderBy("sortOrder", "asc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as ProductCategory)
          .filter((c) => !c.deletedAt && c.status === "active"),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeProducts(
  restaurantId: string,
  branchId: string,
  onData: (products: Product[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "products"),
    where("status", "==", "active"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Product)
        .filter((p) => {
          if (p.deletedAt) return false;
          if (!p.branchIds?.length) return true;
          return p.branchIds.includes(branchId);
        })
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      onData(list);
    },
    (err) => onError?.(err),
  );
}
