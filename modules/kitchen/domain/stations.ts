import type { Product, ProductCategory } from "@/types/catalog";
import type { KitchenStationId } from "@/types/kitchen";
import type { OrderItem } from "@/types/orders";

export function resolveItemStation(
  item: OrderItem,
  product: Product | undefined,
  category: ProductCategory | undefined,
): KitchenStationId {
  if (item.kitchenStation) return item.kitchenStation;
  if (product?.kitchenStation) return product.kitchenStation;

  const haystack = [
    category?.name,
    product?.name,
    item.name,
    ...(product?.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/postre|dessert|tarta|helado|brownie/.test(haystack)) return "postres";
  if (/bebida|drink|refresco|agua|cerveza|vino|cocktail|zumo/.test(haystack)) {
    return "bebidas";
  }
  if (/caf[eé]|espresso|cappuccino|latte|barra|bar\b|t[eé] /.test(haystack)) {
    return "bar";
  }
  return "cocina";
}

export function targetPrepMinutes(
  product: Product | undefined,
  station: KitchenStationId,
): number {
  if (product?.preparationMinutes && product.preparationMinutes > 0) {
    return product.preparationMinutes;
  }
  switch (station) {
    case "bar":
      return 3;
    case "bebidas":
      return 2;
    case "postres":
      return 6;
    case "cocina":
    default:
      return 12;
  }
}
