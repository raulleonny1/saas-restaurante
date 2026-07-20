/**
 * Firestore collection map — multi-restaurante + multi-sucursal.
 *
 * Isolation rules:
 * - restaurantId is mandatory on every tenant document
 * - branchId is mandatory for operational data (orders, stock, reservations, tables)
 * - Catalog (products, ingredients) is restaurant-wide; stock is per branch
 * - Never query across restaurants
 */

export const ROOT_COLLECTIONS = [
  "users",
  "restaurants",
  "restaurantSlugs",
  "customDomains",
  "memberInvites",
] as const;

/** Direct children of restaurants/{restaurantId} */
export const RESTAURANT_COLLECTIONS = [
  // org
  "branches",
  "members",
  "billing",
  "invoices",
  "employees",
  "employeeShifts",
  "employeeRecords",
  // catalog
  "categories",
  "products",
  "ingredients",
  // inventory
  "inventoryLevels",
  "inventoryMovements",
  "suppliers",
  "purchases",
  "waste",
  // crm
  "customers",
  "customerHistory",
  // ops
  "tables",
  "orders",
  "orderEvents",
  "payments",
  "dailyStats",
  "receiptPrintJobs",
  // growth
  "promotions",
  "coupons",
  "campaigns",
  "campaignRecipients",
  "reservations",
  // platform
  "historyEvents",
  "auditLogs",
  "aiSessions",
  "aiInsights",
  "appNotifications",
] as const;

/** Subcollections */
export const SUBCOLLECTIONS = {
  aiMessages: "messages", // aiSessions/{id}/messages/{messageId}
} as const;

export type RootCollection = (typeof ROOT_COLLECTIONS)[number];
export type RestaurantCollection = (typeof RESTAURANT_COLLECTIONS)[number];

/**
 * Recommended composite indexes (also in firestore.indexes.json):
 *
 * orders: restaurantId + branchId + status + openedAt
 * orders: restaurantId + branchId + paidAt
 * reservations: restaurantId + branchId + startsAt
 * inventoryLevels: restaurantId + branchId + ingredientId
 * inventoryLevels: restaurantId + branchId + quantity (for low stock — use minStock in app)
 * auditLogs: restaurantId + occurredAt
 * historyEvents: restaurantId + occurredAt
 * customerHistory: restaurantId + customerId + createdAt
 * payments: restaurantId + branchId + paidAt
 */
