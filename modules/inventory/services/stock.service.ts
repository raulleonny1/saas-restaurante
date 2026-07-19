"use client";

import { getDb } from "@/lib/firebase";
import {
  levelDocId,
  newId,
  nowIso,
  roundQty,
} from "@/modules/inventory/domain/ids";
import type { IngredientUnit } from "@/types/catalog";
import type {
  InventoryLevel,
  InventoryMovement,
  InventoryMovementType,
} from "@/types/inventory";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

export function subscribeLevels(
  restaurantId: string,
  branchId: string,
  onData: (levels: InventoryLevel[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "inventoryLevels"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InventoryLevel),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeMovements(
  restaurantId: string,
  branchId: string,
  onData: (rows: InventoryMovement[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "inventoryMovements"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as InventoryMovement)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 200),
      );
    },
    (err) => onError?.(err),
  );
}

export interface ApplyStockDeltaInput {
  restaurantId: string;
  branchId: string;
  ingredientId: string;
  unit: IngredientUnit;
  delta: number;
  type: InventoryMovementType;
  createdBy: string;
  referenceType?: InventoryMovement["referenceType"];
  referenceId?: string;
  note?: string;
  minStock?: number;
  /** If set, skip write when a movement with this id already exists. */
  movementId?: string;
}

export async function applyStockDelta(
  input: ApplyStockDeltaInput,
): Promise<{ level: InventoryLevel; skipped: boolean }> {
  const {
    restaurantId,
    branchId,
    ingredientId,
    unit,
    delta,
    type,
    createdBy,
    referenceType,
    referenceId,
    note,
    minStock = 0,
  } = input;

  const movementId = input.movementId ?? newId("mov");
  const movRef = doc(
    getDb(),
    "restaurants",
    restaurantId,
    "inventoryMovements",
    movementId,
  );

  if (input.movementId) {
    const existing = await getDoc(movRef);
    if (existing.exists()) {
      const levelId = levelDocId(branchId, ingredientId);
      const levelSnap = await getDoc(
        doc(getDb(), "restaurants", restaurantId, "inventoryLevels", levelId),
      );
      return {
        level: levelSnap.exists()
          ? ({ id: levelSnap.id, ...levelSnap.data() } as InventoryLevel)
          : ({
              id: levelId,
              restaurantId,
              branchId,
              ingredientId,
              quantity: 0,
              unit,
              minStock,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            } as InventoryLevel),
        skipped: true,
      };
    }
  }

  const levelId = levelDocId(branchId, ingredientId);
  const levelRef = doc(
    getDb(),
    "restaurants",
    restaurantId,
    "inventoryLevels",
    levelId,
  );
  const levelSnap = await getDoc(levelRef);
  const stamp = nowIso();
  const prev = levelSnap.exists()
    ? ({ id: levelSnap.id, ...levelSnap.data() } as InventoryLevel)
    : null;

  const quantity = roundQty((prev?.quantity ?? 0) + delta);
  const level: InventoryLevel = {
    id: levelId,
    restaurantId,
    branchId,
    ingredientId,
    quantity,
    unit: prev?.unit ?? unit,
    minStock: prev?.minStock ?? minStock,
    maxStock: prev?.maxStock,
    lastCountedAt: type === "count" ? stamp : prev?.lastCountedAt,
    createdAt: prev?.createdAt ?? stamp,
    updatedAt: stamp,
  };

  const movement: InventoryMovement = {
    id: movementId,
    restaurantId,
    branchId,
    ingredientId,
    type,
    quantity: Math.abs(delta),
    unit: level.unit,
    delta,
    referenceType,
    referenceId,
    note,
    createdBy,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const batch = writeBatch(getDb());
  batch.set(levelRef, level);
  batch.set(movRef, movement);
  await batch.commit();

  return { level, skipped: false };
}

export async function setMinStock(input: {
  restaurantId: string;
  branchId: string;
  ingredientId: string;
  unit: IngredientUnit;
  minStock: number;
  createdBy: string;
}): Promise<void> {
  const levelId = levelDocId(input.branchId, input.ingredientId);
  const ref = doc(
    getDb(),
    "restaurants",
    input.restaurantId,
    "inventoryLevels",
    levelId,
  );
  const snap = await getDoc(ref);
  const stamp = nowIso();
  if (snap.exists()) {
    const batch = writeBatch(getDb());
    batch.update(ref, { minStock: input.minStock, updatedAt: stamp });
    await batch.commit();
    return;
  }
  await applyStockDelta({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    ingredientId: input.ingredientId,
    unit: input.unit,
    delta: 0,
    type: "adjustment",
    createdBy: input.createdBy,
    note: "Inicializar nivel / stock mínimo",
    minStock: input.minStock,
  });
}
