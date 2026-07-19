"use client";

import { useAuth } from "@/context/AuthProvider";
import { KitchenBoard } from "@/modules/kitchen/components/KitchenBoard";
import { KitchenToolbar } from "@/modules/kitchen/components/KitchenToolbar";
import {
  KitchenProvider,
  useKitchen,
} from "@/modules/kitchen/context/KitchenProvider";
import type { KitchenBoardMode } from "@/modules/kitchen/domain/stations";
import { Alert, Badge, Skeleton } from "@/ui";
import { Package } from "lucide-react";
import Link from "next/link";

function KitchenWorkspace({ mode }: { mode: KitchenBoardMode }) {
  const { can } = useAuth();
  const { ready, error, tickets, unlockAudio } = useKitchen();
  const isBar = mode === "bar";
  const accessOk = isBar
    ? can("bar.access") || can("bar.update_status")
    : can("kitchen.access") || can("kitchen.update_status");
  const canCatalog =
    can("catalog.read") || can("catalog.products.manage");

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
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
        Tu rol no tiene permiso de {isBar ? "barra" : "cocina"}.
      </Alert>
    );
  }

  return (
    <div
      className="flex min-h-[calc(100vh-7rem)] flex-col gap-3 pb-16 lg:pb-0"
      onPointerDown={() => void unlockAudio()}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight md:text-3xl">
            {isBar ? "Barra" : "Cocina"}
          </h1>
          <p className="text-sm text-fg-muted">
            {isBar ? "Pedidos de bebidas" : "Pedidos de comida"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">
            {tickets.length} activo{tickets.length === 1 ? "" : "s"}
          </Badge>
          {canCatalog ? (
            <Link
              href="/inventory?tab=products"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3 text-sm font-medium text-fg transition hover:bg-bg-muted"
            >
              <Package className="h-3.5 w-3.5" />
              Carta
            </Link>
          ) : null}
        </div>
      </header>

      {error ? (
        <Alert tone="danger" title="Error de conexión">
          {error}
        </Alert>
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
