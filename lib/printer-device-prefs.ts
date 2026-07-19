import type {
  KitchenOutputMode,
  PrinterStationConfig,
  RestaurantPrintersSettings,
  RestaurantSettings,
} from "@/types/restaurant";

export type DevicePrinterPrefs = {
  kitchenOutput?: KitchenOutputMode;
  printers?: RestaurantPrintersSettings;
};

function key(restaurantId: string) {
  return `smartserve_printers_device:${restaurantId}`;
}

export function getDevicePrinterPrefs(
  restaurantId: string | null | undefined,
): DevicePrinterPrefs {
  if (typeof window === "undefined" || !restaurantId) return {};
  try {
    const raw = localStorage.getItem(key(restaurantId));
    if (!raw) return {};
    return JSON.parse(raw) as DevicePrinterPrefs;
  } catch {
    return {};
  }
}

export function setDevicePrinterPrefs(
  restaurantId: string,
  prefs: DevicePrinterPrefs,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(restaurantId), JSON.stringify(prefs));
}

function mergeStation(
  base?: PrinterStationConfig,
  override?: PrinterStationConfig,
): PrinterStationConfig | undefined {
  if (!base && !override) return undefined;
  return {
    label: override?.label ?? base?.label,
    systemName: override?.systemName ?? base?.systemName,
    paperWidthMm: override?.paperWidthMm ?? base?.paperWidthMm ?? 80,
  };
}

/** Preferencias de este PC encima de las del restaurante. */
export function getEffectivePrintSettings(
  restaurantId: string | null | undefined,
  settings: RestaurantSettings | null | undefined,
): {
  kitchenOutput: KitchenOutputMode;
  printers: RestaurantPrintersSettings;
} {
  const device = getDevicePrinterPrefs(restaurantId);
  const restaurantPrinters = settings?.printers;
  return {
    kitchenOutput:
      device.kitchenOutput ?? settings?.kitchenOutput ?? "kds",
    printers: {
      tpv: mergeStation(
        {
          label: "TPV · ventas / ticket cliente",
          paperWidthMm: 80,
          ...restaurantPrinters?.tpv,
        },
        device.printers?.tpv,
      ),
      kitchen: mergeStation(
        {
          label: "Cocina · comanda",
          paperWidthMm: 80,
          ...restaurantPrinters?.kitchen,
        },
        device.printers?.kitchen,
      ),
    },
  };
}
