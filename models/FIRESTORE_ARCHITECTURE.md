# SmartServe AI — Arquitectura completa de Firestore

> Solo modelo de datos. Multi-tenant, multi-sucursal, pensado para miles de restaurantes.  
> Versión del modelo: **2.0.0**

---

## 1. Principios de aislamiento

| Regla | Descripción |
|-------|-------------|
| Tenant | `restaurantId` en **todo** documento operativo |
| Sucursal | `branchId` obligatorio en ops (mesas, pedidos, stock, reservas, pagos de local) |
| Catálogo | Productos/categorías/ingredientes a nivel restaurante; stock por sucursal |
| Authz | `members` + `roles` + `permissions`; nunca mezclar tenants en queries |
| Escritura sensible | Billing, roles globales y auditoría preferible vía Cloud Functions |
| IDs | Autogenerados Firestore o prefijados (`ord_`, `pay_`); nunca PII como ID |

```text
users/{uid}                                    ← identidad global
roles/{roleId}                                 ← catálogo global de roles (opcional)
permissions/{permissionId}                     ← catálogo global de permisos

restaurants/{restaurantId}                     ← TENANT
  ├── branches/{branchId}
  ├── members/{uid}
  ├── roles/{roleId}                           ← override / custom roles del tenant
  ├── roleBindings/{bindingId}
  ├── settings/{settingsId}                    ← doc único "app" o varios keys
  ├── tables/{tableId}
  ├── categories/{categoryId}
  ├── products/{productId}
  ├── ingredients/{ingredientId}
  ├── inventoryLevels/{levelId}
  ├── inventoryMovements/{movementId}
  ├── suppliers/{supplierId}
  ├── purchases/{purchaseId}
  ├── waste/{wasteId}
  ├── customers/{customerId}
  ├── loyaltyAccounts/{accountId}
  ├── loyaltyTransactions/{txId}
  ├── reservations/{reservationId}
  ├── promotions/{promotionId}
  ├── coupons/{couponId}
  ├── campaigns/{campaignId}
  ├── campaignRecipients/{recipientId}
  ├── orders/{orderId}
  ├── orderEvents/{eventId}
  ├── payments/{paymentId}
  ├── invoices/{invoiceId}                     ← fiscales del restaurante a clientes
  ├── employees/{employeeId}
  ├── employeeShifts/{shiftId}
  ├── notifications/{notificationId}
  ├── notificationPreferences/{uid}
  ├── historyEvents/{eventId}
  ├── auditLogs/{logId}
  ├── aiSessions/{sessionId}
  │     └── messages/{messageId}
  ├── aiInsights/{insightId}
  ├── aiUsage/{periodId}
  ├── subscription                             ← campo o subdoc billing/subscription
  ├── billingInvoices/{invoiceId}              ← facturas SaaS (Stripe)
  └── configHistory/{entryId}
```

---

## 2. Colecciones raíz

### 2.1 `users/{uid}`

**Propósito:** Perfil de Firebase Auth espejado en Firestore.

**Estructura**
```ts
{
  uid: string
  email: string
  displayName: string
  photoURL?: string
  phone?: string
  locale?: string
  role: UserRole                    // rol global por defecto
  restaurantIds: string[]           // denormalizado para listar tenants
  defaultRestaurantId?: string
  status: 'active' | 'disabled'
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}
```

**Relaciones**
- 1:1 con Firebase Auth `uid`
- N:M con `restaurants` vía `members` (fuente de verdad de acceso)
- `restaurantIds[]` es caché; reconciliar en Cloud Function al unir/salir

**Índices**
- `email` ASC (unique lógico en Auth)
- `restaurantIds` (array-contains) si se busca “usuarios de…”

**Escalabilidad**
- Doc pequeño (<2KB). No embeber historial.
- Sharding no necesario; crecimiento lineal con usuarios.

---

### 2.2 `roles/{roleId}` (catálogo global)

**Propósito:** Definición canónica de roles de plataforma.

**Estructura**
```ts
{
  id: string                        // administrador | gerente | cajero | mesero | cocinero | cliente
  name: string
  description: string
  permissionIds: string[]           // refs a permissions
  isSystem: true
  rank: number                      // para comparaciones jerárquicas
  createdAt: string
  updatedAt: string
}
```

