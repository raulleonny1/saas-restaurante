"use client";

import { usePos } from "@/modules/pos/context/PosProvider";
import { Badge } from "@/ui";

export function OfflineBanner() {
  const { syncStatus, queueSize } = usePos();
  if (syncStatus === "online" && queueSize === 0) return null;

  const label =
    syncStatus === "offline"
      ? "Modo offline — los cambios se sincronizarán al recuperar red"
      : syncStatus === "syncing"
        ? "Sincronizando con Firestore…"
        : `${queueSize} cambio(s) pendientes de sync`;

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-warning/40 bg-[var(--warning-soft)] px-3 py-2 text-sm">
      <span className="text-fg">{label}</span>
      <Badge tone={syncStatus === "offline" ? "warning" : "accent"}>
        {syncStatus}
      </Badge>
    </div>
  );
}
