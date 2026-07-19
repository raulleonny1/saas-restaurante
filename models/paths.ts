/**
 * Canonical Firestore path builders.
 * Operational paths always imply restaurant scope; branch is a document field
 * and/or path segment only for branch master data.
 */

export const firestorePaths = {
  // Root
  users: "users",
  user: (uid: string) => `users/${uid}`,
  restaurants: "restaurants",
  restaurant: (restaurantId: string) => `restaurants/${restaurantId}`,

  // Org
  branches: (restaurantId: string) => `restaurants/${restaurantId}/branches`,
  branch: (restaurantId: string, branchId: string) =>
    `restaurants/${restaurantId}/branches/${branchId}`,
  members: (restaurantId: string) => `restaurants/${restaurantId}/members`,
  member: (restaurantId: string, uid: string) =>
    `restaurants/${restaurantId}/members/${uid}`,
  billing: (restaurantId: string) =>
    `restaurants/${restaurantId}/billing/current`,
  invoices: (restaurantId: string) => `restaurants/${restaurantId}/invoices`,
  invoice: (restaurantId: string, invoiceId: string) =>
    `restaurants/${restaurantId}/invoices/${invoiceId}`,
  memberInvites: "memberInvites",
  memberInvite: (inviteId: string) => `memberInvites/${inviteId}`,
  employees: (restaurantId: string) => `restaurants/${restaurantId}/employees`,
  employee: (restaurantId: string, employeeId: string) =>
    `restaurants/${restaurantId}/employees/${employeeId}`,
  employeeShifts: (restaurantId: string) =>
    `restaurants/${restaurantId}/employeeShifts`,

  // Catalog
  categories: (restaurantId: string) => `restaurants/${restaurantId}/categories`,
  products: (restaurantId: string) => `restaurants/${restaurantId}/products`,
  product: (restaurantId: string, productId: string) =>
    `restaurants/${restaurantId}/products/${productId}`,
  ingredients: (restaurantId: string) =>
    `restaurants/${restaurantId}/ingredients`,
  ingredient: (restaurantId: string, ingredientId: string) =>
    `restaurants/${restaurantId}/ingredients/${ingredientId}`,

  // Inventory
  inventoryLevels: (restaurantId: string) =>
    `restaurants/${restaurantId}/inventoryLevels`,
  inventoryLevel: (restaurantId: string, levelId: string) =>
    `restaurants/${restaurantId}/inventoryLevels/${levelId}`,
  inventoryMovements: (restaurantId: string) =>
    `restaurants/${restaurantId}/inventoryMovements`,
  suppliers: (restaurantId: string) => `restaurants/${restaurantId}/suppliers`,
  purchases: (restaurantId: string) => `restaurants/${restaurantId}/purchases`,
  waste: (restaurantId: string) => `restaurants/${restaurantId}/waste`,
  transfers: (restaurantId: string) => `restaurants/${restaurantId}/transfers`,
  transfer: (restaurantId: string, transferId: string) =>
    `restaurants/${restaurantId}/transfers/${transferId}`,
  inventoryPredictions: (restaurantId: string) =>
    `restaurants/${restaurantId}/inventoryPredictions`,

  // CRM
  customers: (restaurantId: string) => `restaurants/${restaurantId}/customers`,
  customer: (restaurantId: string, customerId: string) =>
    `restaurants/${restaurantId}/customers/${customerId}`,
  customerHistory: (restaurantId: string) =>
    `restaurants/${restaurantId}/customerHistory`,
  loyaltyAccounts: (restaurantId: string) =>
    `restaurants/${restaurantId}/loyaltyAccounts`,
  loyaltyAccount: (restaurantId: string, accountId: string) =>
    `restaurants/${restaurantId}/loyaltyAccounts/${accountId}`,
  loyaltyTransactions: (restaurantId: string) =>
    `restaurants/${restaurantId}/loyaltyTransactions`,
  personalizedPromos: (restaurantId: string) =>
    `restaurants/${restaurantId}/personalizedPromos`,

  // Ops
  tables: (restaurantId: string) => `restaurants/${restaurantId}/tables`,
  table: (restaurantId: string, tableId: string) =>
    `restaurants/${restaurantId}/tables/${tableId}`,
  orders: (restaurantId: string) => `restaurants/${restaurantId}/orders`,
  order: (restaurantId: string, orderId: string) =>
    `restaurants/${restaurantId}/orders/${orderId}`,
  orderEvents: (restaurantId: string) =>
    `restaurants/${restaurantId}/orderEvents`,
  payments: (restaurantId: string) => `restaurants/${restaurantId}/payments`,

  // Growth
  promotions: (restaurantId: string) => `restaurants/${restaurantId}/promotions`,
  coupons: (restaurantId: string) => `restaurants/${restaurantId}/coupons`,
  campaigns: (restaurantId: string) => `restaurants/${restaurantId}/campaigns`,
  campaignRecipients: (restaurantId: string) =>
    `restaurants/${restaurantId}/campaignRecipients`,
  marketingAutomations: (restaurantId: string) =>
    `restaurants/${restaurantId}/marketingAutomations`,
  reservations: (restaurantId: string) =>
    `restaurants/${restaurantId}/reservations`,
  reservation: (restaurantId: string, reservationId: string) =>
    `restaurants/${restaurantId}/reservations/${reservationId}`,
  waitlist: (restaurantId: string) =>
    `restaurants/${restaurantId}/waitlist`,
  waitlistEntry: (restaurantId: string, entryId: string) =>
    `restaurants/${restaurantId}/waitlist/${entryId}`,
  reservationsSettings: (restaurantId: string, branchId: string) =>
    `restaurants/${restaurantId}/reservationsSettings/${branchId}`,

  // Platform
  historyEvents: (restaurantId: string) =>
    `restaurants/${restaurantId}/historyEvents`,
  auditLogs: (restaurantId: string) => `restaurants/${restaurantId}/auditLogs`,
  aiSessions: (restaurantId: string) => `restaurants/${restaurantId}/aiSessions`,
  aiSession: (restaurantId: string, sessionId: string) =>
    `restaurants/${restaurantId}/aiSessions/${sessionId}`,
  aiMessages: (restaurantId: string, sessionId: string) =>
    `restaurants/${restaurantId}/aiSessions/${sessionId}/messages`,
  aiInsights: (restaurantId: string) => `restaurants/${restaurantId}/aiInsights`,

  // Public website
  restaurantSlugs: "restaurantSlugs",
  restaurantSlug: (slug: string) => `restaurantSlugs/${slug}`,
  customDomains: "customDomains",
  customDomain: (host: string) => `customDomains/${host}`,
  websiteSettings: (restaurantId: string) =>
    `restaurants/${restaurantId}/websiteSettings`,
  blogPosts: (restaurantId: string) =>
    `restaurants/${restaurantId}/blogPosts`,
  siteEvents: (restaurantId: string) =>
    `restaurants/${restaurantId}/siteEvents`,
  reviews: (restaurantId: string) => `restaurants/${restaurantId}/reviews`,
  customerChats: (restaurantId: string) =>
    `restaurants/${restaurantId}/customerChats`,
  customerChatMessages: (restaurantId: string, threadId: string) =>
    `restaurants/${restaurantId}/customerChats/${threadId}/messages`,
  appNotifications: (restaurantId: string) =>
    `restaurants/${restaurantId}/appNotifications`,
} as const;
