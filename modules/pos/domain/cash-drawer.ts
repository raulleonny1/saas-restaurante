import {
  kickCashDrawer,
  type CashDrawerKickResult,
} from "@/lib/print-bridge-client";
import type { PrinterStationConfig } from "@/types/restaurant";

/**
 * Abre el cajón portamonedas tradicional (cable RJ11 en la impresora TPV)
 * enviando el pulso ESC/POS vía el asistente local.
 */
export async function openCashDrawer(
  tpv: PrinterStationConfig | undefined,
  opts?: { force?: boolean },
): Promise<CashDrawerKickResult> {
  if (!opts?.force && !tpv?.openDrawerOnCash) {
    return { ok: false, reason: "disabled" };
  }
  const printer = tpv?.systemName?.trim();
  if (!printer) {
    return {
      ok: false,
      reason: "no_printer",
      message:
        "Elige la impresora de ventas (TPV) en Impresoras. El cajón va cableado a esa impresora.",
    };
  }
  return kickCashDrawer({
    printerName: printer,
    pin: tpv?.drawerPin === 1 ? 1 : 0,
  });
}
