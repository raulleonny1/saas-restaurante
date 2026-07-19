import type { CurrencyCode, EntityStatus, SoftDelete, Timestamps } from "./common";

export interface ProductCategory extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  status: EntityStatus;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  /** Absolute price when set; otherwise `price + priceDelta`. */
  price?: number;
  priceDelta?: number;
}

export interface ProductModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface ProductModifierGroup {
  id: string;
  name: string;
  required?: boolean;
  min?: number;
  max?: number;
  options: ProductModifierOption[];
}

/** Sellable item (menu product). Catalog is restaurant-wide; availability can be per branch. */
export interface Product extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  sku?: string;
  price: number;
  cost?: number;
  currency: CurrencyCode;
  status: EntityStatus;
  /** Branches where product is offered; empty = all. */
  branchIds: string[];
  recipe: RecipeIngredient[];
  tags?: string[];
  imageUrl?: string;
  allergens?: string[];
  preparationMinutes?: number;
  /** KDS station routing (bar | cocina | postres | bebidas). */
  kitchenStation?: "bar" | "cocina" | "postres" | "bebidas";
  variants?: ProductVariant[];
  modifierGroups?: ProductModifierGroup[];
}

export type IngredientUnit = "kg" | "g" | "L" | "ml" | "ud" | "caja";

export interface Ingredient extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  name: string;
  sku?: string;
  unit: IngredientUnit;
  costPerUnit: number;
  currency: CurrencyCode;
  defaultSupplierId?: string;
  status: EntityStatus;
  /** Optional perishable tracking. */
  shelfLifeDays?: number;
}
