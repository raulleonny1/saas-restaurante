import type { CurrencyCode, ISODateString, SoftDelete, Timestamps } from "./common";

export type OrderStatus =
  | "open"
  | "sent"
  | "preparing"
  | "ready"
  | "delivered"
  | "paid"
  | "cancelled";

export type OrderChannel = "pos" | "qr" | "delivery" | "takeaway" | "online";

export type TableStatus = "available" | "occupied" | "reserved" | "dirty";

export type PaymentMethod = "cash" | "card" | "stripe" | "sumup" | "other";

export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

/** Origen del cobro: sala (mesero), caja o POS admin. */
export type PaymentChargedFrom = "waiter" | "caja" | "pos";

export interface Table extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  branchId: string;
  name: string;
  seats: number;
  status: TableStatus;
  x: number;
  y: number;
  currentOrderId?: string | null;
  mergedWith?: string[];
  zone?: string;
}

export interface OrderItemModifier {
  id: string;
  groupId: string;
  name: string;
  priceDelta: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Line notes visible on kitchen ticket. */
  notes?: string;
  kitchenNotes?: string;
  status: OrderStatus;
  sentAt?: ISODateString;
  /** When kitchen moved item to preparing. */
  startedAt?: ISODateString;
  readyAt?: ISODateString;
  deliveredAt?: ISODateString;
  variantId?: string;
  variantName?: string;
  modifiers?: OrderItemModifier[];
  /** Seat / split bucket id when dividing the check. */
  splitSeat?: number;
  /** Optional station override stamped at send time. */
  kitchenStation?: "bar" | "cocina" | "postres" | "bebidas";
}

export interface OrderSplitSeat {
  seat: number;
  label: string;
  /** Amount already settled for this seat (multi-tender splits). */
  paidAmount?: number;
}

export interface Order extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  branchId: string;
  tableId?: string | null;
  tableName?: string;
  /** Secondary tables merged into this check. */
  mergedTableIds?: string[];
  customerId?: string | null;
  /** Auth uid when order comes from the customer app. */
  customerUid?: string | null;
  channel: OrderChannel;
  items: OrderItem[];
  status: OrderStatus;
  discountPercent: number;
  discountAmount: number;
  tipPercent: number;
  tipAmount: number;
  taxAmount: number;
  subtotal: number;
  total: number;
  /** Amount already paid (partial / split tenders). */
  amountPaid: number;
  currency: CurrencyCode;
  promotionId?: string | null;
  couponCode?: string | null;
  splitParts?: number;
  splitSeats?: OrderSplitSeat[];
  guestCount: number;
  openedAt: ISODateString;
  sentAt?: ISODateString;
  paidAt?: ISODateString;
  cancelledAt?: ISODateString;
  refundedAt?: ISODateString;
  createdBy: string;
  servedBy?: string;
  notes?: string;
  printCount?: number;
  lastPrintedAt?: ISODateString;
  /** Cocina pulsa «Avisar mesero» → el mesero ve aviso flotante + sonido. */
  waiterAlertAt?: ISODateString;
  waiterAlertBody?: string;
}

export interface Payment extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: CurrencyCode;
  tipAmount: number;
  externalRef?: string;
  processedBy: string;
  /** Nombre visible de quien cobró (mesero/cajero). */
  processedByName?: string;
  /** Dónde se cobró: sala, caja o POS. El archivo de mesero incluye todos. */
  chargedFrom?: PaymentChargedFrom;
  paidAt?: ISODateString;
  /** Seat index when paying a split check. */
  splitSeat?: number;
  /** Original payment id when this row is a refund. */
  refundOfPaymentId?: string;
  /** Positive amount refunded (payment rows with status refunded / refund type). */
  refundAmount?: number;
  /** Efectivo que entregó el cliente (para calcular cambio). */
  amountTendered?: number;
  /** Cambio devuelto = max(0, amountTendered − amount). */
  changeGiven?: number;
}

/** Immutable-ish timeline for an order (historial de pedido). */
export interface OrderEvent extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string;
  orderId: string;
  type: string;
  fromStatus?: OrderStatus;
  toStatus?: OrderStatus;
  actorUid: string;
  payload?: Record<string, unknown>;
}
