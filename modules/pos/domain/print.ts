import { formatCurrency } from "@/lib/format";
import { lineTotal } from "@/modules/pos/domain/totals";
import type { Order, Payment } from "@/types/orders";

/** Opens a print-friendly receipt (browser print dialog). */
export function printOrderReceipt(
  order: Order,
  payments: Payment[] = [],
  restaurantName = "SmartServe",
): void {
  if (typeof window === "undefined") return;

  const lines = order.items
    .map((item) => {
      const mods =
        item.modifiers?.map((m) => `  + ${m.name}`).join("<br/>") ?? "";
      const variant = item.variantName ? ` (${item.variantName})` : "";
      const notes =
        item.kitchenNotes || item.notes
          ? `<div class="muted">Nota: ${item.kitchenNotes || item.notes}</div>`
          : "";
      return `<tr>
        <td>${item.quantity}× ${item.name}${variant}${mods ? `<br/>${mods}` : ""}${notes}</td>
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
      return `<tr><td>${p.method}${p.status === "refunded" ? " (reembolso)" : ""}${cashExtra}</td>
         <td class="right">${formatCurrency(p.amount, order.currency)}</td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Ticket ${order.tableName ?? order.id}</title>
    <style>
      body{font-family:ui-monospace,monospace;font-size:12px;padding:16px;color:#111}
      h1{font-size:16px;margin:0 0 4px}
      .muted{color:#666;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      td{padding:4px 0;vertical-align:top}
      .right{text-align:right}
      .total{font-weight:700;font-size:14px;border-top:1px dashed #999;padding-top:8px}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>${restaurantName}</h1>
    <div class="muted">${order.tableName ?? "Barra"} · ${order.channel.toUpperCase()}</div>
    <div class="muted">${new Date(order.openedAt).toLocaleString("es-ES")}</div>
    <div class="muted">#${order.id.slice(0, 8)}</div>
    <table>${lines}</table>
    <table>
      <tr><td>Subtotal</td><td class="right">${formatCurrency(order.subtotal, order.currency)}</td></tr>
      <tr><td>Descuento</td><td class="right">-${formatCurrency(order.discountAmount, order.currency)}</td></tr>
      <tr><td>IVA</td><td class="right">${formatCurrency(order.taxAmount, order.currency)}</td></tr>
      <tr><td>Propina</td><td class="right">${formatCurrency(order.tipAmount, order.currency)}</td></tr>
      <tr class="total"><td>TOTAL</td><td class="right">${formatCurrency(order.total, order.currency)}</td></tr>
      ${payRows}
    </table>
    <p class="muted" style="margin-top:16px">Gracias por su visita</p>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;

  // Blob URL evita about:blank vacío (noopener / móvil bloquean document.write)
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    // Popup bloqueado: imprimir en iframe oculto
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        iframe.remove();
      }, 60_000);
    };
    return;
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
