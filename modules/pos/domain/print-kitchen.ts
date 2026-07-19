import { isDrinkStation } from "@/modules/kitchen/domain/stations";
import type { Order, OrderItem } from "@/types/orders";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openPrintHtml(html: string, title: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.title = title;
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

function renderItem(item: OrderItem): string {
  const variant = item.variantName ? ` (${escapeHtml(item.variantName)})` : "";
  const mods =
    item.modifiers?.map((m) => `<div class="mod">+ ${escapeHtml(m.name)}</div>`).join("") ??
    "";
  const notes =
    item.kitchenNotes || item.notes
      ? `<div class="note">※ ${escapeHtml(item.kitchenNotes || item.notes || "")}</div>`
      : "";
  return `<div class="line">
    <div class="qty">${item.quantity}×</div>
    <div class="name">${escapeHtml(item.name)}${variant}${mods}${notes}</div>
  </div>`;
}

/**
 * Ticket de cocina 80mm para impresora térmica (driver del sistema / red).
 * Solo incluye los ítems pasados en `order.items` (normalmente los recién enviados).
 */
export function printKitchenTicket(
  order: Order,
  opts: {
    restaurantName?: string;
    /** Si se indica, solo imprime esa estación; si no, separa comida/barra. */
    station?: "cocina" | "bar";
  } = {},
): void {
  const restaurantName = opts.restaurantName ?? "SmartServe";
  const active = order.items.filter((i) => i.status !== "cancelled");
  if (!active.length) return;

  const food = active.filter(
    (i) => !i.kitchenStation || !isDrinkStation(i.kitchenStation),
  );
  const drinks = active.filter(
    (i) => i.kitchenStation && isDrinkStation(i.kitchenStation),
  );

  let sections: { title: string; items: OrderItem[] }[] = [];
  if (opts.station === "bar") {
    sections = [{ title: "BARRA", items: drinks.length ? drinks : active }];
  } else if (opts.station === "cocina") {
    sections = [{ title: "COCINA", items: food.length ? food : active }];
  } else {
    if (food.length) sections.push({ title: "COCINA", items: food });
    if (drinks.length) sections.push({ title: "BARRA", items: drinks });
    if (!sections.length) sections = [{ title: "COMANDA", items: active }];
  }

  const body = sections
    .map(
      (s) => `
      <div class="sec">${escapeHtml(s.title)}</div>
      ${s.items.map(renderItem).join("")}
    `,
    )
    .join('<div class="dash"></div>');

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Cocina ${escapeHtml(order.tableName ?? order.id.slice(0, 8))}</title>
    <style>
      @page{margin:0;size:80mm auto}
      body{
        font-family:ui-monospace,Consolas,monospace;
        font-size:13px;line-height:1.25;color:#000;
        width:72mm;margin:0 auto;padding:4mm 3mm;
      }
      h1{font-size:15px;margin:0 0 2px;text-align:center;text-transform:uppercase}
      .meta{text-align:center;font-size:12px;margin-bottom:6px}
      .big{font-size:18px;font-weight:700;text-align:center;margin:6px 0}
      .sec{font-weight:700;border-top:1px dashed #000;border-bottom:1px dashed #000;
        padding:3px 0;margin:8px 0 4px;text-align:center;letter-spacing:.04em}
      .line{display:flex;gap:6px;margin:4px 0;align-items:flex-start}
      .qty{font-weight:700;min-width:1.6em}
      .name{flex:1}
      .mod,.note{font-size:11px;margin-top:1px}
      .note{font-weight:700}
      .dash{border-top:1px dashed #000;margin:6px 0}
      .foot{text-align:center;font-size:10px;margin-top:10px}
      @media print{body{padding:2mm}}
    </style></head><body>
    <h1>${escapeHtml(restaurantName)}</h1>
    <div class="meta">COMANDA · ${new Date().toLocaleString("es-ES")}</div>
    <div class="big">Mesa ${escapeHtml(order.tableName || "—")}</div>
    <div class="meta">#${escapeHtml(order.id.slice(0, 10))} · ${escapeHtml(order.channel)}</div>
    ${body}
    <div class="foot">— fin comanda —</div>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;

  openPrintHtml(html, `Cocina ${order.tableName ?? ""}`);
}
