/** Shared primitive types used across the platform. */

export type ISODateString = string;

export type CurrencyCode = "EUR" | "USD" | "GBP" | "MXN";

export type Timezone = string;

export type EntityStatus = "active" | "inactive" | "archived";

export interface Timestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Every tenant-scoped document carries these isolation keys. */
export interface TenantScope {
  restaurantId: string;
  /** Null only for restaurant-wide (shared) catalog entities. */
  branchId: string | null;
}

export interface Paginated<T> {
  items: T[];
  nextCursor?: string;
}

export interface SoftDelete {
  deletedAt?: ISODateString | null;
  deletedBy?: string | null;
}
