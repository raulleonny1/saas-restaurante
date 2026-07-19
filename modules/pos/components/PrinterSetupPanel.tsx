"use client";

import {
  getDevicePrinterPrefs,
  setDevicePrinterPrefs,
} from "@/lib/printer-device-prefs";
import {
  PRINT_BRIDGE_DOWNLOAD_BAT,
  PRINT_BRIDGE_DOWNLOAD_PS1,
  checkPrintBridge,
  listInstalledPrinters,
  type InstalledPrinter,
} from "@/lib/print-bridge-client";
import { printKitchenTestPage } from "@/modules/pos/domain/print-kitchen";
import { printTpvTestPage } from "@/modules/pos/domain/print";
import { updateTenantSettings } from "@/modules/tenant/services/settings.service";
import type {
  KitchenOutputMode,
  RestaurantPrintersSettings,
  ThermalPaperWidth,
} from "@/types/restaurant";
import { Button, Input, Select, toast } from "@/ui";
import { useCallback, useEffect, useState } from "react";

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
  const [scanning, setScanning] = useState(false);
  const [bridgeUp, setBridgeUp] = useState<boolean | null>(null);
  const [installed, setInstalled] = useState<InstalledPrinter[]>([]);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

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

  const scanPrinters = useCallback(async () => {
    setScanning(true);
    setScanMsg(null);
    try {
      const up = await checkPrintBridge();
      setBridgeUp(up);
      if (!up) {
        setInstalled([]);
        setScanMsg(
          "Asistente apagado. Descarga e inicia el asistente en este PC y vuelve a buscar.",
        );
        return;
      }
      const result = await listInstalledPrinters();
      if (!result.available) {
        setInstalled([]);
        setBridgeUp(false);
        setScanMsg(result.message || "No se pudieron leer las impresoras");
        return;
      }
      setInstalled(result.printers);
      if (result.printers.length === 0) {
        setScanMsg(
          "Asistente activo, pero Windows no tiene impresoras instaladas.",
        );
      } else {
        setScanMsg(
          `${result.printers.length} impresora(s) encontrada(s). Elige ventas y cocina abajo.`,
        );
        toast(`${result.printers.length} impresoras encontradas`, "success");
      }
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const up = await checkPrintBridge();
      setBridgeUp(up);
      if (up) void scanPrinters();
    })();
  }, [scanPrinters]);

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
          La app busca las impresoras instaladas en este PC. Elige cuál es de
          ventas (ticket) y cuál de cocina.
        </p>
      </div>

      {/* Botón siempre visible y activo (solo se desactiva mientras busca) */}
      <div
        className={
          floor
            ? "rounded-2xl border-2 border-emerald-500/50 bg-emerald-950/40 p-4"
            : "rounded-[var(--radius-lg)] border-2 border-accent/40 bg-accent-soft/30 p-4"
        }
      >
        <button
          type="button"
          disabled={scanning}
          onClick={() => void scanPrinters()}
          className={
            floor
              ? "w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
              : "w-full rounded-[var(--radius-md)] bg-accent px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
          }
        >
          {scanning
            ? "Buscando impresoras en este PC…"
            : installed.length > 0
              ? `Volver a buscar (${installed.length} encontradas)`
              : "Buscar impresoras instaladas"}
        </button>
        <p
          className={`mt-2 text-center text-xs ${floor ? "text-[#a8b5a4]" : "text-fg-muted"}`}
        >
          {bridgeUp === true
            ? scanMsg || "Asistente activo · elige ventas y cocina abajo"
            : bridgeUp === false
              ? "Si no encuentra nada: inicia el asistente (descarga abajo) y pulsa de nuevo"
              : "Comprobando asistente local…"}
        </p>
      </div>

      <BridgeBanner floor={floor} bridgeUp={bridgeUp} />

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
          installed={installed}
          scanning={scanning}
          onScan={() => void scanPrinters()}
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
          installed={installed}
          scanning={scanning}
          onScan={() => void scanPrinters()}
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

