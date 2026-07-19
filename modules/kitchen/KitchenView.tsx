"use client";

import { useAuth } from "@/context/AuthProvider";
import { KitchenBoard } from "@/modules/kitchen/components/KitchenBoard";
import { KitchenToolbar } from "@/modules/kitchen/components/KitchenToolbar";
import {
  KitchenProvider,
  useKitchen,
} from "@/modules/kitchen/context/KitchenProvider";
import { Alert, Badge, PageHeader, Skeleton } from "@/ui";

function KitchenWorkspace() {
  const { can } = useAuth();
  const { ready, error, station, stations, tickets, unlockAudio } = useKitchen();
  const stationLabel =
    stations.find((s) => s.id === station)?.label ?? station;

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!can("kitchen.access") && !can("kitchen.update_status")) {
    return (
      <Alert tone="warning" title="Sin acceso a cocina">
        Tu rol no tiene permiso `kitchen.access`.
      </Alert>
    );
  }

  return (
    <div
      className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 pb-16 lg:pb-0"
      onPointerDown={() => void unlockAudio()}
    >
      <PageHeader
        title="Cocina"
        description={`Estación ${stationLabel}: solo líneas enrutadas a este puesto. Tiempo real Firestore.`}
        actions={
          <Badge tone="accent">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
          </Badge>
        }
      />

      {error ? (
        <Alert tone="danger" title="Error Firestore">
          {error}
        </Alert>
      ) : null}

      <KitchenToolbar />
      <KitchenBoard />
    </div>
  );
}

export function KitchenView() {
  return (
    <KitchenProvider>
      <KitchenWorkspace />
    </KitchenProvider>
  );
}
