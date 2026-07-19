"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import { getEffectivePrintSettings } from "@/lib/printer-device-prefs";
import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { PrinterSetupPanel } from "@/modules/pos/components/PrinterSetupPanel";
import Link from "next/link";
import { useMemo, useState } from "react";

export function CashierPrintersPage() {
  const routes = useFloorRoutes();
  const { restaurantId, restaurant } = useRestaurant();
  const [tick, setTick] = useState(0);

  const effective = useMemo(() => {
    void tick;
    return getEffectivePrintSettings(restaurantId, restaurant?.settings);
  }, [restaurantId, restaurant?.settings, tick]);

  if (!restaurantId || !restaurant) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-sm text-[#a8b5a4]">
        Cargando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-28">
      <div>
        <Link
          href={routes.home}
          className="text-xs text-emerald-400 hover:underline"
        >
          ← En vivo
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[#e7efe4]">
          Impresoras
        </h1>
        <p className="mt-1 text-sm text-[#a8b5a4]">
          Pulsa <strong className="text-[#e7efe4]">Buscar impresoras</strong>{" "}
          para ver las instaladas en este PC y elige cuál es de{" "}
          <strong className="text-[#e7efe4]">ventas</strong> y cuál de{" "}
          <strong className="text-[#e7efe4]">cocina</strong>.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/30 px-3 py-2.5 text-xs text-emerald-100/90">
        Ahora: ventas →{" "}
        <span className="font-medium">
          {effective.printers.tpv?.systemName?.trim() ||
            "sin nombre (elige en el diálogo)"}
        </span>
        {" · "}
        cocina →{" "}
        <span className="font-medium">
          {effective.printers.kitchen?.systemName?.trim() ||
            "sin nombre (elige en el diálogo)"}
        </span>
      </div>

      <PrinterSetupPanel
        restaurantId={restaurantId}
        restaurantName={restaurant.name}
        kitchenOutput={effective.kitchenOutput}
        printers={effective.printers}
        canEdit
        storage="device"
        tone="floor"
        onSaved={() => setTick((n) => n + 1)}
      />
    </div>
  );
}
