"use client";

import { getDb } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import type { FiscalDocument } from "@/types/fiscal";
import type { Order, Payment } from "@/types/orders";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

function nowIso() {
  return new Date().toISOString();
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text),
    );
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback simple (no criptográfico fuerte) si subtle no está
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return `fallback_${Math.abs(h).toString(16)}_${text.length}`;
}

/**
 * Emite factura simplificada encadenada (Verifactu-ready).
 * Sin certificado AEAT → aeatSimulated: true; queda en cola local.
 */
export async function issueSimplifiedInvoice(input: {
  restaurantId: string;
  order: Order;
  payment: Payment;
  taxPercent: number;
  issuerTaxId?: string;
  issuerName?: string;
}): Promise<FiscalDocument> {
  const { restaurantId, order, payment, taxPercent } = input;
  const stamp = nowIso();
  const year = new Date(stamp).getFullYear();
  const series = `FS-${year}`;

  const prevQ = query(
    collection(getDb(), "restaurants", restaurantId, "fiscalDocuments"),
    where("series", "==", series),
    orderBy("number", "desc"),
    limit(1),
  );
  let previousHash = "GENESIS";
  let number = 1;
  try {
    const prevSnap = await getDocs(prevQ);
    const prev = prevSnap.docs[0]?.data() as FiscalDocument | undefined;
    if (prev) {
      previousHash = prev.recordHash;
      number = (prev.number || 0) + 1;
    }
  } catch {
    // Índice compuesto pendiente: numeración por timestamp
    number = Date.now() % 100000;
  }

  const fullNumber = `${series}-${String(number).padStart(6, "0")}`;
  const taxBase = Math.round((payment.amount / (1 + taxPercent / 100)) * 100) / 100;
  const taxAmount = Math.round((payment.amount - taxBase) * 100) / 100;

  const payloadCore = {
    fullNumber,
    orderId: order.id,
    paymentId: payment.id,
    total: payment.amount,
    taxBase,
    taxAmount,
    taxPercent,
    issuedAt: stamp,
    previousHash,
  };
  const recordHash = await sha256Hex(JSON.stringify(payloadCore));

  // QR Verifactu: URL AEAT o payload local hasta certificación
  const qrPayload = process.env.NEXT_PUBLIC_VERIFACTU_QR_BASE
    ? `${process.env.NEXT_PUBLIC_VERIFACTU_QR_BASE}?nif=${encodeURIComponent(input.issuerTaxId || "")}&num=${encodeURIComponent(fullNumber)}&total=${payment.amount}&fecha=${stamp.slice(0, 10)}&huella=${recordHash.slice(0, 16)}`
    : JSON.stringify({
        nif: input.issuerTaxId || "",
        num: fullNumber,
        total: payment.amount,
        fecha: stamp.slice(0, 10),
        huella: recordHash.slice(0, 16),
      });

  const id = `fisc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const docRow: FiscalDocument = {
    id,
    restaurantId,
    branchId: order.branchId,
    orderId: order.id,
    paymentId: payment.id,
    kind: "factura_simplificada",
    status: "issued",
    series,
    number,
    fullNumber,
    issuedAt: stamp,
    taxBase,
    taxAmount,
    total: payment.amount,
    taxPercent,
    currency: order.currency,
    recordHash,
    previousHash,
    qrPayload,
    issuerTaxId: input.issuerTaxId,
    issuerName: input.issuerName,
    aeatSimulated: !process.env.NEXT_PUBLIC_VERIFACTU_CERTIFIED,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const batch = writeBatch(getDb());
  batch.set(
    doc(getDb(), "restaurants", restaurantId, "fiscalDocuments", id),
    stripUndefined({ ...docRow }),
  );
  batch.update(
    doc(getDb(), "restaurants", restaurantId, "payments", payment.id),
    { fiscalDocumentId: id, updatedAt: stamp },
  );
  await batch.commit();
  return docRow;
}
