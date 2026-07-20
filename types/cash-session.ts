import type { ISODateString, Timestamps } from "./common";
import type { CurrencyCode } from "./common";

/** Sesión de caja (apertura → arqueo → cierre Z). */
export type CashSessionStatus = "open" | "closing" | "closed";

export interface CashSession extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string;
  status: CashSessionStatus;
  openedAt: ISODateString;
  openedBy: string;
  openedByName?: string;
  /** Fondo de caja al abrir. */
  openingFloat: number;
  currency: CurrencyCode;
  closedAt?: ISODateString;
  closedBy?: string;
  closedByName?: string;
  /** Efectivo contado en el arqueo. */
  countedCash?: number;
  /** Efectivo esperado = float + cobros cash − cambio − retiradas. */
  expectedCash?: number;
  /** counted − expected */
  difference?: number;
  /** Totales acumulados al cerrar (snapshot). */
  totals?: {
    cashSales: number;
    cardSales: number;
    stripeSales: number;
    sumupSales: number;
    otherSales: number;
    tips: number;
    refunds: number;
    tickets: number;
  };
  notes?: string;
  zNumber?: number;
}
