"use client";

import { parseTableQr } from "@/modules/waiter/domain/qr";
import { useEffect, useRef, useState } from "react";

type BarcodeDetectorLike = {
  detect: (
    source: ImageBitmapSource,
  ) => Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: {
      formats?: string[];
    }) => BarcodeDetectorLike;
  }
}

export function QrScanner({
  onDetect,
}: {
  onDetect: (tableId: string, raw: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [supported, setSupported] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let detector: BarcodeDetectorLike | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setSupported(false);
        setError("Cámara no disponible en este dispositivo.");
        return;
      }
      if (!window.BarcodeDetector) {
        setSupported(false);
        setError(
          "Escaneo automático no soportado. Introduce el código de la mesa.",
        );
        return;
      }
      try {
        detector = new window.BarcodeDetector({
          formats: ["qr_code"],
        });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setScanning(true);
        setError(null);

        const tick = async () => {
          if (stopped || !detector || !video) return;
          if (video.readyState >= 2) {
            try {
              const codes = await detector.detect(video);
              const raw = codes[0]?.rawValue;
              if (raw) {
                const tableId = parseTableQr(raw);
                if (tableId) {
                  onDetect(tableId, raw);
                  return;
                }
              }
            } catch {
              /* frame skip */
            }
          }
          raf = window.requestAnimationFrame(() => {
            void tick();
          });
        };
        void tick();
      } catch (e) {
        setSupported(false);
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo abrir la cámara. Usa el código manual.",
        );
      }
    }

    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      setScanning(false);
    };
  }, [onDetect]);

  function submitManual() {
    const tableId = parseTableQr(manual);
    if (!tableId) {
      setError("Código no válido. Usa ss:table:ID o el id de mesa.");
      return;
    }
    onDetect(tableId, manual.trim());
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[3/4] max-h-[55vh] overflow-hidden rounded-2xl border border-white/15 bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {!scanning ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-sm text-white/80">
            {supported ? "Iniciando cámara…" : "Escáner no disponible"}
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-48 w-48 rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-amber-300">{error}</p>
      ) : (
        <p className="text-xs text-[#8fa08c]">
          Apunta al QR de la mesa. Formato: ss:table:ID
        </p>
      )}

      <div className="flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Código o id de mesa"
          className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={submitManual}
          className="rounded-xl bg-emerald-700 px-4 text-sm font-medium"
        >
          Ir
        </button>
      </div>
    </div>
  );
}
