"use client";

import { useKitchen } from "@/modules/kitchen/context/KitchenProvider";
import { Button, toast } from "@/ui";
import { BellRing } from "lucide-react";
import { useMemo, useState } from "react";

/** Acceso rápido: un botón por mesa activa para avisar al mesero. */
export function ActiveTablesAlertBar() {
  const { tickets, alertWaiter } = useKitchen();
  const [busyId, setBusyId] = useState<string | null>(null);

  const tables = useMemo(() => {
    const map = new Map<
      string,
      { orderId: string; tableName: string; itemIds: string[] }
    >();
    for (const t of tickets) {
      const key = t.order.id;
      const prev = map.get(key);
      const ids = t.items.map((i) => i.item.id);
      if (prev) {
        prev.itemIds = [...new Set([...prev.itemIds, ...ids])];
      } else {
        map.set(key, {
          orderId: t.order.id,
          tableName: t.order.tableName ?? "Mesa",
          itemIds: ids,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.tableName.localeCompare(b.tableName, "es"),
    );
  }, [tickets]);

  if (!tables.length) return null;

  return (
    <div className="rounded-[var(--radius-xl)] border border-cyan-500/30 bg-cyan-500/5 p-3">
      <p className="mb-2 text-sm font-medium text-fg">
        Avisar mesero por mesa activa
      </p>
      <p className="mb-3 text-caption text-fg-muted">
        Pulsa la mesa: el mesero recibe el mensaje flotante y el sonido (sin
        quitar el aviso automático al marcar Listo).
      </p>
      <div className="flex flex-wrap gap-2">
        {tables.map((t) => (
          <Button
            key={t.orderId}
            size="sm"
            variant="secondary"
            disabled={busyId === t.orderId}
            className="border-cyan-500/40 bg-bg-elevated"
            onClick={() => {
              void (async () => {
                try {
                  setBusyId(t.orderId);
                  await alertWaiter(t.orderId, t.itemIds);
                  toast(`Mesero avisado · ${t.tableName}`, "success");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Error", "error");
                } finally {
                  setBusyId(null);
                }
              })();
            }}
          >
            <BellRing className="h-3.5 w-3.5" />
            {busyId === t.orderId ? "…" : t.tableName}
          </Button>
        ))}
      </div>
    </div>
  );
}
