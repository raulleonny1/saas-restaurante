"use client";

import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { usePos } from "@/modules/pos/context/PosProvider";
import { QrScanner } from "@/modules/waiter/components/QrScanner";
import { encodeTableQr } from "@/modules/waiter/domain/qr";
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
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Escanear QR
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Abre la mesa al instante desde el código de la sala.
        </p>
      </div>

      <QrScanner onDetect={onDetect} />

      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      {last ? (
        <p className="text-sm text-emerald-300">Última: mesa {last}</p>
      ) : null}

      {selected ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-[#a8b5a4]">
          <p className="font-medium text-[#e7efe4]">
            QR de mesa {selected.name}
          </p>
          <p className="mt-1 break-all font-mono text-[11px]">
            {encodeTableQr(selected.id)}
          </p>
          <p className="mt-2">
            Imprime este valor como QR en la mesa (o usa el id directamente).
          </p>
        </div>
      ) : null}
    </div>
  );
}