**Relaciones**
- N:M con `permissions`
- Referenciado por `members.roleId` / `employees.roleId`

**Índices**
- `isSystem` + `rank`

**Escalabilidad**
- Colección pequeña y estática (~10 docs). Cacheable en cliente/CDN edge.

---

### 2.3 `permissions/{permissionId}` (catálogo global)

**Propósito:** Permisos atómicos (`orders.create`, `inventory.adjust`, `billing.manage`…).

**Estructura**
```ts
{
  id: string                        // 'pos.charge'
  module: string                    // 'pos' | 'inventory' | 'ai' | …
  action: string                    // 'read' | 'create' | 'update' | 'delete' | 'manage'
  description: string
  createdAt: string
}
```

**Relaciones**
- Agrupados en `roles.permissionIds`
- Evaluados en rules / backend (`hasPermission`)

**Índices**
- `module` + `action`

**Escalabilidad**
- Catálogo fijo; versionar IDs, nunca renombrar en caliente.

---

## 3. Tenant: `restaurants/{restaurantId}`

**Documento raíz del tenant**
```ts
{
  id: string
  name: string
  legalName?: string
  taxId?: string                    // NIF/VAT
  timezone: string
  currency: 'EUR' | 'USD' | …
  locale: string
  status: 'active' | 'inactive' | 'suspended' | 'archived'
  logoUrl?: string
  ownerUid: string
  settings: {
    tipDefaultPercent: number
    taxPercent: number
    defaultBranchId?: string
    stripeEnabled: boolean
    sumupEnabled: boolean
  }
  subscription: SubscriptionSnapshot  // ver § Billing
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}
```

**Relaciones**
- 1:N `branches`, `members`, todas las subcolecciones
- 1:1 lógica con Stripe Customer (`subscription.stripeCustomerId`)

**Índices**
- `status` + `createdAt`
- `ownerUid`

**Escalabilidad**
- Un doc hot-path por request de contexto. Mantener <50KB. Contadores de uso en `subscription.usage`, no agregar en el root doc listas grandes.

---

## 4. Sucursales — `branches/{branchId}`

```ts
{
  id: string
  restaurantId: string
  name: string
  code: string                      // 'MAIN', 'CENTRO'
  address?: string
  geo?: { lat: number, lng: number }
  phone?: string
  timezone: string
  currency: string
  status: 'active' | 'inactive' | 'archived'
  isDefault: boolean
  openingHours?: Record<string, { open: string, close: string } | null>
  createdAt: string
  updatedAt: string
}
```

**Relaciones**
- Padre: `restaurants`
- Hijos lógicos: `tables`, `orders`, `inventoryLevels`, `reservations`, `payments` (por campo `branchId`)

**Índices**
- `restaurantId` implícito (subcolección)
- `status` + `isDefault`

**Escalabilidad**
- Decenas–cientos por cadena. Enterprise: miles → seguir subcolección por restaurant (particionado natural por tenant).

---

## 5. Miembros, roles y permisos (tenant)

### 5.1 `members/{uid}`

```ts
{
  uid: string
  restaurantId: string
  email: string
  displayName: string
  roleId: string                    // 'administrador' | custom
  permissionOverrides?: {
    allow?: string[]
    deny?: string[]
  }
  branchIds: string[]               // [] = todas
  active: boolean
  invitedBy?: string
  joinedAt: string
  createdAt: string
  updatedAt: string
}
```

**Relaciones**
- `uid` → `users`
- `roleId` → `roles` global o `restaurants/.../roles`
- `branchIds` → `branches`

**Índices**
- `active` + `roleId`
- `branchIds` ARRAY_CONTAINS

**Escalabilidad**
- 1 doc por usuario/tenant. Ideal para rules (`exists members/uid`).

### 5.2 `roles/{roleId}` (custom del tenant)

```ts
{
  id: string
  restaurantId: string
  name: string
  baseRoleId?: string               // hereda de rol sistema
  permissionIds: string[]
  isSystem: boolean
  createdAt: string
  updatedAt: string
}
```

### 5.3 `roleBindings/{bindingId}` (opcional, para auditabilidad)

```ts
{
  id: string
  restaurantId: string
  uid: string
  roleId: string
  branchIds: string[]
  assignedBy: string
  assignedAt: string
}
```