function BridgeBanner({
  floor,
  bridgeUp,
}: {
  floor: boolean;
  bridgeUp: boolean | null;
}) {
  const box = floor
    ? "rounded-2xl border border-white/10 bg-white/[0.04] p-4"
    : "rounded-[var(--radius-lg)] border border-border bg-bg-muted/40 p-4";
  const text = floor ? "text-[#a8b5a4]" : "text-fg-muted";
  const title = floor ? "text-[#e7efe4]" : "text-fg";

  // Solo instrucciones de descarga si el asistente no está corriendo
  if (bridgeUp !== false) return null;

  return (
    <div className={box}>
      <p className={`text-sm font-medium ${title}`}>
        Asistente de impresoras (una vez en este PC)
      </p>
      <div className={`mt-3 space-y-2 text-xs ${text}`}>
        <ol className="list-decimal space-y-1 pl-4">
          <li>
            Descarga estos dos archivos en la misma carpeta:
            <span className="mt-1 flex flex-wrap gap-2">
              <a
                href={PRINT_BRIDGE_DOWNLOAD_BAT}
                download
                className={
                  floor
                    ? "text-emerald-400 underline"
                    : "text-accent underline"
                }
              >
                start-windows.bat
              </a>
              <a
                href={PRINT_BRIDGE_DOWNLOAD_PS1}
                download
                className={
                  floor
                    ? "text-emerald-400 underline"
                    : "text-accent underline"
                }
              >
                smartserve-print-bridge.ps1
              </a>
            </span>
          </li>
          <li>
            Haz doble clic en <strong>start-windows.bat</strong>.
          </li>
          <li>
            Deja la ventana negra abierta y pulsa el botón verde «Buscar
            impresoras instaladas».
          </li>
        </ol>
        <p>
          El asistente solo lee impresoras de Windows en este PC; no se publica
          en internet.
        </p>
      </div>
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
  installed,
  scanning,
  onScan,
  onTest,
}: {
  title: string;
  subtitle: string;
  draft: StationDraft;
  onChange: (next: StationDraft) => void;
  canEdit: boolean;
  floor: boolean;
  installed: InstalledPrinter[];
  scanning: boolean;
  onScan: () => void;
  onTest: () => void;
}) {
  const selectValue =
    draft.systemName &&
    installed.some((p) => p.name === draft.systemName)
      ? draft.systemName
      : draft.systemName
        ? "__custom__"
        : "";

  const printerSelect = (
    <div className="space-y-2">
      <label className="block space-y-1.5">
        <span
          className={`text-xs font-medium ${floor ? "text-[#c5d0c2]" : "text-fg-muted"}`}
        >
          Impresora instalada
        </span>
        <select
          value={selectValue}
          disabled={!canEdit || installed.length === 0}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") return;
            onChange({ ...draft, systemName: v });
          }}
          className={
            floor
              ? "w-full rounded-xl border border-white/15 bg-[#152018] px-3 py-2.5 text-sm text-[#e7efe4] disabled:opacity-50"
              : "flex h-10 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 text-sm disabled:opacity-50"
          }
        >
          <option value="">
            {installed.length
              ? "— Selecciona impresora —"
              : "— Pulsa Buscar para listar —"}
          </option>
          {installed.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
              {p.isDefault ? " (predeterminada)" : ""}
              {p.portName ? ` · ${p.portName}` : ""}
            </option>
          ))}
          {draft.systemName &&
          !installed.some((p) => p.name === draft.systemName) ? (
            <option value="__custom__">{draft.systemName} (guardada)</option>
          ) : null}
        </select>
      </label>
      {installed.length === 0 ? (
        <button
          type="button"
          disabled={scanning || !canEdit}
          onClick={onScan}
          className={
            floor
              ? "w-full rounded-xl border border-emerald-400/50 bg-emerald-600/90 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              : "w-full rounded-[var(--radius-md)] border border-accent/40 bg-accent py-2.5 text-xs font-semibold text-white disabled:opacity-50"
          }
        >
          {scanning ? "Buscando…" : "Buscar impresoras ahora"}
        </button>
      ) : null}
    </div>
  );

  if (floor) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <h3 className="text-sm font-medium text-[#e7efe4]">{title}</h3>
        <p className="mt-0.5 text-xs text-[#8fa08c]">{subtitle}</p>
        <div className="mt-3 space-y-3">
          {printerSelect}
          <FloorField
            label="Nombre amigable"
            value={draft.label}
            disabled={!canEdit}
            onChange={(v) => onChange({ ...draft, label: v })}
            placeholder={title}
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
        {printerSelect}
        <Input
          label="Nombre amigable"
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          disabled={!canEdit}
          placeholder={title}
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
