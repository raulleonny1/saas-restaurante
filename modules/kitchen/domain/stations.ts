import type { Product, ProductCategory } from "@/types/catalog";
import type { KitchenStationId } from "@/types/kitchen";
import type { OrderItem } from "@/types/orders";

/** Estaciones que ve cada pantalla KDS. */
export const BOARD_STATIONS = {
  kitchen: ["cocina", "postres"] as const satisfies readonly KitchenStationId[],
  /** Una sola estación visible: todas las bebidas. */
  bar: ["bar"] as const satisfies readonly KitchenStationId[],
}

export type KitchenBoardMode = keyof typeof BOARD_STATIONS;

export function isDrinkStation(station: KitchenStationId): boolean {
  return station === "bar" || station === "bebidas";
}

export function resolveItemStation(
  item: OrderItem,
  product: Product | undefined,
  category: ProductCategory | undefined,
): KitchenStationId {
  const tagged = item.kitchenStation ?? product?.kitchenStation;
  if (tagged) {
    // Etiqueta antigua "bebidas" se trata como barra
    return tagged === "bebidas" ? "bar" : tagged;
  }

  const haystack = [
    category?.name,
    product?.name,
    item.name,
    ...(product?.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/postre|dessert|tarta|helado|brownie|tiramis/.test(haystack)) {
    return "postres";
  }

  // Todo lo de bebidas / bar → estación bar (no cocina)
  if (
    /bebida|drink|refresco|soda|agua|cerveza|vino|cocktail|c[oó]ctel|zumo|jugo|whisky|whiskey|ron|vodka|gin|tequila|licor|mojito|sangr[ií]a|champagne|cava|tinto|blanco|rosado|cafe|caf[eé]|espresso|cappuccino|latte|americano|macchiato|matcha|infusi[oó]n|\bt[eé]\b|smoothie|batido|milkshake|mocktail|energ[eé]tica|tonica|t[oó]nica|cola|fanta|sprite|nestea|aquarius|gaseosa|soft.?drink|barra|\bbar\b/.test(
      haystack,
    )
  ) {
    return "bar";
  }

  return "cocina";
}

export function stationMatchesBoard(
  station: KitchenStationId,
  mode: KitchenBoardMode,
): boolean {
  if (mode === "bar") return isDrinkStation(station);
  return station === "cocina" || station === "postres";
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
