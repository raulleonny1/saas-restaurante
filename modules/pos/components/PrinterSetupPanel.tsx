"use client";

import {
  getDevicePrinterPrefs,
  setDevicePrinterPrefs,
} from "@/lib/printer-device-prefs";
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
  /** restaurant = Firebase (admin); device = este PC (caja/cajero). */
  storage = "restaurant",
  tone = "default",
  onSaved,
}: {
  restaurantId: string;
  restaurantName: string;
  kitchenOutput: KitchenOutputMode;
  printers?: RestaurantPrintersSettings;
  canEdit: boolean;
  showKitchenMode?: boolean;
  storage?: "restaurant" | "device";
  tone?: "default" | "floor";
  onSaved?: () => void | Promise<void>;
}) {
  const floor = tone === "floor";
  const [mode, setMode] = useState<KitchenOutputMode>(kitchenOutput ?? "kds");
  const [tpv, setTpv] = useState<StationDraft>(() =>
    toDraft(printers?.tpv, "Ventas · ticket cliente"),
  );
  const [kitchen, setKitchen] = useState<StationDraft>(() =>
    toDraft(printers?.kitchen, "Cocina · comanda"),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (storage === "device") {
      const device = getDevicePrinterPrefs(restaurantId);
      setMode(device.kitchenOutput ?? kitchenOutput ?? "kds");
      setTpv(
        toDraft(
          { ...printers?.tpv, ...device.printers?.tpv },
          "Ventas · ticket cliente",
        ),
      );
      setKitchen(
        toDraft(
          { ...printers?.kitchen, ...device.printers?.kitchen },
          "Cocina · comanda",
        ),
      );
      return;
    }
    setMode(kitchenOutput ?? "kds");
    setTpv(toDraft(printers?.tpv, "Ventas · ticket cliente"));
    setKitchen(toDraft(printers?.kitchen, "Cocina · comanda"));
  }, [kitchenOutput, printers, restaurantId, storage]);

  async function save() {
    if (!canEdit) return;
    const nextPrinters = {
      tpv: {
        label: tpv.label.trim() || "Ventas · ticket cliente",
        systemName: tpv.systemName.trim() || undefined,
        paperWidthMm: tpv.paperWidthMm,
      },
      kitchen: {
        label: kitchen.label.trim() || "Cocina · comanda",
        systemName: kitchen.systemName.trim() || undefined,
        paperWidthMm: kitchen.paperWidthMm,
      },
    };
    try {
      setBusy(true);
      if (storage === "device") {
        setDevicePrinterPrefs(restaurantId, {
          kitchenOutput: mode,
          printers: nextPrinters,
        });
        toast("Impresoras de este equipo guardadas", "success");
      } else {
        await updateTenantSettings({
          restaurantId,
          patch: {
            settings: {
              kitchenOutput: mode,
              printers: nextPrinters,
            },
          },
        });
        toast("Impresoras guardadas", "success");
      }
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
        <h2
          className={`text-sm font-medium ${floor ? "text-[#e7efe4]" : ""}`}
        >
          Elegir impresoras
        </h2>
        <p
          className={`mt-1 text-sm ${floor ? "text-[#a8b5a4]" : "text-fg-muted"}`}
        >
          {storage === "device"
            ? "En este PC de caja: indica cuál es la impresora de ventas (ticket cliente) y cuál la de cocina. Se guarda solo en este equipo."
            : "Configura dos destinos: ticket de ventas (TPV) y comanda de cocina. Usa impresoras ya instaladas en Windows (USB o red)."}
        </p>
      </div>

      <ol
        className={`list-decimal space-y-1.5 pl-5 text-xs ${floor ? "text-[#8fa08c]" : "text-fg-muted"}`}
      >
        <li>
          Instala cada impresora en Windows (USB o red Ethernet/Wi‑Fi).
        </li>
        <li>
          Copia el nombre exacto (Configuración → Impresoras) y pégalo abajo.
        </li>
        <li>
          Pulsa «Probar» y elige esa impresora en el diálogo de Windows.
        </li>
      </ol>

      {showKitchenMode ? (
        floor ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#c5d0c2]">
              Salida de comandas
            </span>
            <select
              value={mode}
              disabled={!canEdit}
              onChange={(e) => setMode(e.target.value as KitchenOutputMode)}
              className="w-full rounded-xl border border-white/15 bg-[#152018] px-3 py-2.5 text-sm text-[#e7efe4]"
            >
              <option value="kds">Solo pantalla KDS (tablet)</option>
              <option value="printer">Solo impresora de cocina</option>
              <option value="both">Ambos (KDS + impresora)</option>
            </select>
          </label>
        ) : (
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
        )
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <StationCard
          title="Impresora de ventas (TPV)"
          subtitle="Ticket del cliente al cobrar"
          draft={tpv}
          onChange={setTpv}
          canEdit={canEdit}
          floor={floor}
          onTest={() =>
            printTpvTestPage({
              restaurantName,
              paperWidthMm: tpv.paperWidthMm,
              printerSystemName: tpv.systemName || undefined,
              printerLabel: tpv.label || "Ventas · ticket cliente",
            })
          }
        />
        <StationCard
          title="Impresora de cocina"
          subtitle="Comanda al enviar a cocina / barra"
          draft={kitchen}
          onChange={setKitchen}
          canEdit={canEdit}
          floor={floor}
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
        floor ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Guardando…" : "Guardar impresoras de este PC"}
          </button>
        ) : (
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Guardando…" : "Guardar impresoras"}
          </Button>
        )
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
  floor,
  onTest,
}: {
  title: string;
  subtitle: string;
  draft: StationDraft;
  onChange: (next: StationDraft) => void;
  canEdit: boolean;
  floor: boolean;
  onTest: () => void;
}) {
  if (floor) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <h3 className="text-sm font-medium text-[#e7efe4]">{title}</h3>
        <p className="mt-0.5 text-xs text-[#8fa08c]">{subtitle}</p>
        <div className="mt-3 space-y-3">
          <FloorField
            label="Nombre amigable"
            value={draft.label}
            disabled={!canEdit}
            onChange={(v) => onChange({ ...draft, label: v })}
            placeholder={title}
          />
          <FloorField
            label="Nombre en Windows (elije esta)"
            value={draft.systemName}
            disabled={!canEdit}
            onChange={(v) => onChange({ ...draft, systemName: v })}
            placeholder="Ej. EPSON TM-T20 Ventas"
          />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#c5d0c2]">
              Ancho del papel
            </span>
            <select
              value={String(draft.paperWidthMm)}
              disabled={!canEdit}
              onChange={(e) =>
                onChange({
                  ...draft,
                  paperWidthMm: Number(e.target.value) as ThermalPaperWidth,
                })
              }
              className="w-full rounded-xl border border-white/15 bg-[#152018] px-3 py-2.5 text-sm text-[#e7efe4]"
            >
              <option value="80">80 mm (recomendado)</option>
              <option value="58">58 mm</option>
            </select>
          </label>
          <button
            type="button"
            onClick={onTest}
            className="w-full rounded-xl border border-emerald-500/40 bg-emerald-950/40 py-2.5 text-sm font-medium text-emerald-200"
          >
            Probar esta impresora
          </button>
        </div>
      </div>
    );
  }

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
          placeholder="Ej. EPSON TM-T20 Kitchen"
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

function FloorField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-[#c5d0c2]">{label}</span>
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/15 bg-[#152018] px-3 py-2.5 text-sm text-[#e7efe4] placeholder:text-[#5a6b57] disabled:opacity-50"
      />
    </label>
  );
}
