/**
 * Declared composite indexes for the data model.
 * Mirror of firestore.indexes.json for TypeScript discoverability.
 */

export interface IndexField {
  field: string;
  order?: "ASCENDING" | "DESCENDING";
}

export interface CollectionIndex {
  collectionGroup: string;
  fields: IndexField[];
}

export const FIRESTORE_INDEXES: CollectionIndex[] = [
  {
    collectionGroup: "orders",
    fields: [
      { field: "branchId", order: "ASCENDING" },
      { field: "status", order: "ASCENDING" },
      { field: "openedAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "orders",
    fields: [
      { field: "branchId", order: "ASCENDING" },
      { field: "paidAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "reservations",
    fields: [
      { field: "branchId", order: "ASCENDING" },
      { field: "startsAt", order: "ASCENDING" },
    ],
  },
  {
    collectionGroup: "inventoryLevels",
    fields: [
      { field: "branchId", order: "ASCENDING" },
      { field: "ingredientId", order: "ASCENDING" },
    ],
  },
  {
    collectionGroup: "inventoryMovements",
    fields: [
      { field: "branchId", order: "ASCENDING" },
      { field: "createdAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "customerHistory",
    fields: [
      { field: "customerId", order: "ASCENDING" },
      { field: "createdAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "orderEvents",
    fields: [
      { field: "orderId", order: "ASCENDING" },
      { field: "createdAt", order: "ASCENDING" },
    ],
  },
  {
    collectionGroup: "payments",
    fields: [
      { field: "branchId", order: "ASCENDING" },
      { field: "paidAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "auditLogs",
    fields: [{ field: "occurredAt", order: "DESCENDING" }],
  },
  {
    collectionGroup: "historyEvents",
    fields: [
      { field: "entityType", order: "ASCENDING" },
      { field: "occurredAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "aiInsights",
    fields: [
      { field: "status", order: "ASCENDING" },
      { field: "createdAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "employees",
    fields: [
      { field: "status", order: "ASCENDING" },
      { field: "role", order: "ASCENDING" },
    ],
  },
  {
    collectionGroup: "tables",
    fields: [
      { field: "branchId", order: "ASCENDING" },
      { field: "status", order: "ASCENDING" },
    ],
  },
];
