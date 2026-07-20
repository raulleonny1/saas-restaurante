import type { Product } from "@/types/catalog";
import type { InventoryLevel } from "@/types/inventory";

export type ProductAvailability = {
  available: boolean;
  /** Motivo corto para UI. */
  reason?: "sold_out" | "zero_stock" | "recipe_stock" | "inactive";
};

/**
 * Disponibilidad operativa (86): flag manual, stock de producto o receta.
 * No usa `status: inactive` (eso archiva la carta).
 */
export function getProductAvailability(
  product: Product,
  levels?: InventoryLevel[] | Map<string, number>,
  opts?: { qty?: number },
): ProductAvailability {
  if (product.status !== "active" || product.deletedAt) {
    return { available: false, reason: "inactive" };
  }
  if (product.soldOut) {
    return { available: false, reason: "sold_out" };
  }
  if (product.stockQty != null && product.stockQty <= 0) {
    return { available: false, reason: "zero_stock" };
  }

  const need = Math.max(1, opts?.qty ?? 1);
  if (product.recipe?.length && levels) {
    const qtyByIng =
      levels instanceof Map
        ? levels
        : new Map(levels.map((l) => [l.ingredientId, l.quantity]));
    for (const ri of product.recipe) {
      const have = qtyByIng.get(ri.ingredientId) ?? 0;
      if (have + 1e-9 < ri.quantity * need) {
        return { available: false, reason: "recipe_stock" };
      }
    }
  }

  return { available: true };
}

export function isProductSellable(
  product: Product,
  levels?: InventoryLevel[] | Map<string, number>,
  opts?: { qty?: number },
): boolean {
  return getProductAvailability(product, levels, opts).available;
}

export function soldOutLabel(
  reason?: ProductAvailability["reason"],
): string {
  switch (reason) {
    case "sold_out":
      return "Agotado";
    case "zero_stock":
      return "Sin stock";
    case "recipe_stock":
      return "Sin ingredientes";
    case "inactive":
      return "No disponible";
    default:
      return "Agotado";
  }
}
