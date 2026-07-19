"use client";

import { getDb } from "@/lib/firebase";
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
  const row: Ingredient = {
    id,
    restaurantId: input.restaurantId,
    name: input.name.trim(),
    unit: input.unit,
    costPerUnit: input.costPerUnit,
    currency: input.currency,
    sku: input.sku,
    defaultSupplierId: input.defaultSupplierId,
    shelfLifeDays: input.shelfLifeDays,
    status: "active",
    createdAt: input.ingredient?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
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

export async function upsertProductBasic(input: {
  restaurantId: string;
  product?: Product | null;
  name: string;
  categoryId: string;
  price: number;
  currency: CurrencyCode;
  recipe?: RecipeIngredient[];
  kitchenStation?: Product["kitchenStation"];
}): Promise<Product> {
  const stamp = nowIso();
  const id = input.product?.id ?? newId("prd");
  const row: Product = {
    id,
    restaurantId: input.restaurantId,
    categoryId: input.categoryId,
    name: input.name.trim(),
    price: input.price,
    currency: input.currency,
    status: "active",
    branchIds: input.product?.branchIds ?? [],
    recipe: input.recipe ?? input.product?.recipe ?? [],
    kitchenStation: input.kitchenStation ?? input.product?.kitchenStation,
    variants: input.product?.variants,
    modifierGroups: input.product?.modifierGroups,
    createdAt: input.product?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", input.restaurantId, "products", id),
    row,
  );
  await batch.commit();
  return row;
}
