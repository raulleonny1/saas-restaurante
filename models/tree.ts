/**
 * Complete Firestore document tree for SmartServe AI.
 *
 * ```
 * users/{uid}
 *   email, displayName, role, restaurantIds[], timestamps
 *
 * restaurants/{restaurantId}
 *   name, currency, timezone, settings, status
 *
 *   branches/{branchId}
 *     name, code, address, isDefault, status
 *
 *   members/{uid}
 *     role, branchIds[], active
 *
 *   employees/{employeeId}
 *   employeeShifts/{shiftId}
 *   employeeRecords/{recordId}
 *
 *   categories/{categoryId}
 *   products/{productId}          // recipe[] restaurant-wide
 *   ingredients/{ingredientId}    // catalog restaurant-wide
 *
 *   inventoryLevels/{levelId}     // UNIQUE(branchId, ingredientId)
 *   inventoryMovements/{movementId}
 *   suppliers/{supplierId}
 *   purchases/{purchaseId}
 *   waste/{wasteId}
 *
 *   customers/{customerId}        // shared across branches
 *   customerHistory/{entryId}
 *
 *   tables/{tableId}              // branchId required
 *   orders/{orderId}              // branchId required
 *   orderEvents/{eventId}
 *   payments/{paymentId}
 *
 *   promotions/{promotionId}
 *   coupons/{couponId}
 *   campaigns/{campaignId}
 *   reservations/{reservationId}
 *
 *   historyEvents/{eventId}       // historial agregado
 *   auditLogs/{logId}             // auditoría inmutable
 *
 *   aiSessions/{sessionId}
 *     messages/{messageId}
 *   aiInsights/{insightId}
 * ```
 */

export const DATA_MODEL_VERSION = "1.0.0";

export const SCOPE_RULES = {
  restaurantWide: [
    "categories",
    "products",
    "ingredients",
    "suppliers",
    "customers",
    "promotions",
    "coupons",
    "campaigns",
    "employees",
    "members",
    "branches",
  ],
  branchRequired: [
    "tables",
    "orders",
    "orderEvents",
    "payments",
    "inventoryLevels",
    "inventoryMovements",
    "purchases",
    "waste",
    "reservations",
    "employeeShifts",
  ],
  branchOptional: [
    "customerHistory",
    "historyEvents",
    "auditLogs",
    "aiSessions",
    "aiInsights",
  ],
} as const;
