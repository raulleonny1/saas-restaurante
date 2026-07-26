"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import type { Table, TableStatus } from "@/types/orders";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

function nowIso() {
  return new Date().toISOString();
}

function newTableId() {
  return `tbl_${Math.random().toString(36).slice(2, 10)}`;
}

export function subscribeTables(
  restaurantId: string,
  branchId: string,
  onData: (tables: Table[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "tables"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Table)
        .filter((t) => !t.deletedAt)
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      onData(list);
    },
    (err) => onError?.(err),
  );
}

export type FloorZone = "sala" | "barra" | "terraza" | "vip";

export async function createTable(input: {
  restaurantId: string;
  branchId: string;
  name: string;
  seats: number;
  zone?: FloorZone;
  existingCount?: number;
}): Promise<Table> {
  const name = input.name.trim();
  if (!name) throw new Error("Pon un nombre a la mesa");
  if (!input.branchId) throw new Error("Falta la sucursal");
  const seats = Math.max(1, Math.min(50, Math.floor(Number(input.seats)) || 4));
  const stamp = nowIso();
  const id = newTableId();
  const index = input.existingCount ?? 0;
  const lower = name.toLowerCase();
  const inferredZone: FloorZone = lower.includes("vip")
    ? "vip"
    : lower.includes("barra") || lower.includes("bar ")
      ? "barra"
      : lower.includes("terraza")
        ? "terraza"
        : "sala";
  const row: Table = {
    id,
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    name,
    seats,
    status: "available",
    x: index % 4,
    y: Math.floor(index / 4),
    currentOrderId: null,
    mergedWith: [],
    zone: input.zone ?? inferredZone,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  try {
    await setDoc(
      doc(getDb(), "restaurants", input.restaurantId, "tables", id),
      stripUndefined({ ...row }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/permission|insufficient/i.test(msg)) {
      throw new Error(
        "Firestore denegó crear la mesa. Publica firestore.rules y comprueba que eres miembro de la sucursal.",
      );
    }
    throw e;
  }
  return row;
}

export type CreateTableDraft = {
  name: string;
  seats: number;
  zone: FloorZone;
};

/**
 * Crea varias mesas/bares/VIP en una sola escritura Firestore (writeBatch).
 */
export async function createTablesBatch(input: {
  restaurantId: string;
  branchId: string;
  drafts: CreateTableDraft[];
  existingCount?: number;
}): Promise<Table[]> {
  if (!input.branchId) throw new Error("Falta la sucursal");
  if (!input.drafts.length) throw new Error("No hay sitios que crear");
  if (input.drafts.length > 400) {
    throw new Error("Máximo 400 sitios por tanda");
  }

  const stamp = nowIso();
  const base = input.existingCount ?? 0;
  const rows: Table[] = input.drafts.map((d, i) => {
    const name = d.name.trim();
    const seats = Math.max(1, Math.min(50, Math.floor(Number(d.seats)) || 4));
    const index = base + i;
    return {
      id: newTableId(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name,
      seats,
      status: "available" as const,
      x: index % 4,
      y: Math.floor(index / 4),
      currentOrderId: null,
      mergedWith: [],
      zone: d.zone,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
  });

  try {
    const batch = writeBatch(getDb());
    for (const row of rows) {
      batch.set(
        doc(getDb(), "restaurants", input.restaurantId, "tables", row.id),
        stripUndefined({ ...row }),
      );
    }
    await batch.commit();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/permission|insufficient/i.test(msg)) {
      throw new Error(
        "Firestore denegó guardar el plano. Publica firestore.rules (firebase deploy --only firestore:rules) y revisa que tu usuario sea miembro de la sucursal.",
      );
    }
    throw e;
  }
  return rows;
}

const COUNTER_NAME = "Mostrador";

/**
 * Punto de venta de caja (mostrador). Reutiliza la mesa si ya existe;
 * si no, la crea en zona barra.
 */
export async function ensureCashierCounterTable(input: {
  restaurantId: string;
  branchId: string;
  tables: Table[];
}): Promise<Table> {
  const existing = input.tables.find((t) => {
    if (t.deletedAt) return false;
    if (t.branchId !== input.branchId) return false;
    const n = t.name.trim().toLowerCase();
    return (
      n === "mostrador" ||
      n === "caja" ||
      n === "venta caja" ||
      n === "mostrador caja"
    );
  });
  if (existing) return existing;
  return createTable({
    restaurantId: input.restaurantId,
    branchId: input.branchId,
    name: COUNTER_NAME,
    seats: 1,
    zone: "barra",
    existingCount: input.tables.length,
  });
}

export async function updateTable(input: {
  restaurantId: string;
  tableId: string;
  name?: string;
  seats?: number;
  zone?: string;
}): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Pon un nombre a la mesa");
    patch.name = name;
  }
  if (input.seats !== undefined) {
    patch.seats = Math.max(1, Math.min(50, Math.floor(Number(input.seats)) || 1));
  }
  if (input.zone !== undefined) patch.zone = input.zone;
  await updateDoc(
    doc(getDb(), "restaurants", input.restaurantId, "tables", input.tableId),
    patch,
  );
}

/** Soft-delete: desaparece del plano / waiter. No si tiene pedido abierto. */
export async function deleteTable(input: {
  restaurantId: string;
  table: Table;
}): Promise<void> {
  if (input.table.status === "occupied" || input.table.currentOrderId) {
    throw new Error("Cierra o mueve el pedido de esa mesa antes de eliminarla");
  }
  await updateDoc(
    doc(
      getDb(),
      "restaurants",
      input.restaurantId,
      "tables",
      input.table.id,
    ),
    {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
      status: "available",
      currentOrderId: null,
    },
  );
}

/** Reactivar mesa eliminada (vuelve al plano). */
export async function restoreTable(input: {
  restaurantId: string;
  tableId: string;
}): Promise<void> {
  await updateDoc(
    doc(getDb(), "restaurants", input.restaurantId, "tables", input.tableId),
    {
      deletedAt: null,
      status: "available",
      updatedAt: nowIso(),
    },
  );
}

/** Incluye mesas soft-deleted (panel administrador). */
export function subscribeAllTables(
  restaurantId: string,
  branchId: string,
  onData: (tables: Table[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "restaurants", restaurantId, "tables"),
    where("branchId", "==", branchId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Table)
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      onData(list);
    },
    (err) => onError?.(err),
  );
}

