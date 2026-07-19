"use client";

import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { usePos } from "@/modules/pos/context/PosProvider";
import { QrScanner } from "@/modules/waiter/components/QrScanner";
import { encodeTableQr } from "@/modules/waiter/domain/qr";
import { ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export function WaiterQrPage() {
  const router = useRouter();
  const routes = useFloorRoutes();
  const { tables, selectTable, selectedTableId } = usePos();
  const [last, setLast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDetect = useCallback(
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId);
      if (!table) {
        setError(`Mesa no encontrada (${tableId})`);
        return;
      }
      setError(null);
      setLast(table.name);
      selectTable(table.id);
      router.push(routes.order);
    },
    [tables, selectTable, router, routes.order],
  );

  const selected = tables.find((t) => t.id === selectedTableId);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/80">
          Acceso rápido
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Escanear QR
        </h1>
        <p className="mt-1 text-sm text-[#a8b5a4]">
          Abre la mesa al instante desde el código de la sala.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-1 shadow-lg shadow-black/20">
        <QrScanner onDetect={onDetect} />
      </div>

      {error ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2.5 text-sm text-amber-200">
          {error}
        </p>
      ) : null}
      {last ? (
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-300">
          <ScanLine className="h-3.5 w-3.5" />
          Última: mesa {last}
        </p>
      ) : null}

      {selected ? (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4 text-xs text-[#a8b5a4]">
          <p className="text-sm font-semibold text-[#e7efe4]">
            QR de mesa {selected.name}
          </p>
          <p className="mt-2 break-all rounded-xl bg-black/30 px-3 py-2 font-mono text-[11px] text-[#c5d0c2]">
            {encodeTableQr(selected.id)}
          </p>
          <p className="mt-2 leading-relaxed">
            Imprime este valor como QR en la mesa (o usa el id directamente).
          </p>
        </div>
      ) : null}
    </div>
  );
}
