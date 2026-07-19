"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import { newId, nowIso } from "@/modules/inventory/domain/ids";
import type {
  Ingredient,
  IngredientUnit,
  Product,
  ProductCategory,
  RecipeIngredient,
} from "@/types/catalog";
import type { CurrencyCode } from "@/types/common";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";

export function subscribeIngredients(
  restaurantId: string,
  onData: (rows: Ingredient[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "restaurants", restaurantId, "ingredients"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Ingredient)
          .filter((i) => !i.deletedAt)
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
    },
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
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Product)
          .filter((p) => !p.deletedAt)
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
    },
    (err) => onError?.(err),
  );
}

export function subscribeCategories(
  restaurantId: string,
  onData: (rows: ProductCategory[]) => void,
  onError?: (e: Error) => void,
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
          .filter((c) => !c.deletedAt),
      );
    },
    (err) => onError?.(err),
  );
}

export async function upsertIngredient(input: {
  restaurantId: string;
  ingredient?: Ingredient | null;
  name: string;
  unit: IngredientUnit;
  costPerUnit: number;
  currency: CurrencyCode;
  sku?: string;
  defaultSupplierId?: string;
  shelfLifeDays?: number;
}): Promise<Ingredient> {
  const stamp = nowIso();
  const id = input.ingredient?.id ?? newId("ing");
  const sku = (input.sku ?? input.ingredient?.sku)?.trim() || undefined;
  const row = stripUndefined({
    id,
    restaurantId: input.restaurantId,
    name: input.name.trim(),
    unit: input.unit,
    costPerUnit: input.costPerUnit,
    currency: input.currency,
    sku,
    defaultSupplierId:
      input.defaultSupplierId ?? input.ingredient?.defaultSupplierId,
    shelfLifeDays: input.shelfLifeDays ?? input.ingredient?.shelfLifeDays,
    status: "active" as const,
    createdAt: input.ingredient?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  }) as Ingredient;
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "ingredients", id),
    row,
  );
  await batch.commit();
  return row;
}

export async function saveProductRecipe(input: {
  restaurantId: string;
  product: Product;
  recipe: RecipeIngredient[];
}): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(
    doc(getDb(), "restaurants", input.restaurantId, "products", input.product.id),
    {
      recipe: input.recipe,
      updatedAt: nowIso(),
    },
  );
  await batch.commit();
}

export async function upsertCategory(input: {
  restaurantId: string;
  category?: ProductCategory | null;
  name: string;
  sortOrder?: number;
}): Promise<ProductCategory> {
  const stamp = nowIso();
  const id = input.category?.id ?? newId("cat");
  const row: ProductCategory = {
    id,
    restaurantId: input.restaurantId,
    name: input.name.trim(),
    sortOrder:
      input.sortOrder ??
      input.category?.sortOrder ??
      Date.now() % 100000,
    status: "active",
    createdAt: input.category?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "categories", id),
    row,
  );
  await batch.commit();
  return row;
}

export async function archiveProduct(input: {
  restaurantId: string;
  productId: string;
}): Promise<void> {
  const batch = writeBatch(getDb());
  batch.update(
    doc(getDb(), "restaurants", input.restaurantId, "products", input.productId),
    {
      status: "inactive",
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    },
  );
  await batch.commit();
}

export async function upsertProductBasic(input: {
  restaurantId: string;
  product?: Product | null;
  name: string;
  categoryId: string;
  price: number;
  currency: CurrencyCode;
  brand?: string;
  wholesalePrice?: number;
  stockQty?: number;
  recipe?: RecipeIngredient[];
  kitchenStation?: Product["kitchenStation"];
}): Promise<Product> {
  const stamp = nowIso();
  const id = input.product?.id ?? newId("prd");
  const brand =
    (input.brand ?? input.product?.brand)?.trim() || undefined;
  const wholesale =
    input.wholesalePrice ?? input.product?.wholesalePrice;
  const stockQty =
    input.stockQty !== undefined
      ? input.stockQty
      : input.product?.stockQty;
  const row = stripUndefined({
    id,
    restaurantId: input.restaurantId,
    categoryId: input.categoryId,
    name: input.name.trim(),
    brand,
    price: input.price,
    wholesalePrice:
      wholesale != null && !Number.isNaN(Number(wholesale))
        ? Number(wholesale)
        : undefined,
    stockQty:
      stockQty != null && !Number.isNaN(Number(stockQty))
        ? Number(stockQty)
        : undefined,
    currency: input.currency,
    status: "active" as const,
    branchIds: input.product?.branchIds ?? [],
    recipe: input.recipe ?? input.product?.recipe ?? [],
    kitchenStation: input.kitchenStation ?? input.product?.kitchenStation,
    variants: input.product?.variants,
    modifierGroups: input.product?.modifierGroups,
    createdAt: input.product?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  }) as Product;
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "products", id),
    row,
  );
  await batch.commit();
  return row;
}
