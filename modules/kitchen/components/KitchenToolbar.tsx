"use client";

import { useKitchen } from "@/modules/kitchen/context/KitchenProvider";
import { Button, SearchInput, Select, Switch } from "@/ui";
import { Volume2, VolumeX } from "lucide-react";

export function KitchenToolbar() {
  const {
    mode,
    branches,
    branchId,
    setBranchId,
    station,
    setStation,
    stations,
    filters,
    setFilters,
    soundEnabled,
    setSoundEnabled,
    unlockAudio,
  } = useKitchen();

  const allLabel = mode === "bar" ? "Todas las bebidas" : "Toda la cocina";
  const showStationTabs = mode === "kitchen" || stations.length > 1;

  return (
    <div className="space-y-3">
      {showStationTabs ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setStation("all")}
            className={`shrink-0 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-colors ${
              station === "all"
                ? "bg-accent text-accent-fg shadow-[var(--shadow-sm)]"
                : "bg-bg-muted text-fg-muted hover:text-fg"
            }`}
          >
            {allLabel}
          </button>
          {stations.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStation(s.id)}
              className={`shrink-0 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-colors ${
                station === s.id
                  ? "bg-accent text-accent-fg shadow-[var(--shadow-sm)]"
                  : "bg-bg-muted text-fg-muted hover:text-fg"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          className="lg:max-w-xs"
          placeholder="Mesa, producto, #pedido…"
          value={filters.query}
          onChange={(e) => setFilters({ query: e.target.value })}
          onClear={() => setFilters({ query: "" })}
        />

        <div className="flex flex-wrap items-center gap-2">
          {branchId && branches.length > 0 ? (
            <Select
              aria-label="Sucursal"
              className="min-w-[140px]"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          ) : null}

          <Select
            aria-label="Canal"
            className="min-w-[130px]"
            value={filters.channel}
            onChange={(e) =>
              setFilters({
                channel: e.target.value as typeof filters.channel,
              })
            }
          >
            <option value="all">Todos los canales</option>
            <option value="pos">POS</option>
            <option value="qr">QR</option>
            <option value="delivery">Delivery</option>
            <option value="takeaway">Takeaway</option>
            <option value="online">Online</option>
          </Select>

          <label className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3 py-2 text-sm">
            <Switch
              checked={filters.includeDelivered}
              onCheckedChange={(v) => setFilters({ includeDelivered: v })}
              aria-label="Mostrar entregados"
            />
            Entregados
          </label>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void unlockAudio();
              setSoundEnabled(!soundEnabled);
            }}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            Sonido
          </Button>
        </div>
      </div>
    </div>
  );
}