**Escalabilidad permisos:** resolver `role → permissions` en servidor y cachear `members.entitlementsCached[]` si las rules se vuelven pesadas (actualizar por CF al cambiar rol).

---

## 6. Configuración — `settings/{settingsId}`

Usar documentos por dominio (evita contención en un solo mega-doc):

| Doc ID | Contenido |
|--------|-----------|
| `general` | nombre comercial, locale, currency default |
| `pos` | propinas, impuestos, impresión |
| `kitchen` | sonido, autosleep columnas |
| `payments` | stripe/sumup keys refs (secrets en Secret Manager, aquí solo flags) |
| `loyalty` | puntos por €, caducidad |
| `notifications` | canales default |
| `ai` | modelo, límites, prompts sistema |
| `billing` | datos fiscales espejo |

```ts
{
  id: string                        // 'pos'
  restaurantId: string
  data: Record<string, unknown>
  updatedAt: string
  updatedBy: string
}
```

**Historial de config** → `configHistory/{entryId}`
```ts
{
  id: string
  restaurantId: string
  settingsId: string
  before: object
  after: object
  changedBy: string
  createdAt: string
}
```

**Índices:** `settingsId` + `createdAt` DESC en `configHistory`.

**Escalabilidad:** writes bajos; no hay hot-spot salvo mal diseño de un único doc gigante.

---

## 7. Mesas — `tables/{tableId}`

```ts
{
  id: string
  restaurantId: string
  branchId: string
  name: string
  seats: number
  zone?: string
  status: 'available' | 'occupied' | 'reserved' | 'dirty'
  x: number
  y: number
  currentOrderId?: string | null
  mergedWith?: string[]
  createdAt: string
  updatedAt: string
}
```

**Relaciones:** `branchId` → branches; `currentOrderId` → orders.

**Índices**
- `branchId` + `status`
- `branchId` + `zone`

**Escalabilidad:** cientos por sucursal; listeners POS por `branchId`.

---

## 8. Catálogo

### 8.1 `categories/{categoryId}`

```ts
{
  id: string
  restaurantId: string
  name: string
  sortOrder: number
  status: 'active' | 'inactive' | 'archived'
  createdAt: string
  updatedAt: string
}
```

### 8.2 `products/{productId}`

```ts
{
  id: string
  restaurantId: string
  categoryId: string
  name: string
  description?: string
  sku?: string
  price: number
  cost?: number
  currency: string
  status: 'active' | 'inactive' | 'archived'
  branchIds: string[]               // [] = todas
  recipe: Array<{ ingredientId: string, quantity: number, unit: string }>
  tags?: string[]
  imageUrl?: string
  allergens?: string[]
  preparationMinutes?: number
  createdAt: string
  updatedAt: string
}
```

### 8.3 `ingredients/{ingredientId}`

```ts
{
  id: string
  restaurantId: string
  name: string
  sku?: string
  unit: 'kg' | 'g' | 'L' | 'ml' | 'ud' | 'caja'
  costPerUnit: number
  currency: string
  defaultSupplierId?: string
  status: 'active' | 'inactive' | 'archived'
  shelfLifeDays?: number
  createdAt: string
  updatedAt: string
}
```

**Relaciones:** product.categoryId → categories; recipe.ingredientId → ingredients; stock en inventoryLevels.

**Índices**
- products: `status` + `categoryId`
- products: `branchIds` ARRAY_CONTAINS + `status`
- ingredients: `status` + `name`

**Escalabilidad:** catálogo miles de productos/tenant OK. Imágenes en Storage; solo URL en Firestore.

---

## 9. Inventario

### 9.1 `inventoryLevels/{levelId}`

ID recomendado: `{branchId}_{ingredientId}` (idempotente).

```ts
{
  id: string
  restaurantId: string
  branchId: string
  ingredientId: string
  quantity: number
  unit: string
  minStock: number
  maxStock?: number
  lastCountedAt?: string
  updatedAt: string
  createdAt: string
}
```

### 9.2 `inventoryMovements/{movementId}`

```ts
{
  id: string
  restaurantId: string
  branchId: string
  ingredientId: string
  type: 'purchase' | 'sale' | 'waste' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'count'
  quantity: number
  unit: string
  delta: number
  referenceType?: 'order' | 'purchase' | 'waste' | 'transfer' | 'manual'
  referenceId?: string
  note?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}
```

