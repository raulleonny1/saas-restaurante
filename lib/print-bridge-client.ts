/** Cliente del asistente local que lista impresoras instaladas en el PC. */

export const PRINT_BRIDGE_URL = "http://127.0.0.1:17891";
export const PRINT_BRIDGE_URL_ALT = "http://localhost:17891";
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
  | { available: false; reason: "offline" | "error" | "popup_blocked"; message?: string };

const BRIDGE_ORIGINS = new Set([
  "http://127.0.0.1:17891",
  "http://localhost:17891",
]);

function normalizePrinters(raw: unknown): InstalledPrinter[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? [raw]
      : [];
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
  base: string,
  path: string,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${base}${path}`, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: ctrl.signal,
    });
  } finally {
    window.clearTimeout(t);
  }
}

async function tryFetchPrinters(
  timeoutMs: number,
): Promise<PrinterBridgeStatus | null> {
  for (const base of [PRINT_BRIDGE_URL, PRINT_BRIDGE_URL_ALT]) {
    try {
      const res = await bridgeFetch(base, "/printers", timeoutMs);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        ok?: boolean;
        printers?: unknown;
        error?: string;
        version?: string;
      };
      if (data.ok === false) continue;
      return {
        available: true,
        printers: normalizePrinters(data.printers),
        version: data.version,
      };
    } catch {
      /* probar siguiente base o popup */
    }
  }
  return null;
}

/**
 * El navegador (sobre todo HTTPS/Vercel) a veces bloquea fetch a 127.0.0.1.
 * Abrimos una ventana del propio asistente (misma máquina) y recibimos la
 * lista por postMessage — eso sí funciona con el asistente encendido.
 */
function listPrintersViaPopup(timeoutMs = 12_000): Promise<PrinterBridgeStatus> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve({
        available: false,
        reason: "offline",
        message: "Solo disponible en el navegador",
      });
      return;
    }

    const origin = window.location.origin;
    // /discover?origin=...  (asistente v1.2+). Si ves JSON not_found,
    // tienes el asistente VIEJO: cierra y vuelve a abrir start-windows.bat nuevo.
    const url =
      `${PRINT_BRIDGE_URL}/discover?origin=${encodeURIComponent(origin)}` +
      `&t=${Date.now()}`;

    const popup = window.open(
      url,
      "smartserve-printers",
      "width=420,height=320,menubar=no,toolbar=no,noopener=no",
    );

    if (!popup) {
      resolve({
        available: false,
        reason: "popup_blocked",
        message:
          "El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio y pulsa Buscar otra vez.",
      });
      return;
    }

    let done = false;
    const finish = (result: PrinterBridgeStatus) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      try {
        popup.close();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (!BRIDGE_ORIGINS.has(event.origin)) return;
      const data = event.data as {
        type?: string;
        ok?: boolean;
        printers?: unknown;
        error?: string;
        version?: string;
      };
      if (!data || data.type !== "smartserve-printers") return;
      if (data.ok === false) {
        finish({
          available: false,
          reason: "error",
          message:
            data.error ||
            "El asistente no pudo leer impresoras. Reinicia start-windows.bat",
        });
        return;
      }
      finish({
        available: true,
        printers: normalizePrinters(data.printers),
        version: data.version,
      });
    };

    window.addEventListener("message", onMessage);

    const timer = window.setTimeout(() => {
      finish({
        available: false,
        reason: "offline",
        message:
          "Sin respuesta. Si la ventanita mostró {\"error\":\"not_found\"}: cierra la ventana negra, descarga OTRA VEZ start-windows.bat + el .ps1, ábrelos (debe decir v1.2.1) y pulsa Buscar.",
      });
    }, timeoutMs);
  });
}

export async function checkPrintBridge(
  timeoutMs = 2500,
): Promise<boolean> {
  for (const base of [PRINT_BRIDGE_URL, PRINT_BRIDGE_URL_ALT]) {
    try {
      const res = await bridgeFetch(base, "/health", timeoutMs);
      if (res.ok) return true;
    } catch {
      /* siguiente */
    }
  }
  return false;
}

/**
 * Lista impresoras: primero fetch directo; si Chrome lo bloquea
 * (muy habitual en HTTPS), usa ventana local del asistente.
 */
export async function listInstalledPrinters(
  timeoutMs = 6000,
): Promise<PrinterBridgeStatus> {
  const viaFetch = await tryFetchPrinters(timeoutMs);
  if (viaFetch) return viaFetch;
  return listPrintersViaPopup(12_000);
}
