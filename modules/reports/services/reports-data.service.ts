"use client";

import { getDb } from "@/lib/firebase";
import type { Ingredient, Product, ProductCategory } from "@/types/catalog";
import type { Customer } from "@/types/customers";
import type { Employee, EmployeeShift } from "@/types/employees";
import type { InventoryLevel, WasteEntry } from "@/types/inventory";
import type { Order } from "@/types/orders";
import { collection, onSnapshot, Unsubscribe } from "firebase/firestore";

function mapDocs<T extends { id: string }>(
  docs: { id: string; data: () => Record<string, unknown> }[],
): T[] {
  return docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export function subscribeOrders(
  restaurantId: string,
  onData: (rows: Order[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "orders"),
    (snap) => onData(mapDocs<Order>(snap.docs)),
    (err) => onError?.(err),
  );
}

export function subscribeCategories(
  restaurantId: string,
  onData: (rows: ProductCategory[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "categories"),
    (snap) =>
      onData(mapDocs<ProductCategory>(snap.docs).filter((c) => !c.deletedAt)),
    (err) => onError?.(err),
  );
}

export function subscribeProducts(
  restaurantId: string,
  onData: (rows: Product[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "products"),
    (snap) =>
      onData(mapDocs<Product>(snap.docs).filter((p) => !p.deletedAt)),
    (err) => onError?.(err),
  );
}

export function subscribeIngredients(
  restaurantId: string,
  onData: (rows: Ingredient[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "ingredients"),
    (snap) =>
      onData(mapDocs<Ingredient>(snap.docs).filter((i) => !i.deletedAt)),
    (err) => onError?.(err),
  );
}

export function subscribeCustomers(
  restaurantId: string,
  onData: (rows: Customer[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "customers"),
    (snap) =>
      onData(mapDocs<Customer>(snap.docs).filter((c) => !c.deletedAt)),
    (err) => onError?.(err),
  );
}

export function subscribeInventoryLevels(
  restaurantId: string,
  onData: (rows: InventoryLevel[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "inventoryLevels"),
    (snap) => onData(mapDocs<InventoryLevel>(snap.docs)),
    (err) => onError?.(err),
  );
}

export function subscribeWaste(
  restaurantId: string,
  onData: (rows: WasteEntry[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "waste"),
    (snap) => onData(mapDocs<WasteEntry>(snap.docs)),
    (err) => onError?.(err),
  );
}

export function subscribeEmployees(
  restaurantId: string,
  onData: (rows: Employee[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "employees"),
    (snap) =>
      onData(mapDocs<Employee>(snap.docs).filter((e) => !e.deletedAt)),
    (err) => onError?.(err),
  );
}

export function subscribeShifts(
  restaurantId: string,
  onData: (rows: EmployeeShift[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "employeeShifts"),
    (snap) => onData(mapDocs<EmployeeShift>(snap.docs)),
    (err) => onError?.(err),
  );
}