### 9.3 `suppliers/{supplierId}` / `purchases/{purchaseId}` / `waste/{wasteId}`

(Ver tipos actuales en `types/inventory.ts` — mismos campos + `restaurantId`/`branchId`.)

**Índices**
- levels: `branchId` + `ingredientId` UNIQUE lógico
- levels: `branchId` + `quantity` (alertas: filtrar `quantity <= minStock` en cliente o CF)
- movements: `branchId` + `createdAt` DESC
- movements: `ingredientId` + `createdAt` DESC

**Escalabilidad**
- Levels: O(ingredients × branches) — aceptable hasta ~50k docs/tenant.
- Movements: append-only alto volumen → retener 90–180 días calientes; archivar a BigQuery/GCS.
- Ajustes de stock con transacciones (`runTransaction`) para evitar race conditions.

---

## 10. Pedidos y ops de sala

### 10.1 `orders/{orderId}`

```ts
{
  id: string
  restaurantId: string
  branchId: string
  tableId?: string | null
  tableName?: string
  customerId?: string | null
  channel: 'pos' | 'qr' | 'delivery' | 'takeaway' | 'online'
  items: OrderItem[]                // embebidos si <~100 líneas
  status: OrderStatus
  discountPercent: number
  discountAmount: number
  tipPercent: number
  tipAmount: number
  taxAmount: number
  subtotal: number
  total: number
  currency: string
  promotionId?: string | null
  couponCode?: string | null
  loyaltyPointsEarned?: number
  loyaltyPointsRedeemed?: number
  splitParts?: number
  guestCount: number
  openedAt: string
  sentAt?: string
  paidAt?: string
  cancelledAt?: string
  createdBy: string
  servedBy?: string
  notes?: string
  createdAt: string
  updatedAt: string
}
```

### 10.2 `orderEvents/{eventId}` (historial de pedido)

```ts
{
  id: string
  restaurantId: string
  branchId: string
  orderId: string
  type: string
  fromStatus?: string
  toStatus?: string
  actorUid: string
  payload?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
```

**Índices orders**
- `branchId` + `status` + `openedAt` DESC
- `branchId` + `paidAt` DESC
- `customerId` + `openedAt` DESC
- `status` IN kitchen: `branchId` + `status` + `sentAt`

**Escalabilidad**
- Hot path KDS: query por branch + status (pocos docs “abiertos”).
- Pedidos cerrados: no escuchar todo el histórico; queries por día/rango.
- Si `items` crece mucho → subcolección `orders/{id}/items/{itemId}`.
- Archivo: mover orders > N meses a `orders_archive` o data warehouse.

---

## 11. Pagos y facturas

### 11.1 `payments/{paymentId}` — cobros a comensales

```ts
{
  id: string
  restaurantId: string
  branchId: string
  orderId: string
  method: 'cash' | 'card' | 'stripe' | 'sumup' | 'other'
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  amount: number
  tipAmount: number
  currency: string
  externalRef?: string
  processedBy: string
  paidAt?: string
  createdAt: string
  updatedAt: string
}
```

### 11.2 `invoices/{invoiceId}` — facturas fiscales B2C/B2B del restaurante

```ts
{
  id: string
  restaurantId: string
  branchId: string
  orderId?: string
  paymentId?: string
  customerId?: string
  number: string                    // serie-fiscal
  series: string
  status: 'draft' | 'issued' | 'void' | 'refunded'
  lines: Array<{ description: string, quantity: number, unitPrice: number, taxRate: number }>
  subtotal: number
  tax: number
  total: number
  currency: string
  issuedAt?: string
  pdfUrl?: string
  createdAt: string
  updatedAt: string
}
```

### 11.3 Billing SaaS (plataforma)

**Campo** `restaurants/{id}.subscription` + subcolección:

`billingInvoices/{invoiceId}`
```ts
{
  id: string
  restaurantId: string
  stripeInvoiceId: string
  stripeCustomerId: string
  planId: string
  status: string
  amountDue: number
  amountPaid: number
  currency: string
  hostedInvoiceUrl?: string
  pdfUrl?: string
  periodStart: string
  periodEnd: string
  createdAt: string
}
```

