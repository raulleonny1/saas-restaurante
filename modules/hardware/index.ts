/**
 * Hardware bridges — escalas y apps nativas (Fase 8).
 * Stub estable: el SaaS web no depende de Capex/stores.
 * Implementaciones reales viven en un proyecto companion (TWA / Capacitor / bridge USB).
 */

export type ScaleReading = {
  grams: number;
  stable: boolean;
  unit: "g" | "kg";
  raw?: string;
  at: string;
};

export type ScaleBridgeStatus =
  | "unsupported"
  | "disconnected"
  | "connecting"
  | "ready"
  | "error";

export interface ScaleBridge {
  status: ScaleBridgeStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Lectura puntual; null si no hay hardware. */
  readOnce(): Promise<ScaleReading | null>;
  /** Suscripción a peso estable (HID / serial via companion app). */
  subscribe(onReading: (r: ScaleReading) => void): () => void;
}

/** Stub: sin Web Serial / companion → siempre unsupported. */
export function createBrowserScaleBridge(): ScaleBridge {
  return {
    status: "unsupported",
    async connect() {
      /* no-op: requiere bridge nativo */
    },
    async disconnect() {
      /* no-op */
    },
    async readOnce() {
      return null;
    },
    subscribe() {
      return () => undefined;
    },
  };
}

export type NativeAppTarget = "twa" | "capacitor" | "react_native";

export const NATIVE_APP_ROADMAP: {
  target: NativeAppTarget;
  purpose: string;
  blockedBy: string;
}[] = [
  {
    target: "twa",
    purpose: "PWA empaquetada (mesero/caja) para Play Store",
    blockedBy: "Core web estable + assets store",
  },
  {
    target: "capacitor",
    purpose: "Plugins impresión / Bluetooth / cámara barcode",
    blockedBy: "Proyecto companion aparte del monorepo web",
  },
  {
    target: "react_native",
    purpose: "Repartidor offline-first (opcional)",
    blockedBy: "Tras delivery web (/delivery) maduro",
  },
];

export function isNativeCompanionAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as { SmartServeNative?: unknown }).SmartServeNative,
    )
  );
}
