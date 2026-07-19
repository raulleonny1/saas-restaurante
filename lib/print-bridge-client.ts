/** Cliente del asistente local que lista impresoras instaladas en el PC. */

export const PRINT_BRIDGE_URL = "http://127.0.0.1:17891";
export const PRINT_BRIDGE_DOWNLOAD_BAT = "/print-bridge/start-windows.bat";
export const PRINT_BRIDGE_DOWNLOAD_PS1 = "/print-bridge/smartserve-print-bridge.ps1";

export type InstalledPrinter = {
  name: string;
  driverName?: string;
  portName?: string;
  shared?: boolean;
  isDefault?: boolean;
};

export type PrinterBridgeStatus =
  | { available: true; printers: InstalledPrinter[]; version?: string }
  | { available: false; reason: "offline" | "error"; message?: string };

function normalizePrinters(raw: unknown): InstalledPrinter[] {
  // PowerShell a veces devuelve un solo objeto en vez de array
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  const out: InstalledPrinter[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? row.Name ?? "").trim();
    if (!name) continue;
    out.push({
      name,
      driverName:
        row.driverName != null
          ? String(row.driverName)
          : row.DriverName != null
            ? String(row.DriverName)
            : undefined,
      portName:
        row.portName != null
          ? String(row.portName)
          : row.PortName != null
            ? String(row.PortName)
            : undefined,
      shared: Boolean(row.shared ?? row.Shared),
      isDefault: Boolean(row.isDefault ?? row.Default),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

async function bridgeFetch(
  path: string,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${PRINT_BRIDGE_URL}${path}`, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: ctrl.signal,
    });
  } finally {
    window.clearTimeout(t);
  }
}

export async function checkPrintBridge(
  timeoutMs = 2500,
): Promise<boolean> {
  try {
    const res = await bridgeFetch("/health", timeoutMs);
    return res.ok;
  } catch {
    return false;
  }
}

/** Lista impresoras instaladas vía el asistente local (127.0.0.1). */
export async function listInstalledPrinters(
  timeoutMs = 6000,
): Promise<PrinterBridgeStatus> {
  try {
    const res = await bridgeFetch("/printers", timeoutMs);
    if (!res.ok) {
      return {
        available: false,
        reason: "error",
        message: `Asistente respondió ${res.status}. Reinicia start-windows.bat`,
      };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      printers?: unknown;
      error?: string;
      version?: string;
    };
    if (data.ok === false) {
      return {
        available: false,
        reason: "error",
        message: data.error || "Error al leer impresoras",
      };
    }
    return {
      available: true,
      printers: normalizePrinters(data.printers),
      version: data.version,
    };
  } catch (e) {
    const aborted =
      e instanceof DOMException && e.name === "AbortError";
    return {
      available: false,
      reason: "offline",
      message: aborted
        ? "El asistente no respondió. ¿Está abierta la ventana negra?"
        : "Asistente apagado. Abre start-windows.bat y deja la ventana abierta; luego Buscar.",
    };
  }
}
