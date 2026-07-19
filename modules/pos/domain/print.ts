import { formatCurrency } from "@/lib/format";
import { lineTotal } from "@/modules/pos/domain/totals";
import {
  escapeHtml,
  openPrintHtml,
  printerHintHtml,
  thermalPageCss,
} from "@/modules/pos/domain/print-shared";
import type { Order, Payment } from "@/types/orders";
import type { ThermalPaperWidth } from "@/types/restaurant";

export type PrintReceiptOptions = {
  restaurantName?: string;
  paperWidthMm?: ThermalPaperWidth;
  /** Nombre de la impresora en el SO (ayuda en pantalla previa). */
  printerSystemName?: string;
  printerLabel?: string;
};

function resolveOpts(
  restaurantNameOrOpts: string | PrintReceiptOptions = "SmartServe",
): Required<
  Pick<PrintReceiptOptions, "restaurantName" | "paperWidthMm" | "printerLabel">
> &
  PrintReceiptOptions {
  if (typeof restaurantNameOrOpts === "string") {
    return {
      restaurantName: restaurantNameOrOpts,
      paperWidthMm: 80,
      printerLabel: "TPV · ticket cliente",
    };
  }
  return {
    restaurantName: restaurantNameOrOpts.restaurantName ?? "SmartServe",
    paperWidthMm: restaurantNameOrOpts.paperWidthMm ?? 80,
    printerSystemName: restaurantNameOrOpts.printerSystemName,
    printerLabel:
      restaurantNameOrOpts.printerLabel ?? "TPV · ticket cliente",
  };
}

/** Ticket de cliente / TPV (térmico 58 o 80 mm). */
export function printOrderReceipt(
  order: Order,
  payments: Payment[] = [],
  restaurantNameOrOpts: string | PrintReceiptOptions = "SmartServe",
): void {
  if (typeof window === "undefined") return;

  const opts = resolveOpts(restaurantNameOrOpts);
  const name = escapeHtml(opts.restaurantName);
  const mm = opts.paperWidthMm;

  const lines = order.items
    .filter((i) => i.status !== "cancelled")
    .map((item) => {
      const mods =
        item.modifiers
          ?.map((m) => `<div class="mod">+ ${escapeHtml(m.name)}</div>`)
          .join("") ?? "";
      const variant = item.variantName
        ? ` (${escapeHtml(item.variantName)})`
        : "";
      const notes =
        item.kitchenNotes || item.notes
          ? `<div class="mod">Nota: ${escapeHtml(item.kitchenNotes || item.notes || "")}</div>`
          : "";
      return `<tr>
        <td class="item">${item.quantity}× ${escapeHtml(item.name)}${variant}${mods}${notes}</td>
        <td class="right">${formatCurrency(lineTotal(item), order.currency)}</td>
      </tr>`;
    })
    .join("");

  const payRows = payments
    .filter((p) => p.status === "completed" || p.status === "refunded")
    .map((p) => {
      const cashExtra =
        p.amountTendered != null
          ? ` · entregó ${formatCurrency(p.amountTendered, order.currency)}${
              p.changeGiven != null
                ? ` · cambio ${formatCurrency(p.changeGiven, order.currency)}`
                : ""
            }`
          : "";
      const label = `${escapeHtml(p.method)}${p.status === "refunded" ? " (reembolso)" : ""}${cashExtra}`;
      return `<tr><td>${label}</td>
         <td class="right">${formatCurrency(p.amount, order.currency)}</td></tr>`;
    })
    .join("");

  const tableLabel = escapeHtml(order.tableName ?? "Barra");
  const when = new Date(order.paidAt || order.openedAt).toLocaleString("es-ES");

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Ticket ${tableLabel}</title>
    <style>
      ${thermalPageCss(mm)}
      .brand{text-align:center;margin:0 0 2px}
      .brand h1{font-size:${mm === 58 ? 14 : 16}px;margin:0;letter-spacing:.06em;
        text-transform:uppercase;font-weight:700}
      .sub{text-align:center;font-size:${mm === 58 ? 10 : 11}px;color:#333}
      .mesa{text-align:center;font-size:${mm === 58 ? 13 : 15}px;font-weight:700;margin:6px 0 2px}
      table{width:100%;border-collapse:collapse;margin-top:4px}
      td{padding:3px 0;vertical-align:top}
      .item{padding-right:6px}
      .right{text-align:right;white-space:nowrap}
      .mod{font-size:${mm === 58 ? 10 : 11}px;color:#333;margin-top:1px}
      .totals td{padding:2px 0}
      .total td{font-weight:700;font-size:${mm === 58 ? 13 : 15}px;padding-top:6px}
      .thanks{text-align:center;margin-top:12px;font-size:${mm === 58 ? 10 : 11}px}
      .foot{text-align:center;font-size:10px;color:#444;margin-top:4px}
    </style></head><body>
    ${printerHintHtml({
      roleLabel: opts.printerLabel,
      systemName: opts.printerSystemName,
    })}
    <div class="brand"><h1>${name}</h1></div>
    <div class="sub">Ticket de cliente</div>
    <hr class="rule"/>
    <div class="mesa">${tableLabel}</div>
    <div class="sub">${when}</div>
    <div class="sub">#${escapeHtml(order.id.slice(0, 10))} · ${escapeHtml(order.channel.toUpperCase())}</div>
    <hr class="rule-d"/>
    <table>${lines}</table>
    <hr class="rule"/>
    <table class="totals">
      <tr><td>Subtotal</td><td class="right">${formatCurrency(order.subtotal, order.currency)}</td></tr>
      ${
        order.discountAmount > 0
          ? `<tr><td>Descuento</td><td class="right">-${formatCurrency(order.discountAmount, order.currency)}</td></tr>`
          : ""
      }
      <tr><td>IVA</td><td class="right">${formatCurrency(order.taxAmount, order.currency)}</td></tr>
      ${
        order.tipAmount > 0
          ? `<tr><td>Propina</td><td class="right">${formatCurrency(order.tipAmount, order.currency)}</td></tr>`
          : ""
      }
      <tr class="total"><td>TOTAL</td><td class="right">${formatCurrency(order.total, order.currency)}</td></tr>
      ${payRows}
    </table>
    <hr class="rule-d"/>
    <p class="thanks">Gracias por su visita</p>
    <p class="foot">— SmartServe —</p>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;

  openPrintHtml(html, `Ticket ${order.tableName ?? order.id.slice(0, 8)}`);
}

/** Ticket de prueba para configurar la impresora TPV. */
export function printTpvTestPage(opts: PrintReceiptOptions = {}): void {
  const o = resolveOpts(opts);
  const name = escapeHtml(o.restaurantName);
  const mm = o.paperWidthMm;
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Prueba TPV</title>
    <style>
      ${thermalPageCss(mm)}
      h1{font-size:15px;text-align:center;margin:0;text-transform:uppercase}
      .ok{text-align:center;font-size:18px;font-weight:700;margin:14px 0}
      .sub{text-align:center;font-size:11px}
    </style></head><body>
    ${printerHintHtml({
      roleLabel: o.printerLabel,
      systemName: o.printerSystemName,
    })}
    <h1>${name}</h1>
    <hr class="rule"/>
    <div class="ok">PRUEBA TPV</div>
    <div class="sub">Ticket cliente · ${mm} mm</div>
    <div class="sub">${new Date().toLocaleString("es-ES")}</div>
    <hr class="rule-d"/>
    <div class="sub">Si lees esto, la impresora TPV está lista.</div>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;
  openPrintHtml(html, "Prueba TPV");
}
