import type { CurrencyCode, ISODateString, SoftDelete, Timestamps } from "./common";
import type { IngredientUnit } from "./catalog";

export type InventoryMovementType =
  | "purchase"
  | "sale"
  | "waste"
  | "adjustment"
  | "transfer_in"
  | "transfer_out"
  | "count";

/** Current stock level for one ingredient in one branch. */
export interface InventoryLevel extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string;
  ingredientId: string;
  quantity: number;
  unit: IngredientUnit;
  minStock: number;
  maxStock?: number;
  lastCountedAt?: ISODateString;
}

export interface InventoryMovement extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string;
  ingredientId: string;
  type: InventoryMovementType;
  quantity: number;
  unit: IngredientUnit;
  /** Signed delta applied to stock (+/-). */
  delta: number;
  referenceType?: "order" | "purchase" | "waste" | "transfer" | "manual";
  referenceId?: string;
  note?: string;
  createdBy: string;
}

export interface Supplier extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  address?: string;
  notes?: string;
}

export type PurchaseStatus = "draft" | "ordered" | "received" | "cancelled";

export interface PurchaseItem {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: IngredientUnit;
  unitCost: number;
}

export interface Purchase extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  branchId: string;
  supplierId: string;
  status: PurchaseStatus;
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: CurrencyCode;
  orderedAt?: ISODateString;
  receivedAt?: ISODateString;
  createdBy: string;
  notes?: string;
}

export type WasteReason =
  | "expired"
  | "spoiled"
  | "prep_error"
  | "customer_return"
  | "other";

export interface WasteEntry extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: IngredientUnit;
  reason: WasteReason;
  note?: string;
  costImpact: number;
  createdBy: string;
}

export type TransferStatus =
  | "draft"
  | "in_transit"
  | "received"
  | "cancelled";

export interface TransferItem {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: IngredientUnit;
}

/** Inter-branch stock transfer. */
export interface StockTransfer extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  fromBranchId: string;
  toBranchId: string;
  status: TransferStatus;
  items: TransferItem[];
  createdBy: string;
  notes?: string;
  shippedAt?: ISODateString;
  receivedAt?: ISODateString;
}

/** AI / heuristic stock forecast materialised for the inventory UI. */
export interface InventoryPrediction extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string;
  ingredientId: string;
  ingredientName: string;
  /** Estimated days until stock-out at current burn rate. */
  daysOfCover: number;
  avgDailyUsage: number;
  suggestedReorderQty: number;
  unit: IngredientUnit;
  confidence: number;
  rationale: string;
  generatedAt: ISODateString;
}
