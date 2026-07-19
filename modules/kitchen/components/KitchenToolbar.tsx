"use client";

import { useKitchen } from "@/modules/kitchen/context/KitchenProvider";
import { Button, SearchInput, Select } from "@/ui";
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

  const allLabel = mode === "bar" ? "Todas" : "Todas";
  const showStationTabs = mode === "kitchen" || stations.length > 1;

  return (
    <div className="space-y-2.5">
      {showStationTabs ? (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setStation("all")}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              station === "all"
                ? "bg-accent text-accent-fg"
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
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                station === s.id
                  ? "bg-accent text-accent-fg"
                  : "bg-bg-muted text-fg-muted hover:text-fg"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          className="min-w-[180px] flex-1 lg:max-w-xs"
          placeholder="Buscar mesa o plato…"
          value={filters.query}
          onChange={(e) => setFilters({ query: e.target.value })}
          onClear={() => setFilters({ query: "" })}
        />

        {branchId && branches.length > 1 ? (
          <Select
            aria-label="Sucursal"
            className="min-w-[120px]"
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

        <Button
          size="sm"
          variant={soundEnabled ? "secondary" : "ghost"}
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
  );
}