**Índices**
- payments: `branchId` + `paidAt` DESC
- payments: `orderId`
- invoices: `number` UNIQUE por restaurant (CF)
- billingInvoices: `periodStart` DESC

**Escalabilidad:** payments ≈ orders; no listeners globales. Billing invoices: pocos/mes/tenant.

---

## 12. Clientes, fidelización

### 12.1 `customers/{customerId}`

```ts
{
  id: string
  restaurantId: string
  uid?: string
  name: string
  email?: string
  phone?: string
  birthday?: string
  favorites: string[]
  tags?: string[]
  notes?: string
  marketingOptIn: boolean
  lastVisitAt?: string
  lastBranchId?: string
  totalSpent: number
  visitCount: number
  createdAt: string
  updatedAt: string
}
```

### 12.2 `loyaltyAccounts/{accountId}`

ID: `customerId` (1:1).

```ts
{
  id: string
  restaurantId: string
  customerId: string
  points: number
  tier: 'standard' | 'silver' | 'gold' | 'platinum'
  lifetimePoints: number
  expiresAt?: string
  updatedAt: string
  createdAt: string
}
```

### 12.3 `loyaltyTransactions/{txId}`

```ts
{
  id: string
  restaurantId: string
  branchId?: string | null
  customerId: string
  accountId: string
  type: 'earn' | 'redeem' | 'adjust' | 'expire'
  points: number
  balanceAfter: number
  referenceType?: 'order' | 'promotion' | 'manual'
  referenceId?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}
```

### 12.4 `customerHistory/{entryId}`

Timeline CRM (visitas, notas, promos).

**Índices**
- customers: `email`, `phone` (si búsqueda)
- loyaltyTx: `customerId` + `createdAt` DESC
- customerHistory: `customerId` + `createdAt` DESC

**Escalabilidad:** clientes compartidos entre sucursales (1 ficha). Transacciones append-only archivables.

---

## 13. Reservas — `reservations/{reservationId}`

```ts
{
  id: string
  restaurantId: string
  branchId: string
  customerId?: string | null
  customerName: string
  customerPhone?: string
  customerEmail?: string
  partySize: number
  tableId?: string | null
  startsAt: string
  endsAt: string
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'
  notes?: string
  source?: 'phone' | 'web' | 'walk_in' | 'app'
  reminderSent: boolean
  reminderSentAt?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}
```

**Índices**
- `branchId` + `startsAt`
- `branchId` + `status` + `startsAt`
- `customerId` + `startsAt`

**Escalabilidad:** queries por día/semana y branch; no cargar años en cliente.

---

## 14. Marketing y promociones

### 14.1 `promotions/{promotionId}`
### 14.2 `coupons/{couponId}`
### 14.3 `campaigns/{campaignId}`
### 14.4 `campaignRecipients/{recipientId}`

```ts
// campaignRecipients
{
  id: string
  restaurantId: string
  campaignId: string
  customerId: string
  channel: 'email' | 'whatsapp' | 'push' | 'sms'
  status: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed'
  error?: string
  sentAt?: string
  createdAt: string
  updatedAt: string
}
```

**Índices**
- coupons: `code` UNIQUE por restaurant
- promotions: `status` + `startsAt`
- campaigns: `status` + `scheduledAt`
- recipients: `campaignId` + `status`
- recipients: `customerId` + `createdAt`

**Escalabilidad**
- Recipients puede ser enorme → escribir en batches desde CF; no listeners de colección completa.
- Stats agregadas en `campaigns.stats` (contadores), no count() en caliente.

---

## 15. Empleados

### 15.1 `employees/{employeeId}`
### 15.2 `employeeShifts/{shiftId}`

(Ver `types/employees.ts`.)

**Relaciones:** `uid?` → users/members; `branchIds` → branches; `roleId` → roles.

**Índices**
- `status` + `roleId`
- `branchIds` ARRAY_CONTAINS
- shifts: `branchId` + `startsAt`

**Escalabilidad:** bajo volumen relativo a orders.

---

## 16. Notificaciones

### 16.1 `notifications/{notificationId}`

```ts
{
  id: string
  restaurantId: string
  branchId?: string | null
  uid: string                       // destinatario
  type: 'order' | 'stock' | 'reservation' | 'billing' | 'ai' | 'system' | 'marketing'
  title: string
  body: string
  href?: string
  readAt?: string | null
  data?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
```

