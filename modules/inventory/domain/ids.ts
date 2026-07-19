export function levelDocId(branchId: string, ingredientId: string): string {
  return `${branchId}__${ingredientId}`;
}

export function saleMovementRefId(
  orderId: string,
  orderItemId: string,
  ingredientId: string,
): string {
  return `sale:${orderId}:${orderItemId}:${ingredientId}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}
