"use client";

import { cn } from "@/lib/cn";
import { create } from "zustand";

type ToastTone = "info" | "success" | "error";

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, tone = "info") => {
    const id = `${Date.now()}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative toast helper — mount `<ToastViewport />` once in providers. */
export function toast(message: string, tone: ToastTone = "info") {
  useToastStore.getState().push(message, tone);
}

/**
 * Organism — fixed toast stack viewport (light/dark via elevated surface tokens).
 */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn(
            "pointer-events-auto rounded-[14px] border px-4 py-3 text-left text-sm shadow-[var(--shadow)] animate-fade-up",
            t.tone === "success" && "border-accent bg-accent-soft text-fg",
            t.tone === "error" && "border-danger bg-[color-mix(in_oklab,var(--danger)_14%,var(--bg-elevated))] text-fg",
            t.tone === "info" && "border-border bg-bg-elevated text-fg",
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