### 16.2 `notificationPreferences/{uid}`

```ts
{
  id: string                        // = uid
  restaurantId: string
  uid: string
  channels: { push: boolean, email: boolean, sms: boolean }
  muteTypes?: string[]
  updatedAt: string
  createdAt: string
}
```

**Índices**
- `uid` + `createdAt` DESC
- `uid` + `readAt` (unread: `readAt == null`) — puede requerir campo `isRead: boolean`

**Escalabilidad:** TTL/CF para borrar leídas > 90 días. FCM tokens en `users/{uid}/devices/{deviceId}` (subcolección de user).

### 16.3 `users/{uid}/devices/{deviceId}` (recomendado)

```ts
{
  id: string
  token: string
  platform: 'web' | 'ios' | 'android'
  restaurantIds: string[]
  updatedAt: string
  createdAt: string
}
```

---

## 17. Historial y logs

### 17.1 `historyEvents/{eventId}` — historial de negocio

```ts
{
  id: string
  restaurantId: string
  branchId: string | null
  entityType: string
  entityId: string
  action: string
  summary: string
  actorUid: string | null
  actorRole?: string
  metadata?: Record<string, unknown>
  occurredAt: string
  createdAt: string
  updatedAt: string
}
```

### 17.2 `auditLogs/{logId}` — auditoría seguridad/compliance

```ts
{
  id: string
  restaurantId: string
  branchId: string | null
  action: string
  resourceType: string
  resourceId: string
  actorUid: string
  actorEmail?: string
  actorRole?: string
  before?: object | null
  after?: object | null
  ip?: string
  userAgent?: string
  occurredAt: string
  createdAt: string
  updatedAt: string
}
```

**Reglas:** auditLogs create por CF/admin; **no update/delete** desde cliente.

**Índices**
- history: `entityType` + `occurredAt` DESC
- history: `entityId` + `occurredAt`
- audit: `occurredAt` DESC
- audit: `actorUid` + `occurredAt`

**Escalabilidad:** append-only; retención caliente 90–365 días; export a BigQuery para Enterprise.

---

## 18. IA

### 18.1 `aiSessions/{sessionId}` + `messages/{messageId}`
### 18.2 `aiInsights/{insightId}`
### 18.3 `aiUsage/{periodId}`

```ts
// aiUsage periodId = '2026-07' o stripe period
{
  id: string
  restaurantId: string
  periodStart: string
  periodEnd: string
  queries: number
  tokensPrompt: number
  tokensCompletion: number
  updatedAt: string
  createdAt: string
}
```

**Índices**
- insights: `status` + `createdAt` DESC
- sessions: `createdBy` + `updatedAt` DESC

**Escalabilidad:** mensajes en subcolección; no cargar sesiones enteras. Cupos en `aiUsage` con incrementos atómicos. Coste OpenAI solo en CF.

---

## 19. Subscription snapshot (campo en restaurant)

```ts
{
  planId: 'free' | 'starter' | 'business' | 'pro' | 'enterprise'
  status: 'trialing' | 'active' | 'past_due' | 'unpaid' | 'canceled' | …
  billingInterval: 'month' | 'year'
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripePriceId?: string
  trialStart?: string
  trialEnd?: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd: boolean
  entitlements: string[]
  limits: {
    branches: number
    seats: number
    ordersPerMonth: number
    aiQueriesPerMonth: number
    storageMb: number
  }
  usage: {
    ordersThisPeriod: number
    aiQueriesThisPeriod: number
    emailsThisPeriod: number
    seatsUsed: number
    branchesUsed: number
  }
  upcomingPlanId?: string
}
```

**Escalabilidad:** 1 read/tenant para gating. Usage actualizado por CF en cada pedido/IA/email.

---

## 20. Mapa de relaciones (resumen)

```text
users ─────────────┬──────── members ──── restaurants
                   │              │
                   └──────── employees
                                  │
restaurants ── branches ── tables ── orders ── payments ── invoices
                │              │         │
                │              └──────── orderEvents
                ├── inventoryLevels ── ingredients ←── products.recipe
                ├── reservations ── customers ── loyaltyAccounts ── loyaltyTransactions
                ├── promotions / coupons / campaigns ── campaignRecipients
                ├── notifications
                ├── historyEvents / auditLogs
                └── aiSessions / aiInsights / aiUsage
```

