"use client";

import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { Button } from "@/ui/atoms/Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
};

/**
 * Organism — dialog overlay. Escape closes; focus ring uses `--ring`.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center animate-fade-in">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-5 shadow-[var(--shadow-lg)] animate-scale-in sm:p-6",
          sizes[size],
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-title">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-fg-muted">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar modal">
            <X className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
        <div>{children}</div>
        {footer ? (
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
