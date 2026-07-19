"use client";

import { formatCurrency } from "@/lib/format";
import { usePos } from "@/modules/pos/context/PosProvider";
import { useState } from "react";

export function WaiterHistoryPage() {
  const { historyOrders, openOrders, currency } = usePos();
  const [tab, setTab] = useState<"cerrados" | "abiertos">("cerrados");
  const rows = tab === "cerrados" ? historyOrders : openOrders;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Historial
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Consulta tickets abiertos y cerrados.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setTab("cerrados")}
          className={`rounded-lg py-2 text-sm ${
            tab === "cerrados" ? "bg-emerald-700" : "text-[#a8b5a4]"
          }`}
        >
          Cerrados
        </button>
        <button
          type="button"
          onClick={() => setTab("abiertos")}
          className={`rounded-lg py-2 text-sm ${
            tab === "abiertos" ? "bg-emerald-700" : "text-[#a8b5a4]"
          }`}
        >
          Abiertos
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map((o) => (
          <li
            key={o.id}
            className="rounded-xl border border-white/10 px-3 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{o.tableName ?? "Sin mesa"}</p>
              <span className="text-[11px] uppercase text-[#8fa08c]">
                {o.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-emerald-300">
              {formatCurrency(o.total, currency)}
            </p>
            <p className="mt-0.5 text-[11px] text-[#5a6b57]">
              {new Date(o.updatedAt || o.createdAt).toLocaleString("es-ES")} ·{" "}
              {o.items.length} ítems
            </p>
          </li>
        ))}
        {!rows.length ? (
          <li className="py-10 text-center text-sm text-[#8fa08c]">
            Sin registros.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
