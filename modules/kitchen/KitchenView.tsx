"use client";

import { useAuth } from "@/context/AuthProvider";
import { ProductsRecipesPanel } from "@/modules/inventory/components/InventoryPanels";
import { InventoryProvider } from "@/modules/inventory/context/InventoryProvider";
import { KitchenBoard } from "@/modules/kitchen/components/KitchenBoard";
import { KitchenToolbar } from "@/modules/kitchen/components/KitchenToolbar";
import {
  KitchenProvider,
  useKitchen,
} from "@/modules/kitchen/context/KitchenProvider";
import type { KitchenBoardMode } from "@/modules/kitchen/domain/stations";
import { Alert, Badge, Button, PageHeader, Skeleton } from "@/ui";
import { Package } from "lucide-react";
import { useState } from "react";

function KitchenWorkspace({ mode }: { mode: KitchenBoardMode }) {
  const { can } = useAuth();
  const { ready, error, station, stations, tickets, unlockAudio } = useKitchen();
  const [showCatalog, setShowCatalog] = useState(false);
  const isBar = mode === "bar";
  const accessOk = isBar
    ? can("bar.access") || can("bar.update_status")
    : can("kitchen.access") || can("kitchen.update_status");
  const canAddProducts = can("catalog.products.manage");
  const stationLabel =
    station === "all"
      ? isBar
        ? "bebidas"
        : "comida"
      : (stations.find((s) => s.id === station)?.label ?? station);

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!accessOk) {
    return (
      <Alert
        tone="warning"
        title={isBar ? "Sin acceso a barra" : "Sin acceso a cocina"}
      >
        Tu rol no tiene permiso `{isBar ? "bar.access" : "kitchen.access"}`.
      </Alert>
    );
  }

  return (
    <div
      className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 pb-16 lg:pb-0"
      onPointerDown={() => void unlockAudio()}
    >
      <PageHeader
        title={isBar ? "Barra" : "Cocina"}
        description={
          isBar
            ? `Solo bebidas (sodas, cafés, licores…). Estación ${stationLabel}.`
            : `Solo comida. Estación ${stationLabel}. Las bebidas van a Barra.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">
              {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
            </Badge>
            {canAddProducts ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowCatalog((v) => !v)}
              >
                <Package className="h-3.5 w-3.5" />
                {showCatalog ? "Ocultar carta" : "Añadir producto"}
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <Alert tone="danger" title="Error Firestore">
          {error}
        </Alert>
      ) : null}

      {showCatalog && canAddProducts ? (
        <section className="rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4">
          <h2 className="mb-3 text-sm font-medium">Carta · añadir / editar</h2>
          <InventoryProvider>
            <ProductsRecipesPanel mode="kitchen" />
          </InventoryProvider>
        </section>
      ) : null}

      <KitchenToolbar />
      <KitchenBoard />
    </div>
  );
}

export function KitchenView({ mode = "kitchen" }: { mode?: KitchenBoardMode }) {
  return (
    <KitchenProvider mode={mode}>
      <KitchenWorkspace mode={mode} />
    </KitchenProvider>
  );
}

export function BarView() {
  return <KitchenView mode="bar" />;
}
