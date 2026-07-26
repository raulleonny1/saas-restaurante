"use client";

import { getDb } from "@/lib/firebase";
import { doc, runTransaction } from "firebase/firestore";

/**
 * Asigna el siguiente número de orden del restaurante (secuencial en Firebase).
 * Si falla (reglas / offline), usa un fallback numérico para no bloquear el servicio.
 */
export async function allocateOrderNumber(
  restaurantId: string,
): Promise<number> {
  const ref = doc(getDb(), "restaurants", restaurantId, "counters", "orders");
  try {
    const next = await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() ? Number(snap.data()?.seq || 0) : 0;
      const seq = (Number.isFinite(prev) ? prev : 0) + 1;
      tx.set(
        ref,
        {
          id: "orders",
          restaurantId,
          seq,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      return seq;
    });
    return next;
  } catch (e) {
    console.warn("[allocateOrderNumber]", e);
    // Fallback: no bloquear apertura de mesa
    return Number(String(Date.now()).slice(-5)) || 1;
  }
}