---

## 21. Índices compuestos prioritarios

| Colección | Campos |
|-----------|--------|
| orders | branchId + status + openedAt DESC |
| orders | branchId + paidAt DESC |
| orders | customerId + openedAt DESC |
| tables | branchId + status |
| reservations | branchId + startsAt ASC |
| inventoryLevels | branchId + ingredientId ASC |
| inventoryMovements | branchId + createdAt DESC |
| payments | branchId + paidAt DESC |
| customerHistory | customerId + createdAt DESC |
| loyaltyTransactions | customerId + createdAt DESC |
| orderEvents | orderId + createdAt ASC |
| notifications | uid + createdAt DESC |
| auditLogs | occurredAt DESC |
| historyEvents | entityType + occurredAt DESC |
| campaigns | status + scheduledAt |
| campaignRecipients | campaignId + status |
| aiInsights | status + createdAt DESC |
| employees | status + roleId |
| members | active + roleId |

(Declarados también en `firestore.indexes.json`.)

---

## 22. Estrategia de escalabilidad global

| Técnica | Uso |
|---------|-----|
| Partición natural | Todo bajo `restaurants/{id}/…` |
| Docs estrechos | Contadores en subscription/usage; no arrays infinitos |
| Append-only | movements, events, audit, loyaltyTx, notifications |
| Archivo | orders/movements > 6–12 meses → cold storage |
| Fan-out controlado | notificaciones y campaignRecipients vía CF batches |
| Idempotencia | payments.externalRef, inventoryLevel id compuesto, webhook event ids |
| Lecturas | listeners solo sobre “abiertos” (KDS/POS); históricos con query acotada |
| Rules | member + branchIds; audit/billing write server-only |

---

## 23. Checklist de colecciones (absolutas)

| # | Colección | Scope |
|---|-----------|-------|
| 1 | users | root |
| 2 | roles | root (sistema) |
| 3 | permissions | root |
| 4 | restaurants | root / tenant |
| 5 | branches | tenant |
| 6 | members | tenant |
| 7 | roles (custom) | tenant |
| 8 | roleBindings | tenant |
| 9 | settings | tenant |
| 10 | configHistory | tenant |
| 11 | tables | tenant + branch |
| 12 | categories | tenant |
| 13 | products | tenant |
| 14 | ingredients | tenant |
| 15 | inventoryLevels | tenant + branch |
| 16 | inventoryMovements | tenant + branch |
| 17 | suppliers | tenant |
| 18 | purchases | tenant + branch |
| 19 | waste | tenant + branch |
| 20 | customers | tenant |
| 21 | customerHistory | tenant |
| 22 | loyaltyAccounts | tenant |
| 23 | loyaltyTransactions | tenant |
| 24 | reservations | tenant + branch |
| 25 | promotions | tenant |
| 26 | coupons | tenant |
| 27 | campaigns | tenant |
| 28 | campaignRecipients | tenant |
| 29 | orders | tenant + branch |
| 30 | orderEvents | tenant + branch |
| 31 | payments | tenant + branch |
| 32 | invoices | tenant + branch |
| 33 | billingInvoices | tenant (SaaS) |
| 34 | employees | tenant |
| 35 | employeeShifts | tenant + branch |
| 36 | notifications | tenant |
| 37 | notificationPreferences | tenant |
| 38 | users/{uid}/devices | user |
| 39 | historyEvents | tenant |
| 40 | auditLogs | tenant |
| 41 | aiSessions | tenant |
| 42 | aiSessions/{id}/messages | tenant |
| 43 | aiInsights | tenant |
| 44 | aiUsage | tenant |

---

## 24. Fuera de Firestore (recomendado)

| Dato | Dónde |
|------|--------|
| Imágenes productos | Firebase Storage |
| Secretos Stripe/SumUp | Secret Manager / env CF |
| Analytics masivo | BigQuery export |
| Búsqueda full-text clientes | Extension Algolia/Typesense (opcional) |
| Cola campañas | Cloud Tasks |

---

*Documento de arquitectura. No incluye pantallas ni implementación de servicios.*