export async function updateTableStatus(
  restaurantId: string,
  tableId: string,
  patch: Partial<
    Pick<Table, "status" | "currentOrderId" | "mergedWith" | "updatedAt">
  >,
) {
  const ref = doc(getDb(), "restaurants", restaurantId, "tables", tableId);
  const batch = writeBatch(getDb());
  batch.update(ref, { ...patch, updatedAt: new Date().toISOString() });
  await batch.commit();
}

/** Tras cobrar (sucia) o mesa ocupada fantasma → vuelve a libre. */
export async function markTableClean(input: {
  restaurantId: string;
  tableId: string;
}): Promise<void> {
  await updateTableStatus(input.restaurantId, input.tableId, {
    status: "available",
    currentOrderId: null,
    mergedWith: [],
  });
}

export async function setTablesStatus(
  restaurantId: string,
  updates: Array<{
    tableId: string;
    status: TableStatus;
    currentOrderId?: string | null;
    mergedWith?: string[];
  }>,
) {
  const batch = writeBatch(getDb());
  const now = new Date().toISOString();
  for (const u of updates) {
    const ref = doc(getDb(), "restaurants", restaurantId, "tables", u.tableId);
    batch.update(ref, {
      status: u.status,
      currentOrderId: u.currentOrderId ?? null,
      mergedWith: u.mergedWith ?? [],
      updatedAt: now,
    });
  }
  await batch.commit();
}
