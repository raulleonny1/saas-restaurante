"use client";

import { printKitchenTestPage } from "@/modules/pos/domain/print-kitchen";
import { printTpvTestPage } from "@/modules/pos/domain/print";
import { updateTenantSettings } from "@/modules/tenant/services/settings.service";
import type {
  KitchenOutputMode,
  RestaurantPrintersSettings,
  ThermalPaperWidth,
} from "@/types/restaurant";
import { Button, Input, Select, toast } from "@/ui";
import { useEffect, useState } from "react";

type StationDraft = {
  label: string;
  systemName: string;
  paperWidthMm: ThermalPaperWidth;
};

function toDraft(
  station: RestaurantPrintersSettings["tpv"] | undefined,
  fallbackLabel: string,
): StationDraft {
  return {
    label: station?.label?.trim() || fallbackLabel,
    systemName: station?.systemName ?? "",
    paperWidthMm: station?.paperWidthMm ?? 80,
  };
}

export function PrinterSetupPanel({
  restaurantId,
  restaurantName,
  kitchenOutput,
  printers,
  canEdit,
  showKitchenMode = true,
  onSaved,
}: {
  restaurantId: string;
  restaurantName: string;
  kitchenOutput: KitchenOutputMode;
  printers?: RestaurantPrintersSettings;
  canEdit: boolean;
  showKitchenMode?: boolean;
  onSaved?: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<KitchenOutputMode>(kitchenOutput ?? "kds");
  const [tpv, setTpv] = useState<StationDraft>(() =>
    toDraft(printers?.tpv, "TPV · ticket cliente"),
  );
  const [kitchen, setKitchen] = useState<StationDraft>(() =>
    toDraft(printers?.kitchen, "Cocina · comanda"),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(kitchenOutput ?? "kds");
    setTpv(toDraft(printers?.tpv, "TPV · ticket cliente"));
    setKitchen(toDraft(printers?.kitchen, "Cocina · comanda"));
  }, [kitchenOutput, printers]);

  async function save() {
    if (!canEdit) return;
    try {
      setBusy(true);
      await updateTenantSettings({
        restaurantId,
        patch: {
          settings: {
            kitchenOutput: mode,
            printers: {
              tpv: {
                label: tpv.label.trim() || "TPV · ticket cliente",
                systemName: tpv.systemName.trim() || undefined,
                paperWidthMm: tpv.paperWidthMm,
              },
              kitchen: {
                label: kitchen.label.trim() || "Cocina · comanda",
                systemName: kitchen.systemName.trim() || undefined,
                paperWidthMm: kitchen.paperWidthMm,
              },
            },
          },
        },
      });
      toast("Impresoras guardadas", "success");
      await onSaved?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-medium">Impresoras TPV y cocina</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Configura dos destinos: ticket del cliente (TPV) y comanda de cocina.
          El navegador usa las impresoras ya instaladas en este equipo (USB o
          red Ethernet/Wi‑Fi con driver).
        </p>
      </div>

      <ol className="list-decimal space-y-1.5 pl-5 text-xs text-fg-muted">
        <li>
          En Windows: Configuración → Bluetooth y dispositivos → Impresoras →
          Agregar dispositivo (elige la de red o USB).
        </li>
        <li>
          Copia el nombre exacto de cada impresora (clic derecho → Propiedades
          de impresora) y pégalo abajo.
        </li>
        <li>
          Usa «Probar» y, en el diálogo, selecciona esa impresora. Puedes
          marcarla como predeterminada la primera vez.
        </li>
      </ol>

      {showKitchenMode ? (
        <Select
          label="Salida de comandas"
          value={mode}
          onChange={(e) => setMode(e.target.value as KitchenOutputMode)}
          disabled={!canEdit}
        >
          <option value="kds">Solo pantalla KDS (tablet)</option>
          <option value="printer">Solo impresora de cocina</option>
          <option value="both">Ambos (KDS + impresora)</option>
        </Select>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <StationCard
          title="Impresora TPV"
          subtitle="Ticket elegante para el cliente al cobrar"
          draft={tpv}
          onChange={setTpv}
          canEdit={canEdit}
          onTest={() =>
            printTpvTestPage({
              restaurantName,
              paperWidthMm: tpv.paperWidthMm,
              printerSystemName: tpv.systemName || undefined,
              printerLabel: tpv.label || "TPV · ticket cliente",
            })
          }
        />
        <StationCard
          title="Impresora cocina"
          subtitle="Comanda al enviar a cocina / barra"
          draft={kitchen}
          onChange={setKitchen}
          canEdit={canEdit}
          onTest={() =>
            printKitchenTestPage({
              restaurantName,
              paperWidthMm: kitchen.paperWidthMm,
              printerSystemName: kitchen.systemName || undefined,
              printerLabel: kitchen.label || "Cocina · comanda",
            })
          }
        />
      </div>

      {canEdit ? (
        <Button type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Guardando…" : "Guardar impresoras"}
        </Button>
      ) : null}
    </div>
  );
}

function StationCard({
  title,
  subtitle,
  draft,
  onChange,
  canEdit,
  onTest,
}: {
  title: string;
  subtitle: string;
  draft: StationDraft;
  onChange: (next: StationDraft) => void;
  canEdit: boolean;
  onTest: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-bg p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>
      <div className="mt-3 space-y-3">
        <Input
          label="Nombre amigable"
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          disabled={!canEdit}
          placeholder={title}
        />
        <Input
          label="Nombre en Windows / macOS"
          value={draft.systemName}
          onChange={(e) => onChange({ ...draft, systemName: e.target.value })}
          disabled={!canEdit}
          placeholder="Ej. EPSON TM-T20III Kitchen"
        />
        <Select
          label="Ancho del papel"
          value={String(draft.paperWidthMm)}
          onChange={(e) =>
            onChange({
              ...draft,
              paperWidthMm: Number(e.target.value) as ThermalPaperWidth,
            })
          }
          disabled={!canEdit}
        >
          <option value="80">80 mm (recomendado)</option>
          <option value="58">58 mm</option>
        </Select>
        <Button type="button" size="sm" variant="secondary" onClick={onTest}>
          Probar impresión
        </Button>
      </div>
    </div>
  );
}
