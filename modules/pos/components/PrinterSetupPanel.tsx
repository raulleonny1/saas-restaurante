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

type StationId = "tpv" | "kitchen";

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
  /** Cada botón busca solo para su tarjeta */
  const [scanningFor, setScanningFor] = useState<StationId | null>(null);
  const [bridgeUp, setBridgeUp] = useState<boolean | null>(null);
  const [tpvInstalled, setTpvInstalled] = useState<InstalledPrinter[]>([]);
  const [kitchenInstalled, setKitchenInstalled] = useState<InstalledPrinter[]>(
    [],
  );
  const [tpvScanMsg, setTpvScanMsg] = useState<string | null>(null);
  const [kitchenScanMsg, setKitchenScanMsg] = useState<string | null>(null);

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

  useEffect(() => {
    void checkPrintBridge().then(setBridgeUp);
  }, []);

  const scanFor = useCallback(async (station: StationId) => {
    setScanningFor(station);
    const setMsg = station === "tpv" ? setTpvScanMsg : setKitchenScanMsg;
    const setList = station === "tpv" ? setTpvInstalled : setKitchenInstalled;
    setMsg("Conectando con el asistente… (puede abrirse una ventana pequeña)");
    try {
      // No confiar solo en /health: Chrome/HTTPS a menudo lo bloquea
      // aunque el asistente esté ENCENDIDO. listInstalledPrinters usa
      // fetch y, si falla, una ventana local http://127.0.0.1
      const up = await checkPrintBridge();
      if (up) setBridgeUp(true);

      const result = await listInstalledPrinters();
      if (!result.available) {
        setList([]);
        if (result.reason !== "popup_blocked") {
          setBridgeUp(false);
        }
        setMsg(result.message || "No se pudieron leer las impresoras");
        toast(result.message || "No se encontraron impresoras", "error");
        return;
      }
      setBridgeUp(true);
      setList(result.printers);
      if (result.printers.length === 0) {
        setMsg("No hay impresoras instaladas en Windows.");
      } else {
        setMsg(
          `${result.printers.length} encontrada(s). Elige la de ${
            station === "tpv" ? "ventas" : "cocina"
          }.`,
        );
        toast(
          station === "tpv"
            ? `${result.printers.length} impresoras · elige la de ventas`
            : `${result.printers.length} impresoras · elige la de cocina`,
          "success",
        );
      }
    } finally {
      setScanningFor(null);
    }
  }, []);

  async function save() {
    if (!canEdit) return;
    const tpvName = tpv.systemName.trim();
    const kitchenName = kitchen.systemName.trim();
    if (tpvName && kitchenName && tpvName === kitchenName) {
      toast(
        "Ventas y cocina deben ser impresoras distintas. Elige otra en uno de los dos.",
        "error",
      );
      return;
    }
    const nextPrinters = {
      tpv: {
        label: tpv.label.trim() || "Ventas · ticket cliente",
        systemName: tpvName || undefined,
        paperWidthMm: tpv.paperWidthMm,
      },
      kitchen: {
        label: kitchen.label.trim() || "Cocina · comanda",
        systemName: kitchenName || undefined,
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
          Cada botón busca solo para su impresora. Elige una distinta para
          ventas y otra para cocina.
        </p>
      </div>

      <BridgeBanner
        floor={floor}
        bridgeUp={bridgeUp}
        onRecheck={() => {
          void (async () => {
            const up = await checkPrintBridge();
            setBridgeUp(up);
            if (up) {
              toast("Asistente encendido · ya puedes Buscar", "success");
            } else {
              toast(
                "Sigue apagado. Abre start-windows.bat y deja la ventana negra abierta",
                "error",
              );
            }
          })();
        }}
      />

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
          station="tpv"
          draft={tpv}
          onChange={setTpv}
          canEdit={canEdit}
          floor={floor}
          installed={tpvInstalled}
          excludeName={kitchen.systemName}
          excludeLabel="ya elegida en cocina"
          scanning={scanningFor === "tpv"}
          otherScanning={scanningFor === "kitchen"}
          scanMsg={tpvScanMsg}
          onScan={() => void scanFor("tpv")}
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
          station="kitchen"
          draft={kitchen}
          onChange={setKitchen}
          canEdit={canEdit}
          floor={floor}
          installed={kitchenInstalled}
          excludeName={tpv.systemName}
          excludeLabel="ya elegida en ventas"
          scanning={scanningFor === "kitchen"}
          otherScanning={scanningFor === "tpv"}
          scanMsg={kitchenScanMsg}
          onScan={() => void scanFor("kitchen")}
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

      {tpv.systemName &&
      kitchen.systemName &&
      tpv.systemName === kitchen.systemName ? (
        <p
          className={`text-xs ${floor ? "text-amber-300" : "text-amber-700"}`}
        >
          Atención: ventas y cocina tienen la misma impresora. Elige otra en
          uno de los dos.
        </p>
      ) : null}

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
  onRecheck,
}: {
  floor: boolean;
  bridgeUp: boolean | null;
  onRecheck: () => void;
}) {
  const box = floor
    ? "rounded-2xl border border-white/10 bg-white/[0.04] p-4"
    : "rounded-[var(--radius-lg)] border border-border bg-bg-muted/40 p-4";
  const text = floor ? "text-[#a8b5a4]" : "text-fg-muted";
  const title = floor ? "text-[#e7efe4]" : "text-fg";

  if (bridgeUp === true) {
    return (
      <div
        className={
          floor
            ? "rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100"
            : "rounded-[var(--radius-lg)] border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        }
      >
        Asistente <strong>encendido</strong> en este PC. Usa «Buscar» en ventas
        y en cocina (impresoras distintas).
      </div>
    );
  }

  return (
    <div className={box}>
      <p className={`text-sm font-medium ${title}`}>
        Paso 1 · Asistente en este PC
      </p>
      <p className={`mt-1 text-xs ${text}`}>
        Si la ventanita dice <code>not_found</code>, el asistente es{" "}
        <strong>viejo</strong>: ciérralo, descarga de nuevo los 2 archivos,
        ábrelos (debe decir <strong>v1.2.1</strong>) y pulsa Buscar. Permite
        ventanas emergentes.
      </p>
      <ol className={`mt-3 list-decimal space-y-2 pl-4 text-xs ${text}`}>
        <li>
          Descarga <strong>los dos</strong> en la misma carpeta (Escritorio):
          <span className="mt-1.5 flex flex-wrap gap-2">
            <a
              href={PRINT_BRIDGE_DOWNLOAD_BAT}
              download
              className={
                floor
                  ? "rounded-lg bg-emerald-700 px-3 py-1.5 font-medium text-white"
                  : "rounded-lg bg-accent px-3 py-1.5 font-medium text-white"
              }
            >
              1 · start-windows.bat
            </a>
            <a
              href={PRINT_BRIDGE_DOWNLOAD_PS1}
              download
              className={
                floor
                  ? "rounded-lg border border-white/20 px-3 py-1.5 text-emerald-300"
                  : "rounded-lg border border-border px-3 py-1.5"
              }
            >
              2 · smartserve-print-bridge.ps1
            </a>
          </span>
        </li>
        <li>
          Doble clic en <strong>start-windows.bat</strong>. Debe decir{" "}
          <strong>ESTADO: ENCENDIDO</strong>.
        </li>
        <li>Vuelve aquí, pulsa el botón de abajo y luego «Buscar» en cada tarjeta.</li>
      </ol>
      <button
        type="button"
        onClick={onRecheck}
        className={
          floor
            ? "mt-3 w-full rounded-xl border border-emerald-400/40 py-2.5 text-sm font-medium text-emerald-200"
            : "mt-3 w-full rounded-[var(--radius-md)] border border-border py-2.5 text-sm font-medium"
        }
      >
        Ya lo abrí · comprobar si está encendido
      </button>
    </div>
  );
}

function StationCard({
  title,
  subtitle,
  station,
  draft,
  onChange,
  canEdit,
  floor,
  installed,
  excludeName,
  excludeLabel,
  scanning,
  otherScanning,
  scanMsg,
  onScan,
  onTest,
}: {
  title: string;
  subtitle: string;
  station: StationId;
  draft: StationDraft;
  onChange: (next: StationDraft) => void;
  canEdit: boolean;
  floor: boolean;
  installed: InstalledPrinter[];
  excludeName: string;
  excludeLabel: string;
  scanning: boolean;
  otherScanning: boolean;
  scanMsg: string | null;
  onScan: () => void;
  onTest: () => void;
}) {
  const exclude = excludeName.trim();
  const options = installed.filter((p) => p.name !== exclude);
  const selectValue =
    draft.systemName && options.some((p) => p.name === draft.systemName)
      ? draft.systemName
      : draft.systemName
        ? "__custom__"
        : "";

  const roleName = station === "tpv" ? "ventas" : "cocina";

  const body = (
    <>
      <button
        type="button"
        disabled={scanning || !canEdit || otherScanning}
        onClick={onScan}
        className={
          floor
            ? "w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            : "w-full rounded-[var(--radius-md)] bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
        }
      >
        {scanning
          ? `Buscando impresoras de ${roleName}…`
          : installed.length > 0
            ? `Buscar de nuevo (${roleName})`
            : `Buscar impresoras de ${roleName}`}
      </button>

      {scanMsg ? (
        <p className={`text-xs ${floor ? "text-[#a8b5a4]" : "text-fg-muted"}`}>
          {scanMsg}
        </p>
      ) : null}

      <label className="block space-y-1.5">
        <span
          className={`text-xs font-medium ${floor ? "text-[#c5d0c2]" : "text-fg-muted"}`}
        >
          Elegir impresora de {roleName}
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
              ? `— Selecciona impresora de ${roleName} —`
              : `— Pulsa Buscar de ${roleName} —`}
          </option>
          {options.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
              {p.isDefault ? " (predeterminada)" : ""}
              {p.portName ? ` · ${p.portName}` : ""}
            </option>
          ))}
          {draft.systemName &&
          !options.some((p) => p.name === draft.systemName) ? (
            <option value="__custom__">{draft.systemName} (guardada)</option>
          ) : null}
        </select>
        {exclude && installed.some((p) => p.name === exclude) ? (
          <span
            className={`block text-[11px] ${floor ? "text-[#8fa08c]" : "text-fg-muted"}`}
          >
            Oculta «{exclude}» ({excludeLabel}).
          </span>
        ) : null}
      </label>

      {floor ? (
        <FloorField
          label="Nombre amigable"
          value={draft.label}
          disabled={!canEdit}
          onChange={(v) => onChange({ ...draft, label: v })}
          placeholder={title}
        />
      ) : (
        <Input
          label="Nombre amigable"
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          disabled={!canEdit}
          placeholder={title}
        />
      )}

      {floor ? (
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
      ) : (
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
      )}

      {floor ? (
        <button
          type="button"
          onClick={onTest}
          className="w-full rounded-xl border border-emerald-500/40 bg-emerald-950/40 py-2.5 text-sm font-medium text-emerald-200"
        >
          Probar esta impresora
        </button>
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={onTest}>
          Probar impresión
        </Button>
      )}
    </>
  );

  if (floor) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <h3 className="text-sm font-medium text-[#e7efe4]">{title}</h3>
        <p className="mt-0.5 text-xs text-[#8fa08c]">{subtitle}</p>
        <div className="mt-3 space-y-3">{body}</div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-bg p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>
      <div className="mt-3 space-y-3">{body}</div>
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
