import { isDrinkStation } from "@/modules/kitchen/domain/stations";
import {
  escapeHtml,
  openPrintHtml,
  printerHintHtml,
  thermalPageCss,
} from "@/modules/pos/domain/print-shared";
import type { Order, OrderItem } from "@/types/orders";
import type { ThermalPaperWidth } from "@/types/restaurant";

function renderItem(item: OrderItem): string {
  const variant = item.variantName
    ? ` (${escapeHtml(item.variantName)})`
    : "";
  const mods =
    item.modifiers
      ?.map((m) => `<div class="mod">+ ${escapeHtml(m.name)}</div>`)
      .join("") ?? "";
  const notes =
    item.kitchenNotes || item.notes
      ? `<div class="note">※ ${escapeHtml(item.kitchenNotes || item.notes || "")}</div>`
      : "";
  return `<div class="line">
    <div class="qty">${item.quantity}×</div>
    <div class="name">${escapeHtml(item.name)}${variant}${mods}${notes}</div>
  </div>`;
}

export type PrintKitchenOptions = {
  restaurantName?: string;
  /** Si se indica, solo imprime esa estación; si no, separa comida/barra. */
  station?: "cocina" | "bar";
  paperWidthMm?: ThermalPaperWidth;
  printerSystemName?: string;
  printerLabel?: string;
};

/**
 * Comanda de cocina/barra para impresora térmica (driver del sistema / red).
 * Solo incluye los ítems pasados en `order.items` (normalmente los recién enviados).
 */
export function printKitchenTicket(
  order: Order,
  opts: PrintKitchenOptions = {},
): void {
  const restaurantName = opts.restaurantName ?? "SmartServe";
  const mm = opts.paperWidthMm ?? 80;
  const printerLabel = opts.printerLabel ?? "Cocina · comanda";
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

  const narrow = mm === 58;
  const body = sections
    .map(
      (s) => `
      <div class="sec">${escapeHtml(s.title)}</div>
      ${s.items.map(renderItem).join("")}
    `,
    )
    .join('<hr class="rule"/>');

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Cocina ${escapeHtml(order.tableName ?? order.id.slice(0, 8))}</title>
    <style>
      ${thermalPageCss(mm)}
      h1{font-size:${narrow ? 13 : 15}px;margin:0 0 2px;text-align:center;
        text-transform:uppercase;letter-spacing:.05em}
      .meta{text-align:center;font-size:${narrow ? 10 : 12}px;margin-bottom:4px}
      .big{font-size:${narrow ? 16 : 20}px;font-weight:700;text-align:center;margin:8px 0 4px}
      .sec{font-weight:700;border-top:1px dashed #000;border-bottom:1px dashed #000;
        padding:4px 0;margin:8px 0 4px;text-align:center;letter-spacing:.08em;
        font-size:${narrow ? 12 : 13}px}
      .line{display:flex;gap:6px;margin:5px 0;align-items:flex-start}
      .qty{font-weight:700;min-width:1.8em;font-size:${narrow ? 13 : 15}px}
      .name{flex:1;font-size:${narrow ? 12 : 14}px;font-weight:600}
      .mod,.note{font-size:${narrow ? 10 : 11}px;margin-top:2px;font-weight:400}
      .note{font-weight:700}
      .foot{text-align:center;font-size:10px;margin-top:12px}
    </style></head><body>
    ${printerHintHtml({
      roleLabel: printerLabel,
      systemName: opts.printerSystemName,
    })}
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

/** Comanda de prueba para configurar la impresora de cocina. */
export function printKitchenTestPage(opts: PrintKitchenOptions = {}): void {
  const restaurantName = opts.restaurantName ?? "SmartServe";
  const mm = opts.paperWidthMm ?? 80;
  const printerLabel = opts.printerLabel ?? "Cocina · comanda";
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Prueba cocina</title>
    <style>
      ${thermalPageCss(mm)}
      h1{font-size:15px;text-align:center;margin:0;text-transform:uppercase}
      .ok{text-align:center;font-size:18px;font-weight:700;margin:14px 0}
      .sub{text-align:center;font-size:11px}
      .line{display:flex;gap:6px;margin:6px 0;font-weight:600}
      .qty{min-width:1.8em}
    </style></head><body>
    ${printerHintHtml({
      roleLabel: printerLabel,
      systemName: opts.printerSystemName,
    })}
    <h1>${escapeHtml(restaurantName)}</h1>
    <hr class="rule"/>
    <div class="ok">PRUEBA COCINA</div>
    <div class="sub">Comanda · ${mm} mm</div>
    <div class="sub">${new Date().toLocaleString("es-ES")}</div>
    <div class="sec" style="text-align:center;font-weight:700;margin:10px 0;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0">COCINA</div>
    <div class="line"><div class="qty">1×</div><div>Plato de prueba</div></div>
    <div class="line"><div class="qty">2×</div><div>Bebida de prueba</div></div>
    <hr class="rule-d"/>
    <div class="sub">Si lees esto, la impresora de cocina está lista.</div>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;
  openPrintHtml(html, "Prueba cocina");
}
