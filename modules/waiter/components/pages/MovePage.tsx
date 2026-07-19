"use client";

import { useAuth } from "@/context/AuthProvider";
import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { usePos } from "@/modules/pos/context/PosProvider";
import Link from "next/link";
import { useState } from "react";

export function WaiterMovePage() {
  const { can } = useAuth();
  const routes = useFloorRoutes();
  const { tables, activeOrder, moveToTable, selectTable } = usePos();
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const allowed = can("pos.move_merge");
  const candidates = tables.filter(
    (t) =>
      t.id !== activeOrder?.tableId &&
      (t.status === "available" || t.status === "dirty"),
  );

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 text-sm">
        <p className="font-medium">Sin permiso para mover mesas</p>
        <p className="mt-2 text-[#a8b5a4]">
          Necesitas el permiso `pos.move_merge`.
        </p>
      </div>
    );
  }

  if (!activeOrder) {
    return (
      <div className="py-10 text-center text-sm text-[#a8b5a4]">
        Abre un ticket primero.{" "}
        <Link href={routes.home} className="text-emerald-400">
          Mesas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Mover mesa
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Ticket actual: {activeOrder.tableName}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {candidates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTargetId(t.id)}
            className={`min-h-[64px] rounded-xl border text-sm font-medium ${
              targetId === t.id
                ? "border-emerald-500 bg-emerald-900/40"
                : "border-white/15 bg-white/5"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {!candidates.length ? (
        <p className="text-center text-sm text-[#8fa08c]">
          No hay mesas libres para mover.
        </p>
      ) : null}

      <button
        type="button"
        disabled={!targetId || busy}
        onClick={() => {
          void (async () => {
            try {
              setBusy(true);
              setMsg(null);
              await moveToTable(targetId);
              selectTable(targetId);
              setMsg("Mesa cambiada");
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Error");
            } finally {
              setBusy(false);
            }
          })();
        }}
        className="w-full rounded-xl bg-emerald-700 py-3.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Moviendo…" : "Confirmar cambio"}
      </button>
      {msg ? <p className="text-center text-xs text-emerald-300">{msg}</p> : null}
    </div>
  );
}
