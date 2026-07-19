"use client";

import { useKitchen } from "@/modules/kitchen/context/KitchenProvider";
import { toast } from "@/ui";
import { BellRing } from "lucide-react";
import { useMemo, useState } from "react";

/** Chips compactos: avisar mesero por mesa. */
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted">
        <BellRing className="h-3.5 w-3.5" />
        Avisar
      </span>
      {tables.map((t) => (
        <button
          key={t.orderId}
          type="button"
          disabled={busyId === t.orderId}
          className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-900 transition hover:bg-cyan-500/20 disabled:opacity-50 dark:text-cyan-100"
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
          {busyId === t.orderId ? "…" : t.tableName}
        </button>
      ))}
    </div>
  );
}
