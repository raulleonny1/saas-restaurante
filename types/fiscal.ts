import type { ISODateString, Timestamps } from "./common";
import type { CurrencyCode } from "./common";

/**
 * Verifactu / factura simplificada (ES).
 * Cadena de hash local lista para envío AEAT cuando haya certificado.
 */
export type FiscalDocumentKind = "factura_simplificada" | "factura" | "rectificativa";

export type FiscalDocumentStatus =
  | "issued"
  | "queued_aeat"
  | "accepted"
  | "rejected"
  | "void";

export interface FiscalDocument extends Timestamps {
  id: string;
  restaurantId: string;
  branchId: string;
  orderId: string;
  paymentId?: string;
  kind: FiscalDocumentKind;
  status: FiscalDocumentStatus;
  /** Serie + número, ej. FS-2026-000042 */
  series: string;
  number: number;
  fullNumber: string;
  issuedAt: ISODateString;
  /** Importe base imponible. */
  taxBase: number;
  taxAmount: number;
  total: number;
  taxPercent: number;
  currency: CurrencyCode;
  /** Hash SHA-256 del registro (encadenado). */
  recordHash: string;
  /** Hash del documento anterior en la cadena (o genesis). */
  previousHash: string;
  /** Payload QR Verifactu (URL o JSON). */
  qrPayload: string;
  /** NIF emisor (restaurante). */
  issuerTaxId?: string;
  issuerName?: string;
  /** Simulado hasta certificado AEAT. */
  aeatSimulated: boolean;
  aeatSubmissionId?: string;
}
